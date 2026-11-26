// Percepção por vibrações do substrato. Complementa visão, audição e olfato; não substitui nenhum deles.
//
// Um estímulo é um ponto no tempo e no espaço com uma intensidade, não um alvo identificado: quem sente
// sabe que ALGUMA COISA se moveu por ali, com erro de posição que cresce com a distância e a profundidade.
// A identidade da espécie só entra quando o mesmo emissor é confirmado por outro sentido ou por
// estímulos repetidos no mesmo lugar (ver `consolidar`).
import { cos, exp, hipot, PI, sen } from '../core/matematica.js';
import { indice } from './terreno.js';
import { resistenciaAreia } from './areia.js';
import { submerso } from './subsolo.js';

// Quanto cada ação sacode o substrato, multiplicado pela massa do emissor (ver intensidade()).
export const FONTES = Object.freeze({
  passo: 0.10, trote: 0.35, corrida: 1.0, salto: 1.2, queda: 1.6,
  combate: 1.8, escavacao: 0.9, mergulho: 1.3, emergencia: 1.5, subsolo: 0.5,
});

export const VIDA_MEMORIA_SEG = 60;

// Intensidade na fonte: massa × ação. Normalizada por 100 kg para ficar na ordem de 1.
export function intensidade(massaKg, tipo) {
  return (FONTES[tipo] ?? 0.2) * Math.sqrt(Math.max(1, massaKg) / 100);
}

export function instalarVibracoes(mundo) {
  mundo.vibracoes = [];
  mundo.vibracao = (a, tipo, massaKg = a?.massa ?? 100) => {
    const v = {
      id: `vib${++mundo.contadorVibracoes}`, emissor: a?.id ?? null, especie: a?.especie?.id ?? null,
      x: a?.x ?? 0, y: a?.y ?? 0, prof: a?.subsolo?.prof ?? 0, tipo,
      intensidade: intensidade(massaKg, tipo), t: mundo.t,
    };
    mundo.vibracoes.push(v);
    return v;
  };
  mundo.contadorVibracoes = 0;
}

// Vibrações geradas pelo próprio movimento neste passo (chamado uma vez por animal ativo).
export function emitirDoMovimento(mundo, a, dt) {
  if (!mundo.vibracao || !a.vivo) return;
  const m = a.especie.movimento;
  let tipo = null;
  if (submerso(a)) tipo = a.velocidade > 0.5 ? 'subsolo' : null;
  else if (a.velocidade >= m.corrida * 0.75) tipo = 'corrida';
  else if (a.velocidade >= m.trote * 0.7) tipo = 'trote';
  else if (a.velocidade > 0.2) tipo = 'passo';
  if (!tipo) return;
  // Uma vibração a cada 0,5 s por animal: a grade de estímulos não cresce com o dt.
  if (a.ultimaVibracao != null && mundo.t - a.ultimaVibracao < 0.5 - 1e-9) return;
  a.ultimaVibracao = mundo.t;
  mundo.vibracao(a, tipo);
}

// Intensidade que chega a quem sente: queda com o quadrado da distância, atenuação pela profundidade
// (emissor e receptor) e pela rocha no caminho, e ganho pela sensibilidade da espécie.
export function intensidadePercebida(a, v, mundo) {
  const s = a.especie.percepcao?.vibracao;
  if (!s) return 0;
  const dx = v.x - a.x, dy = v.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > s.alcance) return 0;
  // 1 m de referência: a 1 m a intensidade chega inteira; depois cai com 1/(1+d²/d0²).
  const d0 = Math.max(1, s.alcance / 6);
  let i = v.intensidade / (1 + (d * d) / (d0 * d0));
  // Profundidade separa emissor e receptor: cada metro de areia entre eles atenua.
  const dProf = Math.abs((a.subsolo?.prof ?? 0) - v.prof);
  i *= exp(-dProf / Math.max(1, s.alcanceVerticalM ?? 8));
  // Quem está na superfície sente pior o que vem de baixo e vice-versa (a crosta reflete parte).
  if (submerso(a) !== (v.prof > 0.5)) i *= 0.65;
  // Rocha no caminho absorve o estímulo.
  i *= atenuacaoDoCaminho(mundo.terreno, a, v);
  return i * (s.sensibilidade ?? 1);
}

