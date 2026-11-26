// Percepção V2 (N animais, terreno 3D). Cada animal só conhece o que vê, ouve, cheira ou lembra.
// O contato expõe apenas sinais observáveis (posição, velocidade, comportamento visível, ferimento aparente,
// porte estimado com erro) — nunca energia, fome, vida exata ou intenções do outro.
import { atan2, cos, sen } from '../core/matematica.js';
import { normalizarAngulo } from '../core/geometria.js';
import { linhaDeVisao } from './terreno.js';
import { feridoVisivel } from './saude.js';
import { fatorVisualCamuflagem } from './camuflagem.js';
import { perceberCalor } from './termo.js';
import { vizinhos as vizinhosDaGrade } from './grade.js';
import { corpoObservavel, sinalCombate } from './tatica.js';

// Reaproveitado entre chamadas de `perceber`: um array por passo, não um por animal.
const perto = [];

// Estados que outros animais conseguem reconhecer visualmente.
const COMPORTAMENTO_VISIVEL = {
  avaliando:'encarando',ameacando:'exibindo',aproximando:'confrontando',circulando:'confrontando',procurando_abertura:'confrontando',preparando_ataque:'atacando',recuperando:'recuperando',pressionando:'correndo',defendendo:'exibindo',
  fugindo: 'fugindo', fugindo_voo: 'fugindo', perseguindo: 'correndo', atacando: 'atacando', comendo_carcaca: 'comendo_carcaca',
  intimidando: 'exibindo', confrontando: 'confrontando', combatendo: 'lutando', recuando: 'recuando',
  pastando: 'comendo', bebendo: 'bebendo', descansando: 'parado', vigiando: 'vigiando', espreitando: 'agachado', emboscado: 'agachado',
  // V3: postura de quem encara um rival, segura uma presa, caiu ou se debate também é visível.
  observando_rival: 'encarando', segurando_presa: 'segurando', caido: 'caido', agarrado: 'debatendo', atordoado: 'cambaleando',
  fintando: 'atacando', esquivando: 'recuando', levantando: 'levantando', protegendo_ferida: 'defendendo',
  cumprimentando: 'cumprimentando', brincando: 'brincando', limpando: 'limpando', submissao: 'submisso',
};

// Luz conforme o horário e o padrão de atividade do observador (diurno vê mal à noite, etc.).
export function fatorLuz(atividade, hora) {
  const dia = hora >= 6.5 && hora <= 18.5;
  const crep = (hora > 5 && hora < 6.5) || (hora > 18.5 && hora < 20);
  if (atividade === 'noturno') return dia ? 0.85 : crep ? 1 : 0.9;
  if (atividade === 'crepuscular') return dia ? 0.95 : crep ? 1.1 : 0.6;
  return dia ? 1 : crep ? 0.7 : 0.3;
}

export function alcances(a, hora, clima = null) {
  const p = a.especie.percepcao;
  const mod = p.modificadoresPorEstado?.[a.estado] ?? {};
  const sent = a.atributos.sentidos * (a.juvenil ? 0.8 : 1);
  return {
    // Clima adverso (V7) limita os sentidos do ANIMAL, pelo mesmo estado que a cena desenha.
    visao: p.visao.alcance * (mod.visao ?? 1) * sent * fatorLuz(a.especie.atividade, hora) * (clima?.visao ?? 1),
    angulo: ((p.visao.anguloGraus * Math.PI) / 180) * (a.foco ? 0.55 : 1),
    proximo: p.visao.alcanceProximo ?? 0,
    audicao: p.audicao.alcance * (mod.audicao ?? 1) * sent * (clima?.audicao ?? 1),
    olfato: (p.olfato?.alcance ?? 0) * sent * (clima?.olfato ?? 1),
    tRec: (p.visao.tempoReconhecimentoSeg ?? 0.5) / (a.estado === 'vigiando' ? 1.6 : 1),
  };
}

// Usado quando a linha de visão não é necessária: nenhum ramo que a consulta pode ser verdadeiro.
const SEM_LOS = Object.freeze({ livre: false, visibilidade: 0 });
// Quem voa olha (e é visto) da altitude em que está.
const alturaOlho = (a) => a.especie.corpo.alturaM * a.escala * 0.9 + (a.voo?.alt ?? 0);
const alturaAlvo = (a) => a.especie.corpo.alturaM * a.escala * 0.6 + (a.voo?.alt ?? 0);

export function visibilidadeDe(alvo) {
  const f = alvo.especie.furtividade ?? {};
  let v = 1 - (f.camuflagem ?? 0);
  if (alvo.velocidade < 0.2) v *= f.fatorParado ?? 1;
  if (alvo.estado === 'escondido' || alvo.estado === 'emboscado') v *= 0.6;
  v *= fatorVisualCamuflagem(alvo);
  // Porte: animais maiores são vistos de mais longe (raiz da altura relativa a 1 m).
  v *= Math.min(2.5, Math.max(0.5, Math.sqrt(alvo.especie.corpo.alturaM * alvo.escala)));
  return v;
}

