// Decisão V2 (herbívoros e carnívoros). Cada decisão usa apenas a.contatos (percepção atual) e a.memoria.
// Retorna uma intenção {estado, codigo, motivo, alvo, destino, ritmo, acao, olharPara}.
import { atan2, cos, sen } from '../core/matematica.js';
import { indice, linhaDeVisao, perfilMobilidade, segmentoPassavel } from './terreno.js';
import { incapacitado } from './saude.js';
import { abrirConflito, afastar, decidirNoConflito, escolherAtaque, gatilhoDisputa, iniciarAtaque } from './combate.js';
import { centro, membrosConhecidos, pontoCoesao } from './social.js';
import { destinoInacessivel } from './locomocao.js';
import { atividadeSocial, competirPorRecurso, vigiaEnquantoPasta } from './relacoes.js';
import { decidirDunas } from './cerebro-dunas.js';
import { intensidadeVeneno, sintomasVeneno } from './veneno.js';
import { decidirVoo } from './cerebro-voo.js';
import { pedeAbrigo } from './clima.js';
import { acessoCupins } from './cupins.js';
import { incapacitadoParaEngolir, podeEngolir } from './engolir.js';

const dist = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
const maisProximo = (lista, a) => lista.reduce((m, k) => (!m || dist(k, a) < dist(m, a) ? k : m), null);
const f1 = (v) => Number(v).toFixed(1);

export function decidir(a, mundo) {
  a.tAtual = mundo.t;
  if (a.agarradoPor) return { estado: 'agarrado', codigo: 'luta_agarrao', motivo: `preso pela mordida de ${a.agarradoPor}; debate-se para soltar`, alvo: null, destino: null, ritmo: 'parado', acao: 'debater' };
  if (a.saude.caidoAte > mundo.t) return { estado: 'caido', codigo: 'caido', motivo: `derrubado; levanta em ${f1(a.saude.caidoAte - mundo.t)} s`, alvo: null, destino: null, ritmo: 'parado' };
  if (a.saude.atordoadoAte > mundo.t) return { estado: 'atordoado', codigo: 'atordoado', motivo: 'atordoado pelo golpe na cabeça', alvo: null, destino: null, ritmo: 'parado' };
  if (a.agarrando) {
    const v = mundo.porId.get(a.agarrando);
    return { estado: 'segurando_presa', codigo: 'agarrao', motivo: `segura ${a.agarrando} pela mordida`, alvo: null, destino: null, ritmo: 'parado', olharPara: v ? { x: v.x, y: v.y } : null };
  }
  if (a.conflito) return decidirNoConflito(a, mundo);
  // Espécies das dunas têm meio próprio (areia) e um sentido a mais (vibração): cérebro separado.
  if (a.subsolo) return decidirDunas(a, mundo);
  const terrestre = () => (a.especie.papel === 'carnivoro' ? decidirCarnivoro(a, mundo) : decidirHerbivoro(a, mundo));
  // Quem voa: as necessidades saem do mesmo cérebro; o voo decide só o meio (chão ou ar).
  return a.voo ? decidirVoo(a, mundo, terrestre) : terrestre();
}

// ======================= HERBÍVORO =======================
function decidirHerbivoro(a, mundo) {
  const e = a.especie, n = e.necessidades, s = e.social, t = mundo.t;
  const ameacas = a.contatos.filter((k) => e.teme.includes(k.especie) && k.via !== 'som');
  const vistas = ameacas.filter((k) => k.via === 'visao');
  const alarmes = a.contatos.filter((k) => k.via === 'som' && k.som === 'alarme' && k.especie === e.id);
  // Alarme de outra espécie de presa: não dispara fuga, mas deixa em alerta olhando para a origem.
  const alarmesOutras = a.contatos.filter((k) => k.via === 'som' && k.som === 'alarme' && k.especie !== e.id && !e.teme.includes(k.especie));
  // Contágio só de companheiros que correm de fato (evita realimentação entre animais parados em "fuga").
  const fugindoVistos = a.contatos.filter((k) => k.via === 'visao' && k.especie === e.id && k.comportamento === 'fugindo' && k.grupo === a.grupoId && k.velocidade > e.movimento.trote * 0.8);

  // Tolerância vigilante: predador visto longe, parado/comendo/segurando outra presa e sem vir na direção dele.
  const tolera = vistas.length && vistas.length === ameacas.length && vistas.every((k) => k.distancia > 25 && ['comendo_carcaca', 'parado', 'segurando'].includes(k.comportamento));
  if (tolera && !a.mente.perigo) {
    const k = maisProximo(vistas, a);
    if (!a.mente.toleraEm || t - a.mente.toleraEm > 15) { a.mente.toleraEm = t; mundo.evento('tolera_predador', a.id, { predador: k.id, distancia: +k.distancia.toFixed(1), comportamento: k.comportamento }); }
    // Ainda avisa o grupo (bufo/alarme) e fica encarando o predador.
    if (s.alarme && (!a.mente.alarmeEm || t - a.mente.alarmeEm > 8)) { a.mente.alarmeEm = t; mundo.som(a, 'alarme', s.alcanceAlarmeM ?? 50); mundo.evento('alarme', a.id, { ameaca: k.id, distancia: +k.distancia.toFixed(1), via: 'visao', tolerado: true }); }
    return { estado: 'vigiando', codigo: 'vigia_predador_saciado', motivo: ` está  a ${f1(k.distancia)} m; vigia sem fugir`, alvo: { tipo: 'criatura', id: k.id, x: k.x, y: k.y }, destino: null, ritmo: 'parado', olharPara: { x: k.x, y: k.y }, acao: 'vigiar' };
  }
  if (vistas.length || ameacas.length) {
    a.mente.social = null;
    const amea = maisProximo(vistas.length ? vistas : ameacas, a);
    a.mente.perigo = { x: amea.x, y: amea.y, t, id: amea.id };
    if (vistas.length && s.alarme && (!a.mente.alarmeEm || t - a.mente.alarmeEm > 4)) {
      a.mente.alarmeEm = t;
      mundo.som(a, 'alarme', s.alcanceAlarmeM ?? 50);
      mundo.evento('alarme', a.id, { ameaca: amea.id, distancia: +amea.distancia.toFixed(1), via: amea.via });
    }
    return reagirAmeaca(a, mundo, amea, vistas.length > 0);
  }
  if (fugindoVistos.length) {
    // Contágio visual: foge na direção média dos companheiros em fuga (sem saber onde está a ameaça).
    let vx = 0, vy = 0; for (const k of fugindoVistos) { vx += k.vx; vy += k.vy; }
    const nrm = Math.sqrt(vx * vx + vy * vy) || 1;
    a.mente.perigo = { x: a.x - (vx / nrm) * 20, y: a.y - (vy / nrm) * 20, t, id: null, indireto: true };
    return { estado: 'fugindo', codigo: 'contagio_fuga', motivo: `viu ${fugindoVistos.length} companheiro(s) fugindo`, alvo: null, destino: { x: a.x + (vx / nrm) * 20, y: a.y + (vy / nrm) * 20 }, ritmo: 'corrida' };
  }
  if (alarmes.length) {
    const al = maisProximo(alarmes, a);
    a.mente.alertaAte = t + 4; a.mente.alertaDe = { x: al.x, y: al.y };
    if (!a.mente.ouviuAlarmeEm || t - a.mente.ouviuAlarmeEm > 4) { a.mente.ouviuAlarmeEm = t; mundo.evento('alarme_ouvido', a.id, { de: al.id, distancia: +al.distancia.toFixed(1) }); }
  } else if (alarmesOutras.length && !(a.mente.alertaAte > t)) {
    const al = maisProximo(alarmesOutras, a);
    a.mente.alertaAte = t + 2.5; a.mente.alertaDe = { x: al.x, y: al.y };
    mundo.evento('alarme_outra_especie', a.id, { de: al.id, especie: al.especie, distancia: +al.distancia.toFixed(1) });
  }
  // Memória de perigo recente: continua se afastando até passar tempo e distância.
  const pg = a.mente.perigo;
  if (pg && t - pg.t < (pg.indireto ? 4 : 8) && dist(a, pg) < 45) {
    return { estado: 'fugindo', codigo: 'fugindo_memoria', motivo: `ameaça vista há ${f1(t - pg.t)} s; afastando-se`, alvo: pg.id ? { tipo: 'criatura', id: pg.id, x: pg.x, y: pg.y } : null, destino: pontoFuga(a, mundo, pg), ritmo: incapacitado(a) ? 'andar' : 'trote' };
  }
  if (pg) { a.mente.perigo = null; a.mente.reagruparAte = t + 25; mundo.evento('seguro', a.id, {}); }
  if (incapacitado(a)) return esconder(a, mundo, 'incapacitado', 'ferido demais; procura abrigo');
  if (a.mente.alertaAte > t) {
    const p = a.mente.alertaDe;
    return { estado: 'alerta', codigo: 'alarme_ouvido', motivo: 'ouviu alarme do grupo; olhando', alvo: null, destino: null, ritmo: 'parado', olharPara: p, acao: 'alerta' };
  }
  // Filhote segue a mãe (histerese: começa a seguir acima de 3,5 m e só para abaixo de 1,8 m; evita alternar
  // a cada passo entre "seguir" e outra necessidade em direção oposta).
  a.mente.perteDaMae = null;
  if (a.juvenil && a.maeId) {
    const mae = a.memoria.criaturas.get(a.maeId);
    if (mae && t - mae.t < 20) {
      const d = dist(a, mae);
      const seguindo = a.estado === 'seguindo_mae';
      if (d > 3.5 || (seguindo && d > 1.8)) return { estado: 'seguindo_mae', codigo: 'seguir_mae', motivo: 'acompanhando a mãe', alvo: { tipo: 'criatura', id: a.maeId, x: mae.x, y: mae.y }, destino: { x: mae.x, y: mae.y }, ritmo: d > 10 ? 'trote' : 'andar' };
      a.mente.perteDaMae = mae;
    } else if (mundo.porId.get(a.maeId)?.vivo) {
      if (!a.mente.chamouEm || t - a.mente.chamouEm > 5) { a.mente.chamouEm = t; mundo.som(a, 'chamado', 40); }
      return { estado: 'procurando_mae', codigo: 'procurando_mae', motivo: 'perdeu a mãe de vista; chamando', alvo: null, destino: mae ? { x: mae.x, y: mae.y } : null, ritmo: 'andar', acao: 'chamar' };
    }
  }
  // Reagrupamento após perigo: procura membros que faltam e chama.
  if (a.grupoId && a.mente.reagruparAte > t) {
    const g = mundo.grupos.get(a.grupoId);
    const conhecidos = membrosConhecidos(a, mundo, 6);
    if (g && conhecidos.length < g.membros.length - 1) {
      if (!a.mente.chamouEm || t - a.mente.chamouEm > 5) { a.mente.chamouEm = t; mundo.som(a, 'chamado', 45); }
      const antigos = membrosConhecidos(a, mundo, 60);
      // Sem pista dos companheiros — ou já junto do próprio subgrupo e ainda faltando membros fora do alcance do
      // chamado — volta para a área de vida do grupo chamando (ponto de encontro natural).
      const cAnt = centro(antigos);
      const noSubgrupo = cAnt && dist(a, cAnt) < 10 && conhecidos.length < (g.membros.length - 1) / 2 + 0.5;
      const c = (!noSubgrupo && cAnt) || (a.casa && dist(a, a.casa) > 12 ? a.casa : cAnt);
      return { estado: 'reagrupando', codigo: antigos.length ? 'reagrupar' : 'voltar_area_grupo', motivo: `reagrupando: vê ${conhecidos.length} de ${g.membros.length - 1} companheiros`, alvo: null, destino: c, ritmo: 'andar', acao: 'chamar' };
    }
    a.mente.reagruparAte = 0;
  }
  // Responde a chamados de companheiros indo na direção deles.
  const chamados = a.contatos.filter((k) => k.via === 'som' && k.som === 'chamado' && k.especie === e.id);
  if (chamados.length && a.grupoId && !membrosConhecidos(a, mundo, 4).length) {
    const c = maisProximo(chamados, a);
    return { estado: 'reagrupando', codigo: 'responde_chamado', motivo: 'indo até o chamado de um companheiro', alvo: null, destino: { x: c.x, y: c.y }, ritmo: 'andar' };
  }
  const env = repousoEnvenenado(a, mundo) ?? abrigoDoClima(a, mundo);
  if (env) return env;
  if (a.papel === 'sentinela' && a.fome < 85 && a.sede < 85) {
    const ang = t * 0.6 + a.numero;
    return { estado: 'vigiando', codigo: 'sentinela', motivo: 'sentinela do grupo (vigiando)', alvo: null, destino: null, ritmo: 'parado', olharPara: { x: a.x + cos(ang) * 10, y: a.y + sen(ang) * 10 }, acao: 'vigiar' };
  }
  const corte = cortejar(a, mundo);
  if (corte) return corte;
  if (a.sede > 80 || a.fome > 80) a.mente.social = null;
  const livre = a.fome < n.fomeProcurar && a.sede < n.sedeProcurar && a.energia > 30;
  const social = atividadeSocial(a, mundo, livre);
  if (social) return social;
  if (a.sede > n.sedeProcurar || (a.estado === 'bebendo' && a.sede > 5)) { const r = irBeber(a, mundo); if (r) return r; }
  const noturno = e.atividade === 'diurno' && (mundo.relogio.hora < 6 || mundo.relogio.hora > 19.5);
  if (a.energia < 25 || (a.estado === 'descansando' && a.energia < 60) || (noturno && a.fome < 80)) {
    const conh = membrosConhecidos(a, mundo, 10);
    const coes = pontoCoesao(a, conh, (s.coesaoM ?? 8) * 0.6);
    return { estado: 'descansando', codigo: noturno ? 'noite' : 'cansado', motivo: noturno ? 'repousando durante a noite' : `energia ${f1(a.energia)}`, alvo: null, destino: coes, ritmo: 'andar' };
  }
  if (a.fome > n.fomeProcurar || (['pastando', 'vigiando'].includes(a.estado) && a.fome > 10)) { const v = vigiaEnquantoPasta(a, mundo); if (v) return v; return pastar(a, mundo); }
  return seguirGrupo(a, mundo, 'vagando', 'sem necessidades urgentes');
}

