// Saúde: pontos de vida, ferimentos por região, sangramento, dor, mobilidade, cicatrização, infecção e doenças.
import { massaMedia } from './especies.js';

// Efeito de cada região atingida: multiplicador de dano, sangramento e consequências.
// muscular: fração da gravidade que vira lesão muscular (reduz força e, nas pernas, a corrida).
export const REGIOES = {
  cabeca: { dano: 1.2, sangra: 0.6, atordoa: 1.0 },
  pescoco: { dano: 1.5, sangra: 1.6, arterial: true },
  tronco: { dano: 1.0, sangra: 1.0, muscular: 0.5 },
  flanco: { dano: 0.9, sangra: 1.2, muscular: 0.6 },
  pernas: { dano: 0.8, sangra: 0.7, mobilidade: true, muscular: 1.0 },
  cauda: { dano: 0.5, sangra: 0.5, equilibrio: true },
};

export function criarSaude(especie, massa, fracaoCrescimento = 1) {
  const hpMax = especie.saude.max * Math.sqrt(massa / massaMedia(especie)) * (0.4 + 0.6 * fracaoCrescimento);
  return { hp: hpMax, hpMax, ferimentos: [], doencas: [], dor: 0, atordoadoAte: 0, caidoAte: 0, desequilibradoAte: 0, sequelaMobilidade: 0 };
}

// Aplica um ferimento. Proteção natural da região (couraça, placas, pelagem densa; ficha `combate.protecao`)
// absorve parte do dano conforme a penetração do golpe. Retorna o registro (com id único) para eventos/ledger.
export function ferir(agente, { dano, regiao, origem, tipo, t, idEvento, penetracao = 0.3 }) {
  const s = agente.saude, cb = agente.especie.combate;
  const r = REGIOES[regiao] ?? REGIOES.tronco;
  const protecao = cb.protecao?.[regiao] ?? 0;
  const efetivo = dano * r.dano * (1 - protecao * (1 - penetracao));
  s.hp -= efetivo;
  const gravidade = Math.min(1, efetivo / s.hpMax);
  const garra = /garra|golpe|mordida|bote/.test(tipo ?? '');
  const fer = {
    id: idEvento, regiao, gravidade: +gravidade.toFixed(4), origem, tipo, efetivo,
    sangramento: +(gravidade * agente.especie.saude.sangramentoBase * r.sangra * 6 * (r.arterial && gravidade > 0.2 ? 1.5 : 1)).toFixed(4), // hp/s
    infeccao: 0, desde: t,
    fratura: !!r.mobilidade && gravidade > 0.28,
    muscular: garra && r.muscular ? +Math.min(0.8, gravidade * r.muscular * 2).toFixed(4) : 0,
  };
  s.ferimentos.push(fer);
  const resistDor = cb.resistenciaDor ?? 0.4;
  s.dor = Math.min(1, s.dor + gravidade * 1.5 * (1 - resistDor * 0.6));
  // Golpe na cabeça atordoa (mais em quem tem pouca resistência à dor).
  if (r.atordoa && gravidade > 0.06) s.atordoadoAte = Math.max(s.atordoadoAte, t + (0.6 + 6 * gravidade) * (1 - resistDor * 0.5));
  agente.estresse = Math.min(1, (agente.estresse ?? 0) + 0.4 + gravidade);
  return fer;
}

// Por passo: sangramento drena vida; coagulação reduz o sangramento; a dor diminui.
export function atualizarSaudePasso(agente, dt) {
  const s = agente.saude;
  let perda = 0;
  for (const f of s.ferimentos) {
    if (f.sangramento <= 0) continue;
    perda += f.sangramento * dt;
    // Coagulação: mais rápida em repouso.
    const coag = (agente.velocidade < 0.5 ? 0.06 : 0.025) * dt;
    f.sangramento = Math.max(0, f.sangramento - coag * (0.3 + f.sangramento));
  }
  s.hp -= perda;
  s.dor = Math.max(0, s.dor - 0.01 * dt);
  return perda;
}

// Fator de mobilidade (0..1): pernas feridas, fraturas, sequelas, vida baixa, doença.
export function fatorMobilidade(agente) {
  const s = agente.saude;
  let f = 1;
  for (const fer of s.ferimentos) if (fer.regiao === 'pernas') f *= fer.fratura ? 0.4 : (1 - fer.gravidade * 0.8) * (1 - (fer.muscular ?? 0) * 0.3);
  f *= 1 - s.sequelaMobilidade;
  f *= s.veneno?.mobilidade ?? 1;
  if (s.hp < s.hpMax * 0.3) f *= 0.75;
  for (const d of s.doencas) f *= 1 - 0.3 * d.intensidade;
  return Math.max(0.15, f);
}

