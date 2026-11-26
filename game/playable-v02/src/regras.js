// V02.2 — camada 2 (planejamento) e regras condicionais por cima da IA do Hunter Lab.
//
// Camadas:
//   1. Objetivo do jogador  — tarefas de jogo.js (fila, progresso), nunca apagadas por uma regra: só suspensas.
//   2. Planejamento         — ESTE arquivo: avalia perigo, ferimentos e companheiros a cada 0,5 s e decide se a
//                             tarefa segue, é interrompida, é suspensa por retirada ou é retomada.
//   3. Sobrevivência/combate — o cérebro do lab (cerebro-hunter.js): esquiva, bloqueio, recuo, fuga, golpes. Não é
//                             duplicado aqui; esta camada só liga/desliga o engajamento (`h.hostilCriaturas`) quando o
//                             Hunter NÃO está sendo atacado, e nunca desliga a defesa.
//
// Perfis mudam só parâmetros de decisão e a personalidade (desvio sobre a personalidade individual do Hunter);
// atributos físicos não são tocados.

export const PERFIS = {
  cauteloso: { nome: 'Cauteloso', descricao: 'Prioriza sobreviver: evita confrontos desfavoráveis, recua cedo.',
    toleranciaRisco: 0.5, retiradaHp: 0.6, esperaRetomarSeg: 10, ajuda: false, maxInterrupcoes: 3, descansoAte: 0.95, personalidade: { agressividade: -0.25, cautela: 0.25 } },
  equilibrado: { nome: 'Equilibrado', descricao: 'Busca o objetivo considerando riscos e o grupo.',
    toleranciaRisco: 1.0, retiradaHp: 0.4, esperaRetomarSeg: 6, ajuda: true, maxInterrupcoes: 5, descansoAte: 0.8, personalidade: { agressividade: 0, cautela: 0 } },
  agressivo: { nome: 'Agressivo', descricao: 'Aceita riscos maiores, persegue presas, recua tarde.',
    toleranciaRisco: 1.8, retiradaHp: 0.25, esperaRetomarSeg: 4, ajuda: true, maxInterrupcoes: Infinity, descansoAte: 0.6, personalidade: { agressividade: 0.25, cautela: -0.25 } },
};
// Alvo da missão (caçar a própria espécie que aparece) tolera o dobro do risco: é o motivo de estar ali.
const FATOR_ALVO_MISSAO = 2;
const INTERVALO = 0.5;          // s entre avaliações (estabilidade e custo)
const MIN_TROCA = 2;            // s mínimos entre trocas de regra (exceto defesa)
const COMBATE_FIXO = 6;         // s em que a defesa continua após o último sinal de ataque (evita oscilar evitar↔defender)

export const REGRAS = [
  // assume: a tarefa pausa enquanto a regra vale. continua: a regra fica ativa (registrada uma vez) enquanto vale.
  { id: 'defesa', nome: 'Atacado → defender-se', prioridade: 100, fixa: true, assume: true, continua: true },
  { id: 'retirada', nome: 'Ferimento grave → retirada para a vila', prioridade: 90 },
  { id: 'evitar', nome: 'Ameaça superior → interromper e evitar', prioridade: 80, assume: true, continua: true },
  { id: 'enfrentar', nome: 'Ameaça dentro da tolerância → enfrentar', prioridade: 75, continua: true },
  { id: 'retomar', nome: 'Ameaça sumiu → retomar a missão', prioridade: 70 },
  { id: 'ajudar', nome: 'Companheiro incapacitado → avaliar ajuda', prioridade: 60, assume: true, continua: true },
  { id: 'descansar', nome: 'Na vila e ferido → descansar', prioridade: 40 },
];
const clamp = (v) => Math.max(0, Math.min(1, v));