function reagirAmeaca(a, mundo, amea, vista) {
  const e = a.especie, s = e.social, t = mundo.t;
  const d = amea.distancia;
  // Ameaça visivelmente ocupada com outro predador (encarando, exibindo, lutando), olhando para o rival e sem se
  // aproximar: oportunidade de fuga. A presa decide como aproveitar (ou não) conforme fôlego, ferimentos e abrigo.
  const aproxima = amea.vx != null ? ((a.x - amea.x) * amea.vx + (a.y - amea.y) * amea.vy) / Math.max(0.01, d) : 1;
  const distraido = vista && amea.emDisputaCom && amea.emDisputaCom !== a.id && amea.foco !== a.id
    && ['exibindo', 'lutando', 'confrontando', 'encarando'].includes(amea.comportamento) && aproxima < 1.5;
  if (distraido) return aproveitarDistracao(a, mundo, amea, d);
  // Estratégias da ficha.
  const resposta = s.respostaAmeaca;
  if (resposta?.includes('esconder') && d > 14 && aproxima < 3) {
    return esconder(a, mundo, 'escondido', `esconde-se de ${amea.id} a ${f1(d)} m`);
  }
  if (s.refugio === 'rochas' && d > 5) {
    const r = refugioRochas(a, mundo, 14);
    if (r) return { estado: 'fugindo', codigo: 'refugio_rochas', motivo: `corre para as rochas (${amea.id} a ${f1(d)} m)`, alvo: { tipo: 'criatura', id: amea.id, x: amea.x, y: amea.y }, destino: r, ritmo: 'corrida' };
  }
  // Proteção de filhotes: adulto corajoso se coloca entre a ameaça e o filhote enquanto ela ainda está longe.
  if (s.protegeFilhotes && d > 12 && a.temperamento.coragem > 0.4 && !a.juvenil) {
    const filhote = a.contatos.find((k) => k.via === 'visao' && k.juvenil && k.grupo === a.grupoId && dist(k, a) < 15);
    if (filhote) {
      const meio = { x: (filhote.x + amea.x * 0.25) / 1.25, y: (filhote.y + amea.y * 0.25) / 1.25 };
      if (!a.mente.protegeuEm || t - a.mente.protegeuEm > 10) { a.mente.protegeuEm = t; mundo.evento('protege_filhote', a.id, { filhote: filhote.id, ameaca: amea.id }); }
      return { estado: 'protegendo_filhote', codigo: 'proteger', motivo: `se põe entre ${amea.id} e o filhote ${filhote.id}`, alvo: { tipo: 'criatura', id: amea.id, x: amea.x, y: amea.y }, destino: meio, ritmo: 'trote', olharPara: { x: amea.x, y: amea.y } };
    }
  }
  // Encurralado e atacado: reage com o ataque defensivo da espécie.
  if (d < 1.6 && a.mente.atingidoPor && t - a.mente.atingidoPor.t < 2) {
    const atacante = mundo.porId.get(amea.id);
    const atq = atacante && !a.golpe && escolherAtaque(a, atacante, d, false);
    if (atq) iniciarAtaque(a, atacante, atq, mundo);
  }
  return { estado: 'fugindo', codigo: vista ? 'viu_ameaca' : `percebeu_${amea.via}`, motivo: `${vista ? 'viu' : amea.via === 'audicao' ? 'ouviu' : 'farejou'} ${amea.especie} a ${f1(d)} m`, alvo: { tipo: 'criatura', id: amea.id, x: amea.x, y: amea.y }, destino: pontoFuga(a, mundo, amea), ritmo: 'corrida' };
}

