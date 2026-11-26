// Classificação de encontros e agregação de métricas de um mundo V2 (usada pelo CLI, testes e demo).
import { criarMundoEco, passoEco, hashMundo, retrato } from './mundo.js';

export function rodarCenario(config, cenarioId, semente, { segundos, opcoes = {} } = {}) {
  const cen = config.cenarios[cenarioId];
  const m = criarMundoEco(config, cen, semente, opcoes);
  const ate = segundos ?? cen.duracaoSeg ?? 300;
  const ini = Date.now();
  while (m.t < ate - 1e-9) passoEco(m);
  return { mundo: m, resumo: resumir(m, Date.now() - ini) };
}

export function resumir(m, ms = 0) {
  const ev = m.eventos;
  const conta = (tipo, f = () => true) => ev.filter((e) => e.tipo === tipo && f(e)).length;
  const conflitos = ev.filter((e) => e.tipo === 'conflito_fim');
  const fases = {};
  for (const c of conflitos) fases[c.faseFinal] = (fases[c.faseFinal] ?? 0) + 1;
  const desfechos = {};
  for (const c of conflitos) desfechos[c.motivo] = (desfechos[c.motivo] ?? 0) + 1;
  const persegs = m.perseguicoes;
  const presasFeridasVivas = new Set(ev.filter((e) => e.tipo === 'ferimento').map((e) => e.id).filter((id) => m.porId.has(id) && m.porId.get(id).especie.papel === 'herbivoro'));
  const r = retrato(m);
  // Rótulos de "resultado" do encontro principal (não exclusivos): o que de fato aconteceu nesta semente.
  const rotulos = [];
  if (m.metricas.predacoes) rotulos.push('predacao');
  if (presasFeridasVivas.size) rotulos.push('presa_ferida_sobreviveu');
  if (conflitos.some((c) => c.faseFinal === 'combate')) rotulos.push('combate_entre_carnivoros');
  if (conflitos.some((c) => c.faseFinal !== 'combate' && ['cedeu', 'intimidado'].includes(c.motivo))) rotulos.push('intimidacao_sem_combate');
  if (m.metricas.escapesDuranteDisputa) rotulos.push('presa_escapou_durante_disputa');
  if (persegs.some((p) => p.motivo === 'desistiu_cansaco')) rotulos.push('desistencia_cansaco');
  if (persegs.some((p) => p.motivo === 'desistiu_perda_rastro')) rotulos.push('perda_de_rastro');
  if (!persegs.length && !conflitos.length) rotulos.push('sem_caca_nem_disputa');
  if (conta('carcaca_reciclada') || m.carcacas.some((c) => Object.keys(c.consumo).length > 1)) rotulos.push('carcaca_disputada_ou_reciclada');
  return {
    cenario: m.cenarioId, semente: m.semente, hash: hashMundo(m), segundos: m.t, msExecucao: ms, rotulos,
    populacaoFinal: r.populacao, mortes: m.metricas.mortes, predacoes: m.metricas.predacoes,
    perseguicoes: persegs.length, perseguicoesPorDesfecho: contar(persegs.map((p) => p.motivo)), duracaoMediaPerseguicao: persegs.length ? +(persegs.reduce((s, p) => s + p.duracao, 0) / persegs.length).toFixed(2) : 0,
    ataques: conta('ataque_inicio'), golpes: conta('ferimento'), esquivas: conta('esquiva'), errados: conta('golpe_errou'),
    presasFeridasVivas: presasFeridasVivas.size, alarmes: conta('alarme'), alarmesOuvidos: conta('alarme_ouvido'), protecaoFilhote: conta('protege_filhote'),
    conflitos: conflitos.length, conflitosPorFaseFinal: fases, conflitosPorDesfecho: desfechos, conflitosPorMotivo: contar(conflitos.map((c) => c.motivoDisputa)),
    oportunidadesFuga: conta('oportunidade_fuga'), escapesDuranteDisputa: m.metricas.escapesDuranteDisputa,
    carcacas: m.carcacas.length + conta('carcaca_reciclada'), consumoCarcacas: m.carcacas.map((c) => ({ id: c.id, consumo: c.consumo, restante: +c.carne.toFixed(1) })),
    nascimentos: conta('nascimento') + conta('eclosao'), migracoes: m.metricas.migracoes, contagios: m.metricas.contagios,
    falhas: m.metricas.falhas.length, primeirasFalhas: m.metricas.falhas.slice(0, 3), colisoes: m.animais.reduce((s, a) => s + a.colisoes, 0),
    custo: { msPorAnimalSegundo: +(ms / Math.max(1, m.animais.length) / Math.max(1, m.t)).toFixed(4), ...m.custo },
  };
}

const contar = (l) => l.reduce((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {});