export function iniciarEstadoRegras(e, a, perfil = 'equilibrado') {
  e.base ??= { ...a.hunter.personalidade };
  e.perfil ??= perfil;
  e.regrasDesligadas ??= {};
  e.prioridades ??= {};
  e.decisoes ??= [];
  e.regraAtiva ??= null;
  aplicarPersonalidade(e, a);
}
function aplicarPersonalidade(e, a) {
  const d = PERFIS[e.perfil].personalidade;
  for (const k of Object.keys(d)) a.hunter.personalidade[k] = clamp(e.base[k] + d[k]);
}
// Troca de perfil: só parâmetros e personalidade; tarefa, fila e interrupção ficam como estão.
export function definirPerfil(jogo, id, perfil, ctx) {
  const e = jogo.hunters.get(id), a = ctx.atorDe(jogo, id);
  if (!PERFIS[perfil] || !e || !a) return;
  const antes = e.perfil; e.perfil = perfil; aplicarPersonalidade(e, a);
  if (antes !== perfil) decidir(jogo, id, { regra: 'perfil', acao: 'perfil', motivo: `Perfil alterado: ${PERFIS[antes].nome} → ${PERFIS[perfil].nome}` }, ctx);
}
export function regraLigada(e, id) { return REGRAS.find((r) => r.id === id).fixa || !e.regrasDesligadas[id]; }
export const prioridade = (e, r) => e.prioridades[r.id] ?? r.prioridade;

// Registro estruturado de decisões: só mudanças. O motivo vem dos números que dispararam a regra.
export function decidir(jogo, id, d, ctx) {
  const e = jogo.hunters.get(id), r = { t: +jogo.t.toFixed(2), ...d };
  e.decisoes.push(r); if (e.decisoes.length > 150) e.decisoes.shift();
  ctx.anotar(jogo, id, d.motivo, 'decisao');
}

// --------------------------------------------------------------- percepção usada pelas regras (só o que o Hunter percebe)
function atacadoPor(m, a) {
  for (const c of a.contatos ?? []) {
    const o = m.porId.get(c.id); if (!o || o.hunter) continue;
    if (o.golpe?.alvo === a.id || o.conflito?.rival === a.id) return o;
    if (o.monstro?.fase === 'combate' && o.monstro.alvo === a.id && c.distancia < 25) return o;
  }
  return null;
}
function ameacas(m, a, e) {
  const alvoMissao = e.atual?.tipo === 'cacar' ? e.atual.especie : null, perfil = PERFIS[e.perfil];
  const aliados = m.hunters.filter((h) => h !== a && h.vivo && !h.hunter.situacao?.match(/rendido|incapacitado/) && Math.hypot(h.x - a.x, h.y - a.y) < 25).length;
  const lista = [];
  for (const c of a.contatos ?? []) {
    const o = m.porId.get(c.id);
    if (!o || o.hunter || o.especie.papel !== 'carnivoro' || c.distancia > 45) continue;
    const massa = c.massaEstimada ?? (o.especie.corpo.massaKg[0] + o.especie.corpo.massaKg[1]) / 2;
    const risco = massa / a.massa / (1 + aliados), tol = perfil.toleranciaRisco * (c.especie === alvoMissao ? FATOR_ALVO_MISSAO : 1);
    lista.push({ id: c.id, especie: c.especie, distancia: c.distancia, risco, tol, superior: risco > tol, x: c.x, y: c.y, aliados });
  }
  return lista;
}