// Distração dos predadores: acelerar e mudar de rumo para longe dos dois, buscar cobertura, quebrar a linha de
// visão ou esconder-se. Nada é automático: a escolha depende de fôlego, ferimentos, abrigo e da distância.
function aproveitarDistracao(a, mundo, amea, d) {
  const t = mundo.t;
  const rival = a.contatos.find((k) => k.id === amea.emDisputaCom && k.via === 'visao') ?? a.memoria.criaturas.get(amea.emDisputaCom);
  const chave = `${amea.id}|${amea.emDisputaCom}`;
  if (a.mente.oportunidadeChave !== chave) {
    a.mente.oportunidadeChave = chave;
    mundo.evento('oportunidade_fuga', a.id, { ameaca: amea.id, rivalDaAmeaca: amea.emDisputaCom, distancia: +d.toFixed(1) });
  }
  const abrigo = refugioCobertura(a, mundo, 25);
  const dAbrigo = abrigo ? dist(a, abrigo) : Infinity;
  const cansada = a.folego < 2 || a.energia < 20 || incapacitado(a);
  // Ponto médio dos dois predadores: foge para longe dele (quebra a linha de visão de ambos se der).
  const meio = rival ? { x: (amea.x + rival.x) / 2, y: (amea.y + rival.y) / 2 } : amea;
  let tipo, intencao;
  if (abrigo && dAbrigo < 1.2) {
    tipo = 'esconder';
    intencao = { estado: 'escondido', codigo: 'esconde_na_distracao', motivo: `no abrigo enquanto ${amea.id} disputa com ${amea.emDisputaCom}; imóvel`, alvo: null, destino: null, ritmo: 'parado' };
  } else if (abrigo && (dAbrigo < 30 || cansada)) {
    tipo = 'abrigo';
    a.mente.preferirCobertura = true;
    intencao = { estado: 'fugindo', codigo: 'aproveita_distracao_abrigo', motivo: `${amea.id} ocupado com ${amea.emDisputaCom}; corre para cobertura a ${f1(dAbrigo)} m`, alvo: { tipo: 'criatura', id: amea.id, x: amea.x, y: amea.y }, destino: abrigo, ritmo: cansada ? 'trote' : 'corrida' };
  } else {
    tipo = 'corrida';
    a.mente.preferirCobertura = true;
    intencao = { estado: 'fugindo', codigo: 'aproveita_distracao', motivo: `${amea.id} ocupado com ${amea.emDisputaCom}; acelera para longe dos dois`, alvo: { tipo: 'criatura', id: amea.id, x: amea.x, y: amea.y }, destino: pontoFuga(a, mundo, meio, true), ritmo: cansada ? 'trote' : 'corrida' };
  }
  if (!a.mente.fugaDisputa || a.mente.fugaDisputa.chave !== chave) {
    a.mente.fugaDisputa = { chave, t, predadores: [amea.id, amea.emDisputaCom].filter(Boolean), tipo, resolvida: false };
    mundo.metricas.tentativasFuga = (mundo.metricas.tentativasFuga ?? 0) + 1;
    mundo.evento('tentativa_fuga', a.id, { modo: tipo, predadores: a.mente.fugaDisputa.predadores, distancia: +d.toFixed(1), abrigo: dAbrigo < Infinity ? +dAbrigo.toFixed(1) : null });
  }
  return intencao;
}

// Depois de uma tentativa de fuga durante disputa: efetiva quando nenhum dos predadores vê a presa por 10 s (e ela
// está viva); recaptura quando um deles a fere ou mata depois da tentativa.
export function avaliarFugasDisputa(mundo) {
  for (const a of mundo.animais) {
    const f = a.mente.fugaDisputa;
    if (!f || f.resolvida) continue;
    if (!a.vivo || a.saude.ferimentos.some((x) => x.desde > f.t && f.predadores.includes(x.origem))) {
      f.resolvida = true;
      mundo.metricas.recapturas = (mundo.metricas.recapturas ?? 0) + 1;
      mundo.evento('recaptura', a.id, { predadores: f.predadores, morreu: !a.vivo, aposSeg: +(mundo.t - f.t).toFixed(1) });
      continue;
    }
    const algumVe = f.predadores.some((id) => { const p = mundo.porId.get(id); return p && p.contatos.some((k) => k.id === a.id && k.via === 'visao'); });
    if (algumVe) f.ultimoVisto = mundo.t;
    if (mundo.t - (f.ultimoVisto ?? f.t) >= 10) {
      f.resolvida = true;
      mundo.metricas.fugasEfetivas = (mundo.metricas.fugasEfetivas ?? 0) + 1;
      mundo.evento('fuga_efetiva', a.id, { modo: f.tipo, predadores: f.predadores, aposSeg: +(mundo.t - f.t).toFixed(1) });
    }
  }
}

// Fuga: candidatos em volta + abrigos; afasta da ameaça, evita passar perto dela, prefere quebrar a linha de visão
// e (bandos) mistura com a direção de fuga dos companheiros percebidos, com dispersão individual.
function pontoFuga(a, mundo, amea, preferirAbrigo = false) {
  if (a.mente.fuga && mundo.t < a.mente.fuga.ate && dist(a, a.mente.fuga.p) > 2) return a.mente.fuga.p;
  const t = mundo.terreno;
  const cands = [];
  for (let k = 0; k < 12; k++) { const ang = (k / 12) * Math.PI * 2; cands.push({ x: a.x + cos(ang) * 22, y: a.y + sen(ang) * 22 }); }
  const abrigo = refugioCobertura(a, mundo, 30);
  if (abrigo) cands.push(abrigo);
  const companheiros = a.contatos.filter((k) => k.via === 'visao' && k.grupo === a.grupoId && k.comportamento === 'fugindo');
  let gx = 0, gy = 0; for (const k of companheiros) { gx += k.vx; gy += k.vy; }
  const gn = Math.sqrt(gx * gx + gy * gy);
  const disp = a.rngMente.entre(-0.5, 0.5);
  let melhor = null, nota = -Infinity;
  for (const c of cands) {
    c.x = Math.min(t.largura - 1, Math.max(1, c.x)); c.y = Math.min(t.profundidade - 1, Math.max(1, c.y));
    const k = indice(t, c.x, c.y);
    if (k < 0 || t.bloqueio[k] === 1) continue;
    // Trajeto direto precisa ser transitável para esta espécie (não foge para dentro do lago ou contra o paredão).
    if (!segmentoPassavel(t, perfilMobilidade(t, a.especie.movimento).passavel, a, c)) continue;
    let s = dist(c, amea) - dist(a, amea);
    const ang = atan2(c.y - a.y, c.x - a.x);
    if (gn > 0.5) s += 6 * ((cos(ang) * gx + sen(ang) * gy) / gn) + disp * 4;
    if (!linhaDeVisao(t, amea, c, 1.2, 0.5).livre) s += preferirAbrigo ? 18 : 9;
    s += (t.cobertura[k] / 100) * (preferirAbrigo ? 14 : 6);
    if (Math.max(0, t.agua[k] - t.alturas[k]) > a.especie.movimento.profundidadeMaxM) s -= 40;
    if (s > nota) { nota = s; melhor = c; }
  }
  a.mente.fuga = { p: melhor ?? afastar(a, amea, 20), ate: mundo.t + 1.0 };
  return a.mente.fuga.p;
}

function refugioCobertura(a, mundo, raio) {
  const t = mundo.terreno;
  let melhor = null, dm = Infinity;
  for (let dy = -raio; dy <= raio; dy += 2) for (let dx = -raio; dx <= raio; dx += 2) {
    const x = a.x + dx, y = a.y + dy, k = indice(t, x, y);
    if (k < 0 || t.cobertura[k] < 50 || t.bloqueio[k] === 1) continue;
    const d = dx * dx + dy * dy;
    if (d < dm) { dm = d; melhor = { x, y }; }
  }
  return melhor;
}
function refugioRochas(a, mundo, raio) {
  const t = mundo.terreno;
  let melhor = null, dm = Infinity;
  for (let dy = -raio; dy <= raio; dy += 1) for (let dx = -raio; dx <= raio; dx += 1) {
    const x = a.x + dx, y = a.y + dy, k = indice(t, x, y);
    if (k < 0 || t.bloqueio[k] !== 1) continue;
    const d = dx * dx + dy * dy;
    if (d < dm) { dm = d; melhor = { x, y }; }
  }
  return melhor;
}