export function ruido(alvo) {
  const m = alvo.especie.movimento;
  let r = (alvo.velocidade / m.corrida) * (alvo.especie.furtividade?.ruidoPassos ?? 1) * Math.min(2, Math.sqrt(alvo.massa / 40));
  if (['combatendo', 'intimidando', 'confrontando'].includes(alvo.estado)) r = Math.max(r, 1.2);
  return r;
}

export function perceber(a, mundo, vizinhos, dt) {
  const t = mundo.terreno;
  // Enterrado na areia: visão, audição e olfato não funcionam. Só resta a vibração do substrato
  // (perceberVibracoes, em vibracoes.js). É o que torna a emboscada um problema de estimativa, não de mira.
  if (a.subsolo && (a.subsolo.fase === 'submerso' || a.subsolo.fase === 'mergulhando')) { a.ocultos = []; return []; }
  const al = alcances(a, mundo.relogio.hora, mundo.climaAtivo);
  const contatos = [];
  a.ocultos = [];
  const termo = a.especie.percepcao.termorrecepcao;
  const maxR = Math.max(al.visao * 2.5, al.audicao * 1.3, al.olfato, (termo?.alcance ?? 0) * 2.4);
  // Grade espacial: só os que podem estar ao alcance de algum sentido. Quem fica de fora teria caído no
  // `decair` do laço antigo — e ele é reposto logo abaixo, para a atenção decair igual.
  const g = mundo.gradeAtivos?.lista === vizinhos ? mundo.gradeAtivos : null;
  const cand = g ? vizinhosDaGrade(g, a.x, a.y, maxR, perto) : null;
  const nCand = cand ? cand.length : vizinhos.length;
  const vistos = g && a.atencao.size ? new Set() : null;
  for (let c = 0; c < nCand; c++) {
    const o = cand ? vizinhos[cand[c]] : vizinhos[c];
    if (vistos) vistos.add(o.id);
    if (o === a || !o.vivo || o.nivel === 3) continue;
    // Quem está sob a areia não é visto, ouvido nem farejado: o corpo está enterrado.
    if (o.subsolo && (o.subsolo.fase === 'submerso' || o.subsolo.fase === 'mergulhando')) { decair(a, o.id, al.tRec, dt); continue; }
    const dx = o.x - a.x, dy = o.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxR) { decair(a, o.id, al.tRec, dt); continue; }
    const ang = atan2(dy, dx);
    const emCone = Math.abs(normalizarAngulo(ang - a.direcao)) <= al.angulo / 2;
    // Linha de visão sobre o relevo é o cálculo mais caro: só quando algum sentido depende dela (visão próxima,
    // dentro do cone e do alcance, ou som que a linha de visão atenua). Fora disso o resultado não muda nada.
    const vis = visibilidadeDe(o);
    const precisaLos = d <= al.proximo || (emCone && d <= Math.max(al.visao, al.visao * vis * 1.15)) || d <= al.audicao * ruido(o);
    const los = precisaLos ? linhaDeVisao(t, a, o, alturaOlho(a), alturaAlvo(o)) : SEM_LOS;
    const alcanceEf = al.visao * vis * los.visibilidade;
    const anterior = a.atencao.get(o.id) ?? 0;
    let visto = false;
    if (los.livre && d <= al.proximo) { a.atencao.set(o.id, 1); visto = true; }
    else if (los.livre && emCone && d <= alcanceEf) {
      // Foco num rival: reconhecer outro alvo fica muito mais lento (distração).
      const foco = a.foco && a.foco !== o.id ? 0.3 : 1;
      const ganho = (dt / al.tRec) * (1 + 2 * (1 - d / alcanceEf)) * foco;
      const at = Math.min(1, anterior + ganho);
      a.atencao.set(o.id, at); visto = at >= 1;
    } else if (los.livre && emCone && anterior >= 1 && d <= alcanceEf * 1.15) visto = true;
    else decair(a, o.id, al.tRec, dt);
    if (visto) {
      contatos.push(contato(a, o, d, 'visao', mundo));
      continue;
    }
    // Calor: sentido independente. Funciona contra quem a visão não reconhece (camuflado, no escuro).
    if (termo) { const c = perceberCalor(a, o, d, mundo, dt); if (c) { contatos.push(c); continue; } }
    // Diagnóstico (só inspeção): fora do cone não calcula linha de visão.
    if (d <= al.visao) a.ocultos.push({ id: o.id, distancia: d, motivo: !emCone && !precisaLos ? 'fora_do_cone' : !los.livre ? 'sem_linha_de_visao' : !emCone ? 'fora_do_cone' : d > alcanceEf ? 'camuflagem_cobertura' : 'reconhecendo' });
    const atenuacao = los.livre ? 1 : 0.55;
    if (d <= al.audicao * ruido(o) * atenuacao) {
      const erro = (a.especie.percepcao.audicao.erroRelativo ?? 0.2) * d;
      contatos.push(contatoImpreciso(a, o, d, 'audicao', erro));
      continue;
    }
    // Olfato: rastro de animais vivos só de perto (sem modelar vento nesta etapa).
    if (d <= al.olfato * 0.35) contatos.push(contatoImpreciso(a, o, d, 'olfato', d * 0.35));
  }
  // Com a grade, quem está longe nem foi visitado. O laço antigo chamava `decair` para cada um deles, e
  // `decair` só faz algo em quem está na atenção — então basta percorrer a atenção, que é curta.
  if (vistos) for (const id of [...a.atencao.keys()]) if (!vistos.has(id) && mundo.idsAtivos?.has(id)) decair(a, id, al.tRec, dt);
  // Sons emitidos no passo anterior (alarmes, rugidos, chamados): só a posição de quem emitiu.
  for (const s of mundo.sonsAnteriores) {
    if (s.fonte === a.id) continue;
    const d = Math.sqrt((s.x - a.x) * (s.x - a.x) + (s.y - a.y) * (s.y - a.y));
    if (d <= s.alcance * (mundo.climaAtivo?.audicao ?? 1)) contatos.push({ id: s.fonte, especie: s.especie, via: 'som', som: s.tipo, x: s.x, y: s.y, distancia: d, sobre: s.sobre ?? null });
  }
  return contatos;
}