// Média da transmissão ao longo do segmento: areia solta transmite bem, rocha e leito compacto mal.
function atenuacaoDoCaminho(t, a, v) {
  const passos = Math.max(1, Math.round(hipot(v.x - a.x, v.y - a.y) / Math.max(2, t.res * 2)));
  let soma = 0;
  for (let i = 1; i <= passos; i++) {
    const u = i / passos;
    const x = a.x + (v.x - a.x) * u, y = a.y + (v.y - a.y) * u;
    const k = indice(t, x, y);
    if (k < 0) { soma += 0.2; continue; }
    if (t.bloqueio[k] === 1) { soma += 0.15; continue; }
    soma += 1 - 0.55 * resistenciaAreia(t, x, y);
  }
  return soma / passos;
}

// Estímulos sentidos neste passo, já com erro de posição. Devolve contatos `via: 'vibracao'`,
// SEM identidade de espécie: `especie: null` até que `consolidar` confirme.
export function perceberVibracoes(a, mundo) {
  const s = a.especie.percepcao?.vibracao;
  // As vibrações do passo anterior: a percepção roda antes das ações que produzem as deste passo.
  const lista = mundo.vibracoesAnteriores ?? mundo.vibracoes;
  if (!s || !lista?.length) return [];
  const out = [];
  for (const v of lista) {
    if (v.emissor === a.id) continue;
    const i = intensidadePercebida(a, v, mundo);
    if (i < s.limiar) continue;
    // Erro de posição: proporcional à distância e inverso à intensidade recebida.
    const d = hipot(v.x - a.x, v.y - a.y);
    const erro = Math.min(s.alcance * 0.5, (d * (s.erroRelativo ?? 0.25)) / Math.max(0.25, Math.min(2, i / s.limiar)));
    const ang = a.rngPercepcao.entre(-PI, PI), r = a.rngPercepcao.entre(0, erro);
    out.push({
      via: 'vibracao', id: v.emissor, especie: null, tipo: v.tipo,
      x: v.x + cos(ang) * r, y: v.y + sen(ang) * r,
      erroM: +erro.toFixed(2), intensidade: +i.toFixed(4), distancia: d, prof: v.prof, t: mundo.t,
    });
  }
  return out;
}

// Memória dos estímulos: acumula no mesmo local, decai com o tempo e só nomeia a espécie quando
// outro sentido confirmou o mesmo indivíduo. Guardada em a.memoria.vibracoes (Map por emissor|local).
export function consolidar(a, estimulos, mundo) {
  const mem = (a.memoria.vibracoes ??= new Map());
  for (const e of estimulos) {
    // Agrupa por região de ~8 m: estímulos seguidos do mesmo animal viram uma pista só, mais precisa.
    const chave = `${Math.round(e.x / 8)}:${Math.round(e.y / 8)}`;
    const m = mem.get(chave);
    if (m) {
      const peso = e.intensidade / (m.intensidade + e.intensidade);
      m.x += (e.x - m.x) * peso; m.y += (e.y - m.y) * peso;
      m.intensidade = Math.max(m.intensidade, e.intensidade);
      m.contagem++; m.t = mundo.t; m.erroM = Math.min(m.erroM, e.erroM);
      m.tipos.add(e.tipo);
      if (e.id) m.candidatos.add(e.id);
    } else {
      mem.set(chave, { chave, x: e.x, y: e.y, prof: e.prof, intensidade: e.intensidade, erroM: e.erroM, contagem: 1, t: mundo.t, inicio: mundo.t, tipos: new Set([e.tipo]), candidatos: new Set(e.id ? [e.id] : []), especie: null, investigado: -1e9 });
    }
  }
  // Identidade: só quando a visão/olfato confirmou um dos candidatos perto da pista.
  for (const m of mem.values()) {
    if (m.especie) continue;
    for (const id of m.candidatos) {
      const c = a.memoria.criaturas.get(id);
      if (c && c.via !== 'vibracao' && mundo.t - c.t < 8 && (c.x - m.x) * (c.x - m.x) + (c.y - m.y) * (c.y - m.y) < 400) { m.especie = c.especie; break; }
    }
  }
  for (const [k, m] of mem) if (mundo.t - m.t > VIDA_MEMORIA_SEG) mem.delete(k);
  return mem;
}

// Pista mais forte ainda não investigada (intensidade ponderada pela idade e pela distância).
export function melhorPista(a, mundo, { ignorarAteSeg = 20 } = {}) {
  const mem = a.memoria.vibracoes;
  if (!mem?.size) return null;
  let melhor = null;
  for (const m of mem.values()) {
    if (mundo.t - m.investigado < ignorarAteSeg) continue;
    const idade = mundo.t - m.t;
    const d = hipot(m.x - a.x, m.y - a.y);
    const peso = (m.intensidade * (1 + 0.2 * m.contagem)) / (1 + idade / 12) / (1 + d / 40);
    if (!melhor || peso > melhor.peso) melhor = { pista: m, peso };
  }
  return melhor?.pista ?? null;
}
