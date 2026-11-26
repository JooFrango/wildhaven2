#!/usr/bin/env node
// Aceitação da V02 num Chrome real: tudo por cliques na interface (cartões, botões de ordem, mapa, terreno).
// A API window.wildhaven2 só é LIDA (estado, câmera, medição), exceto `velocidade` (o mesmo que os botões 1×–8×).
// Uso: node tools/navegador.mjs   →  resultados/navegador.json + capturas PNG
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const PORTA = 5212, URL0 = `http://127.0.0.1:${PORTA}/game/playable-v02/`, saida = new URL('../resultados/', import.meta.url);
await mkdir(saida, { recursive: true });
const servidor = spawn(process.execPath, [fileURLToPath(new URL('../../playable-v01/tools/servir.mjs', import.meta.url)), '--porta', String(PORTA)], { stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'] });
const R = { data: new Date().toISOString(), erros: [], falhas: [], etapas: {} };
const foto = (page, nome) => page.screenshot({ path: fileURLToPath(new URL(nome, saida)) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') R.erros.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) R.falhas.push({ url: r.url(), status: r.status() }); });
  const ler = (f, a) => page.evaluate(f, a);
  const todos = () => ler(() => wildhaven2.todos());
  const esperar = async (cond, ms, passo = 1000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await ler(cond)) return true; await page.waitForTimeout(passo); } return false; };
  const cartao = (id) => page.locator(`.cartao[data-id="${id}"]`);
  const ordem = (o) => page.click(`[data-ordem="${o}"]`);
  async function clicarHexNoMapa(hex) {
    const p = await ler((hex) => { const G = wildhaven2.jogo.G, t = G.porId.get(hex), c = document.getElementById('mapaCanvas'), r = c.getBoundingClientRect();
      const xs = G.tiles.map((t) => t.cx), ys = G.tiles.map((t) => t.cy), minX = Math.min(...xs) - 3000, maxX = Math.max(...xs) + 3000, minY = Math.min(...ys) - 3000, maxY = Math.max(...ys) + 3000;
      const s = Math.min(c.width / (maxX - minX), c.height / (maxY - minY)), k = r.width / c.width; return { x: r.left + (t.cx - minX) * s * k, y: r.top + (t.cy - minY) * s * k }; }, hex);
    await page.mouse.click(p.x, p.y);
  }

  // 1. Abrir: tela inicial → nova demonstração → câmera estratégica.
  await page.goto(URL0);
  await page.waitForSelector('#novaDemo:not([hidden])', { timeout: 180000 });
  await page.click('#novaDemo');
  await page.waitForSelector('#esquadrao .cartao');
  await page.waitForTimeout(1500);
  const cam0 = await ler(() => wildhaven2.camera());
  R.etapas.camera = cam0;
  assert.ok(cam0.polar > 0.5 && cam0.polar < 1.2, 'câmera semi-isométrica');
  // Teclas de ação não comandam Hunter: W move a câmera; J/H/K/Espaço não geram golpe.
  const antes = await todos();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  for (const k of ['KeyJ', 'KeyH', 'KeyK']) await page.keyboard.press(k);
  const cam1 = await ler(() => wildhaven2.camera()), depois = await todos();
  assert.notDeepEqual(cam1.alvo, cam0.alvo, 'W desloca a câmera');
  for (const h of depois) { assert.equal(h.controle, 'ia'); assert.ok(Math.hypot(h.x - antes.find((a) => a.id === h.id).x, h.y - antes.find((a) => a.id === h.id).y) < 1.5, `${h.id} não andou pelo teclado`); }
  R.etapas.semControleManual = true;
  await foto(page, 'v02-01-inicio.png');

  // 2–3. Seleção e ordens pela interface: dois caçam (seleção múltipla), um explora (mapa), um fica na vila.
  await cartao('arvo').click(); await cartao('brena').click({ modifiers: ['Control'] });
  assert.deepEqual(await ler(() => [...document.querySelectorAll('.cartao.sel')].map((c) => c.dataset.id)), ['arvo', 'brena']);
  await ordem('cacar');
  await cartao('caio').click(); await ordem('explorar'); await page.waitForSelector('#mapa:not([hidden])'); await page.waitForTimeout(300);
  await foto(page, 'v02-02-mapa-ordem.png');
  await clicarHexNoMapa('HV_01');
  await cartao('dara').click(); await ordem('vila');
  const ordens = await todos();
  R.etapas.ordens = ordens.map((h) => [h.id, h.tarefa?.tipo, h.situacao]);
  assert.deepEqual(ordens.map((h) => h.tarefa?.tipo), ['cacar', 'cacar', 'explorar', 'vila']);
  await page.click('[data-vel="8"]');

  // 4–5. Observar Arvo (duplo clique) e trocar para Caio: as tarefas não reiniciam.
  await cartao('arvo').dblclick();
  assert.equal(await ler(() => wildhaven2.seguido()), 'arvo');
  await page.waitForTimeout(8000);
  const t1 = await todos();
  await cartao('caio').dblclick();
  await page.waitForTimeout(6000);
  const t2 = await todos();
  for (const id of ['arvo', 'brena', 'caio', 'dara']) {
    const a = t1.find((h) => h.id === id), b = t2.find((h) => h.id === id);
    // A mesma tarefa (mesmo instante de início) ou concluída normalmente nesse intervalo; nunca reiniciada.
    const concluiu = !b.tarefa && await ler((id) => wildhaven2.jogo.hunters.get(id).log.some((r) => /: concluída/.test(r.texto)), id);
    assert.ok(concluiu || b.tarefa?.inicio === a.tarefa?.inicio, `${id}: tarefa não reiniciou ao trocar a câmera`);
    if (a.tarefa?.i != null && b.tarefa) assert.ok(b.tarefa.i >= a.tarefa.i);
  }
  const andou = ['arvo', 'brena', 'caio'].map((id) => Math.hypot(t2.find((h) => h.id === id).x - t1.find((h) => h.id === id).x, t2.find((h) => h.id === id).y - t1.find((h) => h.id === id).y));
  R.etapas.trocaDeCamera = { seguido: await ler(() => wildhaven2.seguido()), metrosAndadosDepoisDaTroca: andou.map((d) => +d.toFixed(1)) };
  assert.ok(andou.every((d) => d > 2), 'todos continuam andando depois da troca');
  await foto(page, 'v02-03-acompanhando-caio.png');
  // Desempenho em regime: câmera acompanhando Caio, hexágonos já carregados, 11 s a 1× e 11 s a 8×.
  await page.click('[data-vel="1"]'); await page.waitForTimeout(11000); R.desempenho1x = await ler(() => wildhaven2.medir());
  await page.click('[data-vel="8"]'); await page.waitForTimeout(11000); R.desempenho8x = await ler(() => wildhaven2.medir());

  // 6. Combate observado: segue Arvo, aproxima a câmera e espera o desfecho sem tocar em nada.
  await cartao('arvo').dblclick();
  await page.mouse.move(800, 450); for (let k = 0; k < 8; k++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(60); }
  const viu = await esperar(() => wildhaven2.jogo.log.some((r) => /localizado/.test(r.texto)), 120000);
  assert.ok(viu, 'caçadores localizaram o Varrisco');
  await page.click('[data-vel="2"]'); await page.waitForTimeout(5000);
  await foto(page, 'v02-04-combate-observado.png');
  await page.click('[data-vel="8"]');
  const fim = await esperar(() => { const v = wildhaven2.varrisco(); return !v.vivo || ['arvo', 'brena'].every((id) => ['incapacitado', 'morto'].includes(wildhaven2.estado(id).situacao)); }, 240000);
  const log = await ler(() => wildhaven2.log());
  const ev = await ler(() => { const m = wildhaven2.jogo.m, v = m.animais.find((a) => a.especie.id === 'varrisco'); return { acertosHunters: m.eventos.filter((e) => e.tipo === 'ferimento' && e.id === v.id).length, golpesVarrisco: m.eventos.filter((e) => e.tipo === 'monstro_golpe').length, esquivas: m.eventos.filter((e) => e.tipo === 'esquiva').length }; });
  R.etapas.combate = { desfecho: fim, varrisco: await ler(() => wildhaven2.varrisco()), ...ev, ultimos: log.filter((r) => ['combate', 'perigo', 'morte'].includes(r.tipo)).slice(-8) };
  assert.ok(fim, 'a caçada teve desfecho'); assert.ok(ev.acertosHunters >= 3 && ev.golpesVarrisco >= 3);
  // 7. Resultado da caçada no registro.
  await page.click('[data-f="combate"]'); await page.waitForTimeout(400);
  assert.ok(log.some((r) => /abatido|incapacitado|MORTO/.test(r.texto)), 'resultado da caçada registrado');
  await foto(page, 'v02-05-resultado-cacada.png');
  await page.click('[data-f="todos"]');

  // 8. Trocar a tarefa: Caio volta à vila; Brena vai até um ponto clicado no terreno.
  await cartao('caio').click(); await ordem('voltar');
  assert.equal((await ler(() => wildhaven2.estado('caio'))).tarefa.tipo, 'voltar');
  await cartao('brena').dblclick(); await page.waitForTimeout(1200); await ordem('ir-ponto');
  { const b = await ler(() => wildhaven2.estado('brena'));
    let alvo = null;   // primeiro ponto a ~25 m da Brena que esteja na área livre da tela (fora dos painéis)
    for (const [dx, dy] of [12, 8, 20].flatMap((r) => [[-r, -r], [r, -r], [-r, r], [r, r]])) {
      const p = await ler(([x, y]) => wildhaven2.paraTela(x, y), [b.x + dx, b.y + dy]);
      if (p.x > 380 && p.x < 1260 && p.y > 70 && p.y < 760) { alvo = p; break; }
    }
    assert.ok(alvo, 'ponto visível para clicar'); await page.mouse.click(alvo.x, alvo.y); }
  const brena = await ler(() => wildhaven2.estado('brena'));
  R.etapas.trocaDeTarefa = { caio: 'voltar', brena: brena.tarefa?.tipo ?? brena.situacao };
  if (brena.situacao !== 'morto' && brena.situacao !== 'incapacitado') assert.equal(brena.tarefa?.tipo, 'ir');

  // Navegação entre hexágonos: Dara vai a ER_25 pela rota; sai da região detalhada andando.
  await cartao('dara').click(); await ordem('ir-hex'); await page.waitForSelector('#mapa:not([hidden])'); await clicarHexNoMapa('ER_25');
  const viajou = await esperar(() => wildhaven2.estado('dara').modo === 'estrategico', 120000);
  assert.ok(viajou, 'Dara passou à viagem simplificada');
  await page.waitForTimeout(3000);
  await ler(() => wildhaven2.velocidade(8)); await page.waitForTimeout(10000); R.desempenhoViagem8x = await ler(() => wildhaven2.medir());
  await page.keyboard.press('KeyM'); await page.waitForTimeout(400); await foto(page, 'v02-06-rota-continental.png'); await page.keyboard.press('KeyM');
  await cartao('dara').dblclick(); await page.waitForTimeout(1500); await foto(page, 'v02-07-viagem-simplificada.png');

  // 9. Salvar, recarregar e restaurar.
  await page.click('[data-vel="0"]');
  const salvo = await todos(), tSalvo = await ler(() => wildhaven2.jogo.m.t);
  await page.click('#btnSalvar'); await page.waitForTimeout(800);
  await page.reload();
  await page.waitForSelector('#continuarSave:not([hidden])', { timeout: 180000 });
  await page.click('#continuarSave'); await page.waitForSelector('#esquadrao .cartao'); await page.waitForTimeout(800);
  const restaurado = await todos(), tRest = await ler(() => wildhaven2.jogo.m.t);
  R.etapas.salvarRestaurar = { tSalvo, tRest, hunters: restaurado.map((h) => [h.id, h.modo, h.tarefa?.tipo, +h.hp.toFixed(1)]) };
  assert.equal(tRest, tSalvo, 'restaurado no mesmo instante, pausado: sem progresso offline');
  for (const a of salvo) { const b = restaurado.find((h) => h.id === a.id); assert.equal(b.modo, a.modo); assert.equal(b.tarefa?.tipo, a.tarefa?.tipo); assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 2, a.id); assert.ok(Math.abs(a.hp - b.hp) < 1e-6); }
  await page.click('[data-vel="4"]'); await page.waitForTimeout(4000);
  assert.ok((await ler(() => wildhaven2.jogo.m.t)) > tRest, 'a simulação continua após restaurar');
  R.desempenho = await ler(() => wildhaven2.medir());
  await foto(page, 'v02-08-restaurado.png');
  assert.deepEqual(R.erros, []); assert.deepEqual(R.falhas, []);
  R.ok = true;
} catch (e) { R.ok = false; R.falha = String(e.stack ?? e); console.error(e); }
finally {
  await writeFile(new URL('navegador.json', saida), JSON.stringify(R, null, 1));
  await browser.close(); servidor.kill();
  console.log(JSON.stringify(R.etapas, null, 1).slice(0, 3000));
  console.log(R.ok ? 'V02 no navegador: OK' : 'V02 no navegador: FALHOU (resultados/navegador.json)');
  process.exitCode = R.ok ? 0 : 1;
}
