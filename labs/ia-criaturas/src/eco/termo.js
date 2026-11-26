// Termorrecepção (V7, experimental). Sentido à parte da visão: percebe CONTRASTE de temperatura com o ar,
// dentro de um cone, sem atravessar relevo ou rocha. Devolve posição aproximada e porte grosseiro — nunca a espécie.
// Ficha: percepcao.termorrecepcao { alcance, anguloGraus, sensibilidadeC, contrasteRefC, erroRelativo, tempoReconhecimentoSeg }.
import { atan2, cos, sen } from '../core/matematica.js';
import { normalizarAngulo } from '../core/geometria.js';
import { linhaDeVisao } from './terreno.js';
import { temperaturaAmbiente } from './clima.js';

// Temperatura da superfície do corpo: endotérmico mantém a sua; ectotérmico acompanha o ar e aquece com esforço.
export function temperaturaCorporal(a, tAmb) {
  const c = a.especie.corpo;
  const esforco = Math.min(1, a.velocidade / a.especie.movimento.corrida);
  if (c.ectotermico) return tAmb + 1 + 4 * esforco;
  return (c.temperaturaC ?? 37) + 1.5 * esforco;
}

export function alcanceTermico(a, o, tAmb) {
  const p = a.especie.percepcao.termorrecepcao;
  const contraste = Math.abs(temperaturaCorporal(o, tAmb) - tAmb);
  if (contraste < p.sensibilidadeC) return { alcance: 0, contraste };
  // Corpo maior irradia por área maior; contraste satura em 1,5× o de referência.
  return { alcance: p.alcance * Math.min(1.5, contraste / p.contrasteRefC) * Math.min(1.6, Math.max(0.5, Math.sqrt(o.massa / 40))), contraste };
}

// Chamado por `perceber` para um alvo que a visão não reconheceu. Devolve contato impreciso ou null.
export function perceberCalor(a, o, d, mundo, dt) {
  const p = a.especie.percepcao.termorrecepcao;
  if (d > p.alcance * 2.4) return esfriar(a, o.id, dt, p);
  if (Math.abs(normalizarAngulo(atan2(o.y - a.y, o.x - a.x) - a.direcao)) > ((p.anguloGraus * Math.PI) / 180) / 2) return esfriar(a, o.id, dt, p);
  const r = alcanceTermico(a, o, temperaturaAmbiente(mundo));
  if (d > r.alcance) return esfriar(a, o.id, dt, p);
  const los = linhaDeVisao(mundo.terreno, a, o, a.especie.corpo.alturaM * a.escala * 0.5, o.especie.corpo.alturaM * o.escala * 0.5);
  // Sólido bloqueia; vegetação só atenua (visibilidade parcial).
  if (!los.livre || d > r.alcance * (0.4 + 0.6 * los.visibilidade)) return esfriar(a, o.id, dt, p);
  const m = (a.atencaoTermica ??= new Map());
  const at = Math.min(1, (m.get(o.id) ?? 0) + dt / (p.tempoReconhecimentoSeg ?? 1));
  m.set(o.id, at);
  if (at < 1) return null;
  const erro = (p.erroRelativo ?? 0.2) * d;
  const ang = a.rngPercepcao.entre(-Math.PI, Math.PI), raio = a.rngPercepcao.entre(0, erro);
  return { id: o.id, especie: null, via: 'termico', distancia: d, x: o.x + cos(ang) * raio, y: o.y + sen(ang) * raio, velocidade: null, comportamento: null,
    contrasteC: +r.contraste.toFixed(1), sinal: +((r.contraste / p.contrasteRefC) * (1 - d / r.alcance)).toFixed(3), massaEstimada: o.massa * a.rngPercepcao.entre(0.6, 1.4) };
}

function esfriar(a, id, dt, p) {
  const m = a.atencaoTermica, v = m?.get(id);
  if (v) { const n = v - dt / ((p.tempoReconhecimentoSeg ?? 1) * 2); if (n > 0) m.set(id, n); else m.delete(id); }
  return null;
}
