// Veneno (V7, experimental). Abstração de gameplay, não bioquímica: cada inoculação vira uma CARGA por kg
// da vítima que decai com meia-vida; os sintomas saem da carga. Só entra por golpe que feriu (contato real).
// Ficha: especie.veneno { tipo, potencia, doseMg, reservaMg, recargaMgPorSeg, ataques[], meiaVidaSeg, latenciaSeg,
// esperaSeg } e especie.resistenciaVeneno (0..0,95; nunca imunidade).
import { exp } from '../core/matematica.js';

const LN2 = 0.6931471805599453;
// Peso da região: perto de vasos grandes a dose age mais; extremidade, menos.
const REGIAO = { pescoco: 1.3, tronco: 1.0, flanco: 1.0, cabeca: 1.1, pernas: 0.75, cauda: 0.5 };
export const TIPOS_VENENO = Object.freeze(['neurotoxico', 'hemotoxico', 'citotoxico']);

export function estadoVeneno(a) {
  const v = a.especie.veneno;
  if (v) a.veneno = { reserva: v.reservaMg, inoculacoes: 0, secas: 0 };
}

export const resistenciaVeneno = (a) => Math.min(0.95, a.resistenciaVeneno ?? a.especie.resistenciaVeneno ?? 0);

// Decisão de gastar veneno: caça e defesa justificam; disputa ritual com rival da mesma guilda, não.
function querInocular(a, alvo) {
  if (a.especie.dieta.presas.includes(alvo.especie.id)) return true;
  if ((a.especie.teme ?? []).includes(alvo.especie.id)) return true;
  return a.saude.hp < a.saude.hpMax * 0.6;
}

// Chamado pelo combate DEPOIS de `ferir`: sem ferimento registrado não há inoculação.
// Carga 1,0 = 1 mg por kg de vítima com potência 1 (dose de referência, grave).
export function inocular(a, alvo, nomeAtaque, fer, mundo) {
  const v = a.especie.veneno;
  if (!v || !a.veneno || !v.ataques.includes(nomeAtaque)) return null;
  if (!querInocular(a, alvo)) { a.veneno.secas++; mundo.evento('mordida_seca', a.id, { alvo: alvo.id, motivo: 'poupou_veneno' }); return null; }
  // Dose proporcional ao porte do alvo: não gasta a glândula inteira numa presa pequena.
  const dose = Math.min(a.veneno.reserva, v.doseMg * Math.min(1, Math.max(0.3, alvo.massa / a.massa)));
  if (dose < v.doseMg * 0.05) { a.veneno.secas++; mundo.evento('mordida_seca', a.id, { alvo: alvo.id, motivo: 'reserva_esgotada' }); return null; }
  a.veneno.reserva -= dose; a.veneno.inoculacoes++;
  a.energia = Math.max(0, a.energia - dose * (v.custoEnergiaPorMg ?? 0));
  const res = resistenciaVeneno(alvo);
  const carga = (dose * v.potencia * (1 - res) * (REGIAO[fer.regiao] ?? 1)) / alvo.massa;
  const reg = { tipo: v.tipo, carga, cargaInicial: carga, origem: a.id, especieOrigem: a.especie.id, regiao: fer.regiao, ferimento: fer.id, desde: mundo.t,
    meiaVidaSeg: v.meiaVidaSeg / (1 + 2 * res), latenciaSeg: v.latenciaSeg ?? 8 };
  (alvo.saude.venenos ??= []).push(reg);
  // A espera conta da PRIMEIRA mordida nesta presa; mordidas seguintes não reiniciam o relógio.
  if (a.mente.inoculou?.id !== alvo.id) a.mente.inoculou = { id: alvo.id, t: mundo.t };
  mundo.metricas.inoculacoes = (mundo.metricas.inoculacoes ?? 0) + 1;
  mundo.evento('inoculacao', alvo.id, { atacante: a.id, veneno: v.tipo, doseMg: +dose.toFixed(2), carga: +carga.toFixed(3), regiao: fer.regiao, resistencia: res, reservaRestanteMg: +a.veneno.reserva.toFixed(2) });
  return reg;
}

// Intensidade atual de um registro: a carga só age depois da latência (absorção).
const efeito = (v, t) => v.carga * (1 - exp(-(t - v.desde) / v.latenciaSeg));

