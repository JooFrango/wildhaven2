// Linha MH (E4): roda a caçada real no lab com ?pve1=1&pve2=1&mh=1, em tempo real num Chromium headless, e
// registra cada troca de clipe do Varrisco com o estado do monstro. Tira uma captura na primeira vez de cada
// clipe de estado/golpe (sem vídeo). Saída em labs/hunters/resultados/mh-e4/.
// Uso: sirva labs/ (npm run dev em labs/hunters → porta 5195) e rode
//      node labs/hunters/scripts/capture-mh-lab.mjs [url] [segundos] [pasta relativa a scripts/]
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';

const require = createRequire(new URL('../../hunters-codex/package.json', import.meta.url));
const {chromium} = require('playwright-core');
const DIR = new URL(process.argv[4] ?? '../resultados/mh-e4/', import.meta.url);
const URL_LAB = process.argv[2] ?? 'http://localhost:5195/hunters/hunter-lab.html?cenario=jogador-espada&semente=23&pve1=1&pve2=1&mh=1';
const SEG = Number(process.argv[3] ?? 75);
const CAPTURAR = ['roar', 'bite', 'bite_heavy', 'claw_right', 'double_claw', 'pounce', 'body_slam', 'tail_sweep', 'stagger', 'fall', 'get_up', 'exhausted', 'limp',
  'sickle_kick', 'bite_turn_l', 'bite_turn_r', 'pounce_chain', 'backstep_tail'];

await mkdir(DIR, {recursive: true});
const navegador = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const pagina = await navegador.newPage({viewport: {width: 1100, height: 720}});
const erros = [];
pagina.on('pageerror', (e) => erros.push(e.stack));
pagina.on('response', (r) => {if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) erros.push(r.status() + ' ' + r.url());});
try {
  await pagina.goto(URL_LAB);
  await pagina.waitForFunction(() => window.hunterLab?.mundo?.hunters?.length && window.hunterLab.modelosCarregados?.(), null, {timeout: 90000}).catch(() => {});
  if (await pagina.locator('#marcadores').evaluate((e) => e.classList.contains('ativo')).catch(() => false)) await pagina.locator('#marcadores').click();
  await pagina.locator('#cinematicaCombate').uncheck().catch(() => {});
  await pagina.locator('#camera').click().catch(() => {});
  await pagina.evaluate(() => {
    const api = window.hunterLab, v = api.mundo.animais.find((a) => a.especie.id === 'varrisco');
    window.__mh = {trocas: [], ult: null};
    const laco = () => {
      const m = api.mundo, c = api.clipes().find((x) => x.id === v.id)?.clip, L = window.__mh;
      if (c !== L.ult) {L.trocas.push({t: +m.t.toFixed(2), clipe: c, estado: v.estado, hp: +(v.saude.hp / v.saude.hpMax).toFixed(2)}); L.ult = c;}
      api.enquadrar(v.x, v.y, 7);
      if (!m.resultado) requestAnimationFrame(laco);
    };
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Iniciar').click();
    requestAnimationFrame(laco);
  });
  const feitos = new Set();
  for (let fim = Date.now() + (SEG + 30) * 1000; Date.now() < fim;) {
    const s = await pagina.evaluate(() => ({t: window.hunterLab.mundo.t, res: window.hunterLab.mundo.resultado?.motivo ?? null, c: window.__mh.ult}));
    if (CAPTURAR.includes(s.c) && !feitos.has(s.c)) {
      feitos.add(s.c);
      await pagina.waitForTimeout(/roar|fall|get_up|stagger/.test(s.c) ? 450 : 250);
      await pagina.screenshot({path: fileURLToPath(new URL(`${String(feitos.size).padStart(2, '0')}-${s.c}.png`, DIR))});
    }
    if (s.t >= SEG || s.res) break;
    await pagina.waitForTimeout(60);
  }
  const r = await pagina.evaluate(() => ({t: +window.hunterLab.mundo.t.toFixed(1), resultado: window.hunterLab.mundo.resultado?.motivo ?? null, trocas: window.__mh.trocas,
    eventos: window.hunterLab.mundo.eventos.filter((e) => /^monstro_/.test(e.tipo)).map((e) => ({t: e.t, tipo: e.tipo, ataque: e.ataque ?? null}))}));
  const usados = [...new Set(r.trocas.map((x) => x.clipe))];
  await writeFile(new URL('relatorio.json', DIR), JSON.stringify({url: URL_LAB, ...r, clipesUsados: usados, capturas: [...feitos], erros}, null, 1));
  console.log(JSON.stringify({t: r.t, resultado: r.resultado, clipesUsados: usados, capturas: [...feitos], erros: erros.length}));
} finally {await navegador.close();}
