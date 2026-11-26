// Cérebro de herbívoro: procurar alimento, comer, detectar perigo, fugir e voltar à atividade quando seguro.
// Contrato: decidir(sentidos, mente) -> intenção. `sentidos` contém só o que a criatura percebeu/lembra.
import { distancia } from '../geometria.js';
import { calcularPontoDeFuga, fmt, maisProximo, maisRecente, sortearPontoVagar } from './utilidades.js';

export const herbivoro = {
  id: 'herbivoro',
  estadosFuga: ['fugindo'],
  estadosCaca: [],
  inicioPerseguicao: null,

  decidir(s, mente) {
    const eu = s.eu, p = eu.especie.decisao;
    const teme = eu.especie.relacoes.teme ?? [];
    const ameacas = s.contatos.filter((k) => teme.includes(k.especie));
    const vistas = ameacas.filter((k) => k.via === 'visao');
    const ouvidas = ameacas.filter((k) => k.via === 'audicao');
    const lembradas = s.memoria.criaturas.filter((m) => teme.includes(m.especie));
    const fugindo = eu.estado === 'fugindo';

    // 1. Perigo visto: foge imediatamente.
    if (vistas.length) {
      const a = maisProximo(vistas, eu);
      return fugir(s, mente, a, `viu ${a.especie} a ${fmt(a.distancia)} m`, 'viu_predador');
    }
    // 2. Perigo ouvido: foge se já estava fugindo ou se está perto; senão fica em alerta e olha.
    if (ouvidas.length) {
      const a = maisProximo(ouvidas, eu);
      if (fugindo) return fugir(s, mente, a, `ouviu ${a.especie} a ~${fmt(a.distancia)} m enquanto fugia`, 'ouviu_fugindo');
      if (a.distancia <= p.distanciaPanicoAudicao) return fugir(s, mente, a, `ouviu ${a.especie} muito perto (~${fmt(a.distancia)} m)`, 'ouviu_perto');
      mente.alerta = { ate: s.t + p.tempoAlertaSeg, x: a.x, y: a.y, id: a.id };
      return alerta(mente, `ouviu ruído de ${a.especie} a ~${fmt(a.distancia)} m; parou para olhar`, 'ouviu_ruido');
    }
    // 3. Sem contato atual, mas lembra da ameaça recente: continua fugindo da última posição conhecida.
    if (fugindo) {
      const m = maisRecente(lembradas);
      if (m) {
        const desde = s.t - m.t, d = distancia(eu, m);
        // Só se acalma depois de tempoCalmaSeg sem sinal E longe da última posição conhecida.
        if (desde < p.tempoCalmaSeg || d < p.distanciaSegura) {
          return fugir(s, mente, m, `sem ver ${m.especie} há ${fmt(desde)} s; afasta-se da última posição (${fmt(d)} m)`, 'fugindo_memoria');
        }
      }
      mente.fuga = null;
      mente.recuperar = { ate: s.t + p.tempoRecuperarSeg, x: m?.x ?? eu.x, y: m?.y ?? eu.y };
      return recuperando(mente, 'nenhum sinal do predador; considera-se seguro', 'seguro');
    }
    if (mente.recuperar && s.t < mente.recuperar.ate) return recuperando(mente, 'recuperando o fôlego e vigiando', 'recuperando');
    mente.recuperar = null;
    if (mente.alerta && s.t < mente.alerta.ate) return alerta(mente, 'continua em alerta olhando para o ruído', 'alerta');
    mente.alerta = null;

    // 4. Energia baixa: descansa.
    const descansando = eu.estado === 'descansando';
    if (eu.energia < p.energiaDescanso || (descansando && eu.energia < p.energiaRetomar)) {
      return { estado: 'descansando', codigo: 'cansado', motivo: `energia ${fmt(eu.energia)} abaixo de ${descansando ? p.energiaRetomar : p.energiaDescanso}`, alvo: null, destino: null, ritmo: 'parado' };
    }

    // 5. Fome: vai ao alimento conhecido mais próximo; sem alimento conhecido, procura.
    const emAlimentacao = eu.estado === 'comendo' || eu.estado === 'indo_comer' || eu.estado === 'procurando_alimento';
    if (eu.fome > p.fomeProcurar || (emAlimentacao && eu.fome > p.fomeSaciado)) {
      const opcoes = s.memoria.alimentos.filter((f) => f.quantidade > 1 && (eu.especie.relacoes.come ?? []).includes(f.tipo));
      const f = maisProximo(opcoes, eu);
      if (f) {
        const alvo = { tipo: 'alimento', id: f.id, x: f.x, y: f.y };
        if (distancia(eu, f) <= f.raio) {
          return { estado: 'comendo', codigo: 'comendo', motivo: `fome ${fmt(eu.fome)}; comendo em ${f.id}`, alvo, destino: null, ritmo: 'parado', acao: 'comer' };
        }
        return { estado: 'indo_comer', codigo: 'viu_alimento', motivo: `fome ${fmt(eu.fome)}; alimento ${f.id} a ${fmt(distancia(eu, f))} m`, alvo, destino: { x: f.x, y: f.y }, ritmo: 'andar' };
      }
      return vagar(s, mente, 'procurando_alimento', 'sem_alimento_conhecido', `fome ${fmt(eu.fome)} e nenhum alimento conhecido; procurando`, p.raioBuscaAlimento);
    }

    // 6. Sem necessidades urgentes: vaga devagar.
    return vagar(s, mente, 'vagando', 'ocioso', `saciado (fome ${fmt(eu.fome)}); vagando`, p.raioVagar);
  },
};

function fugir(s, mente, ameaca, motivo, codigo) {
  const p = s.eu.especie.decisao;
  mente.alerta = null;
  if (!mente.fuga || s.t >= mente.fuga.reavaliar || distancia(s.eu, mente.fuga.ponto) < 1.5) {
    mente.fuga = { ponto: calcularPontoDeFuga(s, ameaca, p), reavaliar: s.t + p.reavaliarFugaSeg };
  }
  return {
    estado: 'fugindo', codigo, motivo,
    alvo: { tipo: 'criatura', id: ameaca.id, x: ameaca.x, y: ameaca.y },
    destino: mente.fuga.ponto, ritmo: p.ritmoFuga,
  };
}

function alerta(mente, motivo, codigo) {
  const a = mente.alerta;
  return { estado: 'alerta', codigo, motivo, alvo: { tipo: 'ponto', x: a.x, y: a.y }, destino: null, ritmo: 'parado', olharPara: { x: a.x, y: a.y } };
}

function recuperando(mente, motivo, codigo) {
  const r = mente.recuperar;
  return { estado: 'recuperando', codigo, motivo, alvo: null, destino: null, ritmo: 'parado', olharPara: { x: r.x, y: r.y } };
}

function vagar(s, mente, estado, codigo, motivo, raioBusca) {
  if (!mente.vagar || s.t > mente.vagar.ate || distancia(s.eu, mente.vagar.ponto) < 1) {
    mente.vagar = { ponto: sortearPontoVagar(s, raioBusca), ate: s.t + s.rng.entre(4, 9) };
  }
  return { estado, codigo, motivo, alvo: null, destino: mente.vagar.ponto, ritmo: 'andar' };
}
