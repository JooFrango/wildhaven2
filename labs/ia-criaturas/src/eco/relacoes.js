// Relações individuais e interações sociais (V3). Memória social persistente por indivíduo (família, parceiros,
// companheiros, rivais, conhecidos) e atos sociais que nascem de percepção + necessidades + temperamento:
// cumprimento ao reencontrar, limpeza mútua, brincadeira de filhotes, dominância/submissão sem ferimentos,
// vigilância compartilhada e curiosidade por outras espécies. Sem humanizar: cada ato tem custo/benefício
// ecológico (estresse, vigilância, acesso a recurso) e duração curta.
import { cos, sen } from '../core/matematica.js';

const dist = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

export function relacao(a, id, tipo = 'conhecido') {
  if (!a.relacoes) a.relacoes = new Map();
  let r = a.relacoes.get(id);
  if (!r) { r = { tipo, afinidade: 0, familiaridade: 0, interacoes: 0, visto: null, domina: 0 }; a.relacoes.set(id, r); }
  return r;
}

// Vínculos que existem desde o início: mãe↔filhote, companheiros do mesmo grupo.
export function registrarVinculos(mundo) {
  for (const g of mundo.grupos.values()) {
    for (const id of g.membros) for (const outro of g.membros) {
      if (id === outro) continue;
      const a = mundo.porId.get(id); if (!a) continue;
      const r = relacao(a, outro, 'companheiro');
      r.familiaridade = Math.max(r.familiaridade, 0.6); r.afinidade = Math.max(r.afinidade, 0.3);
    }
  }
  for (const a of mundo.vivos) if (a.maeId) vincularFamilia(mundo, a);
}

export function vincularFamilia(mundo, filhote) {
  const mae = mundo.porId.get(filhote.maeId);
  if (!mae) return;
  Object.assign(relacao(filhote, mae.id), { tipo: 'mae', afinidade: 0.9, familiaridade: 1 });
  Object.assign(relacao(mae, filhote.id), { tipo: 'filhote', afinidade: 0.9, familiaridade: 1 });
}

export function vincularParceiros(a, b) {
  for (const [x, y] of [[a, b], [b, a]]) { const r = relacao(x, y.id); if (r.tipo === 'conhecido' || r.tipo === 'companheiro') r.tipo = 'parceiro'; r.afinidade = Math.min(1, r.afinidade + 0.3); r.familiaridade = Math.min(1, r.familiaridade + 0.3); }
}

export function registrarRivalidade(a, b, venceu) {
  const r = relacao(a, b.id);
  if (r.tipo === 'conhecido') r.tipo = 'rival';
  r.afinidade = Math.max(-1, r.afinidade - 0.2);
  r.domina += venceu ? 1 : -1;
}

// Reconhecimento individual: quem já foi visto é reconhecido; familiaridade cresce com a convivência.
// Reencontro de companheiro/família depois de 30 s sem se verem → vontade de cumprimentar.
export function atualizarRelacoes(a, mundo) {
  for (const k of a.contatos) {
    if (k.via !== 'visao' || k.especie !== a.especie.id || k.distancia > 20) continue;
    const r = relacao(a, k.id);
    if (r.visto !== null && mundo.t - r.visto > 30 && ['companheiro', 'mae', 'filhote', 'parceiro'].includes(r.tipo)) {
      a.mente.cumprimentar = { id: k.id, ate: mundo.t + 20 };
    }
    r.visto = mundo.t;
    r.familiaridade = Math.min(1, r.familiaridade + 0.002);
  }
}

const dominancia = (a) => a.massa * (0.5 + a.temperamento.agressividade) * (a.saude.hp / a.saude.hpMax) * (a.juvenil ? 0.2 : 1) + a.idadeAnos * 0.5;

