#!/usr/bin/env node
// Sessão de jogo automatizada num Chrome real (playwright-core + Chrome do sistema, GPU da máquina).
// O "jogador" aperta as mesmas teclas que uma pessoa (eventos de teclado na página); nada é chamado na simulação,
// exceto o teleporte até o Varrisco e o giro da câmera (os testes não têm mouse nem 8 min para andar).
// Uso: node tools/navegador.mjs [--dir dist] [--sementes 1,2,3]   →  resultados/navegador.json + capturas PNG
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORTA = 5211, saida = new URL('../resultados/', import.meta.url);
await mkdir(saida, { recursive: true });
const servidor = spawn(process.execPath, [fileURLToPath(new URL('servir.mjs', import.meta.url)), '--porta', String(PORTA), ...(arg('dir') ? ['--dir', arg('dir')] : [])], { stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ headless: arg('headless', '1') === '1', executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'] });
const relatorio = { data: new Date().toISOString(), dir: arg('dir') ?? 'repositório', erros: [], falhas: [], sessoes: [], travessia: null, recursos: null, desempenho: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => relatorio.erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') relatorio.erros.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) relatorio.falhas.push({ url: r.url(), status: r.status() }); });
  await page.goto(`http://127.0.0.1:${PORTA}/game/playable-v01/`);
  await page.waitForSelector('#entrar:not([hidden])', { timeout: 180000 });
  await page.screenshot({ path: fileURLToPath(new URL('01-carregado.png', saida)) });
  await page.click('#entrar');
  await page.waitForTimeout(1500);
  const estado = () => page.evaluate(() => wildhaven.estado());
  const segurar = async (codigos, ms) => { for (const c of codigos) await page.keyboard.down(c); await page.waitForTimeout(ms); for (const c of codigos) await page.keyboard.up(c); };

  // 1. Movimento manual: W + Shift a partir da vila, para o norte.
  const s0 = await estado();
  await segurar(['KeyW', 'ShiftLeft'], 3000);
  const s1 = await estado();
  assert.ok(s0.hunter.y - s1.hunter.y > 5, `W+Shift move o Hunter para o norte (${(s0.hunter.y - s1.hunter.y).toFixed(1)} m)`);
  assert.ok(s1.vigor < 90, 'correr gasta resistência');
  await page.screenshot({ path: fileURLToPath(new URL('02-vila.png', saida)) });

  // 2. Travessia: do HV_01 para FX_20/ER_18 pelo canto norte comum, andando.
  const trav = await page.evaluate(() => {
    const m = wildhaven.mundo, h = m.hunters[0], v = m.porId.get('varrisco-real');
    // Canto norte de HV_01 (local): x = 400, y = 400 (janela começa 400 m ao norte do canto). Nasce 40 m ao sul dele.
    wildhaven.teleportar(400 - v.x - 25, 430 - v.y); wildhaven.olharPara(375, 300);
    return { de: [h.x, h.y] };
  });
  await segurar(['KeyW', 'ShiftLeft'], 9000);
  const s2 = await page.evaluate(() => { const m = wildhaven.mundo, h = m.hunters[0]; return { x: h.x, y: h.y, z: h.z, hexes: wildhaven.estado().hexes }; });
  // Em qual hexágono o Hunter está: centro mais próximo (metros do mundo).
  const hexDe = (x, y) => { const X = x + 27745.825622994256, Z = y - 6650, c = { HV_01: [28145.825622994256, -3750], FX_20: [25980.762113533157, -7500], ER_18: [30310.889132455352, -7500] };
    return Object.entries(c).sort((a, b) => Math.hypot(a[1][0] - X, a[1][1] - Z) - Math.hypot(b[1][0] - X, b[1][1] - Z))[0][0]; };
  relatorio.travessia = { de: trav.de, hexInicial: hexDe(...trav.de), para: [s2.x, s2.y], hexFinal: hexDe(s2.x, s2.y), alturaFinal: s2.z };
  assert.equal(relatorio.travessia.hexInicial, 'HV_01');
  assert.notEqual(relatorio.travessia.hexFinal, 'HV_01', `atravessou a fronteira (${JSON.stringify(relatorio.travessia)})`);
  assert.ok(Number.isFinite(s2.z));
  await page.screenshot({ path: fileURLToPath(new URL('03-travessia.png', saida)) });

  // 3. Caçadas: três sementes, o jogador sintético golpeia, rola e se aproxima com as teclas.
  for (const semente of String(arg('sementes', '1,2,3')).split(',').map(Number)) {
    await page.evaluate((s) => { wildhaven.novaSessao(s); wildhaven.teleportar(0, 22); }, semente);
    const r = await page.evaluate(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms)), k = (code, t) => dispatchEvent(new KeyboardEvent(t, { code, bubbles: true }));
      const t0 = performance.now(); let i = 0, capturou = false;
      while (performance.now() - t0 < 300000) {
        const s = wildhaven.estado();
        if (s.fase !== 'explorar') break;
        const v = wildhaven.mundo.porId.get('varrisco-real'); if (v) wildhaven.olharPara(v.x, v.y);
        if (s.distancia > 2.6) { k('KeyW', 'keydown'); await w(300); k('KeyW', 'keyup'); }
        else { k(i % 5 === 4 ? 'KeyH' : 'KeyJ', 'keydown'); await w(i % 5 === 4 ? 1100 : 120); k(i % 5 === 4 ? 'KeyH' : 'KeyJ', 'keyup'); await w(450);
          if (++i % 4 === 0) { k('Space', 'keydown'); await w(100); k('Space', 'keyup'); await w(500); } }
        if (!capturou && s.registro.golpesMonstro >= 6) { capturou = true; window.__captura = true; }
      }
      return wildhaven.estado();
    });
    await page.screenshot({ path: fileURLToPath(new URL(`04-cacada-s${semente}.png`, saida)) });
    const sessao = { semente, fase: r.fase, t: r.t, resultado: r.resultado?.motivo ?? null, registro: r.registro, hpHunter: r.hunter.hp, hpVarrisco: r.varrisco.hp, clipes: r.clipes };
    // Vitória: volta à vila andando (câmera apontada para a vila, teleporte para 60 m dela).
    if (r.fase === 'voltar') {
      await page.evaluate(() => { const m = wildhaven.mundo, v = m.mortos.get('varrisco-real'), p = m.pontos.vila; wildhaven.teleportar(p.x - v.x, p.y - v.y + 60); wildhaven.olharPara(p.x, p.y); });
      for (let n = 0; n < 30 && (await estado()).fase === 'voltar'; n++) { await page.evaluate(() => { const p = wildhaven.mundo.pontos.vila; wildhaven.olharPara(p.x, p.y); }); await segurar(['KeyW', 'ShiftLeft'], 1000); }
      sessao.fase = (await estado()).fase;
    }
    sessao.telaFinal = await page.evaluate(() => !document.getElementById('fim').hidden && document.getElementById('fimTitulo').textContent);
    await page.screenshot({ path: fileURLToPath(new URL(`05-fim-s${semente}.png`, saida)) });
    relatorio.sessoes.push(sessao);
    console.log(JSON.stringify(sessao));
    assert.ok(r.registro.golpesMonstro >= 5, `semente ${semente}: Varrisco ataca`);
    assert.ok(r.registro.ferimentos >= 1 && r.registro.acertos >= 1, `semente ${semente}: dano nos dois sentidos`);
    assert.ok(sessao.telaFinal, `semente ${semente}: vitória ou derrota com tela de resultado`);
  }

  // 4. Recursos: cinco sessões novas não acumulam geometrias/texturas na GPU.
  const recursos = [];
  for (let n = 0; n < 5; n++) { await page.evaluate((s) => wildhaven.novaSessao(s), 100 + n); await page.waitForTimeout(1500); recursos.push(await page.evaluate(() => wildhaven.medir())); }
  relatorio.recursos = recursos.map((r) => ({ geometrias: r.geometrias, texturas: r.texturas, heapMB: r.heapMB }));
  assert.equal(recursos.at(-1).geometrias, recursos[0].geometrias, 'geometrias estáveis entre sessões');
  assert.equal(recursos.at(-1).texturas, recursos[0].texturas, 'texturas estáveis entre sessões');

  // 5. Desempenho medido (o relógio do quadro na página), por preset, explorando 8 s.
  for (const q of ['baixa', 'media', 'alta']) {
    await page.evaluate((q) => { wildhaven.qualidade(q); wildhaven.novaSessao(7); }, q);
    await segurar(['KeyW'], 8000);
    relatorio.desempenho.push(await page.evaluate(() => wildhaven.medir()));
  }
  console.log(JSON.stringify(relatorio.desempenho));
  assert.deepEqual(relatorio.erros, []);
  assert.deepEqual(relatorio.falhas, []);
  relatorio.ok = true;
} catch (e) {
  relatorio.ok = false; relatorio.falha = String(e.stack ?? e); console.error(e);
} finally {
  await writeFile(new URL('navegador.json', saida), JSON.stringify(relatorio, null, 1));
  await browser.close(); servidor.kill();
  console.log(relatorio.ok ? 'Sessão de navegador: OK' : 'Sessão de navegador: FALHOU (resultados/navegador.json)');
  process.exitCode = relatorio.ok ? 0 : 1;
}