// --------------------------------------------------------------- avaliação
// Devolve true quando a regra ativa assume o Hunter neste passo (a tarefa fica pausada, sem perder o progresso).
export function passoRegras(jogo, id, ctx) {
  const e = jogo.hunters.get(id), a = ctx.atorDe(jogo, id), m = ctx.mundoDe(jogo, id), t = jogo.t;
  if (e.modo !== 'detalhado' || !m || !a?.vivo || m.mortos.has(id) || ctx.foraDeCombate(a)) return false;
  if (t - (e.avaliadoEm ?? -1) >= INTERVALO - 1e-9) { e.avaliadoEm = t; avaliar(jogo, id, e, a, ctx, m); }
  return !!REGRAS.find((r) => r.id === e.regraAtiva)?.assume;
}
function avaliar(jogo, id, e, a, ctx, m) {
  const t = jogo.t, perfil = PERFIS[e.perfil], h = a.hunter;
  const atacante = atacadoPor(m, a);
  if (atacante) e.combateAte = t + COMBATE_FIXO;
  const amea = ameacas(m, a, e), sup = amea.filter((x) => x.superior).sort((x, y) => x.distancia - y.distancia)[0];
  if (sup) { e.ameacaVistaEm = t; e.ameacaUltima = sup; }
  if (amea.length) { e.qualquerAmeacaEm = t; e.ameacaPerto = amea[0]; }
  const vida = a.saude.hp / a.saude.hpMax;
  const pj = ctx.posicao(jogo, id), naVila = Math.hypot(pj.x - jogo.vila.x, pj.y - jogo.vila.y) < 30;
  const incapacitado = m.hunters.filter((o) => o !== a && o.vivo && /incapacitado|rendido/.test(o.hunter.situacao ?? '') && Math.hypot(o.x - a.x, o.y - a.y) < 80)[0];

  // Condições, em ordem de prioridade (o primeiro verdadeiro vence).
  const candidatos = [
    ['defesa', atacante || t < (e.combateAte ?? -1), () => `Defendendo-se: atacado por ${atacante?.especie.nome ?? e.ultimoAtacante ?? 'criatura'}`],
    ['retirada', vida < perfil.retiradaHp && !['voltar', 'descansar'].includes(e.atual?.tipo), () => `Retirada: ferimentos graves (vida ${(vida * 100).toFixed(0)}% < ${(perfil.retiradaHp * 100).toFixed(0)}% do perfil ${perfil.nome.toLowerCase()})`],
    ['evitar', !!sup || (e.interrupcao && t - (e.ameacaVistaEm ?? -1e9) < perfil.esperaRetomarSeg),
      () => { const x = sup ?? e.ameacaUltima; return `${rotuloCurto(e.interrupcao?.tarefa ?? e.atual?.tipo)} interrompida: ameaça superior (${x.especie} a ${x.distancia.toFixed(0)} m, risco ${x.risco.toFixed(2)} > tolerância ${x.tol.toFixed(2)}${x.aliados ? `, ${x.aliados} aliado(s) perto` : ', sozinho'})`; }],
    // Histerese de 4 s: a criatura entrando e saindo da borda de percepção não gera decisões repetidas.
    ['enfrentar', !sup && !e.interrupcao && (amea.length > 0 || t - (e.qualquerAmeacaEm ?? -1e9) < 4), () => { const x = amea[0] ?? e.ameacaPerto; return `Enfrentando ${x.especie} a ${x.distancia.toFixed(0)} m: risco ${x.risco.toFixed(2)} ≤ tolerância ${x.tol.toFixed(2)} (perfil ${perfil.nome.toLowerCase()})`; }],
    ['retomar', !!e.interrupcao && !sup && t - (e.ameacaVistaEm ?? -1e9) >= perfil.esperaRetomarSeg, () => e.interrupcao.tarefa ? `Missão retomada: ameaça fora de percepção há ${(t - e.ameacaVistaEm).toFixed(0)} s` : `Perigo passou: ameaça fora de percepção há ${(t - e.ameacaVistaEm).toFixed(0)} s`],
    ['ajudar', !!incapacitado && perfil.ajuda && vida > 0.6, () => `Ajudando ${incapacitado.hunter.nome}: incapacitado a ${Math.hypot(incapacitado.x - a.x, incapacitado.y - a.y).toFixed(0)} m`],
    ['descansar', naVila && (!e.atual || e.atual.tipo === 'vila') && (vida < 0.9 || a.saude.ferimentos.some((f) => f.sangramento > 0)), () => `Descansando na vila: vida ${(vida * 100).toFixed(0)}%`],
  ].filter(([rid, ok]) => ok && regraLigada(e, rid)).sort((x, y) => prioridade(e, REGRAS.find((r) => r.id === y[0])) - prioridade(e, REGRAS.find((r) => r.id === x[0])));
  if (atacante) e.ultimoAtacante = atacante.especie.nome;
  // Ajuda negada pelo perfil: registrada uma vez por companheiro, para o jogador entender a omissão.
  if (incapacitado && !perfil.ajuda && e.ajudaNegada !== incapacitado.id) { e.ajudaNegada = incapacitado.id; decidir(jogo, id, { regra: 'ajudar', acao: 'nao_ajudar', motivo: `Não vai ajudar ${incapacitado.hunter.nome}: perfil ${perfil.nome.toLowerCase()} evita o risco` }, ctx); }

  const [rid, , motivo] = candidatos[0] ?? [null];
  const ativa = e.regraAtiva;
  // Estabilidade: a regra ativa que ainda vale fica; troca só depois de MIN_TROCA s (a defesa entra sempre).
  if (rid === ativa) return executar(jogo, id, e, a, rid, sup, incapacitado, ctx);
  if (rid !== 'defesa' && ativa && t - (e.ativaDesde ?? -1e9) < MIN_TROCA && candidatos.some(([r]) => r === ativa)) return executar(jogo, id, e, a, ativa, sup, incapacitado, ctx);
  sair(jogo, id, e, a, ativa);
  e.regraAtiva = REGRAS.find((r) => r.id === rid)?.continua ? rid : null; e.ativaDesde = t;
  if (!rid) return;
  decidir(jogo, id, { regra: rid, acao: rid, motivo: motivo(), vida: +vida.toFixed(2), ameaca: sup ? { especie: sup.especie, distancia: +sup.distancia.toFixed(1), risco: +sup.risco.toFixed(2), tol: sup.tol } : null }, ctx);
  entrar(jogo, id, e, a, rid, sup, ctx);
  executar(jogo, id, e, a, rid, sup, incapacitado, ctx);
}
const rotuloCurto = (tipo) => ({ cacar: 'Caçada', explorar: 'Exploração', patrulhar: 'Patrulha', ir: 'Viagem', vila: 'Guarda da vila', voltar: 'Retorno', descansar: 'Descanso' })[tipo] ?? 'Atividade';

