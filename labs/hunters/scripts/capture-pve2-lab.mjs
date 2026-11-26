// E7: grava a caçada PvE real com o rig v13 ligado (?pve1=1&pve2=1) e mede o que a revisão pediu —
// continuidade da pose depois de cada troca de clipe, contato de pé, distância do rolamento e sincronização do
// combo. Saída em labs/hunters/resultados/pve2-e7/.
// A sequência é guiada pelo RELÓGIO DA SIMULAÇÃO (não pelo relógio real), senão a taxa de quadros do navegador
// headless (~10 fps) atropelaria as ações. O vídeo sai em câmera lenta em relação ao tempo simulado.
// Uso: node labs/hunters-codex/scripts/server.mjs   e, em outro terminal,
//      node labs/hunters/scripts/capture-pve2-lab.mjs [cenario]
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../../hunters-codex/package.json', import.meta.url));
const {chromium} = require('playwright-core');
const DIR = new URL('../resultados/pve2-e7/', import.meta.url);
const CENARIO = process.argv[2] ?? 'jogador-espada';   // caçada PvE: Hunter de espada contra o Varrisco real
const URL_LAB = `http://127.0.0.1:8782/labs/hunters/hunter-lab.html?cenario=${CENARIO}&pve1=1&pve2=1&semente=17`;

await mkdir(DIR, {recursive: true});
const navegador = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const pagina = await navegador.newPage({viewport: {width: 1200, height: 760}});
const erros = [];
pagina.on('pageerror', (e) => erros.push(e.stack));
pagina.on('response', (r) => {if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) erros.push(r.status() + ' ' + r.url());});