function esconder(a, mundo, estado, motivo) {
  const r = refugioCobertura(a, mundo, 8);
  if (r && dist(a, r) > 0.8) return { estado: estado === 'escondido' ? 'indo_esconder' : estado, codigo: 'abrigo', motivo, alvo: null, destino: r, ritmo: 'trote' };
  return { estado: 'escondido', codigo: 'congelar', motivo: `${motivo} (imóvel)`, alvo: null, destino: null, ritmo: 'parado' };
}

function pastar(a, mundo) {
  const t = mundo.terreno, e = a.especie;
  if (e.dieta.cupins) return forragearCupins(a, mundo);
  const k0 = indice(t, a.x, a.y);
  // Competição por alimento entre espécies: o menor/menos dominante cede a mancha (sem ferimentos).
  if (k0 >= 0 && t.vegetacao[k0] > 4 && a.estado !== 'pastando') { const c = competirPorRecurso(a, mundo, { x: a.x, y: a.y, id: `c${k0}`, outraEspecie: true }); if (c) return c; }
  if (k0 >= 0 && t.vegetacao[k0] > 4) return { estado: 'pastando', codigo: 'comendo', motivo: `fome ${f1(a.fome)}; pastando`, alvo: { tipo: 'vegetacao', id: `c${k0}`, x: a.x, y: a.y }, destino: null, ritmo: 'parado', acao: 'comer' };
  // Líder escolhe a mancha; membros seguem o grupo (procuram dentro do raio de coesão).
  const g = a.grupoId ? mundo.grupos.get(a.grupoId) : null;
  if (g && g.lider !== a.id && !a.juvenil) {
    const conh = membrosConhecidos(a, mundo, 8);
    const coes = pontoCoesao(a, conh, e.social.coesaoM ?? 8);
    if (coes) return { estado: 'seguindo_grupo', codigo: 'coesao', motivo: 'acompanhando o grupo até o pasto', alvo: null, destino: coes, ritmo: 'andar' };
  }
  const p = melhorPasto(a, mundo, 18);
  if (p) return { estado: 'indo_pastar', codigo: 'pasto_visto', motivo: `fome ${f1(a.fome)}; capim a ${f1(dist(a, p))} m`, alvo: { tipo: 'vegetacao', id: `c${indice(t, p.x, p.y)}`, x: p.x, y: p.y }, destino: p, ritmo: 'andar' };
  return explorar(a, mundo, 'procurando_pasto', 'sem pasto à vista');
}

function melhorPasto(a, mundo, raio) {
  const t = mundo.terreno;
  const perigo = a.mente.perigoArea;
  let melhor = null, nota = 0;
  for (let dy = -raio; dy <= raio; dy += 3) for (let dx = -raio; dx <= raio; dx += 3) {
    const x = a.x + dx, y = a.y + dy, k = indice(t, x, y);
    if (k < 0 || t.bloqueio[k] || t.vegetacao[k] < 8) continue;
    let s = t.vegetacao[k] / (1 + Math.sqrt(dx * dx + dy * dy) * 0.08);
    if (perigo && dist({ x, y }, perigo) < 20) s *= 0.3;
    if (s > nota) { nota = s; melhor = { x, y }; }
  }
  return melhor;
}

function irBeber(a, mundo) {
  const t = mundo.t;
  // Pontos sabidamente inacessíveis são ignorados; pontos já ocupados por outros animais custam mais (fila na margem).
  const agua = (a.memoria.recursos.agua ?? []).filter((p) => !destinoInacessivel(a, p, t));
  if (!agua.length) return explorar(a, mundo, 'procurando_agua', `sede ${f1(a.sede)}; não conhece água acessível`);
  const ocupacao = (p) => a.contatos.filter((k) => k.via === 'visao' && dist(k, p) < 1.5).length;
  // Filhote só bebe onde a mãe está perto; senão espera ela (que também tem sede) para não se afastar.
  const mae = a.juvenil && a.mente.perteDaMae ? a.mente.perteDaMae : null;
  const cands = mae ? agua.filter((p) => dist(p, mae) < 6) : agua;
  if (!cands.length) return null;
  const ev = a.mente.evitarPonto && a.mente.evitarPonto.ate > mundo.t ? a.mente.evitarPonto : null;
  const nota = (p) => dist(p, a) + ocupacao(p) * 4 + (ev && dist(p, ev) < 3 ? 25 : 0);
  const atual = a.alvo?.tipo === 'agua' ? cands.find((p) => p.id === a.alvo.id) : null;
  const alvo = atual && ocupacao(atual) < 2 ? atual : cands.reduce((m, p) => (!m || nota(p) < nota(m) ? p : m), null);
  if (dist(a, alvo) < 1.6 + a.especie.corpo.raio * a.escala * 0.5 && a.estado !== 'bebendo' && a.especie.papel === 'herbivoro') { const c = competirPorRecurso(a, mundo, alvo); if (c) return c; }
  if (dist(a, alvo) < 1.6 + a.especie.corpo.raio * a.escala * 0.5) return { estado: 'bebendo', codigo: 'bebendo', motivo: `sede ${f1(a.sede)}; bebendo`, alvo: { tipo: 'agua', id: alvo.id, x: alvo.x, y: alvo.y }, destino: null, ritmo: 'parado', acao: 'beber', olharPara: alvo.agua };
  return { estado: 'indo_beber', codigo: 'agua_lembrada', motivo: `sede ${f1(a.sede)}; indo à água (${f1(dist(a, alvo))} m)`, alvo: { tipo: 'agua', id: alvo.id, x: alvo.x, y: alvo.y }, destino: alvo, ritmo: a.sede > 85 ? 'trote' : 'andar' };
}

function seguirGrupo(a, mundo, estado, motivo) {
  const conh = membrosConhecidos(a, mundo, 10);
  const coes = pontoCoesao(a, conh, a.especie.social.coesaoM ?? 8);
  if (coes) return { estado: 'seguindo_grupo', codigo: 'coesao', motivo: 'mantendo-se perto do grupo', alvo: null, destino: coes, ritmo: 'andar' };
  // Membro de bando sozinho e longe da área do grupo: volta chamando.
  if (a.grupoId && !conh.length && a.casa && dist(a, a.casa) > 25) {
    if (!a.mente.chamouEm || mundo.t - a.mente.chamouEm > 6) { a.mente.chamouEm = mundo.t; mundo.som(a, 'chamado', 45); }
    return { estado: 'reagrupando', codigo: 'voltar_area_grupo', motivo: 'sozinho; voltando à área do grupo e chamando', alvo: null, destino: a.casa, ritmo: 'andar', acao: 'chamar' };
  }
  return explorar(a, mundo, estado, motivo);
}

function explorar(a, mundo, estado, motivo) {
  if (!a.mente.vagar || mundo.t > a.mente.vagar.ate || dist(a, a.mente.vagar.p) < 2) {
    const t = mundo.terreno;
    const casa = a.territorio ?? a.casa;
    const base = casa && dist(a, casa) > (casa.raio ?? 80) * 0.8 ? casa : a;
    let p = null;
    for (let i = 0; i < 10 && !p; i++) {
      const ang = a.rngMente.entre(-Math.PI, Math.PI), r = a.rngMente.entre(10, 35);
      const c = { x: Math.min(t.largura - 2, Math.max(2, base.x + cos(ang) * r)), y: Math.min(t.profundidade - 2, Math.max(2, base.y + sen(ang) * r)) };
      const k = indice(t, c.x, c.y);
      if (k >= 0 && !t.bloqueio[k] && Math.max(0, t.agua[k] - t.alturas[k]) < 0.2 && perfilMobilidade(t, a.especie.movimento).passavel[k] && !destinoInacessivel(a, c, mundo.t) && !areaDeEmboscadaConhecida(a, c, mundo.t)) p = c;
    }
    a.mente.vagar = { p: p ?? { x: a.x, y: a.y }, ate: mundo.t + a.rngMente.entre(6, 14) };
  }
  return { estado, codigo: estado, motivo, alvo: null, destino: a.mente.vagar.p, ritmo: 'andar' };
}

// Onde este animal já foi atacado (só espécies com `memoriaDePerigo { raioM, seg }`): não volta a passear ali.
function areaDeEmboscadaConhecida(a, c, t) {
  const cfg = a.especie.memoriaDePerigo, ps = a.memoria.perigos;
  if (!cfg || !ps) return false;
  return ps.some((p) => t - p.t < cfg.seg && (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y) < cfg.raioM * cfg.raioM);
}

