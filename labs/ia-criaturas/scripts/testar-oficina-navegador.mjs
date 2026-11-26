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
  assert.deepEqual(erros, [], 'Erros JavaScript na interface: ' + JSON.stringify(erros));
  console.log(JSON.stringify({ aprovado: true, ...r, capturas: '/tmp/wildhaven-oficina-smoke.png' }, null, 2));
} finally {
  await navegador?.close();
  srv.kill('SIGTERM');
}