function entrar(jogo, id, e, a, rid, sup, ctx) {
  if (rid === 'evitar') {
    e.interrupcao = { tarefa: e.atual?.tipo ?? null, desde: jogo.t, ameaca: sup?.id ?? e.ameacaUltima?.id };
    // Reavaliação: a mesma missão interrompida vezes demais pelo perfil é abandonada; o Hunter volta à vila.
    const t = e.atual, max = PERFIS[e.perfil].maxInterrupcoes;
    if (t && !['voltar', 'descansar', 'vila'].includes(t.tipo) && (t.interrupcoes = (t.interrupcoes ?? 0) + 1) >= max) {
      t.estado = 'abandonada (ameaça repetida)';
      decidir(jogo, id, { regra: 'evitar', acao: 'abandonar', motivo: `${rotuloCurto(t.tipo)} abandonada: ${t.interrupcoes} interrupções por ameaça superior (limite do perfil ${PERFIS[e.perfil].nome.toLowerCase()})` }, ctx);
      e.atual = null; e.interrupcao = { ...e.interrupcao, tarefa: null }; ctx.iniciar(jogo, id, { tipo: 'voltar' });
    }
  }
  if (rid === 'retomar') { e.interrupcao = null; a.hunter.hostilCriaturas = undefined; }
  if (rid === 'retirada') {
    // A missão é suspensa (volta para a frente da fila), não apagada; depois do descanso ela recomeça de onde parou.
    if (e.atual && !['voltar', 'descansar', 'vila'].includes(e.atual.tipo)) { e.atual.estado = 'suspensa (retirada)'; e.fila.unshift(e.atual); }
    e.fila.unshift({ tipo: 'descansar' }); e.interrupcao = null; a.hunter.hostilCriaturas = undefined;
    ctx.iniciar(jogo, id, { tipo: 'voltar' });
  }
  if (rid === 'descansar') ctx.iniciar(jogo, id, { tipo: 'descansar' });
}
function sair(jogo, id, e, a, rid) {
  if (rid === 'evitar' || rid === 'defesa') a.hunter.hostilCriaturas = undefined;
}
// Efeito contínuo das regras que assumem o Hunter. O que acontece dentro do combate continua sendo do lab.
function executar(jogo, id, e, a, rid, sup, aliado, ctx) {
  const h = a.hunter;
  if (rid === 'defesa') { h.hostilCriaturas = undefined; h.ordem = null; }
  if (rid === 'evitar') {
    h.hostilCriaturas = false;   // não engaja quem ainda não o atacou; se for atacado, a regra de defesa entra
    const amea = sup ?? e.ameacaUltima;
    if (amea) {
      const dx = a.x - amea.x, dy = a.y - amea.y, d = Math.hypot(dx, dy) || 1, k = 55 / d;
      const p = { x: a.x + dx * k, y: a.y + dy * k };
      if (!e.refugio || Math.hypot(e.refugio.x - p.x, e.refugio.y - p.y) > 15) e.refugio = ctx.pontoLivreLocal(jogo, id, p.x, p.y);
      h.ordem = { tipo: 'ir', x: e.refugio.x, y: e.refugio.y, ritmo: 'corrida' };
    }
  }
  if (rid === 'ajudar' && aliado) { h.hostilCriaturas = undefined; h.ordem = { tipo: 'ir', x: aliado.x, y: aliado.y, ritmo: 'corrida' }; }
}
