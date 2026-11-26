// Clima experimental (V7): temperatura do ar e condições adversas. Uma fonte só — `mundo.climaAtivo` — lida
// pelos sentidos, pela locomoção, pelo voo e pela fisiologia. O que o jogador vê na cena sai do mesmo estado
// que limita o animal: não existe tempestade "só da câmera".
import { cos, PI } from '../core/matematica.js';

// Fator de cada sentido/capacidade com intensidade 1 (1 = sem efeito). `exige` restringe ao bioma certo.
export const CLIMAS = Object.freeze({
  chuva_intensa: { nome: 'chuva intensa', visao: 0.55, audicao: 0.55, olfato: 0.5, locomocao: 0.9, voo: 0.7, custoEnergia: 1.15, deltaTemperaturaC: -4, umidade: 1, apagaRastros: true },
  tempestade_areia: { nome: 'tempestade de areia', visao: 0.15, audicao: 0.5, olfato: 0.6, locomocao: 0.8, voo: 0.3, custoEnergia: 1.3, deltaTemperaturaC: -2, umidade: 0, apagaRastros: true, exige: 'areia' },
  nevasca: { nome: 'nevasca', visao: 0.3, audicao: 0.7, olfato: 0.7, locomocao: 0.65, voo: 0.35, custoEnergia: 1.6, deltaTemperaturaC: -14, umidade: 0.6, apagaRastros: true, exige: 'frio' },
});
const RAMPA_SEG = 8;
const FATORES = ['visao', 'audicao', 'olfato', 'locomocao', 'voo', 'custoEnergia'];

// Temperatura do ar (°C): valor fixo do cenário ou ciclo diário (mínima às 3 h, máxima às 15 h).
export function temperaturaAmbiente(mundo) {
  const c = mundo.cenario.clima ?? {};
  const base = c.temperaturaC ?? ((c.temperaturaMediaC ?? 26) - (c.amplitudeTermicaC ?? 7) * cos(((mundo.relogio.hora - 3) / 12) * PI));
  return base + (mundo.climaAtivo?.deltaTemperaturaC ?? 0);
}

// O bioma do cenário comporta o evento? Areia vem do terreno; frio, da temperatura média declarada.
export function climaPermitido(mundo, tipo) {
  const def = CLIMAS[tipo];
  if (!def) return { ok: false, motivo: 'tipo_desconhecido' };
  if (def.exige === 'areia' && !mundo.terreno.areia) return { ok: false, motivo: 'bioma_sem_areia' };
  if (def.exige === 'frio' && (mundo.cenario.clima?.temperaturaMediaC ?? mundo.cenario.clima?.temperaturaC ?? 26) > 4) return { ok: false, motivo: 'bioma_sem_frio' };
  return { ok: true };
}

export function iniciarClima(mundo, tipo, { intensidade = 1, duracaoSeg = 120 } = {}) {
  const p = climaPermitido(mundo, tipo);
  if (!p.ok) { mundo.evento('clima_recusado', null, { clima: tipo, motivo: p.motivo }); return false; }
  mundo.climaEvento = { tipo, intensidadeAlvo: Math.max(0, Math.min(1, intensidade)), inicio: mundo.t, fim: mundo.t + duracaoSeg };
  mundo.evento('clima_inicio', null, { clima: tipo, intensidade, duracaoSeg });
  return true;
}

export function encerrarClima(mundo) { if (mundo.climaEvento) mundo.climaEvento.fim = Math.min(mundo.climaEvento.fim, mundo.t + RAMPA_SEG); }

// Por passo: agenda do cenário (determinística) e rampa de entrada/saída.
export function atualizarClimaAdverso(mundo) {
  const agenda = mundo.cenario.clima?.eventos;
  if (agenda) for (const e of agenda) {
    const chave = `clima:${e.tipo}:${e.inicioSeg}`;
    if (mundo.t >= e.inicioSeg && !mundo.ledger.has(chave)) { mundo.ledger.add(chave); iniciarClima(mundo, e.tipo, e); }
  }
  const ev = mundo.climaEvento;
  if (!ev) { mundo.climaAtivo = null; return; }
  if (mundo.t >= ev.fim) { mundo.climaEvento = null; mundo.climaAtivo = null; mundo.evento('clima_fim', null, { clima: ev.tipo }); return; }
  const rampa = Math.max(0, Math.min(1, (mundo.t - ev.inicio) / RAMPA_SEG, (ev.fim - mundo.t) / RAMPA_SEG));
  const i = ev.intensidadeAlvo * rampa, def = CLIMAS[ev.tipo];
  const at = { tipo: ev.tipo, nome: def.nome, intensidade: i, deltaTemperaturaC: def.deltaTemperaturaC * i, umidade: def.umidade * i, apagaRastros: def.apagaRastros && i > 0.5, restaSeg: ev.fim - mundo.t };
  for (const f of FATORES) at[f] = 1 + (def[f] - 1) * i;
  mundo.climaAtivo = at;
}

// Fisiologia por passo: o esforço custa mais sob clima adverso; fora da faixa térmica da espécie há perda de
// energia e, no extremo, de vida. Ficha: especie.resistenciaClimatica { frioMinC, calorMaxC } (padrão −5 / 45).
export function custoClimatico(a, mundo, dt) {
  const at = mundo.climaAtivo;
  const r = a.especie.resistenciaClimatica ?? {};
  const tAmb = temperaturaAmbiente(mundo);
  const abrigado = a.estado === 'abrigado';
  let gasto = 0;
  if (at && a.velocidade > 0.2) gasto += a.especie.necessidades.custoBasePorSeg * (at.custoEnergia - 1) * 10 * dt;
  const frio = (r.frioMinC ?? -5) - tAmb, calor = tAmb - (r.calorMaxC ?? 45);
  const excesso = Math.max(frio, calor, 0) * (abrigado ? 0.4 : 1);
  if (excesso > 0) {
    gasto += 0.04 * excesso * dt;
    // Sem energia para manter a temperatura: hipotermia/hipertermia passa a tirar vida.
    if (a.energia <= a.especie.necessidades.limiteExaustao) { a.saude.hp -= a.saude.hpMax * 0.0008 * excesso * dt; a.saude.danoClima = (a.saude.danoClima ?? 0) + a.saude.hpMax * 0.0008 * excesso * dt; }
  }
  if (gasto) { a.energia = Math.max(0, a.energia - gasto); a.energiaClima = (a.energiaClima ?? 0) + gasto; }
}

// Vale a pena procurar abrigo? Só clima que cega ou castiga (tempestade de areia, nevasca, chuva forte no auge).
export const pedeAbrigo = (mundo) => !!mundo.climaAtivo && mundo.climaAtivo.intensidade > 0.5 && mundo.climaAtivo.visao < 0.6;
