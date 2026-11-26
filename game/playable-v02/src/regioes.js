// Regiões detalhadas móveis. Cada região é um mundo do Hunter Lab com sua própria grade (coordenadas locais,
// origem no canto da grade). O jogo trabalha no "quadro do jogo" (o mesmo da V01/V02: x = X − QUADRO.x0, y = Z − QUADRO.z0);
// local = jogo − deslocamento da região.
//
// Recentrar uma região = construir a grade nova a partir dos GLBs (src/regiao.js) e deslocar TODO o estado posicional
// do mundo pelo mesmo vetor (múltiplo exato da resolução): ninguém se teletransporta, o terreno sob cada ator é o mesmo.
import { criarMundoHunters } from '../../../labs/hunters/src/mundo-hunters.js';
import { hexEm } from './estrategico.js';

import { QUADRO } from './quadro.js';
export { QUADRO };
export const TAM = 1200, RES = 2, MARGEM_RECENTRO = 250, MARGEM_INTERIOR = 30;
const alinhar = (v) => Math.round(v / RES) * RES;

export const ox = (R) => R.X0 - QUADRO.x0, oy = (R) => R.Z0 - QUADRO.z0;
export const paraLocal = (R, p) => ({ x: p.x - ox(R), y: p.y - oy(R) });
export const paraJogo = (R, p) => ({ x: p.x + ox(R), y: p.y + oy(R) });
export const dentroRegiao = (R, pj, m = 0) => { const p = paraLocal(R, pj); return p.x >= m && p.y >= m && p.x <= R.L - m && p.y <= R.P - m; };

// Janela de TAM × TAM centrada num ponto do jogo, alinhada à grade global de RES metros.
export function janela(c) { return { X0: QUADRO.x0 + alinhar(c.x - TAM / 2), Z0: QUADRO.z0 + alinhar(c.y - TAM / 2), L: TAM, P: TAM }; }
// Hexágonos cujo retângulo (4 330 × 5 000 m) cruza a janela.
export function hexesDaJanela(G, w) {
  return G.tiles.filter((t) => t.x + 2166 > w.X0 && t.x - 2166 < w.X0 + w.L && t.z + 2501 > w.Z0 && t.z - 2501 < w.Z0 + w.P).map((t) => t.id);
}

// Mundo vazio para uma região nova (os atores chegam por transferência); relógio copiado da região de origem.
export function mundoVazio(cfg, cen, semente, { fichaHunter, equipamentos }, t, relogioDe) {
  const c = { ...cen, populacoes: [], hunters: [], terreno: { tipo: 'procedural', largura: 4, profundidade: 4, res: 1, amplitude: 0, capim: 0 } };
  const m = criarMundoHunters({ ...cfg, cenarios: { ...cfg.cenarios, [c.id]: c } }, c, semente, { fichaHunter, equipamentos });
  m.terreno = t; m.pontosAgua = [];
  if (relogioDe) { m.t = relogioDe.t; m.tick = relogioDe.tick; m.relogio = structuredClone(relogioDe.relogio); }
  m.opcoes.maxEventos = 20000;
  return m;
}

// Desloca todo objeto {x, y} numérico alcançável (posições, destinos, memórias, caminhos, eventos) por (−dx, −dy).
const PULAR = new Set(['terreno', 'config', 'cenario', 'especie', 'doencas', 'rng', 'ledger', 'hunterRecursos', 'opcoes', 'metricas', 'custo', 'gradeAtivos', 'gradeN1', 'idsAtivos']);
export function deslocar(raiz, dx, dy, vistos = new Set()) {
  const visitar = (o, chave) => {
    if (!o || typeof o !== 'object' || vistos.has(o) || ArrayBuffer.isView(o) || PULAR.has(chave)) return;
    vistos.add(o);
    if (o instanceof Map) { for (const v of o.values()) visitar(v); return; }
    if (o instanceof Set) { for (const v of o) visitar(v); return; }
    if (typeof o.x === 'number' && typeof o.y === 'number') { o.x -= dx; o.y -= dy; }
    if (o.caminho && typeof o.caminho === 'object') o.caminho.invalido = true;   // replaneja no terreno novo
    for (const k of Object.keys(o)) if (typeof o[k] === 'object') visitar(o[k], k);
  };
  visitar(raiz);
}

// Aplica a grade nova à região: desloca o mundo inteiro e troca o terreno. Atores fora da grade nova ficam dormentes
// (saem de `vivos`, continuam em `animais`/salvamento); dormentes que caem dentro dela voltam.
export function aplicarJanela(R, w, t) {
  const dx = w.X0 - R.X0, dy = w.Z0 - R.Z0, m = R.m;
  if (dx || dy) deslocar(m, dx, dy);
  Object.assign(R, { X0: w.X0, Z0: w.Z0, L: w.L, P: w.P });
  m.terreno = t; m.pontosAgua = [];
  const dentro = (a) => a.x >= 1 && a.y >= 1 && a.x <= w.L - 1 && a.y <= w.P - 1;
  for (const a of m.vivos.filter((a) => !a.hunter && !dentro(a))) { m.vivos = m.vivos.filter((x) => x !== a); m.porId.delete(a.id); a.dormente = true; }
  for (const a of m.animais.filter((a) => a.dormente && a.vivo && !m.mortos.has(a.id) && dentro(a))) { a.dormente = false; m.vivos.push(a); m.porId.set(a.id, a); }
  return { dx, dy };
}

// Move um ator vivo de uma região para outra (mesma posição no mundo; coordenadas convertidas).
export function transferir(a, de, para) {
  const dx = para.X0 - de.X0, dy = para.Z0 - de.Z0;
  for (const m of [de.m]) { m.vivos = m.vivos.filter((x) => x !== a); m.animais = m.animais.filter((x) => x !== a); m.hunters = m.hunters.filter((x) => x !== a); m.porId.delete(a.id); }
  deslocar(a, dx, dy);
  a.contatos = []; a.golpe = null;
  const m = para.m; m.animais.push(a); m.vivos.push(a); m.porId.set(a.id, a); if (a.hunter) m.hunters.push(a);
}

// Hexágonos com GLB de terreno disponível nesta build (a navegação detalhada só existe neles).
export const hexDisponivel = (jogo, id) => !!id && jogo.provedor.disponivel(id);
export const hexDoPonto = (jogo, p) => hexEm(jogo.G, p.x, p.y)?.id ?? null;
