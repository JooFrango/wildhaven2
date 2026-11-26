// Cupinzeiros (V7, experimental). Recurso finito do LABORATÓRIO — nada é acrescentado ao mapa oficial.
// Cada colônia tem população que cresce devagar (logística), atividade que varia com clima e hora, e uma
// casca que alguns animais conseguem abrir. Quem come retira indivíduos; colônia zerada se extingue (ficha
// das espécies especialistas: "se chegar a zero, a colônia se extingue para sempre").
// Cenário: cupinzeiros: [{ id, x, y, populacao, populacaoMax, crescimentoPorDia }].
// Ficha: dieta.cupins { porSeg, alcanceM, abre, saciaPorCupim }.
import { linhaDeVisao } from './terreno.js';
import { temperaturaAmbiente } from './clima.js';

export function instalarCupinzeiros(mundo) {
  mundo.cupinzeiros = (mundo.cenario.cupinzeiros ?? []).map((c, i) => ({
    id: c.id ?? `cupinzeiro${i + 1}`, x: c.x, y: c.y, populacaoMax: c.populacaoMax ?? 3000, populacao: c.populacao ?? c.populacaoMax ?? 3000,
    crescimentoPorDia: c.crescimentoPorDia ?? 0.35, aberto: 0, atividade: 1, extinta: false, consumido: 0, consumoPor: {}, alturaM: c.alturaM ?? 1.6,
  }));
}

// Atividade na superfície: chuva traz a revoada; calor forte e seca recolhem a colônia; tempestade fecha tudo.
export function atividadeCupins(mundo) {
  const tAmb = temperaturaAmbiente(mundo), at = mundo.climaAtivo, r = mundo.relogio;
  let f = tAmb > 34 ? 0.5 : tAmb < 12 ? 0.4 : 1;
  if (r.hora < 6 || r.hora > 18.5) f *= 1.15;
  if (r.estacao === 'seca') f *= 0.8;
  if (at?.tipo === 'chuva_intensa') f *= 1 + 0.5 * at.intensidade;
  else if (at) f *= 1 - 0.7 * at.intensidade;
  else if (r.chovendo) f *= 1.3;
  return f;
}

export function atualizarCupinzeiros(mundo, dt) {
  if (!mundo.cupinzeiros?.length) return;
  const atv = atividadeCupins(mundo), dia = mundo.relogio.segundosPorDia;
  for (const c of mundo.cupinzeiros) {
    c.atividade = c.extinta ? 0 : atv;
    if (c.extinta) continue;
    // Recuperação logística: rápida no meio, lenta quando quase vazia ou cheia.
    c.populacao = Math.min(c.populacaoMax, c.populacao + c.crescimentoPorDia * c.populacao * (1 - c.populacao / c.populacaoMax) * (dt / dia));
    // A colônia conserta a casca.
    c.aberto = Math.max(0, c.aberto - (0.5 * dt) / dia);
  }
}

// Fração da colônia ao alcance: fechada, só quem está na superfície; aberta, as galerias ficam expostas.
export const acessoCupins = (c) => Math.min(1, (0.12 + 0.88 * c.aberto) * c.atividade);

// O animal só sabe de um cupinzeiro que viu (monte) ou farejou. Devolve os percebidos neste passo.
export function perceberCupinzeiros(a, mundo, al) {
  const out = [];
  for (const c of mundo.cupinzeiros) {
    const d = Math.sqrt((c.x - a.x) * (c.x - a.x) + (c.y - a.y) * (c.y - a.y));
    const odor = al.olfato * 0.5 * c.atividade * Math.sqrt(c.populacao / c.populacaoMax);
    const via = d <= odor ? 'olfato' : d <= al.visao && linhaDeVisao(mundo.terreno, a, c, a.especie.corpo.alturaM * a.escala * 0.9 + (a.voo?.alt ?? 0), c.alturaM * 0.7).livre ? 'visao' : null;
    if (via) out.push({ id: c.id, x: c.x, y: c.y, distancia: d, via });
  }
  return out;
}

// Comer: retira indivíduos da colônia e só então reduz a fome. Devolve quantos cupins foram comidos.
export function comerCupins(a, c, mundo, dt) {
  const cfg = a.especie.dieta.cupins;
  if (c.extinta || c.populacao <= 0) return 0;
  const q = Math.min(cfg.porSeg * acessoCupins(c) * dt, c.populacao);
  c.populacao -= q; c.consumido += q; c.consumoPor[a.id] = (c.consumoPor[a.id] ?? 0) + q;
  a.fome = Math.max(0, a.fome - q * (cfg.saciaPorCupim ?? 0.3));
  a.cupinsComidos = (a.cupinsComidos ?? 0) + q;
  mundo.metricas.cupinsConsumidos = (mundo.metricas.cupinsConsumidos ?? 0) + q;
  if (c.populacao < 1) { c.populacao = 0; c.extinta = true; mundo.evento('cupinzeiro_esgotado', a.id, { cupinzeiro: c.id }); }
  return q;
}

// Abrir a casca (só quem tem garras para isso). Leva tempo e gasta energia.
export function abrirCupinzeiro(a, c, dt) {
  c.aberto = Math.min(1, c.aberto + dt / 6);
  a.energia = Math.max(0, a.energia - 0.6 * dt);
}