function cortejar(a, mundo) {
  if (!a.mente.receptiva && !a.mente.parceiraAlvo) return null;
  if (a.sexo === 'M' && a.mente.parceiraAlvo) {
    const f = a.memoria.criaturas.get(a.mente.parceiraAlvo);
    const fem = mundo.porId.get(a.mente.parceiraAlvo);
    if (!f || !fem?.vivo || !fem.mente.receptiva || mundo.t - f.t > 10) { a.mente.parceiraAlvo = null; return null; }
    if (dist(a, f) < 2) {
      a.mente.corteSeg = (a.mente.corteSeg ?? 0) + mundo.dt;
      if (a.mente.corteSeg > 6) { mundo.acasalar(fem, a); a.mente.parceiraAlvo = null; a.mente.corteSeg = 0; }
      return { estado: 'cortejando', codigo: 'corte', motivo: `cortejando ${fem.id}`, alvo: { tipo: 'criatura', id: fem.id, x: f.x, y: f.y }, destino: null, ritmo: 'parado', olharPara: f, acao: a.especie.combate.exibicao ? 'exibicao' : 'chamar' };
    }
    return { estado: 'cortejando', codigo: 'aproximar_parceira', motivo: `aproximando-se de ${fem.id} (estação reprodutiva)`, alvo: { tipo: 'criatura', id: fem.id, x: f.x, y: f.y }, destino: f, ritmo: 'andar' };
  }
  return null;
}

// ======================= CARNÍVORO =======================
function decidirCarnivoro(a, mundo) {
  const e = a.especie, n = e.necessidades, t = mundo.t;
  const vistos = a.contatos.filter((k) => k.via === 'visao');
  // Recuo pós-disputa.
  if (a.mente.recuarDe && t < a.mente.recuarDe.ate) {
    const r = mundo.porId.get(a.mente.recuarDe.id);
    return { estado: 'recuando', codigo: 'recuo', motivo: 'afastando-se do rival', alvo: null, destino: r ? afastar(a, r, 20) : null, ritmo: 'trote' };
  }
  // Ameaças (ex.: Varrisco teme Rocantraz).
  const ameaca = vistos.filter((k) => e.teme.includes(k.especie)).sort((x, y) => x.distancia - y.distancia)[0];
  if (ameaca && ameaca.distancia < 40) {
    const minha = mundo.carcacas.find((c) => c.dono === a.id && c.carne > 0);
    if (minha) { minha.dono = null; mundo.evento('abandona_carcaca', a.id, { carcaca: minha.id, por: ameaca.id }); }
    abandonarCaca(a, mundo, 'ameaca_maior');
    return { estado: 'fugindo', codigo: 'evita_predador_maior', motivo: `evita ${ameaca.especie} a ${f1(ameaca.distancia)} m`, alvo: { tipo: 'criatura', id: ameaca.id, x: ameaca.x, y: ameaca.y }, destino: afastar(a, ameaca, 40), ritmo: 'corrida' };
  }
  // Rivais/competidores: gatilhos de disputa (nunca só proximidade).
  for (const k of vistos) {
    const rival = mundo.porId.get(k.id);
    if (!rival || rival.especie.papel !== 'carnivoro' || !(e.competidores ?? []).includes(k.especie)) continue;
    if (a.parId && a.parId === k.id) continue;
    const g = gatilhoDisputa(a, k, rival, mundo);
    if (g && !incapacitado(a)) {
      // Ferido/exausto normalmente evita: só entra se a avaliação permitir (decidida na fase de observação).
      abrirConflito(mundo, a, rival, g.motivo, g.recurso);
      return decidirNoConflito(a, mundo);
    }
  }
  // Intruso visto no território: aproxima-se para verificar se ele permanece (a disputa só nasce da permanência).
  if (a.territorio && a.mente.intrusos && !a.mente.caca && a.fome < 85 && !incapacitado(a)) {
    for (const id of Object.keys(a.mente.intrusos)) {
      const m = a.memoria.criaturas.get(id);
      const vivo = mundo.porId.get(id);
      if (!m || !vivo || mundo.t - m.t > 20 || (a.cooldownRival.get(id) ?? 0) > mundo.t) { delete a.mente.intrusos[id]; continue; }
      const dt = a.territorio, dentro = (m.x - dt.x) * (m.x - dt.x) + (m.y - dt.y) * (m.y - dt.y) <= dt.raio * dt.raio;
      if (dentro && dist(a, m) > 10) return { estado: 'verificando_intruso', codigo: 'intruso', motivo: `intruso ${id} no território; aproxima-se`, alvo: { tipo: 'criatura', id, x: m.x, y: m.y }, destino: m, ritmo: 'trote' };
    }
  }
  if (incapacitado(a) || a.saude.hp < a.saude.hpMax * 0.35) {
    abandonarCaca(a, mundo, 'ferido');
    return { estado: 'descansando', codigo: 'ferido', motivo: `ferido (vida ${Math.round((100 * a.saude.hp) / a.saude.hpMax)}%); repousa`, alvo: null, destino: null, ritmo: 'parado' };
  }
  // Digestão: depois de engolir uma presa inteira, fica muito tempo sem caçar (`digestaoSeg` da ficha).
  if (a.mente.digerindoAte > t) return { estado: 'digerindo', codigo: 'digestao', motivo: `digerindo (${f1(a.mente.digerindoAte - t)} s)`, alvo: null, destino: null, ritmo: 'parado', postura: 'enrolada' };
  // Presa já rendida pelo veneno e ao alcance: engole inteira em vez de continuar golpeando.
  const eng = engolirPresa(a, mundo);
  if (eng) return eng;
  const env = repousoEnvenenado(a, mundo);
  if (env) { abandonarCaca(a, mundo, 'envenenado'); return env; }
  // Predador sem caça em curso e sem fome extrema também se abriga; em caça, a tempestade é cobertura.
  if (!a.mente.caca && a.fome < n.fomeDesesperada) { const abr = abrigoDoClima(a, mundo); if (abr) return abr; }
  // Fonte de calor sem identificação (termorrecepção): orienta a cabeça, estima o porte e decide.
  // Quem está emboscado não sai do lugar pelo calor: a espera é a tática, e sair alternava de estado a cada
  // passo com a presa se aproximando (medido: 20 trocas em 2 s).
  const calor = a.mente.caca || a.mente.emboscada ? null : a.contatos.filter((k) => k.via === 'termico').sort((x, y) => y.sinal - x.sinal || (x.id < y.id ? -1 : 1))[0];
  if (calor) {
    const olharPara = { x: calor.x, y: calor.y }, alvo = { tipo: 'calor', id: null, x: calor.x, y: calor.y };
    // O porte é julgado uma vez por fonte (a leitura varia a cada passo; a decisão não pode oscilar com ela).
    if (a.mente.calor?.id !== calor.id || t - a.mente.calor.visto > 10) { a.mente.calor = { id: calor.id, t, grande: calor.massaEstimada > a.massa * 1.6, fugindo: false }; mundo.evento('calor_detectado', a.id, { distancia: +calor.distancia.toFixed(1), contrasteC: calor.contrasteC, grande: a.mente.calor.grande }); }
    const mc = a.mente.calor; mc.visto = t;
    if (mc.grande) {
      // Histerese: começa a fugir a 6 m e só para depois de 14 m.
      mc.fugindo = calor.distancia < (mc.fugindo ? 14 : 6);
      if (mc.fugindo) return { estado: 'fugindo', codigo: 'calor_grande_perto', motivo: `fonte de calor grande a ${f1(calor.distancia)} m; afasta-se`, alvo, destino: afastar(a, calor, 25), ritmo: 'corrida' };
      return { estado: 'imovel', codigo: 'calor_grande', motivo: `fonte de calor grande a ${f1(calor.distancia)} m; imóvel`, alvo, destino: null, ritmo: 'parado', olharPara };
    }
    if (a.fome >= n.fomeCacar && t - a.mente.calor.t > 1.5) return { estado: 'investigando', codigo: 'fonte_termica', motivo: `investiga fonte de calor a ${f1(calor.distancia)} m (+${calor.contrasteC} °C)`, alvo, destino: olharPara, ritmo: 'andar' };
    return { estado: 'alerta', codigo: 'fonte_termica', motivo: `sente calor a ${f1(calor.distancia)} m; vira a cabeça`, alvo, destino: null, ritmo: 'parado', olharPara };
  }
  // Carcaça própria ou conhecida.
  const minha = mundo.carcacas.find((c) => c.dono === a.id && c.carne > 0);
  if (minha && a.fome > -50) {
    if (dist(a, minha) < 1.8) return { estado: 'comendo_carcaca', codigo: 'comendo', motivo: `comendo carcaça ${minha.id} (${f1(minha.carne)} kg restantes)`, alvo: { tipo: 'carcaca', id: minha.id, x: minha.x, y: minha.y }, destino: null, ritmo: 'parado', acao: 'comer_carcaca' };
    return { estado: 'indo_carcaca', codigo: 'carcaca_propria', motivo: 'voltando à própria carcaça', alvo: { tipo: 'carcaca', id: minha.id, x: minha.x, y: minha.y }, destino: minha, ritmo: 'andar' };
  }
  if (minha && a.fome <= -50 && minha.dono === a.id) { minha.dono = null; mundo.evento('abandona_carcaca', a.id, { carcaca: minha.id, por: 'saciado' }); }
  // Emboscada (só quem declara a tática): espera na cobertura em vez de sair procurando.
  const emb = emboscar(a, mundo);
  if (emb) return emb;
  // Caça em andamento ou nova.
  const caca = cacar(a, mundo);
  if (caca) return caca;
  if (e.dieta.carnica && a.fome > 30) {
    const conh = [...a.memoria.carcacas.values()].filter((c) => { const real = mundo.carcacas.find((x) => x.id === c.id); return real && real.carne > 0; });
    const c = maisProximo(conh, a);
    if (c) {
      const real = mundo.carcacas.find((x) => x.id === c.id);
      if (!real.dono && dist(a, real) < 1.8) { real.dono = a.id; real.donoDesde = t; mundo.evento('reivindica_carcaca', a.id, { carcaca: real.id }); }
      return { estado: 'indo_carcaca', codigo: c.via === 'olfato' ? 'farejou_carcaca' : 'viu_carcaca', motivo: `${c.via === 'olfato' ? 'farejou' : 'viu'} carcaça a ${f1(dist(a, c))} m`, alvo: { tipo: 'carcaca', id: c.id, x: c.x, y: c.y }, destino: c, ritmo: 'trote' };
    }
  }
  if (a.sede > n.sedeProcurar) { const r = irBeber(a, mundo); if (r) return r; }
  const corte = cortejar(a, mundo);
  if (corte) return corte;
  const hora = mundo.relogio.hora;
  const inativo = e.atividade === 'crepuscular' ? (hora > 10.5 && hora < 15.5) || hora < 3 : e.atividade === 'diurno' ? hora < 6 || hora > 19.5 : false;
  if (a.energia < 30 || (a.estado === 'descansando' && a.energia < 70) || (inativo && a.fome < 60)) {
    return { estado: 'descansando', codigo: inativo ? 'periodo_inativo' : 'cansado', motivo: inativo ? 'fora do horário de atividade' : `energia ${f1(a.energia)}`, alvo: null, destino: null, ritmo: 'parado' };
  }
  return patrulhar(a, mundo);
}