function contato(a, o, d, via, mundo) {
  const c = {
    id: o.id, especie: o.especie.id, via, distancia: d, x: o.x, y: o.y,
    vx: cos(o.direcao) * o.velocidade, vy: sen(o.direcao) * o.velocidade, velocidade: o.velocidade, direcao: o.direcao,
    comportamento: COMPORTAMENTO_VISIVEL[o.estado] ?? 'movendo',
    juvenil: !!o.juvenil, grupo: o.grupoId,
  };
  if(via==='visao') { c.body=corpoObservavel(o); c.signal=sinalCombate(o,mundo.t); }
  if (d < 25) {
    c.ferido = feridoVisivel(o);
    // Porte estimado com erro (± até 15%), estável por par observador/alvo dentro do mesmo segundo.
    const ruidoEst = ((((a.numero * 73856093) ^ (o.numero * 19349663) ^ Math.floor(mundo.t)) >>> 0) % 1000) / 1000;
    c.massaEstimada = o.massa * (0.85 + 0.3 * ruidoEst);
  }
  if (o.conflito) c.emDisputaCom = o.conflito.rival;
  if (o.voo) { c.alt = o.voo.alt; c.noAr = o.voo.fase !== 'solo'; }
  // Para onde o outro está olhando (orientação da cabeça é visível): base para perceber distração.
  if (via === 'visao') c.foco = o.foco ?? o.alvo?.id ?? null;
  if (o.alvo?.tipo === 'criatura' && (o.estado === 'perseguindo'||o.tatica?.context==='hunt')) c.perseguindo = o.alvo.id;
  return c;
}

function contatoImpreciso(a, o, d, via, erro) {
  const ang = a.rngPercepcao.entre(-Math.PI, Math.PI), r = a.rngPercepcao.entre(0, erro);
  return { id: o.id, especie: o.especie.id, via, distancia: d, x: o.x + cos(ang) * r, y: o.y + sen(ang) * r, velocidade: null, comportamento: null };
}

function decair(a, id, tRec, dt) {
  const v = a.atencao.get(id);
  if (!v) return;
  const n = Math.max(0, Math.min(v, 0.8) - dt / (tRec * 3));
  if (n > 0) a.atencao.set(id, n); else a.atencao.delete(id);
}

export function perceberCarcacas(a, mundo) {
  const al = alcances(a, mundo.relogio.hora, mundo.climaAtivo);
  const out = [];
  for (const c of mundo.carcacas) {
    if (c.carne <= 0) continue;
    const d = Math.sqrt((c.x - a.x) * (c.x - a.x) + (c.y - a.y) * (c.y - a.y));
    const odor = al.olfato * (0.4 + c.decomposicao * 1.2) * Math.min(2, Math.sqrt(c.carneInicial / 10));
    if (d <= odor) out.push({ id: c.id, x: c.x, y: c.y, distancia: d, via: 'olfato', dono: null });
    else if (d <= al.visao && linhaDeVisao(mundo.terreno, a, c, alturaOlho(a), 0.3).livre) out.push({ id: c.id, x: c.x, y: c.y, distancia: d, via: 'visao', dono: c.dono, carne: c.carne });
  }
  return out;
}

export function atualizarMemoria(a, contatos, carcacas, t) {
  const m = a.memoria;
  for (const k of contatos) {
    if (k.via === 'som') { m.sons.push({ ...k, t }); continue; }
    const prev = m.criaturas.get(k.id);
    m.criaturas.set(k.id, { ...k, t, ferido: k.ferido ?? prev?.ferido ?? false, massaEstimada: k.massaEstimada ?? prev?.massaEstimada });
  }
  for (const c of carcacas) m.carcacas.set(c.id, { ...c, t });
  const dur = a.especie.percepcao.memoriaSeg;
  for (const [id, v] of m.criaturas) if (t - v.t > dur) m.criaturas.delete(id);
  for (const [id, v] of m.carcacas) if (t - v.t > dur * 4) m.carcacas.delete(id);
  m.sons = m.sons.filter((s) => t - s.t < 6);
}
