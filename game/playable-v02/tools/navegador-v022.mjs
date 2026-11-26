#!/usr/bin/env node
// Aceitação da V02.2 no Chrome real: perfis, regras, interrupção/retomada, troca de perfil e de câmera,
// combate autônomo, save/restore e desempenho. Cliques na interface; `ordenarTeste` só fixa o destino da patrulha
// perigosa (a mesma função dos botões de ordem) para o cenário ser reproduzível (semente 1).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const PORTA = 5213, saida = new URL('../resultados/v022/', import.meta.url);
await mkdir(saida, { recursive: true });
const servidor = spawn(process.execPath, [fileURLToPath(new URL('../../playable-v01/tools/servir.mjs', import.meta.url)), '--porta', String(PORTA)], { stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'] });
const R = { data: new Date().toISOString(), erros: [], falhas: [], etapas: {} };
try {
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  page.on('pageerror', (e) => R.erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') R.erros.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) R.falhas.push({ url: r.url(), status: r.status() }); });
  const ler = (f, a) => page.evaluate(f, a);
  const foto = (n) => page.screenshot({ path: fileURLToPath(new URL(n, saida)) });
  const esperar = async (cond, ms, a) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await ler(cond, a)) return true; await page.waitForTimeout(500); } return false; };
  const cartao = (id) => page.locator(`.cartao[data-id="${id}"]`);
  const decisoes = (id) => ler((id) => wildhaven2.decisoes(id).map((d) => ({ t: d.t, regra: d.regra, motivo: d.motivo })), id);

  await page.goto(`http://127.0.0.1:${PORTA}/game/playable-v02/?semente=1`);
  await page.waitForSelector('#novaDemo:not([hidden])', { timeout: 180000 });
  await page.click('#novaDemo'); await page.waitForSelector('#esquadrao .cartao'); await page.waitForTimeout(800);
  // 2. Cada Hunter com seu perfil, visível no painel ao selecionar o cartão.
  const perfis = {};
  for (const id of ['arvo', 'brena', 'caio', 'dara']) { await cartao(id).click(); perfis[id] = await page.inputValue('#perfil'); }
  R.etapas.perfis = perfis;
  assert.deepEqual(perfis, { arvo: 'agressivo', brena: 'equilibrado', caio: 'cauteloso', dara: 'equilibrado' });

  // 1. Quatro tarefas independentes: Arvo patrulha a vila, Brena descansa, Dara fica na vila (botões); Caio patrulha perto
  // da toca (cenário fixo). A caçada de Arvo e Brena vem depois, para o Caio encontrar o Varrisco vivo.
  await page.click('[data-vel="0"]');
  await cartao('arvo').click(); await page.click('[data-ordem="patrulhar"]');
  await cartao('brena').click(); await page.click('[data-ordem="descansar"]');
  await cartao('dara').click(); await page.click('[data-ordem="vila"]');
  await ler(() => { const j = wildhaven2.jogo; wildhaven2.ordenarTeste(['caio'], { tipo: 'patrulhar', centro: { x: j.toca.x, y: j.toca.y + 70 }, raio: 40 }); });
  await cartao('caio').dblclick();
  R.etapas.tarefas = await ler(() => wildhaven2.todos().map((h) => [h.id, h.tarefa?.tipo, wildhaven2.jogo.hunters.get(h.id).atual?.pontos?.[0] ?? null]));
  assert.ok(R.etapas.tarefas.every(([, t]) => t), 'os quatro com tarefa');
  const [pa, pc] = ['arvo', 'caio'].map((id) => R.etapas.tarefas.find((x) => x[0] === id)[2]);
  assert.ok(Math.hypot(pa.x - pc.x, pa.y - pc.y) > 200, 'patrulhas em áreas diferentes');
  await page.click('[data-vel="8"]');

  // 5. Interrupção por ameaça (cauteloso), com motivo real.
  assert.ok(await esperar(() => wildhaven2.decisoes('caio').some((d) => d.regra === 'evitar'), 120000), 'Caio interrompeu a patrulha');
  await page.click('[data-vel="1"]'); await page.waitForTimeout(1200);
  await foto('v022-01-interrupcao-cauteloso.png');
  const antes = await ler(() => ({ ...wildhaven2.estado('caio'), interrupcao: wildhaven2.interrupcao('caio') }));
  // 8. Troca de câmera durante a interrupção: nada reinicia.
  await cartao('arvo').dblclick(); await page.waitForTimeout(1500);
  const depois = await ler(() => ({ ...wildhaven2.estado('caio'), interrupcao: wildhaven2.interrupcao('caio') }));
  assert.equal(depois.tarefa.inicio, antes.tarefa.inicio); assert.deepEqual(depois.interrupcao, antes.interrupcao);
  // 6. Retomada quando a ameaça sai da percepção.
  await page.click('[data-vel="8"]');
  assert.ok(await esperar(() => { const d = wildhaven2.decisoes('caio'), i = d.findIndex((x) => x.regra === 'evitar'); return d.slice(i + 1).some((x) => x.regra === 'retomar'); }, 120000), 'Caio retomou');
  const dc = await decisoes('caio');
  R.etapas.cauteloso = dc;
  const st = await ler(() => wildhaven2.estado('caio'));
  assert.equal(st.tarefa?.inicio ?? antes.tarefa.inicio, antes.tarefa.inicio, 'mesma patrulha (ou abandonada pelo limite do perfil)');

  // 7. Troca de perfil pela interface sem perder tarefa e fila.
  await cartao('caio').click();
  const t0 = await ler(() => wildhaven2.estado('caio'));
  await page.selectOption('#perfil', 'agressivo');
  const t1 = await ler(() => wildhaven2.estado('caio'));
  assert.equal(await ler(() => wildhaven2.perfil('caio')), 'agressivo');
  assert.equal(t1.tarefa?.tipo, t0.tarefa?.tipo); assert.equal(t1.tarefa?.inicio, t0.tarefa?.inicio); assert.equal(t1.fila, t0.fila);
  assert.ok((await decisoes('caio')).some((d) => /Perfil alterado: Cauteloso → Agressivo/.test(d.motivo)));
  await page.locator('#ia details summary').click(); await page.waitForTimeout(300);
  await foto('v022-02-painel-perfil-regras.png');

  // 10. Combate autônomo contra o Varrisco, com decisões registradas: Arvo e Brena recebem a caçada pelo botão.
  await cartao('arvo').click(); await cartao('brena').click({ modifiers: ['Control'] }); await page.click('[data-ordem="cacar"]');
  await cartao('arvo').dblclick(); for (let k = 0; k < 6; k++) { await page.mouse.move(800, 450); await page.mouse.wheel(0, -400); }
  assert.ok(await esperar(() => { const v = wildhaven2.varrisco(); return !v.vivo || ['arvo', 'brena', 'caio'].every((id) => ['incapacitado', 'morto'].includes(wildhaven2.estado(id).situacao)); }, 300000), 'caçada com desfecho');
  // Quem chega primeiro ao Varrisco varia (Caio, já agressivo, pode estar mais perto): vale qualquer um dos três.
  R.etapas.combate = { varrisco: await ler(() => wildhaven2.varrisco()), arvo: await decisoes('arvo'), brena: await decisoes('brena'), caio: await decisoes('caio') };
  assert.ok([...R.etapas.combate.arvo, ...R.etapas.combate.brena, ...R.etapas.combate.caio].some((d) => ['enfrentar', 'defesa'].includes(d.regra)), 'decisões de combate registradas');
  assert.ok(await ler(() => wildhaven2.jogo.m.eventos.some((e) => e.tipo === 'ferimento' && e.id === 'varrisco-real')), 'Hunters feriram o Varrisco sozinhos');
  await page.click('[data-f="decisao"]'); await page.waitForTimeout(400);
  await foto('v022-03-decisoes-combate.png');

  // 9. Salvar e restaurar mantendo perfis, regra ativa, decisões e ordens.
  await page.click('[data-vel="0"]');
  const salvo = await ler(() => Object.fromEntries(['arvo', 'brena', 'caio', 'dara'].map((id) => [id, { perfil: wildhaven2.perfil(id), regra: wildhaven2.regraAtiva(id), n: wildhaven2.decisoes(id).length, tarefa: wildhaven2.estado(id).tarefa?.tipo ?? null }])));
  await page.click('#btnSalvar'); await page.waitForTimeout(800); await page.reload();
  await page.waitForSelector('#continuarSave:not([hidden])', { timeout: 180000 }); await page.click('#continuarSave'); await page.waitForSelector('#esquadrao .cartao'); await page.waitForTimeout(800);
  const rest = await ler(() => Object.fromEntries(['arvo', 'brena', 'caio', 'dara'].map((id) => [id, { perfil: wildhaven2.perfil(id), regra: wildhaven2.regraAtiva(id), n: wildhaven2.decisoes(id).length, tarefa: wildhaven2.estado(id).tarefa?.tipo ?? null }])));
  R.etapas.salvarRestaurar = { salvo, rest };
  assert.deepEqual(rest, salvo);
  await foto('v022-04-restaurado.png');

  // Desempenho comparável com a V02 (mesmo método: 11 s a 1× e 11 s a 8×, câmera acompanhando um Hunter).
  await cartao('dara').dblclick();
  await page.click('[data-vel="1"]'); await page.waitForTimeout(11000); R.desempenho1x = await ler(() => wildhaven2.medir());
  await page.click('[data-vel="8"]'); await page.waitForTimeout(11000); R.desempenho8x = await ler(() => wildhaven2.medir());
  assert.deepEqual(R.erros, []); assert.deepEqual(R.falhas, []);
  R.ok = true;
} catch (e) { R.ok = false; R.falha = String(e.stack ?? e); console.error(e); }
finally {
  await writeFile(new URL('navegador-v022.json', saida), JSON.stringify(R, null, 1));
  await browser.close(); servidor.kill();
  console.log(R.ok ? 'V02.2 no navegador: OK' : 'V02.2 no navegador: FALHOU');
  process.exitCode = R.ok ? 0 : 1;
}
