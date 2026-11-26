#!/usr/bin/env node
// Benchmark de renderização e integrado (IA + renderizador) no Chromium real, com os GLBs reais.
// Só roda onde o Playwright estiver instalado (o laboratório não o traz como dependência):
//   npm install --no-save playwright && npx playwright install chromium
//
//   node scripts/bench-navegador.mjs --populacoes 25,100,400 --quadros 240 --json saida.json
//
// Mede por nível de população: FPS estimado, p50/p95/p99 e pior quadro, 1% low, draw calls, triângulos,
// malhas com skin, tempo de carregamento e a divisão do quadro entre simulação, animação e desenho.
// O `fpsEstimado` é tempo de CPU por quadro a 1280x720, sem vsync — é um teto, não o FPS de uma janela.
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as esperar } from 'node:timers/promises';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const porta = Number(args.porta ?? 5194);
const cenario = args.cenario ?? 'laboratorio-populacao-hex-5km';
const semente = args.semente ?? '1';
const quadros = Number(args.quadros ?? 240);
const niveis = String(args.populacoes ?? '25,100,400,800').split(',').map(Number);

const { chromium } = await import('playwright');
const srv = spawn(process.execPath, ['scripts/servidor.mjs', '--porta', String(porta)], { cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
const log = [];
srv.stdout.on('data', (b) => log.push(String(b)));
srv.stderr.on('data', (b) => log.push(String(b)));
let nav;
const linhas = [];
try {
  for (let i = 0; i < 150 && !log.join('').includes('http://localhost:' + porta + '/'); i++) await esperar(100);
  if (!log.join('').includes('http://localhost:' + porta + '/')) throw new Error('servidor não subiu: ' + log.join(''));
  nav = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const n of niveis) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 160)); });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${porta}/ecossistema.html?cenario=${cenario}&semente=${semente}&populacao=${n}&modo=${args.modo ?? 'ecologico'}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.ecoDemo?.mundo?.vivos?.length > 0, { timeout: 300000 });
    await page.waitForFunction(() => window.ecoDemo.modelosCarregados().length >= 8, { timeout: 300000 });
    const msCarga = Date.now() - t0;
    // Enquadrar a câmera no grosso da população. Sem isso o recorte de visão deixa quase tudo de fora e a
    // medida de desenho (draw calls, triângulos) não diz nada sobre a densidade visível.
    const enquadrado = await page.evaluate(() => {
      const d = window.ecoDemo, m = d.mundo, t = m.terreno, W = t.largura / 2, D = t.profundidade / 2;
      if (!m.vivos.length) return null;
      let sx = 0, sy = 0;
      for (const a of m.vivos) { sx += a.x; sy += a.y; }
      const cx = sx / m.vivos.length, cy = sy / m.vivos.length;
      // Raio que cobre 80% dos animais em volta do centro: o enquadramento segue a mancha, não os isolados.
      const ds = m.vivos.map((a) => Math.hypot(a.x - cx, a.y - cy)).sort((p, q) => p - q);
      const r = Math.max(30, ds[Math.floor(ds.length * 0.8)]);
      const h = d.alturaEm(cx, cy);
      d.camera.position.set(cx - W, h + r * 0.9, cy - D + r * 1.1);
      d.camera.lookAt(cx - W, h, cy - D);
      d.camera.updateMatrixWorld(true);
      return { cx: +cx.toFixed(0), cy: +cy.toFixed(0), raio: +r.toFixed(0) };
    });
    // Aquecimento: compila shaders e estabiliza o JIT antes de medir.
    await page.evaluate((q) => window.ecoDemo.medirDesempenho(Math.min(60, q), 60), quadros);
    // Mede com e sem o LOD de animação no mesmo mundo, para o ganho não depender de duas execuções.
    const semLod = args.compararLod
      ? await page.evaluate((q) => { window.ecoDemo.lodAnimacao(false); const x = window.ecoDemo.medirDesempenho(q, 60); window.ecoDemo.lodAnimacao(true); return x; }, quadros)
      : null;
    const r = await page.evaluate((q) => window.ecoDemo.medirDesempenho(q, 60), quadros);
    linhas.push({ populacao: n, msCarga, enquadrado, semLod, ...r, erros: erros.slice(0, 3), nErros: erros.length });
    console.log(`${String(n).padStart(5)} animais | vivos ${r.animais} visíveis ${r.visiveis} | fps ${r.fpsEstimado} (1% low ${r.fps1pctLow})`
      + ` | quadro p50 ${r.msQuadro.p50} p95 ${r.msQuadro.p95} p99 ${r.msQuadro.p99} pior ${r.msQuadro.pior} ms`
      + ` | sim ${r.msSim} anim ${r.msAnimacaoIK} render ${r.msRender} ms | draw ${r.drawCalls} tri ${r.triangulos}`
      + ` | malhas ${r.malhas} (skin ${r.malhasComSkin}) | animados ${r.animadosNoQuadro}`
      + (semLod ? ` | sem LOD: fps ${semLod.fpsEstimado}, anim ${semLod.msAnimacaoIK} ms` : '')
      + ` | enquadre r=${enquadrado?.raio ?? '?'} m | carga ${(msCarga / 1000).toFixed(1)} s | erros ${erros.length}`);
    // A captura é evidência, não medida: se o quadro estiver lento demais para o Playwright, segue o jogo.
    if (args.captura) {
      try { await page.screenshot({ path: `${args.captura}-${n}.png`, timeout: 120000 }); }
      catch (e) { console.log(`  (sem captura em ${n}: ${String(e).split('\n')[0].slice(0, 80)})`); }
    }
    await ctx.close();
    // Segurança: parar de subir a população quando o quadro já passou do limite, em vez de perseguir recorde.
    if (r.msQuadro.p50 > Number(args.limiteQuadro ?? 400)) { console.log(`parando: quadro p50 ${r.msQuadro.p50} ms passou do limite`); break; }
  }
} finally {
  await nav?.close();
  srv.kill('SIGTERM');
}
if (args.json) await writeFile(args.json, JSON.stringify({ cenario, semente, quadros, linhas }, null, 1));
