// Cérebro de predador: patrulhar, detectar, aproximar, perseguir, atacar e desistir (cansaço ou perda de rastro).
// Contrato: decidir(sentidos, mente) -> intenção. Só usa contatos e memória (última posição conhecida).
import { cos, sen } from '../matematica.js';
import { distancia } from '../geometria.js';
import { fmt, maisProximo, pontoLivre, pontoNoTerreno } from './utilidades.js';

const ESTADOS_CACA = ['aproximando', 'perseguindo', 'atacando', 'investigando', 'farejando'];

export const predador = {
  id: 'predador',
  estadosFuga: [],
  estadosCaca: ESTADOS_CACA,
  inicioPerseguicao: 'perseguindo',

  decidir(s, mente) {
    const eu = s.eu, p = eu.especie.decisao, ataque = eu.especie.ataque;
    const presas = eu.especie.relacoes.presas ?? [];
    const vistas = s.contatos.filter((k) => presas.includes(k.especie) && k.via === 'visao');
    const ouvidas = s.contatos.filter((k) => presas.includes(k.especie) && k.via === 'audicao');
    const emCaca = ESTADOS_CACA.includes(eu.estado);
    // Depois de desistir por cansaço, só volta a caçar quando recuperar até energiaRetomar (o desespero não vale mais).
    if (mente.exigirRecuperacao && eu.energia >= p.energiaRetomar) mente.exigirRecuperacao = false;
    const desesperado = !mente.exigirRecuperacao && eu.fome >= p.fomeDesesperada && eu.energia > p.energiaDesistir + p.margemDesespero;
    const podeIniciar = eu.fome >= p.fomeCacar && (eu.energia >= p.energiaRetomar || desesperado);

    // 0. Pausa obrigatória depois de desistir por cansaço.
    if (mente.pausaAte && s.t < mente.pausaAte) {
      return { estado: 'descansando', codigo: 'pausa_desistencia', motivo: `recuperando após desistir (até t=${fmt(mente.pausaAte)} s)`, alvo: null, destino: null, ritmo: 'parado' };
    }
    mente.pausaAte = null;

    // 1. Cansaço durante a caça: desiste.
    if (emCaca && eu.energia <= p.energiaDesistir) {
      mente.caca = null;
      mente.pausaAte = s.t + p.pausaAposDesistirSeg;
      mente.exigirRecuperacao = true;
      return { estado: 'descansando', codigo: 'desistiu_cansaco', motivo: `energia ${fmt(eu.energia)} ≤ ${p.energiaDesistir}: desistiu da caça`, alvo: null, destino: null, ritmo: 'parado' };
    }

    // 2. Presa visível.
    if (vistas.length && (emCaca || podeIniciar)) {
      const a = (mente.caca && vistas.find((k) => k.id === mente.caca.id)) || maisProximo(vistas, eu);
      mente.caca = { id: a.id };
      const alvo = { tipo: 'criatura', id: a.id, x: a.x, y: a.y };
      if (a.distancia <= ataque.alcance) {
        return { estado: 'atacando', codigo: 'em_alcance', motivo: `presa a ${fmt(a.distancia, 2)} m ≤ alcance ${ataque.alcance} m`, alvo, destino: { x: a.x, y: a.y }, ritmo: 'corrida', acao: 'atacar' };
      }
      const presaCorrendo = a.velocidade > eu.especie.movimento.andar * 1.3;
      if (eu.estado === 'perseguindo' || eu.estado === 'atacando' || a.distancia <= p.distanciaCorrida || presaCorrendo) {
        // Intercepta: mira à frente da presa proporcionalmente à distância.
        const antecipa = Math.min(p.antecipacaoMaxSeg, a.distancia / eu.especie.movimento.corrida);
        const destino = pontoNoTerreno(s.terreno, a.x + cos(a.direcao) * a.velocidade * antecipa, a.y + sen(a.direcao) * a.velocidade * antecipa, eu.especie.corpo.raio);
        const porque = eu.estado === 'perseguindo' ? 'mantém perseguição' : presaCorrendo ? 'presa começou a correr' : `presa a ${fmt(a.distancia)} m ≤ ${p.distanciaCorrida} m`;
        return { estado: 'perseguindo', codigo: 'perseguindo', motivo: `${porque}; energia ${fmt(eu.energia)}`, alvo, destino, ritmo: 'corrida' };
      }
      return { estado: 'aproximando', codigo: 'viu_presa', motivo: `viu ${a.especie} a ${fmt(a.distancia)} m; aproxima-se devagar`, alvo, destino: { x: a.x, y: a.y }, ritmo: p.ritmoAproximacao };
    }

    // 3. Caça em andamento sem visão da presa: vai à última posição conhecida, fareja e desiste se perder o rastro.
    if (emCaca && mente.caca) {
      const ouvida = ouvidas.find((k) => k.id === mente.caca.id);
      if (ouvida) {
        return { estado: 'investigando', codigo: 'ouviu_presa', motivo: `sem visão, mas ouviu a presa a ~${fmt(ouvida.distancia)} m`, alvo: { tipo: 'criatura', id: ouvida.id, x: ouvida.x, y: ouvida.y }, destino: { x: ouvida.x, y: ouvida.y }, ritmo: 'trote' };
      }
      const m = s.memoria.criaturas.find((x) => x.id === mente.caca.id);
      const desde = m ? s.t - m.t : Infinity;
      if (!m || desde > p.tempoSemContatoMaxSeg) {
        mente.caca = null;
        return { estado: 'patrulhando', codigo: 'desistiu_perda_rastro', motivo: m ? `sem contato há ${fmt(desde)} s > ${p.tempoSemContatoMaxSeg} s: perdeu o rastro` : 'memória da presa expirou: perdeu o rastro', alvo: null, destino: null, ritmo: 'parado' };
      }
      const alvo = { tipo: 'criatura', id: m.id, x: m.x, y: m.y };
      if (distancia(eu, m) > p.raioChegadaUltimaPosicao) {
        return { estado: 'investigando', codigo: 'indo_ultima_posicao', motivo: `perdeu contato há ${fmt(desde)} s; indo à última posição (${fmt(m.x)}, ${fmt(m.y)})`, alvo, destino: { x: m.x, y: m.y }, ritmo: 'trote' };
      }
      const ang = s.t * 2.2;
      return { estado: 'farejando', codigo: 'farejando', motivo: `chegou à última posição; procurando há ${fmt(desde)} s`, alvo, destino: null, ritmo: 'parado', olharPara: { x: eu.x + cos(ang) * 5, y: eu.y + sen(ang) * 5 } };
    }

    // 4. Ouviu possível presa: investiga se tem condição de caçar.
    if (ouvidas.length && podeIniciar) {
      const a = maisProximo(ouvidas, eu);
      mente.caca = { id: a.id };
      return { estado: 'investigando', codigo: 'ouviu_presa', motivo: `ouviu ${a.especie} a ~${fmt(a.distancia)} m`, alvo: { tipo: 'criatura', id: a.id, x: a.x, y: a.y }, destino: { x: a.x, y: a.y }, ritmo: 'andar' };
    }

    // 5. Descanso.
    const descansando = eu.estado === 'descansando';
    if (eu.energia < p.energiaDescanso || (descansando && eu.energia < p.energiaRetomar && !podeIniciar)) {
      const extra = vistas.length ? `; viu presa mas não tem energia (${fmt(eu.energia)}) nem fome (${fmt(eu.fome)}) suficientes` : '';
      return { estado: 'descansando', codigo: vistas.length ? 'ignorou_presa' : 'cansado', motivo: `energia ${fmt(eu.energia)} < ${descansando ? p.energiaRetomar : p.energiaDescanso}${extra}`, alvo: null, destino: null, ritmo: 'parado' };
    }

    // 6. Patrulha.
    if (!mente.patrulha) mente.patrulha = { pontos: gerarPatrulha(s), indice: 0 };
    const pat = mente.patrulha;
    let alvoPat = pat.pontos[pat.indice];
    if (distancia(eu, alvoPat) < p.raioChegadaPatrulha) {
      pat.indice = (pat.indice + 1) % pat.pontos.length;
      alvoPat = pat.pontos[pat.indice];
    }
    const extra = vistas.length ? ' (viu presa, mas está saciado)' : '';
    return { estado: 'patrulhando', codigo: 'patrulha', motivo: `patrulhando até o ponto ${pat.indice + 1}/${pat.pontos.length}${extra}`, alvo: { tipo: 'ponto', x: alvoPat.x, y: alvoPat.y }, destino: alvoPat, ritmo: 'andar' };
  },
};

function gerarPatrulha(s) {
  if (s.eu.patrulha && s.eu.patrulha.length) return s.eu.patrulha.map(([x, y]) => ({ x, y }));
  const pontos = [], r = s.eu.especie.corpo.raio + 2;
  while (pontos.length < 4) {
    const p = { x: s.rng.entre(r, s.terreno.largura - r), y: s.rng.entre(r, s.terreno.altura - r) };
    if (pontoLivre(s.terreno, p, r)) pontos.push(p);
  }
  return pontos;
}