// Atos sociais de herbívoros (quando não há ameaça e nenhuma necessidade é urgente). Retorna intenção ou null.
export function atividadeSocial(a, mundo, livre) {
  const t = mundo.t, e = a.especie;
  const ativo = a.mente.social;
  // Ato em andamento: continua até o fim se o parceiro ainda está perto.
  if (ativo && t < ativo.ate) {
    const p = a.contatos.find((k) => k.id === ativo.com && k.via === 'visao');
    if (p) return continuar(a, mundo, ativo, p);
    a.mente.social = null;
  } else if (ativo) {
    terminar(a, mundo, ativo);
  }
  if (!livre) return null;
  const vistos = a.contatos.filter((k) => k.via === 'visao');
  // 1) Resposta a convite (perceptível: o outro está virado para mim fazendo o ato).
  const convite = vistos.find((k) => k.foco === a.id && ['cumprimentando', 'limpando', 'brincando'].includes(k.comportamento) && k.especie === e.id);
  if (convite && a.rngMente.chance(0.8)) {
    const tipo = convite.comportamento === 'cumprimentando' ? 'cumprimentando' : convite.comportamento === 'limpando' ? 'limpando' : 'brincando';
    return iniciar(a, mundo, tipo, convite, tipo === 'brincando' ? 'fugir' : 'responder');
  }
  // 2) Cumprimento ao reencontrar companheiro/família.
  const cp = a.mente.cumprimentar;
  if (cp && t < cp.ate) {
    const k = vistos.find((x) => x.id === cp.id);
    if (k) { a.mente.cumprimentar = null; return iniciar(a, mundo, 'cumprimentando', k, 'iniciar'); }
  }
  // 3) Brincadeira entre filhotes (energia sobrando, outro filhote à vista).
  if (a.juvenil && a.energia > 60 && a.fome < 60 && a.rngMente.chance(0.015)) {
    const k = vistos.find((x) => x.juvenil && x.especie === e.id && x.distancia < 12);
    if (k) return iniciar(a, mundo, 'brincando', k, 'perseguir');
  }
  // 4) Limpeza mútua com quem tem mais afinidade (descansando/parado, estresse alto aumenta a vontade).
  if (!a.juvenil && e.social.tipo === 'bando' && a.rngMente.chance(0.0012 + 0.008 * (a.estresse ?? 0))) {
    const k = vistos.filter((x) => x.especie === e.id && x.distancia < 6 && !x.juvenil).sort((x, y) => (relacao(a, y.id).afinidade - relacao(a, x.id).afinidade) || (x.id < y.id ? -1 : 1))[0];
    if (k) return iniciar(a, mundo, 'limpando', k, 'iniciar');
  }
  // 5) Curiosidade: espécie diferente, inofensiva, ainda não investigada; mais em jovens e pouco medrosos.
  if (a.temperamento.medo < (a.juvenil ? 0.75 : 0.5) && a.rngMente.chance(a.juvenil ? 0.01 : 0.003)) {
    const k = vistos.find((x) => x.especie !== e.id && !e.teme.includes(x.especie) && x.distancia < 25 && x.distancia > 6 && !(a.mente.investigados ?? []).includes(x.id));
    if (k) {
      (a.mente.investigados ??= []).push(k.id);
      if (a.mente.investigados.length > 20) a.mente.investigados.shift();
      return iniciar(a, mundo, 'curioso', k, 'aproximar');
    }
  }
  return null;
}

// Competição pelo mesmo ponto (pasto/água): o menos dominante cede; dominâncias parecidas e temperamentos
// agressivos → disputa social ritualizada curta (empurrões de cabeça, sem dano). Retorna intenção ou null.
export function competirPorRecurso(a, mundo, ponto) {
  if (!ponto) return null;
  const outro = a.contatos.find((k) => k.via === 'visao' && !k.juvenil && dist(k, ponto) < 1.6 && dist(a, ponto) < 3 && ['comendo', 'bebendo'].includes(k.comportamento));
  if (!outro || a.juvenil) return null;
  const real = mundo.porId.get(outro.id);
  if (!real || real.especie.papel !== 'herbivoro') return null;
  if (ponto.outraEspecie && real.especie.id === a.especie.id) return null; // no pasto, o próprio bando divide
  const ra = relacao(a, outro.id);
  // Só o que é observável do outro: porte estimado; do próprio histórico, quem costuma dominar quem.
  const da = a.massa * (1 + 0.15 * ra.domina) * (0.7 + 0.6 * a.temperamento.agressividade), db = outro.massaEstimada ?? real.massa;
  const razao = da / Math.max(1e-6, db);
  const t = mundo.t;
  if (razao < 0.85 || (real.especie.id !== a.especie.id && real.massa > a.massa * 1.3)) {
    ra.domina -= 0.5; ra.interacoes++;
    if (!a.mente.cedeuEm || t - a.mente.cedeuEm > 10) { a.mente.cedeuEm = t; mundo.evento('submissao', a.id, { para: outro.id, recurso: ponto.id ?? 'pasto' }); }
    a.mente.evitarPonto = { x: ponto.x, y: ponto.y, ate: t + 20 };
    return { estado: 'submissao', codigo: 'cede_recurso', motivo: `cede o lugar para ${outro.id} (mais dominante)`, alvo: null, destino: { x: a.x + (a.x - outro.x) * 1.5, y: a.y + (a.y - outro.y) * 1.5 }, ritmo: 'andar' };
  }
  if (razao < 1.15 && a.especie.id === real.especie.id && a.temperamento.agressividade > 0.5 && !a.mente.social && a.rngMente.chance(0.3)) {
    return iniciar(a, mundo, 'disputa_social', outro, 'iniciar');
  }
  return null;
}

const DURACAO = { cumprimentando: 2.5, limpando: 6, brincando: 5, curioso: 5, disputa_social: 3 };

function iniciar(a, mundo, tipo, k, papel) {
  a.mente.social = { tipo, com: k.id, ate: mundo.t + DURACAO[tipo] * (0.8 + 0.4 * a.rngMente.proximo()), papel, desde: mundo.t };
  mundo.evento(tipo === 'cumprimentando' ? 'cumprimento' : tipo === 'limpando' ? 'limpeza_mutua' : tipo === 'brincando' ? 'brincadeira' : tipo === 'curioso' ? 'curiosidade' : 'disputa_social', a.id, { com: k.id, papel });
  return continuar(a, mundo, a.mente.social, k);
}