// Engolir inteira (só quem declara `engolirInteira`): a presa precisa estar incapacitada e caber.
function engolirPresa(a, mundo) {
  if (!a.especie.engolirInteira) return null;
  const t = mundo.t;
  const atual = a.mente.engolindo ? (mundo.porId.get(a.mente.engolindo) ?? mundo.mortos.get(a.mente.engolindo)) : null;
  if (atual) {
    if (dist(a, atual) > 3) { a.mente.engolindo = null; a.mente.engolirProgresso = 0; } // escapou ou foi levada
    else return { estado: 'engolindo', codigo: 'engolir', motivo: `engolindo ${atual.id} (${atual.massa.toFixed(0)} kg)`, alvo: { tipo: 'criatura', id: atual.id, x: atual.x, y: atual.y }, destino: null, ritmo: 'parado', acao: 'engolir', olharPara: { x: atual.x, y: atual.y } };
  }
  // O alvo é lembrado pela própria mordida: a serpente sabe quem envenenou, e essa memória sobrevive à morte
  // da presa (aí ela engole o corpo em vez de comer a carcaça como necrófaga) e a um contato que pisca entre
  // um passo e outro enquanto ela espera o veneno fazer efeito.
  const mordido = a.mente.inoculou && (mundo.porId.get(a.mente.inoculou.id) ?? mundo.mortos.get(a.mente.inoculou.id));
  const porPerto = mordido && dist(a, mordido) < 30 && (mordido.vivo || mundo.carcacas.some((c) => c.animal === mordido.id)) ? mordido : null;
  const k = porPerto ? null : a.contatos.filter((c) => (c.via === 'visao' && a.especie.dieta.presas.includes(c.especie))
    || (c.via === 'termico' && a.especie.percepcao.termorrecepcao && a.mente.caca?.id === c.id)).sort((x, y) => x.distancia - y.distancia)[0];
  const p = porPerto ?? (k && mundo.porId.get(k.id));
  if (!p || !incapacitadoParaEngolir(p, t)) return null;
  const cabe = podeEngolir(a, p);
  if (!cabe.ok) {
    if (a.mente.recusouEngolir !== p.id) { a.mente.recusouEngolir = p.id; mundo.evento('engolir_recusado', a.id, { presa: p.id, motivo: cabe.motivo, massaKg: +p.massa.toFixed(1) }); }
    return null;
  }
  const d = dist(a, p);
  const alvo = { tipo: 'criatura', id: p.id, x: p.x, y: p.y };
  if (d > 2.5) return { estado: 'indo_engolir', codigo: p.vivo ? 'presa_rendida' : 'presa_abatida', motivo: `${p.id} ${p.vivo ? 'rendido' : 'abatido'} a ${f1(d)} m; aproxima-se para engolir`, alvo, destino: { x: p.x, y: p.y }, ritmo: 'trote' };
  a.mente.engolindo = p.id; a.mente.engolirProgresso = 0;
  mundo.evento('engolir_inicio', a.id, { presa: p.id, massaKg: +p.massa.toFixed(1), fracaoDaPropria: +(p.massa / a.massa).toFixed(3), jaMorta: !p.vivo });
  return { estado: 'engolindo', codigo: 'engolir', motivo: `engolindo ${p.id} (${p.massa.toFixed(0)} kg)`, alvo, destino: null, ritmo: 'parado', acao: 'engolir', olharPara: { x: p.x, y: p.y } };
}

// Envenenado com sintomas: para e procura cobertura próxima. Ameaça à vista já foi tratada antes.
function repousoEnvenenado(a, mundo) {
  if (intensidadeVeneno(a, mundo.t) < 0.25) return null;
  return { estado: 'descansando', codigo: 'envenenado', motivo: `envenenado (${sintomasVeneno(a).join(', ') || 'sintomas iniciais'}); procura repouso`, alvo: null, destino: refugioCobertura(a, mundo, 20), ritmo: 'andar' };
}

// Clima que cega e castiga: procura cobertura (arbusto ou rocha) e espera passar. Sem abrigo perto, agacha onde está.
function abrigoDoClima(a, mundo) {
  if (!pedeAbrigo(mundo)) { a.mente.abrigo = null; return null; }
  const t = mundo.terreno, nome = mundo.climaAtivo.nome;
  if (!a.mente.abrigo) {
    let p = refugioCobertura(a, mundo, 30);
    if (!p) {
      // A rocha em si é célula bloqueada (inalcançável): o abrigo é o ponto encostado nela, do lado do animal.
      const r = refugioRochas(a, mundo, 30);
      if (r) { const d = dist(a, r) || 1; p = { x: r.x + ((a.x - r.x) / d) * 2, y: r.y + ((a.y - r.y) / d) * 2 }; }
    }
    a.mente.abrigo = { p, desde: mundo.t };
    mundo.evento('busca_abrigo', a.id, { clima: mundo.climaAtivo.tipo, achou: !!p, distancia: p ? +dist(a, p).toFixed(1) : null });
  }
  const p = a.mente.abrigo.p;
  if (!p || dist(a, p) < 2) return { estado: 'abrigado', codigo: p ? 'abrigo' : 'sem_abrigo', motivo: p ? `abrigado da ${nome}` : `${nome}: sem abrigo por perto, agacha`, alvo: null, destino: null, ritmo: 'parado' };
  return { estado: 'buscando_abrigo', codigo: 'clima', motivo: `${nome}: vai até cobertura a ${f1(dist(a, p))} m`, alvo: null, destino: p, ritmo: 'trote' };
}

