#!/usr/bin/env node
// Smoke test real (Playwright): só executa quando Playwright/Chromium estão disponíveis.
// Roda o servidor do laboratório, abre a oficina e lê o GLB real do Arenoceto.
// Não modifica Alpha, mapa oficial, GLBs ou configurações persistidas do repositório.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as esperar } from 'node:timers/promises';
import { chromium } from 'playwright';

const porta = Number(process.env.PORTA_SMOKE ?? 5186);
const srv = spawn(process.execPath, ['scripts/servidor.mjs', '--porta', String(porta)], {
  cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe']
});
const log = [];
srv.stdout.on('data', (b) => log.push(String(b)));
srv.stderr.on('data', (b) => log.push(String(b)));
let navegador;
try {
  let subiu = false;
  for (let i = 0; i < 100; i++) {
    if (log.join('').includes('http://localhost:' + porta + '/')) { subiu = true; break; }
    if (srv.exitCode !== null) throw new Error('Servidor terminou: ' + log.join(''));
    await esperar(100);
  }
  if (!subiu) throw new Error('Servidor não iniciou: ' + log.join(''));
  navegador = await chromium.launch({
    headless: true, args: ['--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await contexto.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto('http://127.0.0.1:' + porta + '/ecossistema.html?cenario=disputa-presa&semente=5', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.ecoDemo?.mundo?.vivos?.length > 0, { timeout: 60000 });
  await page.locator('#oficina summary').click();
  await page.waitForFunction(() =>
    document.querySelector('#of-status')?.textContent?.includes('modelos GLB disponíveis'), { timeout: 60000 });
  await page.locator('#of-busca').fill('arenoceto-v02-skinned-animated-LOD0.glb');
  const id = await page.locator('#of-catalogo option').first().getAttribute('value');
  assert.ok(id?.startsWith('cat_'), 'Arenoceto não apareceu no catálogo');
  await page.locator('#of-catalogo').selectOption(id);
  assert.equal(await page.locator('#of-modo').inputValue(), 'subterraneo_areia',
    'Manifest do Arenoceto não foi lido para propor locomoção na areia');
  await page.locator('#of-auditar').click();
  await page.waitForFunction(() => document.querySelector('#of-relatorio')?.textContent?.trim()?.startsWith('{'), { timeout: 60000 });
  const diag = JSON.parse(await page.locator('#of-relatorio').textContent());
  assert.ok(diag.encontrados.includes('swim_sand'), 'Clipe real swim_sand não identificado');
  assert.ok(diag.encontrados.includes('dive'), 'Clipe real dive não identificado');
  assert.ok(diag.geometria.malhasComSkin >= 1, 'GLB real sem skin');
  assert.equal(diag.problemas.length, 0, JSON.stringify(diag.problemas));
  await page.locator('#of-proxy').check();
  await page.locator('#of-quantidade').fill('2');
  await page.locator('#of-salvar').click();
  await page.locator('#of-pre-nome').fill('Teste real do Arenoceto');
  await page.locator('#of-pre-salvar').click();
  await page.locator('#of-aplicar').click();
  await page.waitForFunction((id) => window.ecoDemo?.mundo?.vivos?.some((a) => a.especie.id === id), id, { timeout: 60000 });
  const r = await page.evaluate((id) => ({
    animais: window.ecoDemo.mundo.vivos.filter((x) => x.especie.id === id).length,
    perfil: window.ecoDemo.mundo.config.especies[id].perfilLocomocao,
    glb: window.ecoDemo.modelosCarregados().find((x) => x.id === id)
  }), id);
  assert.equal(r.animais, 2);
  assert.equal(r.perfil.simulacao, 'proxy_superficie');
  assert.ok(r.glb.clipes >= 20);
  await page.screenshot({ path: '/tmp/wildhaven-oficina-smoke.png', fullPage: true });

  // ---- IA Base V1: o cenário integrado no navegador real, não só a Oficina.
  // Mede o que só o navegador prova: GLB carregado por espécie, animação e movimento acontecendo,
  // combate/voo/carcaça exercitados e reinício de cenário sem erro no console.
  const erroConsole = [];
  page.on('console', (m) => { if (m.type() === 'error') erroConsole.push(m.text().slice(0, 180)); });
  await page.goto('http://127.0.0.1:' + porta + '/ecossistema.html?cenario=ia-base-v1-integracao&semente=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.ecoDemo?.mundo?.vivos?.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => window.ecoDemo.modelosCarregados().length >= 11, { timeout: 120000 });
  const base = await page.evaluate(() => {
    const d = window.ecoDemo, m = d.mundo;
    const antes = m.vivos.map((a) => [a.id, a.x, a.y]);
    d.avancar(200);
    const depois = new Map(m.vivos.map((a) => [a.id, [a.x, a.y]]));
    const mexeu = antes.filter(([id, x, y]) => { const p = depois.get(id); return p && (Math.abs(p[0] - x) > 1 || Math.abs(p[1] - y) > 1); }).length;
    const naN = m.animais.filter((a) => !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z) || !Number.isFinite(a.saude.hp)).map((a) => a.id);
    return {
      especies: [...new Set(m.vivos.map((a) => a.especie.id))].length,
      glbs: d.modelosCarregados().filter((g) => g.clipes > 0).length,
      mexeu, naN, falhas: m.metricas.falhas.length,
      ev: m.metricas.eventos, animacao: typeof d.quadros === 'function',
    };
  });
  assert.ok(base.especies >= 11, 'o cenário integrado não subiu com as 11 espécies: ' + base.especies);
  assert.ok(base.glbs >= 11, 'nem todo GLB do cenário carregou com clipes: ' + base.glbs);
  assert.ok(base.mexeu >= 5, 'quase ninguém se moveu em 200 s: ' + base.mexeu);
  assert.deepEqual(base.naN, [], 'coordenada ou HP inválido no navegador');
  assert.equal(base.falhas, 0, 'o mundo registrou reação sem percepção');
  assert.ok((base.ev.decolagem ?? 0) > 0 && (base.ev.pouso ?? 0) > 0, 'voadores não decolaram/pousaram');
  assert.ok((base.ev.ataque_inicio ?? 0) > 0, 'nenhum ataque no cenário integrado');
  // Reinício de cenário: troca para as dunas e confere que o mundo novo sobe inteiro.
  const dunas = await page.evaluate(async () => {
    await window.ecoDemo.reiniciar('ia-base-v1-integracao-dunas', 4);
    await new Promise((r) => setTimeout(r, 4000));
    const d = window.ecoDemo, m = d.mundo;
    d.avancar(260);
    return { cenario: m.cenarioId, vivos: m.vivos.length, glbs: d.modelosCarregados().filter((g) => g.clipes > 0).length,
      mergulhos: m.metricas.eventos.mergulho_inicio ?? 0, engoliu: m.metricas.eventos.engolir_fim ?? 0, falhas: m.metricas.falhas.length };
  });
  assert.equal(dunas.cenario, 'ia-base-v1-integracao-dunas');
  assert.ok(dunas.vivos > 0 && dunas.glbs >= 6, 'o cenário das dunas não subiu inteiro');
  assert.ok(dunas.mergulhos > 0, 'ninguém mergulhou na areia');
  assert.equal(dunas.falhas, 0);
  // Só a viewport: a cena das dunas (600 x 600 m) com renderização por software estoura os 30 s padrão
  // do Playwright se a captura for de página inteira.
  await page.screenshot({ path: '/tmp/wildhaven-ia-base-v1-smoke.png', timeout: 60000 });
  assert.deepEqual(erroConsole, [], 'Erros no console durante o cenário integrado: ' + JSON.stringify(erroConsole.slice(0, 3)));

  assert.deepEqual(erros, [], 'Erros JavaScript na interface: ' + JSON.stringify(erros));
  console.log(JSON.stringify({ aprovado: true, ...r, iaBaseV1: base, dunas, capturas: ['/tmp/wildhaven-oficina-smoke.png', '/tmp/wildhaven-ia-base-v1-smoke.png'] }, null, 2));
} finally {
  await navegador?.close();
  srv.kill('SIGTERM');
}