function continuar(a, mundo, s, k) {
  const r = relacao(a, k.id);
  const d = k.distancia ?? dist(a, k);
  const olhar = { x: k.x, y: k.y };
  switch (s.tipo) {
    case 'cumprimentando':
      return { estado: 'cumprimentando', codigo: 'cumprimento', motivo: `cumprimenta ${k.id} (${r.tipo}, afinidade ${r.afinidade.toFixed(2)})`, alvo: { tipo: 'criatura', id: k.id, x: k.x, y: k.y }, destino: d > 1.6 ? olhar : null, ritmo: 'andar', olharPara: olhar, acao: 'chamar' };
    case 'limpando':
      return { estado: 'limpando', codigo: 'limpeza_mutua', motivo: `limpeza mútua com ${k.id}`, alvo: { tipo: 'criatura', id: k.id, x: k.x, y: k.y }, destino: d > 1.4 ? olhar : null, ritmo: 'andar', olharPara: olhar, acao: 'limpar' };
    case 'brincando': {
      // Papéis alternam: quem persegue corre até o outro; quem foge se afasta em trote (sem pânico).
      const perseguir = s.papel === 'perseguir';
      const dest = perseguir ? olhar : { x: a.x + (a.x - k.x) * 2, y: a.y + (a.y - k.y) * 2 };
      if (perseguir && d < 1.5) s.papel = 'fugir';
      return { estado: 'brincando', codigo: perseguir ? 'brinca_persegue' : 'brinca_foge', motivo: `brincando com ${k.id} (${perseguir ? 'persegue' : 'é perseguido'})`, alvo: { tipo: 'criatura', id: k.id, x: k.x, y: k.y }, destino: dest, ritmo: 'trote', olharPara: perseguir ? olhar : null };
    }
    case 'curioso':
      return { estado: 'curioso', codigo: 'investiga', motivo: `curiosidade: observa ${k.id} (${k.especie})`, alvo: { tipo: 'criatura', id: k.id, x: k.x, y: k.y }, destino: d > 7 ? olhar : null, ritmo: 'andar', olharPara: olhar, acao: 'farejar' };
    default:
      return { estado: 'disputa_social', codigo: 'empurra_cabeca', motivo: `disputa ritualizada com ${k.id} (sem ferimentos)`, alvo: { tipo: 'criatura', id: k.id, x: k.x, y: k.y }, destino: d > 1.3 ? olhar : null, ritmo: 'andar', olharPara: olhar, acao: 'exibicao' };
  }
}

function terminar(a, mundo, s) {
  a.mente.social = null;
  const r = relacao(a, s.com);
  r.interacoes++;
  if (s.tipo === 'limpando') { r.afinidade = Math.min(1, r.afinidade + 0.08); a.estresse = Math.max(0, (a.estresse ?? 0) - 0.3); }
  else if (s.tipo === 'cumprimentando') r.afinidade = Math.min(1, r.afinidade + 0.04);
  else if (s.tipo === 'brincando') { r.afinidade = Math.min(1, r.afinidade + 0.05); a.energia = Math.max(0, a.energia - 3); }
  else if (s.tipo === 'disputa_social') {
    const o = mundo.porId.get(s.com);
    if (o && o.mente.social?.tipo !== 'disputa_social') {
      // Resultado: dominância + sorteio do próprio animal; quem perde cede o lugar por um tempo.
      const venceu = dominancia(a) * (0.8 + 0.4 * a.rngMente.proximo()) > dominancia(o);
      r.domina += venceu ? 1 : -1; r.afinidade = Math.max(-1, r.afinidade - 0.05);
      mundo.evento('disputa_social_fim', a.id, { com: o.id, venceu });
      if (!venceu) a.mente.evitarPonto = { x: o.x, y: o.y, ate: mundo.t + 20 };
    }
  }
}

// Vigilância compartilhada: quem pasta em grupo levanta a cabeça de tempos em tempos; quanto maior o grupo
// visível, menos cada um precisa vigiar ("muitos olhos").
export function vigiaEnquantoPasta(a, mundo) {
  if (a.estado !== 'pastando' || a.juvenil) return null;
  const t = mundo.t;
  if (a.mente.vigiaAte > t) return { estado: 'vigiando', codigo: 'olhar_em_volta', motivo: 'levanta a cabeça entre bocados (vigilância)', alvo: null, destino: null, ritmo: 'parado', acao: 'vigiar', olharPara: { x: a.x + cos(a.numero + t) * 10, y: a.y + sen(a.numero + t) * 10 } };
  const companheiros = a.contatos.filter((k) => k.via === 'visao' && k.especie === a.especie.id && k.distancia < 15).length;
  const p = (0.06 * a.temperamento.vigilancia * 2) / Math.sqrt(1 + companheiros) * mundo.dt * 10;
  if (a.rngMente.chance(p)) { a.mente.vigiaAte = t + 1.2 + a.rngMente.proximo(); mundo.metricas.olhadasVigilancia = (mundo.metricas.olhadasVigilancia ?? 0) + 1; }
  return null;
}