try {
  await pagina.goto(URL_LAB);
  await pagina.waitForFunction(() => window.hunterLab?.mundo?.hunters?.length, null, {timeout: 60000});
  if (await pagina.locator('#marcadores').evaluate((e) => e.classList.contains('ativo'))) await pagina.locator('#marcadores').click();
  await pagina.locator('#cinematicaCombate').uncheck();
  // Câmera perto e seguindo o Hunter controlado: é o corpo dele que está em revisão.
  await pagina.locator('#camera').click();
  await pagina.evaluate(() => {const a = window.hunterLab.mundo.hunters[0]; window.hunterLab.enquadrar(a.x, a.y, 7);});

  // ---------------------------------------------------------------- painel: um clipe de cada vez, mundo pausado
  const painel = await pagina.evaluate(async () => {
    const api = window.hunterLab, id = api.mundo.hunters[0].id;
    const quadro = () => new Promise(requestAnimationFrame);
    const mao = () => api.medirPose(id).arms.map((b) => b.hand);
    const dist = (a, b) => Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1], p[2] - b[i][2])));
    const saida = [];
    for (const clipe of api.clipesDisponiveis().filter((c) => c !== 'rig13_stress')) {
      let antes = mao();
      api.forcarClipe(clipe);
      await quadro();
      const naTroca = dist(antes, mao());   // primeiro quadro com o clipe novo
      antes = mao();
      let noClipe = 0;
      for (let n = 0; n < 60; n++) {await quadro(); const atual = mao(); noClipe = Math.max(noClipe, dist(antes, atual)); antes = atual;}
      const v = api.clipes().find((x) => x.id === id);
      saida.push({clipe, clipeDesenhado: v.clip, pegada: v.pegada, pesPlantados: v.pes,
        saltoNaTrocaM: +naTroca.toFixed(4), saltoMaxNoClipeM: +noClipe.toFixed(4)});
    }
    api.forcarClipe(null);
    return saida;
  });
  for (const l of painel) assert.equal(l.clipeDesenhado, l.clipe, `o painel desenhou ${l.clipeDesenhado} no lugar de ${l.clipe}`);
  await pagina.screenshot({path: fileURLToPath(new URL('painel-clipes.png', DIR))});

  // ---------------------------------------------------------------- controle manual, vídeo contínuo
  await pagina.locator('#manual').click();
  await pagina.evaluate(() => {
    const api = window.hunterLab, canvas = document.querySelector('#palco canvas'), saida = document.createElement('canvas');
    saida.width = 900; saida.height = 600;
    const ctx = saida.getContext('2d'), fluxo = saida.captureStream(20), pedacos = [];
    const rec = new MediaRecorder(fluxo, {mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1500000});
    rec.ondataavailable = (e) => {if (e.data.size) pedacos.push(e.data);};
    window.__gravacao = {rec, pedacos, fim: new Promise((r) => {rec.onstop = r;}), fluxo};
    const id = api.mundo.hunters[0].id;
    const mao = () => api.medirPose(id).arms.map((b) => b.hand);
    const dist = (a, b) => Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1], p[2] - b[i][2])));
    window.__log = {quadros: [], trocas: [], anterior: mao(), clipe: null, rotulo: ''};
    const laco = () => {
      const a = api.mundo.porId.get(id), v = api.clipes().find((x) => x.id === id), L = window.__log;
      const atual = mao(), d = dist(L.anterior, atual);
      if (v.clip !== L.clipe) {L.trocas.push({t: +api.mundo.t.toFixed(3), de: L.clipe, para: v.clip, naTrocaM: +d.toFixed(4), seguintes: []}); L.clipe = v.clip;}
      else {const u = L.trocas[L.trocas.length - 1]; if (u && u.seguintes.length < 11) u.seguintes.push(+d.toFixed(4));}
      L.anterior = atual;
      L.quadros.push({t: +api.mundo.t.toFixed(3), clipe: v.clip, pegada: v.pegada, pes: v.pes, x: a.x, y: a.y,
        vel: +a.velocidade.toFixed(2), rolando: !!a.hunter.esquivaPve, avancando: !!a.hunter.avancoPve, rotulo: L.rotulo,
        acao: a.hunter.action ? {clipe: a.hunter.action.clip, start: +a.hunter.action.start.toFixed(3),
          impact: +a.hunter.action.impact.toFixed(3), end: +a.hunter.action.end.toFixed(3)} : null});
      ctx.drawImage(canvas, 0, 0, 900, 600);
      ctx.fillStyle = '#15272bea'; ctx.fillRect(0, 0, 900, 44); ctx.fillRect(0, 552, 900, 48);
      ctx.fillStyle = '#eed8a1'; ctx.font = '17px sans-serif';
      ctx.fillText('HUNTER LAB / CAÇADA PvE / RIG v13 / ?pve1=1&pve2=1 / ' + (api.mundo.hunters[0].hunter.controle === 'manual' ? 'TECLADO' : 'IA'), 16, 28);
      ctx.font = '15px sans-serif';
      ctx.fillText(`${api.mundo.t.toFixed(2)} s · ${L.rotulo} · ${v.clip} · pegada ${v.pegada ?? '—'} · ${a.velocidade.toFixed(1)} m/s`, 16, 582);
      requestAnimationFrame(laco);
    };
    rec.start(); requestAnimationFrame(laco);
  });
  // O segundo Hunter entra em controle manual sem ninguém no teclado: fica de pé, parado. É o alvo de treino que
  // deixa o combo encadear — a cadeia quebra quando o golpe erra (regra do lote anterior, não mudou aqui).
  await pagina.evaluate(() => {const outro = window.hunterLab.mundo.hunters[1]; if (outro) window.hunterLab.comando('manual', outro.id, {on: true});});
  await pagina.locator('#rodar').click();

  const tempoSim = () => pagina.evaluate(() => window.hunterLab.mundo.t);
  const esperar = async (seg) => {const alvo = (await tempoSim()) + seg;
    await pagina.waitForFunction((x) => window.hunterLab.mundo.t >= x, alvo, {timeout: 240000});};
  const rotulo = (txt) => pagina.evaluate((t) => {window.__log.rotulo = t;}, txt);
  const segurar = async (tecla, seg) => {await pagina.keyboard.down(tecla); await esperar(seg); await pagina.keyboard.up(tecla);};
  const tocar = async (tecla) => {await pagina.keyboard.down(tecla); await esperar(0.15); await pagina.keyboard.up(tecla);};

  await rotulo('guarda'); await esperar(1);
  await rotulo('caminhada (W), fechando a distância'); await segurar('w', 4);
  // A carga vem antes do combo: ela é o golpe mais caro em energia, e depois de três golpes o Hunter já não a escolhe.
  // O corpo precisa estar parado: o golpe pesado não sai no meio do passo.
  await rotulo('guarda, parando o corpo'); await esperar(1.2);
  await rotulo('carga e liberação (H)'); await tocar('h'); await esperar(3);
  await rotulo('combo de 3 golpes (J, J, J)');
  await tocar('j'); await esperar(1.1);
  await tocar('j'); await esperar(1.2);
  await tocar('j'); await esperar(1.6);
  await rotulo('guarda (K)'); await segurar('k', 1);
  // Os rolamentos vêm com espaço livre em volta: ao lado do outro Hunter o corpo é barrado no meio do caminho,
  // e a medida do deslocamento sairia cortada pela colisão, não pelo clipe.
  await rotulo('recuo andando (S), abrindo distância'); await segurar('s', 3);
  await rotulo('rolamento à direita (D + Espaço)');
  await pagina.keyboard.down('d'); await tocar(' '); await pagina.keyboard.up('d'); await esperar(1.4);
  await rotulo('rolamento à esquerda (A + Espaço)');
  await pagina.keyboard.down('a'); await tocar(' '); await pagina.keyboard.up('a'); await esperar(1.6);
  await rotulo('corrida (W+Shift, pegada reversa)');
  await pagina.keyboard.down('Shift'); await segurar('w', 3); await pagina.keyboard.up('Shift');
  await rotulo('guarda'); await esperar(1);
  // Depois do teclado, a IA PvE volta a decidir e a caçada segue até o fim (ou 45 s simulados).
  await pagina.locator('#manual').click();
  await rotulo('caçada com a IA PvE');
  await pagina.waitForFunction((x) => window.hunterLab.mundo.resultado || window.hunterLab.mundo.t >= x, (await tempoSim()) + 45, {timeout: 600000});
  await esperar(0.5).catch(() => {});

  const resultado = await pagina.evaluate(async () => {
    const g = window.__gravacao;
    g.rec.stop(); await g.fim; g.fluxo.getTracks().forEach((t) => t.stop());
    const bytes = new Uint8Array(await new Blob(g.pedacos).arrayBuffer());
    let bruto = ''; for (let i = 0; i < bytes.length; i += 32768) bruto += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const api = window.hunterLab, L = window.__log;
    return {base64: btoa(bruto), quadros: L.quadros, trocas: L.trocas, invariantes: api.invariantes(),
      eventos: api.mundo.eventos.filter((e) => /rolamento|ataque_inicio|ferimento|esquiva/.test(e.tipo)).map((e) => ({t: +e.t.toFixed(2), tipo: e.tipo, id: e.id, lado: e.lado ?? null, ataque: e.ataque ?? null})),
      segundos: api.mundo.t, quadro: api.medirQuadro()};
  });

  const {base64, ...bruto} = resultado;
  await writeFile(new URL('pve2-lab-real.webm', DIR), Buffer.from(base64, 'base64'));
  await pagina.screenshot({path: fileURLToPath(new URL('final.png', DIR))});

  // ---------------------------------------------------------------- medidas
  const q = bruto.quadros, trechos = (rot) => q.filter((x) => x.rotulo.startsWith(rot));
  const andou = (filtro) => {const t = q.filter(filtro); if (t.length < 2) return 0;
    return +Math.hypot(t.at(-1).x - t[0].x, t.at(-1).y - t[0].y).toFixed(3);};
  const trocas = bruto.trocas.filter((x) => x.de);
  // Os rolamentos são separados pela ordem em que aconteceram (o primeiro é o da direita).
  const blocos = [];
  for (const f of q) {
    if (!f.rolando) {if (blocos.length && blocos.at(-1).aberto) blocos.at(-1).aberto = false; continue;}
    if (!blocos.length || !blocos.at(-1).aberto) blocos.push({aberto: true, quadros: [f]}); else blocos.at(-1).quadros.push(f);
  }
  const rolamentos = blocos.map((b) => ({clipes: [...new Set(b.quadros.map((x) => x.clipe))],
    metros: +Math.hypot(b.quadros.at(-1).x - b.quadros[0].x, b.quadros.at(-1).y - b.quadros[0].y).toFixed(3),
    segundos: +(b.quadros.at(-1).t - b.quadros[0].t).toFixed(2)}));
  const relatorio = {
    url: URL_LAB, cenario: CENARIO, segundosSimulados: +bruto.segundos.toFixed(2), quadro: bruto.quadro,
    amostragem: 'pose medida uma vez por quadro de vídeo (~10 fps no headless): 0,1 s entre amostras',
    painel, clipesVistosNoJogo: [...new Set(q.map((x) => x.clipe))], trocasDeClipe: trocas.length,
    saltoDaPoseNaTrocaM: {max: +Math.max(...trocas.map((x) => x.naTrocaM)).toFixed(4), porTroca: trocas.map((x) => ({t: x.t, de: x.de, para: x.para, naTrocaM: x.naTrocaM, maxSeguintes: x.seguintes.length ? +Math.max(...x.seguintes).toFixed(4) : null}))},
    pesPlantadosEmAlgumQuadro: q.some((x) => x.pes),
    velocidadeMaxMs: +Math.max(...q.map((x) => x.vel)).toFixed(2),
    pegadaPorClipe: Object.fromEntries([...new Set(q.map((x) => x.clipe))].map((c) => [c, [...new Set(q.filter((x) => x.clipe === c).map((x) => x.pegada))]])),
    caminhouM: andou((x) => x.rotulo.startsWith('caminhada')), correuM: andou((x) => x.rotulo.startsWith('corrida')),
    rolamentos, comboClipes: [...new Set(trechos('combo').map((x) => x.acao?.clipe).filter(Boolean))],
    cargaClipes: [...new Set(trechos('carga').map((x) => x.clipe))],
    quadrosComAvancoAutorado: q.filter((x) => x.avancando).length,
    eventos: bruto.eventos, invariantes: bruto.invariantes, erros,
    fonte: 'Canvas real do Hunter Lab, Chrome via Playwright (ANGLE SwiftShader). Controle manual por teclado, sequência guiada pelo relógio da simulação.',
  };
  await writeFile(new URL('browser-pve2-lab.json', DIR), JSON.stringify(relatorio, null, 2));
  await writeFile(new URL('quadros-pve2-lab.json', DIR), JSON.stringify(bruto.quadros));
  console.log(JSON.stringify({segundosSimulados: relatorio.segundosSimulados, clipesVistosNoJogo: relatorio.clipesVistosNoJogo,
    saltoMaxNaTrocaM: relatorio.saltoDaPoseNaTrocaM.max, velocidadeMaxMs: relatorio.velocidadeMaxMs,
    pegadaPorClipe: relatorio.pegadaPorClipe, rolamentos, comboClipes: relatorio.comboClipes, cargaClipes: relatorio.cargaClipes,
    invariantes: bruto.invariantes.length, erros}, null, 2));
  assert.deepEqual(bruto.invariantes, [], 'invariantes do núcleo violadas');
  assert.deepEqual(erros, [], 'erros de página');
} finally {
  await navegador.close();
}