export const sangrando = (a) => a.saude.ferimentos.some((f) => f.sangramento > 0.05);
export const feridoVisivel = (a) => fatorMobilidade(a) < 0.8 || sangrando(a) || a.saude.hp < a.saude.hpMax * 0.5;
export const incapacitado = (a) => a.saude.hp < a.saude.hpMax * 0.15 || fatorMobilidade(a) < 0.3;

// Uma vez por dia ecológico: cicatrização, infecção de feridas, evolução de doenças, sequelas.
// `rng` é um sorteio chaveado por (agente, dia): o mesmo dia nunca é processado com resultados diferentes.
export function processarSaudeDia(agente, rng, dia, doencasConfig) {
  const s = agente.saude, e = agente.especie;
  const condicao = Math.max(0.2, 1 - (agente.fome / 100) * 0.6 - (agente.sede / 100) * 0.6);
  const eventos = [];
  for (const f of s.ferimentos) {
    // Infecção: só em feridas relevantes ainda abertas; chance moderada, nunca espontânea sem ferida.
    if (f.infeccao === 0 && f.gravidade > 0.15 && rng.chance(0.04 * e.saude.suscetibilidadeDoenca * (1.5 - condicao))) {
      f.infeccao = 0.2; eventos.push({ tipo: 'infeccao_ferida', regiao: f.regiao });
    }
    if (f.infeccao > 0) {
      const combate = condicao * (1 - e.saude.suscetibilidadeDoenca) * 0.25;
      f.infeccao = Math.max(0, Math.min(1, f.infeccao + (rng.chance(0.5) ? 0.12 : 0.05) - combate));
      s.hp -= f.infeccao * s.hpMax * 0.06;
      if (f.infeccao === 0) eventos.push({ tipo: 'infeccao_curada', regiao: f.regiao });
    }
    const cura = (e.saude.regenPorDia / 100) * condicao * (f.infeccao > 0 ? 0.3 : 1);
    if (f.fratura && f.gravidade - cura <= 0.05) {
      // Fratura consolidada: pode deixar sequela permanente leve.
      s.sequelaMobilidade = Math.min(0.5, s.sequelaMobilidade + f.gravidade * 0.25);
      eventos.push({ tipo: 'sequela', regiao: f.regiao, mobilidade: +s.sequelaMobilidade.toFixed(3) });
    }
    f.gravidade = Math.max(0, f.gravidade - cura);
    if (f.muscular) f.muscular = Math.min(f.muscular, f.gravidade * 2);
  }
  s.ferimentos = s.ferimentos.filter((f) => f.gravidade > 0.01 || f.infeccao > 0);
  // Doenças contagiosas (módulo configurável).
  for (const d of s.doencas) {
    const cfg = doencasConfig[d.id];
    if (!cfg) continue;
    d.dias++;
    const resist = (1 - e.saude.suscetibilidadeDoenca) * condicao * agente.atributos.resistencia;
    // Fase sintomática mínima (contagiosa) antes que a resposta imune consiga reduzir a intensidade.
    const sintomatica = d.dias >= cfg.incubacaoDias && d.dias < cfg.incubacaoDias + (cfg.duracaoMinDias ?? 0);
    if (sintomatica) d.intensidade = Math.min(1, d.intensidade + cfg.progressaoDia * 0.5);
    else if (d.dias >= cfg.incubacaoDias) d.intensidade = Math.min(1, d.intensidade + cfg.progressaoDia - resist * cfg.recuperacaoDia);
    s.hp -= d.intensidade * cfg.danoDiaFracao * s.hpMax;
    if (d.intensidade <= 0 && d.dias > cfg.incubacaoDias) { d.curada = true; eventos.push({ tipo: 'doenca_curada', doenca: d.id }); }
  }
  s.doencas = s.doencas.filter((d) => !d.curada);
  // Regeneração geral de vida.
  if (!s.ferimentos.length && !s.doencas.length) s.hp = Math.min(s.hpMax, s.hp + s.hpMax * (e.saude.regenPorDia / 100) * condicao);
  else s.hp = Math.min(s.hpMax, s.hp + s.hpMax * (e.saude.regenPorDia / 300) * condicao);
  return eventos;
}

export function contagio(agente, outro, cfg, rng, dt) {
  // Contato próximo prolongado entre animais compatíveis com a doença.
  if (!cfg.especies.includes(outro.especie.id)) return false;
  if (outro.saude.doencas.some((d) => d.id === cfg.id)) return false;
  const fonte = agente.saude.doencas.find((d) => d.id === cfg.id);
  if (!fonte || fonte.dias < cfg.incubacaoDias * 0.5) return false;
  const p = cfg.transmissaoPorSegContato * dt * outro.especie.saude.suscetibilidadeDoenca * (0.5 + fonte.intensidade);
  if (!rng.chance(p)) return false;
  outro.saude.doencas.push({ id: cfg.id, dias: 0, intensidade: 0.1, origem: agente.id });
  return true;
}
