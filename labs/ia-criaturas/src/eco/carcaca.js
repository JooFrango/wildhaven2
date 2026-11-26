// Ciclo da carcaça (V7, experimental). Liga quando o cenário declara `decomposicao`; sem isso vale o
// comportamento antigo (carcaça some ao decompor). A carne só sai por três caminhos contabilizados —
// animais (c.consumo), insetos (c.consumoInsetos) e apodrecimento (c.perdaDecomposicao) — e nunca é criada.
// Cenário: decomposicao { diasAteOssos, ossosDias, maxCarcacas, necrofagos { especie, maxPorCarcaca, comePorSegKg, chegadaPorSeg } }.
import { marcarDisco } from './terreno.js';
import { temperaturaAmbiente } from './clima.js';

export const ESTAGIOS = Object.freeze(['fresca', 'consumida', 'decomposicao', 'restos', 'ossos', 'reciclada']);

// Matéria que ficou no local até a reciclagem: o que apodreceu, o que os insetos comeram ali e os ossos.
// É a massa inicial menos o que os animais carregaram no corpo para outro lugar.
export const materiaLocalKg = (c) =>
  Math.max(0, c.carneInicial - Object.values(c.consumo ?? {}).reduce((s, v) => s + v, 0));

export function estagioCarcaca(c) {
  if (c.reciclada) return 'reciclada';
  if (c.carne <= 0.05) return 'ossos';
  const resto = c.carne / c.carneInicial;
  if (c.decomposicao >= 0.6 || resto < 0.15) return 'restos';
  if (c.decomposicao >= 0.15) return 'decomposicao';
  return resto < 0.9 ? 'consumida' : 'fresca';
}

// Velocidade do apodrecimento: calor e umidade aceleram; corpo grande demora; insetos abrem o tecido.
export function fatorDecomposicao(c, mundo) {
  const tAmb = temperaturaAmbiente(mundo);
  const q10 = Math.max(0.15, Math.min(3, 1 + (tAmb - 20) / 12));
  const umid = mundo.climaAtivo ? 0.8 + 0.6 * mundo.climaAtivo.umidade : mundo.relogio.chovendo ? 1.3 : mundo.terreno.areia ? 0.6 : 1;
  const porte = Math.max(0.4, Math.min(1.8, Math.sqrt(Math.sqrt(12 / Math.max(1, c.carneInicial)))));
  return q10 * umid * porte * (1 + 0.04 * (c.insetos ?? 0));
}

export function atualizarCarcacasV7(mundo, dt) {
  const cfg = mundo.cenario.decomposicao, dia = mundo.relogio.segundosPorDia, t = mundo.terreno;
  const nec = cfg.necrofagos, tAmb = temperaturaAmbiente(mundo);
  for (const c of mundo.carcacas) {
    if (c.dono && !mundo.porId.get(c.dono)) c.dono = null;
    c.ossosKg ??= +(c.carneInicial / 0.55 * 0.12).toFixed(2); // esqueleto ≈ 12% da massa viva
    c.insetos ??= 0; c.consumoInsetos ??= 0; c.perdaDecomposicao ??= 0; c.estagio ??= 'fresca';
    if (c.carne > 0.05) {
      const f = fatorDecomposicao(c, mundo);
      c.decomposicao = Math.min(1, c.decomposicao + (f * dt) / (dia * (cfg.diasAteOssos ?? 2.5)));
      // Tecido que apodrece deixa de ser alimento: perda proporcional ao avanço, mais forte no fim.
      const perda = Math.min(c.carne, c.carneInicial * ((f * dt) / (dia * (cfg.diasAteOssos ?? 2.5))) * (0.3 + c.decomposicao));
      c.carne -= perda; c.perdaDecomposicao += perda;
      if (nec) {
        // Insetos necrófagos: chegam pelo odor (cresce com a decomposição), mais ativos no calor; frio e
        // tempestade os mantêm recolhidos. Limite por carcaça para o custo não crescer sem controle.
        const ativ = Math.max(0, Math.min(1.5, (tAmb - 8) / 16)) * (mundo.climaAtivo ? 1 - 0.8 * mundo.climaAtivo.intensidade : 1);
        const odor = 0.25 + c.decomposicao;
        const teto = Math.min(nec.maxPorCarcaca ?? 30, Math.ceil(c.carne * 4));
        if (c.insetos < teto) c.insetos = Math.min(teto, c.insetos + (nec.chegadaPorSeg ?? 0.05) * odor * ativ * dt);
        else c.insetos = Math.max(teto, c.insetos - 0.2 * dt);
        if (c.insetos >= 1 && !c.insetosDesde) { c.insetosDesde = mundo.t; mundo.evento('necrofagos_chegaram', null, { carcaca: c.id, especie: nec.especie, apos: +(mundo.t - c.morteT).toFixed(1) }); }
        const come = Math.min(c.carne, Math.floor(c.insetos) * (nec.comePorSegKg ?? 0.0006) * ativ * dt);
        c.carne -= come; c.consumoInsetos += come;
      }
      if (c.carne <= 0.05) { c.perdaDecomposicao += c.carne; c.carne = 0; c.ossosDesde = mundo.t; }
    } else {
      // Só ossos: os insetos dispersam e o esqueleto se desfaz devagar.
      c.ossosDesde ??= mundo.t;
      if (c.insetos > 0) { c.insetos = Math.max(0, c.insetos - 0.5 * dt); if (c.insetos === 0) mundo.evento('necrofagos_dispersaram', null, { carcaca: c.id }); }
      const vida = (cfg.ossosDias ?? 6) * dia;
      c.ossosKg = Math.max(0, c.ossosKg - (c.ossosKg0 ??= c.ossosKg) * (dt / vida));
      if (mundo.t - c.ossosDesde >= vida) c.reciclada = true;
    }
    const e = estagioCarcaca(c);
    if (e !== c.estagio && e !== 'reciclada') { mundo.evento('carcaca_estagio', null, { carcaca: c.id, de: c.estagio, para: e, carneKg: +c.carne.toFixed(2), insetos: Math.floor(c.insetos) }); c.estagio = e; }
  }
  // Limite de objetos persistentes: recicla primeiro os ossos mais antigos.
  const max = cfg.maxCarcacas ?? 24;
  if (mundo.carcacas.length > max) {
    const velhas = [...mundo.carcacas].sort((x, y) => (x.carne > 0.05) - (y.carne > 0.05) || x.morteT - y.morteT);
    for (const c of velhas.slice(0, mundo.carcacas.length - max)) { c.reciclada = true; c.porLimite = true; }
  }
  for (const c of mundo.carcacas) if (c.reciclada) {
    // Reciclagem: volta ao solo só a matéria que ficou no local. A carne que os animais levaram no corpo
    // não enriquece este ponto; contá-la aqui criaria nutriente a partir de nada.
    const local = materiaLocalKg(c);
    marcarDisco(t, c.x, c.y, 3, (k) => { t.vegetacaoMax[k] = Math.min(150, t.vegetacaoMax[k] + 2 * Math.sqrt(local)); });
    mundo.evento('ossos_reciclados', null, { carcaca: c.id, porLimite: !!c.porLimite, animaisKg: +Object.values(c.consumo).reduce((s, v) => s + v, 0).toFixed(2), insetosKg: +c.consumoInsetos.toFixed(2), apodreceuKg: +c.perdaDecomposicao.toFixed(2) });
  }
  mundo.carcacas = mundo.carcacas.filter((c) => !c.reciclada);
}
