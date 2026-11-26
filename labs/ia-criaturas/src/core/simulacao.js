// Execução de encontros completos e classificação dos resultados.
import { criarMundo, hashTrilha, passo } from './mundo.js';
import { hashTexto } from './rng.js';

export const RESULTADOS = [
  'captura', 'desistencia_cansaco', 'perda_de_rastro', 'perseguicao_em_andamento', 'perseguicao_interrompida',
  'fuga_sem_perseguicao', 'detectado_sem_perseguicao', 'sem_deteccao',
];

const MOTIVO_PARA_RESULTADO = {
  captura: 'captura',
  desistiu_cansaco: 'desistencia_cansaco',
  desistiu_perda_rastro: 'perda_de_rastro',
  tempo_esgotado: 'perseguicao_em_andamento',
};

export function rodarEncontro(config, cenarioId, semente, { limitePassos = 1e6 } = {}) {
  const mundo = criarMundo(config, cenarioId, semente);
  let n = 0;
  while (passo(mundo) && ++n < limitePassos);
  return { mundo, resumo: analisarEncontro(mundo) };
}

export function analisarEncontro(mundo) {
  const ev = mundo.eventos;
  const conta = (tipo, filtro = () => true) => ev.filter((e) => e.tipo === tipo && filtro(e)).length;
  const deteccoes = ev.filter((e) => e.tipo === 'deteccao' && e.relevante);
  const desistCansaco = conta('desistencia', (e) => e.motivo === 'cansaco');
  const desistRastro = conta('desistencia', (e) => e.motivo === 'perda_rastro');
  const capturas = conta('captura');
  const perseguicoes = mundo.perseguicoes.map((p) => ({ inicio: p.inicio, duracao: p.duracao, motivo: p.motivo }));
  const fugas = conta('fuga_inicio');

  // `resultado`: desfecho da PRIMEIRA perseguição (o encontro em si).
  // `resultadoFinal`: o que aconteceu até o fim do tempo (o predador pode tentar de novo).
  const semPerseguicao = fugas ? 'fuga_sem_perseguicao' : deteccoes.length ? 'detectado_sem_perseguicao' : 'sem_deteccao';
  const primeira = perseguicoes[0];
  const resultado = primeira ? MOTIVO_PARA_RESULTADO[primeira.motivo] ?? 'perseguicao_interrompida' : semPerseguicao;
  let resultadoFinal;
  if (capturas) resultadoFinal = 'captura';
  else if (desistCansaco) resultadoFinal = 'desistencia_cansaco';
  else if (desistRastro) resultadoFinal = 'perda_de_rastro';
  else if (perseguicoes.some((p) => p.motivo === 'tempo_esgotado')) resultadoFinal = 'perseguicao_em_andamento';
  else resultadoFinal = semPerseguicao;

  const det = (id) => deteccoes.find((e) => e.id === id);
  return {
    cenario: mundo.cenarioId,
    semente: mundo.semente,
    hash: hashTrilha(mundo),
    resultado,
    resultadoFinal,
    duracaoEncontro: mundo.t,
    fim: mundo.fim?.motivo ?? null,
    detectou: deteccoes.length > 0,
    primeiraDeteccao: Object.fromEntries(mundo.criaturas.map((c) => [c.id, det(c.id) ? { t: det(c.id).t, via: det(c.id).via, distancia: det(c.id).distancia } : null])),
    quemDetectouPrimeiro: deteccoes[0]?.id ?? null,
    // Furtividade: menor distância entre pares presa/predador, episódios em que um estava no alcance
    // nominal de visão do outro sem ser visto (com o motivo) e o tempo total oculto por motivo.
    distanciaMinima: Math.min(Infinity, ...Object.values(mundo.metricas.distanciaMinima)),
    despercebidos: contarPor(ev.filter((e) => e.tipo === 'despercebido'), 'motivo'),
    ocultoSeg: mundo.metricas.ocultoSeg,
    perseguicoesIniciadas: perseguicoes.length,
    perseguicoes,
    fugas,
    desistenciasCansaco: desistCansaco,
    desistenciasPerdaRastro: desistRastro,
    capturas,
    ataques: conta('ataque'),
    comeu: conta('comer_inicio'),
    decisoes: mundo.decisoes.length,
    falhas: mundo.falhas,
  };
}

function contarPor(lista, campo) {
  const out = {};
  for (const x of lista) out[x[campo]] = (out[x[campo]] ?? 0) + 1;
  return out;
}

// Impressão digital de um lote: um único hash para todas as trilhas (cenário × semente).
// Página e CLI devem imprimir o mesmo valor para a mesma configuração.
export function impressaoDigital(config, sementes = '1-30', cenarios = config.ordemCenarios) {
  const linhas = [];
  for (const id of cenarios) for (const s of interpretarSementes(sementes)) {
    const r = rodarEncontro(config, id, s).resumo;
    linhas.push(`${id}:${s}:${r.hash}:${r.resultado}`);
  }
  return { encontros: linhas.length, hash: hashTexto(linhas.join(',')).toString(16).padStart(8, '0'), linhas };
}

export function interpretarSementes(texto) {
  // "1-30", "5", "1,2,9", "1-10,42"
  const out = [];
  for (const parte of String(texto).split(',')) {
    const [a, b] = parte.split('-').map((x) => parseInt(x, 10));
    if (Number.isNaN(a)) continue;
    if (b === undefined || Number.isNaN(b)) out.push(a);
    else for (let i = a; i <= b; i++) out.push(i);
  }
  return out;
}
