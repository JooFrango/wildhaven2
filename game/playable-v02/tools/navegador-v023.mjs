#!/usr/bin/env node
// Regiões detalhadas móveis no Chrome real: Arvo fica na vila; Brena → FX_20 (floresta), Caio → ER_18 (montanha),
// Dara → X3 (deserto; o trecho final não tem GLB validado nesta build). Ordens por cliques (cartões, botões, mapa).
// Verifica: modelo 3D na posição da simulação, terreno do hexágono carregado sob o Hunter observado, travessias,
// troca de observação sem reiniciar tarefas, salvamento com várias regiões e desempenho.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const PORTA = 5215, saida = new URL('../resultados/v023/', import.meta.url);
await mkdir(saida, { recursive: true });
const servidor = spawn(process.execPath, [fileURLToPath(new URL('../../playable-v01/tools/servir.mjs', import.meta.url)), '--porta', String(PORTA)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'] });
const R = { data: new Date().toISOString(), erros: [], falhas: [], amostras: [], observacoes: [], desempenho: {} };
try {
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  page.on('pageerror', (e) => R.erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') R.erros.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) R.falhas.push({ url: r.url(), status: r.status() }); });
  const ler = (f, a) => page.evaluate(f, a);
  const foto = (n) => page.screenshot({ path: fileURLToPath(new URL(n, saida)) });
  const cartao = (id) => page.locator(`.cartao[data-id="${id}"]`);
  async function mapaHex(hex) {
    await page.waitForSelector('#mapa:not([hidden])');
    const p = await ler((hex) => { const G = wildhaven2.jogo.G, t = G.porId.get(hex), c = document.getElementById('mapaCanvas'), r = c.getBoundingClientRect();
      const xs = G.tiles.map((t) => t.cx), ys = G.tiles.map((t) => t.cy), minX = Math.min(...xs) - 3000, maxX = Math.max(...xs) + 3000, minY = Math.min(...ys) - 3000, maxY = Math.max(...ys) + 3000;
      const s = Math.min(c.width / (maxX - minX), c.height / (maxY - minY)), k = r.width / c.width; return { x: r.left + (t.cx - minX) * s * k, y: r.top + (t.cy - minY) * s * k }; }, hex);
    await page.mouse.click(p.x, p.y);
  }
  // Coerência entre simulação e desenho do Hunter observado.
  const conferir = (id) => ler((id) => {
    const e = wildhaven2.estado(id), v = wildhaven2.vistaDe(id), hx = wildhaven2.jogo.hunters.get(id).hexAtual;
    return { id, t: wildhaven2.jogo.t, modo: e.modo, x: e.x, y: e.y, hex: hx, regiao: wildhaven2.regiaoDe(id), tarefa: e.tarefa, vista: v,
      difVista: v ? Math.hypot(v.jogo.x - e.x, v.jogo.y - e.y) : null, hexDesenhado: wildhaven2.hexesDesenhados().includes(hx) };
  }, id);

  await page.goto(`http://127.0.0.1:${PORTA}/game/playable-v02/?semente=1`);
  await page.waitForSelector('#novaDemo:not([hidden])', { timeout: 180000 });
  await page.click('#novaDemo'); await page.waitForSelector('#esquadrao .cartao', { timeout: 180000 }); await page.waitForTimeout(1000);
  await page.click('[data-vel="0"]');
  await cartao('arvo').click(); await page.click('[data-ordem="vila"]');
  for (const [id, hex] of [['brena', 'FX_20'], ['caio', 'ER_18'], ['dara', 'X3']]) { await cartao(id).click(); await page.click('[data-ordem="ir-hex"]'); await mapaHex(hex); }
  R.ordens = await ler(() => wildhaven2.todos().map((h) => [h.id, h.tarefa?.tipo, wildhaven2.jogo.hunters.get(h.id).atual?.hex ?? null]));
  assert.deepEqual(R.ordens.map((o) => o[2]), [null, 'FX_20', 'ER_18', 'X3']);
  await cartao('brena').dblclick(); await page.click('[data-vel="8"]');

  // Viagem: a cada 6 s, alterna a observação entre os quatro e confere modelo, terreno e tarefa.
  const inicio = await ler(() => Object.fromEntries(wildhaven2.todos().map((h) => [h.id, h.tarefa?.inicio ?? null])));
  const ids = ['brena', 'caio', 'dara', 'arvo'];
  const fim = Date.now() + 9 * 60000;
  let k = 0, medidoViagem = false;
  while (Date.now() < fim) {
    const id = ids[k++ % ids.length];
    await cartao(id).dblclick(); await page.waitForTimeout(6000);
    const c = await conferir(id); R.observacoes.push(c);
    if (c.modo === 'detalhado') {
      assert.ok(c.vista?.visivel, `${id}: modelo 3D presente`);
      assert.ok(c.difVista < 1.5, `${id}: modelo a ${c.difVista?.toFixed(2)} m da posição simulada`);
    }
    for (const h of ids) { const i = (await ler((h) => wildhaven2.estado(h).tarefa?.inicio ?? null, h)); if (i !== null) assert.equal(i, inicio[h], `${h}: tarefa não reiniciou`); }
    R.amostras.push(await ler(() => ({ t: wildhaven2.jogo.t, regioes: wildhaven2.regioes().map((r) => r.id + ':' + r.hunters.join('+')), hunters: wildhaven2.todos().map((h) => [h.id, Math.round(h.x), Math.round(h.y), h.modo, wildhaven2.jogo.hunters.get(h.id).hexAtual]) })));
    // Desempenho acompanhando a Brena em plena viagem (comparável à medida de 22 FPS da V02).
    if (!medidoViagem && id === 'brena' && c.hex === 'FX_20') { medidoViagem = true; await page.waitForTimeout(11000); R.desempenho.viagem8x = await ler(() => wildhaven2.medir()); }
    const s = await ler(() => ({ b: wildhaven2.jogo.hunters.get('brena'), c: wildhaven2.jogo.hunters.get('caio'), d: wildhaven2.jogo.hunters.get('dara') }));
    if (!s.b.atual && !s.c.atual && s.d.modo === 'estrategico') break;
  }
  const ult = R.amostras.at(-1);
  const h = (id) => ult.hunters.find((x) => x[0] === id);
  R.final = ult;
  assert.equal(h('brena')[4], 'FX_20'); assert.equal(h('caio')[4], 'ER_18');
  assert.ok(R.observacoes.some((o) => o.id === 'brena' && o.hex === 'FX_20' && o.hexDesenhado), 'terreno de FX_20 desenhado sob a Brena');
  assert.ok(R.observacoes.some((o) => o.id === 'caio' && o.hex === 'ER_18' && o.hexDesenhado), 'terreno de ER_18 desenhado sob o Caio');
  assert.equal(h('dara')[3], 'estrategico', 'Dara chegou ao trecho sem GLB e seguiu em viagem simplificada');
  for (const id of ['brena', 'caio', 'arvo']) { await cartao(id).dblclick(); await page.waitForTimeout(3500); await foto(`v023-observando-${id}.png`); }
  await cartao('dara').dblclick(); await page.waitForTimeout(3500); await foto('v023-observando-dara-viagem.png');
  await page.keyboard.press('KeyM'); await page.waitForTimeout(500); await foto('v023-mapa-quatro-destinos.png'); await page.keyboard.press('KeyM');

  // Desempenho estável a 1× e 8× com a câmera na Brena parada em FX_20.
  await cartao('brena').dblclick();
  await page.click('[data-vel="1"]'); await page.waitForTimeout(11000); R.desempenho.estavel1x = await ler(() => wildhaven2.medir());
  await page.click('[data-vel="8"]'); await page.waitForTimeout(11000); R.desempenho.estavel8x = await ler(() => wildhaven2.medir());

  // Salvar e restaurar com várias regiões e um Hunter em viagem.
  await page.click('[data-vel="0"]');
  const antes = await ler(() => ({ t: wildhaven2.jogo.t, regioes: wildhaven2.regioes().map((r) => r.id), hunters: wildhaven2.todos().map((h) => [h.id, h.x, h.y, h.modo, wildhaven2.regiaoDe(h.id)]) }));
  await page.click('#btnSalvar'); await page.waitForTimeout(1000); await page.reload();
  await page.waitForSelector('#continuarSave:not([hidden])', { timeout: 180000 }); await page.click('#continuarSave'); await page.waitForSelector('#esquadrao .cartao', { timeout: 180000 }); await page.waitForTimeout(1500);
  const depois = await ler(() => ({ t: wildhaven2.jogo.t, regioes: wildhaven2.regioes().map((r) => r.id), hunters: wildhaven2.todos().map((h) => [h.id, h.x, h.y, h.modo, wildhaven2.regiaoDe(h.id)]) }));
  R.salvarRestaurar = { antes, depois };
  assert.equal(depois.t, antes.t); assert.deepEqual(depois.regioes, antes.regioes);
  for (let i = 0; i < 4; i++) { const a = antes.hunters[i], b = depois.hunters[i]; assert.equal(b[3], a[3]); assert.equal(b[4], a[4]); assert.ok(Math.hypot(a[1] - b[1], a[2] - b[2]) < 0.01, a[0]); }
  await cartao('brena').dblclick(); await page.waitForTimeout(2500); await foto('v023-restaurado.png');
  assert.deepEqual(R.erros, []); assert.deepEqual(R.falhas, []);
  R.provedor = await ler(() => wildhaven2.provedor());
  R.ok = true;
} catch (e) { R.ok = false; R.falha = String(e.stack ?? e); console.error(e); }
finally {
  await writeFile(new URL('navegador-v023.json', saida), JSON.stringify(R, null, 1));
  await browser.close(); servidor.kill();
  console.log(R.ok ? 'V02.3 regiões no navegador: OK' : 'V02.3 regiões no navegador: FALHOU');
  process.exitCode = R.ok ? 0 : 1;
}