export function intensidadeVeneno(a, t, tipo = null) {
  let i = 0;
  for (const v of a.saude.venenos ?? []) if (!tipo || v.tipo === tipo) i += efeito(v, t);
  return i;
}

// Por passo: recarrega a glândula, decai a carga, aplica sintomas. Devolve o dano causado pelo veneno.
export function atualizarVeneno(a, mundo, dt) {
  const ev = a.especie.veneno;
  if (ev && a.veneno) a.veneno.reserva = Math.min(ev.reservaMg, a.veneno.reserva + ev.recargaMgPorSeg * dt * (a.fome < 80 ? 1 : 0.3));
  const s = a.saude, lista = s.venenos;
  if (!lista?.length) return 0;
  const t = mundo.t;
  let mob = 1, forca = 1, dano = 0, neuro = 0, hemo = 0, cito = 0;
  for (const v of lista) {
    const i = efeito(v, t);
    const f = s.ferimentos.find((x) => x.id === v.ferimento);
    if (v.tipo === 'neurotoxico') neuro += i;
    else if (v.tipo === 'hemotoxico') {
      hemo += i;
      dano += s.hpMax * 0.004 * i * dt;
      // Anticoagulante: o ferimento da mordida volta a sangrar enquanto houver carga.
      if (f) f.sangramento = Math.max(f.sangramento, 0.25 * Math.min(1, i));
    } else {
      cito += i;
      // Necrose local: a lesão da própria mordida se agrava (nas pernas, tira mobilidade pelo sistema de saúde).
      if (f) f.gravidade = Math.min(0.6, f.gravidade + 0.004 * i * dt);
      dano += s.hpMax * 0.0012 * i * dt;
      s.dor = Math.min(1, s.dor + 0.03 * i * dt);
    }
    v.carga *= exp((-LN2 * dt) / v.meiaVidaSeg);
  }
  if (neuro > 0) {
    mob *= Math.max(0.05, 1 - 0.85 * Math.min(1, neuro));
    forca *= Math.max(0.3, 1 - 0.6 * Math.min(1, neuro));
    // Paralisia: carga grave derruba; acima disso compromete a respiração.
    if (neuro >= 0.9) s.caidoAte = Math.max(s.caidoAte, t + 1);
    if (neuro > 1.1) dano += s.hpMax * 0.02 * (neuro - 1.1) * dt;
  }
  if (hemo > 0) forca *= Math.max(0.5, 1 - 0.3 * Math.min(1, hemo));
  s.venenos = lista.filter((v) => v.carga > 0.01);
  s.hp -= dano;
  s.danoVeneno = (s.danoVeneno ?? 0) + dano;
  // Expirou: nenhum efeito residual (mobilidade e força voltam; o dano para).
  if (!s.venenos.length) { s.veneno = null; mundo.evento('veneno_expirou', a.id, { danoTotal: +s.danoVeneno.toFixed(1) }); }
  else s.veneno = { mobilidade: mob, forca, neuro, hemo, cito, danoPorSeg: dano / dt };
  return dano;
}

// Sintomas legíveis (inspetor e testes).
export function sintomasVeneno(a) {
  const v = a.saude.veneno;
  if (!v) return [];
  const out = [];
  if (v.neuro >= 0.9) out.push('paralisia');
  else if (v.neuro >= 0.5) out.push('fraqueza muscular');
  else if (v.neuro >= 0.2) out.push('tremores e lentidão');
  else if (v.neuro > 0.03) out.push('descoordenação leve');
  if (v.hemo >= 0.5) out.push('hemorragia');
  else if (v.hemo > 0.03) out.push('sangramento que não coagula');
  if (v.cito >= 0.5) out.push('necrose local');
  else if (v.cito > 0.03) out.push('dor e inchaço local');
  return out;
}

// A morte é "envenenamento" quando o veneno tirou parte relevante da vida ou o animal morreu sob sintomas graves
// (a hemorragia induzida é contada pelo sangramento, não por danoVeneno). Golpe que mata na hora continua predação.
export const morreuDeVeneno = (a) => (a.saude.danoVeneno ?? 0) > a.saude.hpMax * 0.25 || (a.saude.veneno?.hemo ?? 0) >= 0.5 || (a.saude.veneno?.neuro ?? 0) >= 1.1;