// Cupinívoro: precisa CONHECER um cupinzeiro (visto ou farejado) antes de comer; ao chegar, vê o estado real.
function forragearCupins(a, mundo) {
  const cfg = a.especie.dieta.cupins, mem = a.memoria.cupinzeiros;
  const m = maisProximo(mem ? [...mem.values()].filter((c) => !c.vazio) : [], a);
  if (!m) return explorar(a, mundo, 'procurando_cupins', 'nenhum cupinzeiro conhecido; procura');
  const c = mundo.cupinzeiros.find((x) => x.id === m.id);
  const d = dist(a, c), alvo = { tipo: 'cupinzeiro', id: c.id, x: c.x, y: c.y };
  // Competição: quem é bem maior e já está no monte fica com ele; o menor espera à distância.
  if (d < 8) {
    const rival = a.contatos.find((k) => k.via === 'visao' && (k.massaEstimada ?? 0) > a.massa * 1.5 && dist(k, c) < 3 && mundo.porId.get(k.id)?.especie.dieta.cupins);
    // Continua esperando por alguns segundos depois de perder o rival de vista (senão volta e cede de novo a cada passo).
    if (rival) a.mente.cedeu = { id: c.id, rival: rival.id, ate: mundo.t + 4, avisado: a.mente.cedeu?.id === c.id && a.mente.cedeu.avisado };
    const ced = a.mente.cedeu;
    if (ced && ced.id === c.id && mundo.t < ced.ate) {
      if (!ced.avisado) { ced.avisado = true; mundo.evento('cupinzeiro_cedido', a.id, { cupinzeiro: c.id, para: ced.rival }); }
      return { estado: 'aguardando_cupinzeiro', codigo: 'cede_ao_maior', motivo: `${ced.rival} ocupa ${c.id}; espera`, alvo, destino: d < 3.5 ? afastar(a, c, 5) : null, ritmo: d < 3.5 ? 'andar' : 'parado', olharPara: { x: c.x, y: c.y } };
    }
  }
  if (d > cfg.alcanceM) return { estado: 'indo_cupinzeiro', codigo: m.via === 'olfato' ? 'farejou_cupins' : 'viu_cupinzeiro', motivo: `fome ${f1(a.fome)}; ${c.id} a ${f1(d)} m`, alvo, destino: { x: c.x, y: c.y }, ritmo: 'andar' };
  if (c.extinta || c.populacao < 1) {
    m.vazio = true; mundo.evento('cupinzeiro_abandonado', a.id, { cupinzeiro: c.id, motivo: 'esgotado' });
    return explorar(a, mundo, 'procurando_cupins', `${c.id} esgotado; procura outro`);
  }
  if (cfg.abre && c.aberto < 0.6) return { estado: 'abrindo_cupinzeiro', codigo: 'abre_casca', motivo: `abre ${c.id} (${Math.round(c.aberto * 100)}% aberto)`, alvo, destino: null, ritmo: 'parado', acao: 'abrir_cupinzeiro', olharPara: { x: c.x, y: c.y } };
  return { estado: 'pastando', codigo: 'cupins', motivo: `come cupins em ${c.id}: ${Math.round(c.populacao)} na colônia, ${Math.round(acessoCupins(c) * 100)}% ao alcance`, alvo, destino: null, ritmo: 'parado', acao: 'comer_cupins', olharPara: { x: c.x, y: c.y } };
}

// Emboscada — capacidade `taticasDeEmboscada { raioBuscaM, esperaMaxSeg, distanciaDisparoM }`.
// 1 procura cobertura · 2 vai até ela · 3 espera imóvel · 4 percebe estímulo · 5 avalia a distância ·
// 6-8 dispara e o combate normal resolve o contato · 9 persegue, desiste ou volta a esperar.
// Só dispara contra presa que ele VÊ; pista sem identidade (som, calor) apenas orienta a cabeça.
function emboscar(a, mundo) {
  const cfg = a.especie.taticasDeEmboscada, e = a.especie, t = mundo.t;
  if (!cfg || a.taticaDesligada || a.mente.caca || a.fome < e.necessidades.fomeCacar || t < (a.mente.semEmboscadaAte ?? 0)) return null;
  let em = a.mente.emboscada;
  if (!em) {
    // Área favorável: cobertura perto de onde ele sabe que há presa (vista ou ouvida há pouco). Sem pista
    // nenhuma, a cobertura mais próxima de si. Nunca usa posição de presa que não percebeu.
    const sinal = [...a.memoria.criaturas.values()].filter((k) => e.dieta.presas.includes(k.especie) && t - k.t < 30).sort((x, y) => y.t - x.t || (x.id < y.id ? -1 : 1))[0];
    const p = (sinal && dist(a, sinal) < cfg.raioBuscaM * 1.5 ? refugioCobertura({ x: sinal.x, y: sinal.y }, mundo, 10) : null) ?? refugioCobertura(a, mundo, cfg.raioBuscaM);
    if (!p) return null; // sem cobertura por perto não há emboscada: caça como os outros
    em = a.mente.emboscada = { ponto: p, fase: 'indo', desde: t };
    mundo.evento('emboscada_escolheu', a.id, { x: +p.x.toFixed(1), y: +p.y.toFixed(1), distancia: +dist(a, p).toFixed(1) });
  }
  if (em.fase === 'indo') {
    if (dist(a, em.ponto) > 1.5 && t - em.desde < 40) return { estado: 'indo_emboscada', codigo: 'cobertura', motivo: `vai até a cobertura a ${f1(dist(a, em.ponto))} m para emboscar`, alvo: null, destino: em.ponto, ritmo: 'andar' };
    em.fase = 'aguardando'; em.desde = t;
    mundo.evento('emboscada_armada', a.id, { x: +a.x.toFixed(1), y: +a.y.toFixed(1) });
  }
  const presas = a.contatos.filter((k) => k.via !== 'som' && (e.dieta.presas.includes(k.especie) || k.especie == null)).sort((x, y) => x.distancia - y.distancia || (x.id < y.id ? -1 : 1));
  // Dispara pelo que o animal de fato percebe: a visão, ou — para quem tem o sentido declarado — o calor,
  // que dá posição sem dar identidade. Uma serpente de fosseta não precisa enxergar para dar o bote.
  const vista = presas.find((k) => k.via === 'visao' && k.especie) ?? (e.percepcao.termorrecepcao ? presas.find((k) => k.via === 'termico') : null);
  // Presa parada e distraída (comendo, descansando) vale a saída da cobertura até ~2x a distância de disparo.
  // Quem embosca de tocaia (não persegue) espera o alvo entrar no alcance REAL do golpe, em vez de sair da
  // cobertura a uma distância fixa: disparar cedo gasta a emboscada e a presa passa ilesa. Para quem persegue,
  // vale a distância da ficha — ele corre atrás.
  const tocaia = !!a.especie.serpente;
  const alvoReal = vista && mundo.porId.get(vista.id);
  const atq = vista && alvoReal && !a.golpe ? escolherAtaque(a, alvoReal, vista.distancia, !alvoReal.memoria.criaturas.has(a.id)) : null;
  const noAlcance = tocaia ? !!atq : vista && vista.distancia <= cfg.distanciaDisparoM * (vista.comportamento !== 'fugindo' && (vista.velocidade ?? 1) < 0.5 ? 2.2 : 1);
  if (vista && noAlcance) {
    mundo.evento('emboscada_disparou', a.id, { presa: vista.id ?? null, via: vista.via, distancia: +vista.distancia.toFixed(1), esperou: +(t - em.desde).toFixed(1) });
    a.mente.emboscada = null; a.mente.semEmboscadaAte = t + 20;
    // O bote sai de onde ele está: quem embosca não começa uma perseguição.
    if (alvoReal) {
      a.mente.caca = { id: vista.id, inicio: t, semFolegoDesde: null };
      mundo.evento('caca_inicio', a.id, { presa: vista.id, distancia: +vista.distancia.toFixed(1), ferida: false, juvenil: !!alvoReal.juvenil });
      if (atq) {
        iniciarAtaque(a, alvoReal, atq, mundo);
        return { estado: 'atacando', codigo: atq.nome, motivo: `${atq.nome} da emboscada em ${vista.id} a ${f1(vista.distancia)} m`, alvo: { tipo: 'criatura', id: vista.id, x: alvoReal.x, y: alvoReal.y }, destino: null, ritmo: 'parado', acao: atq.nome, olharPara: { x: alvoReal.x, y: alvoReal.y } };
      }
    }
    return null;
  }
  if (t - em.desde > cfg.esperaMaxSeg) {
    mundo.evento('emboscada_desistiu', a.id, { esperou: +(t - em.desde).toFixed(1) });
    a.mente.emboscada = null; a.mente.semEmboscadaAte = t + 15;
    return null;
  }
  const pista = vista ?? presas[0];
  return { estado: 'emboscado', codigo: pista ? 'presa_percebida' : 'espera', motivo: pista ? `emboscado: ${pista.via === 'visao' ? pista.id : `pista por ${pista.via}`} a ${f1(pista.distancia)} m (dispara a ${cfg.distanciaDisparoM} m)` : `emboscado na cobertura há ${f1(t - em.desde)} s`,
    alvo: pista ? { tipo: pista.especie ? 'criatura' : 'pista', id: pista.especie ? pista.id : null, x: pista.x, y: pista.y } : null, destino: null, ritmo: 'parado', olharPara: pista ? { x: pista.x, y: pista.y } : null };
}

function abandonarCaca(a, mundo, motivo) {
  if (a.mente.caca) { mundo.fimPerseguicao(a, `desistiu_${motivo}`); a.mente.caca = null; }
}

