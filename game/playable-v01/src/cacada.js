// Caçada da Playable Build V01: o mundo do laboratório Hunter (labs/hunters, PR #97/#98) montado sobre o
// terreno derivado da região real (tools/derivar-regiao.mjs). Mesmo código no navegador e no Node.
import { criarMundoHunters } from '../../../labs/hunters/src/mundo-hunters.js';
import { decidirHunter } from '../../../labs/hunters/src/cerebro-hunter.js';
import { usarGuardaFechada, usarPve1, usarPve2 } from '../../../labs/hunters/src/trajetoria-arma.js';
import { usarMonstro, modeloMonstro } from '../../../labs/hunters/src/monstro-varrisco.js';
import { indice } from '../../../labs/ia-criaturas/src/eco/terreno.js';

export const RIG_V13 = 'labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_blockout.glb';

// Liga a linha experimental PvE v02 + Varrisco MH (as mesmas flags ?pve1=1&pve2=1&mh=1 do Hunter Lab).
export function prepararConfig(cfgEco, fichaHunter) {
  usarGuardaFechada(false); usarPve1(true); usarPve2(true); usarMonstro(true);
  fichaHunter.modelo.glb = RIG_V13;
  const especies = structuredClone(cfgEco.especies);
  if (!especies.varrisco.dieta.presas.includes('hunter')) especies.varrisco.dieta.presas.push('hunter');
  especies.varrisco.modelo = modeloMonstro(especies.varrisco.modelo);
  return { ...cfgEco, especies: { ...especies, hunter: fichaHunter } };
}

// Célula livre mais próxima (o ponto de nascimento não pode cair dentro de tronco ou parede).
export function pontoLivre(dados, terreno, x, y) {
  for (let r = 0; r < 60; r += terreno.res) for (let a = 0; a < 16; a++) {
    const px = x + Math.cos(a * Math.PI / 8) * r, py = y + Math.sin(a * Math.PI / 8) * r, k = indice(terreno, px, py);
    if (k >= 0 && !terreno.bloqueio[k] && terreno.inclinacao[k] < 25) return { x: +px.toFixed(2), y: +py.toFixed(2) };
    if (!r) break;
  }
  throw Error(`sem ponto livre perto de (${x}, ${y})`);
}

// Pontos fixos da caçada, em metros do mundo (X leste, Z sul). A vila é HV_01 (site.json); o Varrisco nasce
// 520 m ao norte, ainda em HV_01; o canto norte (FX_20 | ER_18) fica a 2,5 km da praça.
export const PONTOS = { vila: [28145.825622994256, -3740], varrisco: [28145.825622994256, -4260] };

// vidaMonstro: preset de dificuldade da demonstração (1 = ficha do laboratório; 0,5 = padrão desta build).
export function criarCacada(cfg, dados, semente, { fichaHunter, equipamentos, terreno, vidaMonstro = 1 }) {
  const o = dados.origem, local = ([X, Z]) => pontoLivre(dados, terreno, X - o.x0, Z - o.z0);
  const vila = local(PONTOS.vila), toca = local(PONTOS.varrisco);
  const cen = {
    id: 'auralis-v01', nome: 'Auralis — região de caça HV_01 · FX_20 · ER_18', dt: 0.05, duracaoSeg: 36000,
    // Letal: a morte do Hunter encerra a sessão de demonstração (não muda a regra de morte permanente do jogo).
    modoCombate: 'letal', relogio: { segundosPorDia: 900, diaInicial: 20, horaInicial: 10 }, clima: { chanceIncendio: 0 },
    terreno: { tipo: 'derivado', dados },
    populacoes: [{ especie: 'varrisco', individuos: [{ id: 'varrisco-real', ...toca, idadeAnos: 6, direcaoGraus: 90, fome: 70, sede: 0 }] }],
    hunters: [{ id: 'hunter-A', nome: 'Arvo', equipe: 'azul', ...vila, direcaoGraus: 270,
      equipamento: { arma: 'espada', escudo: null, armadura: 'leve' }, personalidade: { agressividade: 0.72, cautela: 0.35, disciplina: 0.7 }, habilidade: 0.85 }],
  };
  const m = criarMundoHunters({ ...cfg, cenarios: { ...cfg.cenarios, [cen.id]: cen } }, cen, semente, { fichaHunter, equipamentos });
  const v = m.animais.find((a) => a.especie.id === 'varrisco');
  v.saude.hpMax *= vidaMonstro; v.saude.hp = v.saude.hpMax;
  m.pontos = { vila, toca };
  return m;
}

// Controle do jogador. Com inimigo à vista vale o controle manual do laboratório (WASD relativo ao alvo, J/H/K/Espaço).
// Sem inimigo o laboratório não move o Hunter manual; aqui WASD anda relativo à câmera (`comando.rumo`, radianos no
// plano da simulação).
const SEM_INIMIGO = new Set(['ordem', 'ultima_abertura', 'recuperar', 'voltar', 'vigia']);
export function decidirJogador(a, mundo) {
  const i = decidirHunter(a, mundo), h = a.hunter, c = h.comando ?? {};
  if (h.controle !== 'manual' || !SEM_INIMIGO.has(i.codigo)) return i;
  h.situacao = 'explorando';
  const f = (c.frente ? 1 : 0) - (c.tras ? 1 : 0), s = (c.direita ? 1 : 0) - (c.esquerda ? 1 : 0);
  if (!f && !s) return { ...i, estado: 'parado', codigo: 'explorar_parado', motivo: 'aguardando comando', destino: null, ritmo: 'parado' };
  const r = Number.isFinite(c.rumo) ? c.rumo : a.direcao, n = Math.hypot(f, s);
  const dx = (Math.cos(r) * f - Math.sin(r) * s) / n, dy = (Math.sin(r) * f + Math.cos(r) * s) / n;
  return { ...i, estado: 'deslocando', codigo: 'explorar', motivo: 'movimento comandado', alvo: null, olharPara: null,
    destino: { x: a.x + dx * 3, y: a.y + dy * 3 }, ritmo: c.correr ? 'corrida' : 'andar' };
}