function cacar(a, mundo) {
  const e = a.especie, n = e.necessidades, t = mundo.t;
  // Quem tem fosseta térmica não perde a presa de vista ao escurecer ou atrás do mato: a pista de calor dá
  // posição (nunca espécie), e por isso só vale para o alvo que ele já escolheu — foi assim que o bote saiu.
  const presasVistas = a.contatos.filter((k) => (e.dieta.presas.includes(k.especie) && k.via !== 'som')
    || (k.via === 'termico' && e.percepcao.termorrecepcao && a.mente.caca?.id === k.id));
  const podeIniciar = a.fome >= n.fomeCacar && (a.energia > 55 || (a.fome > n.fomeDesesperada && a.energia > 20)) && a.folego > e.movimento.resistenciaSeg * 0.4;
  // Cansaço durante a caça.
  if (a.mente.caca && (a.energia < 12 || (a.folego <= 0 && a.estado === 'perseguindo' && a.mente.caca.semFolegoDesde && t - a.mente.caca.semFolegoDesde > 2))) {
    abandonarCaca(a, mundo, 'cansaco');
    a.mente.pausaAte = t + 15;
    return { estado: 'descansando', codigo: 'desistiu_cansaco', motivo: `sem fôlego (energia ${f1(a.energia)}): desiste`, alvo: null, destino: null, ritmo: 'parado' };
  }
  if (a.mente.pausaAte > t) return { estado: 'descansando', codigo: 'pausa', motivo: 'recuperando o fôlego após a perseguição', alvo: null, destino: null, ritmo: 'parado' };
  if (a.folego <= 0 && a.mente.caca && !a.mente.caca.semFolegoDesde) a.mente.caca.semFolegoDesde = t;
  if (a.folego > 1 && a.mente.caca) a.mente.caca.semFolegoDesde = null;
  let alvoK = null;
  if (a.mente.caca) alvoK = presasVistas.find((k) => k.id === a.mente.caca.id);
  if (!alvoK && presasVistas.length && (podeIniciar || a.mente.caca)) {
    // Escolha: vulnerável (ferido visível, filhote, isolado), mais perto.
    const nota = (k) => (k.ferido ? 2 : 1) * (k.juvenil ? 1.6 : 1) * (isolado(k, a) ? 1.4 : 1) / (1 + k.distancia * 0.05);
    alvoK = [...presasVistas].sort((x, y) => nota(y) - nota(x) || (x.id < y.id ? -1 : 1))[0];
    if (!a.mente.caca || a.mente.caca.id !== alvoK.id) {
      if (a.mente.caca) mundo.fimPerseguicao(a, 'trocou_alvo');
      a.mente.caca = { id: alvoK.id, inicio: t, semFolegoDesde: null };
      mundo.evento('caca_inicio', a.id, { presa: alvoK.id, distancia: +alvoK.distancia.toFixed(1), ferida: !!alvoK.ferido, juvenil: !!alvoK.juvenil });
    }
  }
  if (alvoK) {
    const presa = mundo.porId.get(alvoK.id);
    const d = alvoK.distancia;
    const alvo = { tipo: 'criatura', id: alvoK.id, x: alvoK.x, y: alvoK.y };
    const percebido = presa && presa.memoria.criaturas.has(a.id) && t - presa.memoria.criaturas.get(a.id).t < 2;
    // Veneno: depois de inocular, acompanha a presa a distância e deixa o veneno agir em vez de lutar.
    const inoc = e.veneno && a.mente.inoculou?.id === alvoK.id ? a.mente.inoculou : null;
    // Só volta a atacar quando a presa cai, ou para de se mover depois de o veneno ter tido tempo de agir.
    const rendida = alvoK.comportamento === 'caido' || (alvoK.velocidade < 0.3 && t - (inoc?.t ?? 0) > (e.veneno?.latenciaSeg ?? 8) * 2);
    if (inoc && !a.golpe && t - inoc.t < (e.veneno.esperaSeg ?? 60) && !rendida) {
      // Não se afasta de costas (perderia a presa de vista): fica onde está, de frente, e só anda se ela se distanciar.
      const longe = d > 8;
      return { estado: 'acompanhando_presa', codigo: 'aguarda_veneno', motivo: `inoculou ${alvoK.id} há ${f1(t - inoc.t)} s; acompanha a ${f1(d)} m`, alvo, destino: longe ? alvoK : null, ritmo: longe ? 'trote' : 'parado', olharPara: { x: alvoK.x, y: alvoK.y } };
    }
    if (presa && (alvoK.via === 'visao' || alvoK.via === 'termico')) {
      const atq = !a.golpe && escolherAtaque(a, presa, d, !percebido);
      // Durante o golpe acompanha a presa na velocidade dela (+1,5 m/s): o membro chega ao corpo sem passar direto.
      const velMax = presa.velocidade + 1.5;
      if (atq) { iniciarAtaque(a, presa, atq, mundo); return { estado: 'atacando', codigo: atq.nome, motivo: `${atq.nome} em ${presa.id} a ${f1(d)} m${!percebido ? ' (surpresa)' : ''}`, alvo, destino: alvoK, ritmo: 'corrida', acao: atq.nome, velMax: atq.nome === 'bote' ? null : velMax }; }
      if (a.golpe) return { estado: 'atacando', codigo: 'golpe', motivo: `golpeando ${presa.id}`, alvo, destino: alvoK, ritmo: 'corrida', velMax: a.golpe.nome === 'bote' ? null : velMax };
    }
    // Espreita (devagar, prefere cobertura) até perto ou até ser percebido; depois corre com antecipação.
    // Camuflado e ainda não denunciado: vale chegar ao alcance do bote andando, em vez de disparar a 16 m.
    const correr = d < (a.camuflagem?.ligada ? 5 : 16) || alvoK.comportamento === 'fugindo' || a.estado === 'perseguindo';
    if (!correr) {
      a.mente.preferirCobertura = true;
      return { estado: 'espreitando', codigo: 'espreita', motivo: `espreita ${alvoK.id} a ${f1(d)} m`, alvo, destino: flanquear(a, mundo, alvoK), ritmo: 'andar' };
    }
    a.mente.preferirCobertura = false;
    if (a.estado !== 'perseguindo') mundo.inicioPerseguicao(a, alvoK.id);
    const ant = Math.min(0.8, d / e.movimento.corrida);
    const destino = alvoK.vx != null ? { x: alvoK.x + alvoK.vx * ant, y: alvoK.y + alvoK.vy * ant } : alvoK;
    return { estado: 'perseguindo', codigo: 'perseguicao', motivo: `persegue ${alvoK.id} (${f1(d)} m, fôlego ${f1(a.folego)} s)`, alvo, destino, ritmo: 'corrida' };
  }
  if (a.mente.caca) {
    const m = a.memoria.criaturas.get(a.mente.caca.id);
    if (!m || t - m.t > 8) { abandonarCaca(a, mundo, 'perda_rastro'); return null; }
    if (dist(a, m) > 2) return { estado: 'investigando', codigo: 'ultima_posicao', motivo: `perdeu ${m.id} de vista há ${f1(t - m.t)} s; vai à última posição`, alvo: { tipo: 'criatura', id: m.id, x: m.x, y: m.y }, destino: m, ritmo: 'trote' };
    const ang = t * 2.1;
    return { estado: 'farejando', codigo: 'farejar', motivo: `farejando o rastro de ${m.id}`, alvo: { tipo: 'criatura', id: m.id, x: m.x, y: m.y }, destino: null, ritmo: 'parado', olharPara: { x: a.x + cos(ang) * 5, y: a.y + sen(ang) * 5 }, acao: 'farejar' };
  }
  return null;
}

// Par de caça (só espécies com caça cooperativa): o segundo aproxima-se pelo flanco.
function flanquear(a, mundo, presa) {
  if (!a.especie.social.cacaCooperativa || !a.parId) return presa;
  const par = a.contatos.find((k) => k.id === a.parId && k.via === 'visao');
  if (!par || par.perseguindo !== presa.id && dist(par, presa) > 30) return presa;
  const ang = atan2(presa.y - par.y, presa.x - par.x) + (a.numero < (mundo.porId.get(a.parId)?.numero ?? 0) ? 1.2 : -1.2);
  if (!a.mente.flanqueouEm || mundo.t - a.mente.flanqueouEm > 10) { a.mente.flanqueouEm = mundo.t; mundo.evento('flanqueio', a.id, { par: a.parId, presa: presa.id }); }
  return { x: presa.x - cos(ang) * 10, y: presa.y - sen(ang) * 10 };
}

function isolado(k, a) {
  return !a.contatos.some((o) => o.id !== k.id && o.grupo && o.grupo === k.grupo && dist(o, k) < 8);
}

function patrulhar(a, mundo) {
  const ter = a.territorio;
  if (ter && a.especie.social.marcacao && (!a.mente.marcouEm || mundo.t - a.mente.marcouEm > 45)) {
    a.mente.marcouEm = mundo.t;
    mundo.marcas.push({ dono: a.id, especie: a.especie.id, x: a.x, y: a.y, t: mundo.t });
    if (mundo.marcas.length > 200) mundo.marcas.shift();
    mundo.evento('marca_territorio', a.id, {});
  }
  return explorar(a, mundo, 'patrulhando', ter ? 'patrulhando o território' : 'percorrendo a área');
}

export { irBeber };
