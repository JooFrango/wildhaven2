// Decisão das espécies das dunas. Mesmo contrato do cérebro terrestre (uma intenção por passo, só com o que
// o animal percebeu ou lembra), mais dois campos: `subsolo` ('mergulhar' | 'emergir' | null) e `profundidade`.
//
// O que muda em relação ao cérebro terrestre:
//   - a areia é um refúgio e uma estrada, não um esconderijo mágico: só entra onde cabe o corpo;
//   - vibrações são pistas, não alvos: a criatura investiga um ponto, não persegue uma espécie;
//   - cada espécie decide conforme o que sua anatomia permite (nadador de areia × escavador de emboscada).
import { atan2, cos, hipot, PI, sen } from '../core/matematica.js';
import { indice } from './terreno.js';
import { areiaNavegavel, espessuraAreia, faixaProfundidade } from './areia.js';
import { emTransicao, naSuperficie, perfilSubsolo, podeEmergir, podeMergulhar, pontoDeEmergencia, separadosNaVertical, submerso } from './subsolo.js';
import { melhorPista } from './vibracoes.js';
import { escolherAtaque, iniciarAtaque } from './combate.js';
import { incapacitado } from './saude.js';

const f1 = (v) => Number(v).toFixed(1);
const dist = (a, b) => hipot(a.x - b.x, a.y - b.y);

// Nadador de areia: percorre distâncias sob a areia. Escavador: enterra-se e espera (avanço quase nulo).
export const nadadorDeAreia = (e) => !!e.subsolo && e.subsolo.cruzeiro >= 2;

export function decidirDunas(a, mundo) {
  const e = a.especie, t = mundo.t;
  a.tAtual = t;
  const p = a.subsolo?.perfil ?? perfilSubsolo(e);

  if (a.agarradoPor) return intencao('agarrado', 'luta_agarrao', `preso por ${a.agarradoPor}`, { ritmo: 'parado', acao: 'debater' });
  if (a.saude.caidoAte > t) return intencao('caido', 'caido', 'derrubado', { ritmo: 'parado' });
  if (a.saude.atordoadoAte > t) return intencao('atordoado', 'atordoado', 'atordoado pelo golpe', { ritmo: 'parado' });
  // Transição em curso: o controlador físico termina o mergulho/emergência; a IA não interrompe no meio.
  if (emTransicao(a)) return intencao(a.subsolo.fase === 'mergulhando' ? 'mergulhando' : 'emergindo', a.subsolo.fase, 'atravessando a superfície da areia', { ritmo: 'andar' });

  const profPref = e.subsolo?.profundidadePreferidaM ?? Math.min(p.profundidadeMaxM * 0.5, 3);

  // ---- 1. Ameaça: fugir. Mergulhar é a melhor fuga de quem nada na areia.
  const ameacas = a.contatos.filter((k) => k.via !== 'som' && k.via !== 'vibracao' && k.especie && e.teme.includes(k.especie));
  if (ameacas.length && !incapacitado(a)) {
    const am = ameacas.reduce((m, k) => (!m || k.distancia < m.distancia ? k : m), null);
    a.mente.perigo = { x: am.x, y: am.y, t, id: am.id };
    const fuga = { x: a.x + (a.x - am.x) * 3, y: a.y + (a.y - am.y) * 3 };
    if (naSuperficie(a) && podeMergulhar(a, mundo))
      return intencao('fugindo', 'mergulho_de_fuga', `mergulha para escapar de ${am.especie} a ${f1(am.distancia)} m`, { alvo: alvoDe(am), destino: fuga, ritmo: 'corrida', subsolo: 'mergulhar', profundidade: profPref });
    if (submerso(a))
      return intencao('fugindo', 'fuga_subterranea', `foge sob a areia de ${am.especie}`, { alvo: alvoDe(am), destino: fuga, ritmo: 'corrida', profundidade: Math.min(p.profundidadeMaxM, profPref + 2) });
    return intencao('fugindo', 'fuga_superficie', `foge de ${am.especie} a ${f1(am.distancia)} m`, { alvo: alvoDe(am), destino: fuga, ritmo: 'corrida' });
  }

  // ---- 1b. Estímulo forte e perto, sem saber o que é: a presa não espera para descobrir.
  // É a fuga possível para quem está enterrado, onde não há visão nem olfato — e o motivo registrado
  // diz exatamente isso: um corpo grande se mexendo por perto, espécie desconhecida.
  if (e.papel !== 'carnivoro' && !incapacitado(a)) {
    const v = e.percepcao.vibracao;
    const alerta = v && melhorPista(a, mundo, { ignorarAteSeg: 0 });
    if (alerta && t - alerta.t < 3 && alerta.intensidade > v.limiar * 14 && dist(a, alerta) < 25 && !alerta.tipos.has('passo')) {
      const fuga = { x: a.x + (a.x - alerta.x) * 3, y: a.y + (a.y - alerta.y) * 3 };
      a.mente.perigo = { x: alerta.x, y: alerta.y, t, id: null, indireto: true };
      if (naSuperficie(a) && podeMergulhar(a, mundo))
        return intencao('fugindo', 'mergulho_de_fuga', `estímulo forte a ${f1(dist(a, alerta))} m (${alerta.especie ?? 'espécie desconhecida'}); mergulha`, { destino: fuga, ritmo: 'corrida', subsolo: 'mergulhar', profundidade: profPref });
      return intencao('fugindo', 'fuga_por_vibracao', `estímulo forte a ${f1(dist(a, alerta))} m (${alerta.especie ?? 'espécie desconhecida'}); afasta-se`, { destino: fuga, ritmo: 'corrida', profundidade: submerso(a) ? Math.min(p.profundidadeMaxM, profPref + 2) : 0 });
    }
  }

  // ---- 2. Carnívoro: emboscada a partir do subsolo.
  if (e.papel === 'carnivoro' && a.fome > (e.necessidades.fomeCacar ?? 40) && !incapacitado(a)) {
    const r = cacarDasDunas(a, mundo, p, profPref);
    if (r) return r;
  }

  // ---- 3. Fome: filtrar/pastar o sedimento (herbívoros) sob a areia.
  if (e.papel === 'herbivoro' && a.fome > (e.necessidades.fomeComer ?? 35)) {
    const r = comerDasDunas(a, mundo, p, profPref);
    if (r) return r;
  }

  // ---- 4. Energia baixa: descansar. Escavador descansa enterrado; nadador, parado sob a areia.
  if (a.energia < 25 || (a.estado === 'descansando' && a.energia < 65)) {
    if (naSuperficie(a) && podeMergulhar(a, mundo))
      return intencao('descansando', 'descanso_enterrado', `energia ${f1(a.energia)}; enterra-se para descansar`, { ritmo: 'parado', subsolo: 'mergulhar', profundidade: profPref });
    return intencao('descansando', 'cansado', `energia ${f1(a.energia)}`, { ritmo: 'parado', profundidade: a.subsolo?.prof ?? 0 });
  }

  // ---- 5. Pista de vibração sem fome: curiosidade/vigilância, só se vale a pena ir.
  const pista = melhorPista(a, mundo);
  if (pista && dist(a, pista) < (e.percepcao.vibracao?.alcance ?? 80) * 0.6 && pista.intensidade > (e.percepcao.vibracao?.limiar ?? 0.02) * 4) {
    pista.investigado = t;
    registrarInvestigacao(a, mundo, pista);
    return irAte(a, mundo, pista, p, profPref, 'investigando', 'pista_de_vibracao', `estímulo ${[...pista.tipos].join('/')} a ${f1(dist(a, pista))} m (erro ${f1(pista.erroM)} m)`);
  }

  // ---- 6. Explorar. Nadador cruza a duna sob a areia; escavador anda na superfície.
  const exp = explorarDunas(a, mundo, p, profPref);
  // Rota subterrânea impossível até o destino (leito aflorando no caminho): sai da areia e segue por cima.
  if (submerso(a) && exp.destino && a.caminhoAreia && !a.caminhoAreia.completo && podeEmergir(a, mundo)) {
    // Esquece o destino ao sair: sem isso ele emerge, mergulha de novo rumo ao mesmo ponto inalcançável
    // e fica alternando de estado a cada poucos segundos (medido: 190 mergulhos em 900 s).
    a.mente.rumoDuna = null;
    return intencao('emergindo', 'rota_subterranea_bloqueada', `sem corredor de areia até ${f1(dist(a, exp.destino))} m; emerge e segue na superfície`, { destino: exp.destino, ritmo: 'andar', subsolo: 'emergir' });
  }
  return exp;
}

// ---------------------------------------------------------------- caça
function cacarDasDunas(a, mundo, p, profPref) {
  const e = a.especie, t = mundo.t;
  // Presa vista/farejada tem prioridade sobre a pista: posição conhecida.
  const vistos = a.contatos.filter((k) => k.via !== 'vibracao' && k.especie && (e.dieta.presas ?? []).includes(k.especie));
  const presa = vistos.reduce((m, k) => (!m || k.distancia < m.distancia ? k : m), null);
  if (presa) {
    const real = mundo.porId.get(presa.id);
    const d = presa.distancia;
    // Submerso e perto: sobe para o bote só onde a emergência é possível.
    if (submerso(a)) {
      const alcanceBote = maiorAlcance(e) + a.especie.corpo.raio * a.escala;
      if (d <= alcanceBote * 1.3) {
        const saida = pontoDeEmergencia(a, mundo, presa, 12);
        if (saida)
          return intencao('emboscando', 'emergir_para_atacar', `emerge a ${f1(d)} m de ${presa.especie} para o bote`, { alvo: alvoDe(presa), destino: saida, ritmo: 'trote', subsolo: 'emergir' });
      }
      return intencao('emboscando', 'aproximacao_subterranea', `aproxima-se de ${presa.especie} sob a areia (${f1(d)} m)`, { alvo: alvoDe(presa), destino: { x: presa.x, y: presa.y }, ritmo: d > 25 ? 'corrida' : 'trote', profundidade: profPref });
    }
    // Na superfície e ao alcance: ataca como qualquer carnívoro.
    if (real && d <= maiorAlcance(e) + 1) {
      const atq = escolherAtaque(a, real, d, a.mente.emboscadaEm && t - a.mente.emboscadaEm < 3);
      if (atq) { iniciarAtaque(a, real, atq.ataque ?? atq, mundo); return intencao('atacando', 'bote', `${(atq.ataque ?? atq).nome} em ${presa.especie}`, { alvo: alvoDe(presa), ritmo: 'parado', olharPara: { x: presa.x, y: presa.y } }); }
    }
    // Longe, com areia no caminho: mergulha e fecha a distância escondido.
    if (d > 18 && podeMergulhar(a, mundo))
      return intencao('emboscando', 'mergulho_de_caca', `mergulha para alcançar ${presa.especie} a ${f1(d)} m`, { alvo: alvoDe(presa), destino: { x: presa.x, y: presa.y }, ritmo: 'trote', subsolo: 'mergulhar', profundidade: profPref });
    return intencao('perseguindo', 'perseguicao', `persegue ${presa.especie} a ${f1(d)} m`, { alvo: alvoDe(presa), destino: { x: presa.x, y: presa.y }, ritmo: 'corrida' });
  }

  // Sem presa à vista: a pista de vibração é tudo o que existe. Investiga sem saber o que é.
  const pista = melhorPista(a, mundo);
  if (!pista) return null;
  // A pouca distância a vibração localiza bem: se há MESMO uma presa ali, no mesmo meio, há contato.
  // É assim que a emboscada fecha sob a areia — nunca através dela (separadosNaVertical corta o golpe).
  const perto = presaNoAlcance(a, mundo, pista);
  if (perto) {
    const atq = escolherAtaque(a, perto, dist(a, perto), true);
    if (atq) { iniciarAtaque(a, perto, atq.ataque ?? atq, mundo); return intencao('atacando', 'bote_por_vibracao', `${(atq.ataque ?? atq).nome} no corpo localizado pela vibração`, { alvo: alvoDe({ id: perto.id, x: perto.x, y: perto.y }), ritmo: 'parado', olharPara: { x: perto.x, y: perto.y }, profundidade: a.subsolo?.prof ?? 0 }); }
    return intencao('emboscando', 'fechando_pela_vibracao', `corpo a ${f1(dist(a, perto))} m, localizado pela vibração`, { alvo: alvoDe({ id: perto.id, x: perto.x, y: perto.y }), destino: { x: perto.x, y: perto.y }, ritmo: 'trote', profundidade: a.subsolo?.prof ?? 0 });
  }
  pista.investigado = t;
  a.mente.emboscadaEm = t;
  registrarInvestigacao(a, mundo, pista);
  const d = dist(a, pista);
  // Escavador fica à espreita quando a pista está em cima dele; nadador vai até lá.
  if (d < 6 && submerso(a)) return intencao('emboscando', 'espreita_enterrado', `estímulo a ${f1(d)} m; espera enterrado`, { ritmo: 'parado', profundidade: a.subsolo.prof, olharPara: { x: pista.x, y: pista.y } });
  // Escavador não persegue por baixo (avanço de centímetros por segundo): sai da areia e corre por cima.
  if (!nadadorDeAreia(a.especie) && submerso(a) && d > 8) {
    if (podeEmergir(a, mundo)) return intencao('investigando', 'sai_para_perseguir', `estímulo a ${f1(d)} m; emerge para alcançar`, { destino: { x: pista.x, y: pista.y }, ritmo: 'trote', subsolo: 'emergir' });
  }
  return irAte(a, mundo, pista, p, profPref, 'investigando', 'caca_por_vibracao', `caça pelo estímulo ${[...pista.tipos].join('/')} a ${f1(d)} m`);
}

const maiorAlcance = (e) => e.combate.ataques.reduce((m, x) => Math.max(m, x.alcance), 0);

// Presa real ao alcance do corpo, perto da pista e no mesmo meio. A pista só vale como localização a curta
// distância; longe, o erro é grande demais e a criatura não sabe sequer o que produziu o estímulo.
function presaNoAlcance(a, mundo, pista) {
  const e = a.especie;
  const alcance = maiorAlcance(e) + e.corpo.raio * a.escala;
  if (dist(a, pista) > alcance + 6) return null;
  let melhor = null;
  for (const id of pista.candidatos) {
    const o = mundo.porId.get(id);
    if (!o || !o.vivo || o === a) continue;
    if (!(e.dieta.presas ?? []).includes(o.especie.id)) continue;
    if (separadosNaVertical(a, o)) continue;
    const d = dist(a, o);
    if (d > alcance + 1) continue;
    if (!melhor || d < dist(a, melhor)) melhor = o;
  }
  return melhor;
}

// ---------------------------------------------------------------- alimentação
function comerDasDunas(a, mundo, p, profPref) {
  const t = mundo.terreno, n = a.especie.necessidades;
  const k = indice(t, a.x, a.y);
  // Filtrar sedimento só funciona dentro da areia: na superfície não há o que peneirar.
  if (submerso(a) && k >= 0 && t.vegetacao[k] > 0)
    return intencao('comendo', 'filtrando_sedimento', `peneira o sedimento (${f1(t.vegetacao[k])} na célula)`, { ritmo: 'parado', acao: 'comer', profundidade: a.subsolo.prof });
  const alvo = melhorSedimento(a, mundo, 70);
  if (!alvo) return null;
  if (naSuperficie(a) && podeMergulhar(a, mundo))
    return intencao('procurando_alimento', 'mergulho_para_filtrar', `mergulha para filtrar a ${f1(dist(a, alvo))} m`, { destino: alvo, ritmo: 'andar', subsolo: 'mergulhar', profundidade: profPref });
  return intencao('procurando_alimento', 'indo_filtrar', `sedimento a ${f1(dist(a, alvo))} m`, { destino: alvo, ritmo: 'trote', profundidade: profPref });
}

// Melhor célula de sedimento dentro do raio, só onde o corpo cabe sob a areia.
function melhorSedimento(a, mundo, raio) {
  const t = mundo.terreno, p = a.subsolo.perfil;
  let melhor = null;
  const passo = Math.max(t.res, raio / 12);
  for (let dy = -raio; dy <= raio; dy += passo) for (let dx = -raio; dx <= raio; dx += passo) {
    const x = a.x + dx, y = a.y + dy;
    const k = indice(t, x, y);
    if (k < 0 || t.vegetacao[k] <= 0) continue;
    if (!faixaProfundidade(t, x, y, p.alturaCorpoM)) continue;
    const d = hipot(dx, dy);
    const peso = t.vegetacao[k] / (1 + d / 20);
    if (!melhor || peso > melhor.peso) melhor = { x, y, peso };
  }
  return melhor;
}

// ---------------------------------------------------------------- exploração
function explorarDunas(a, mundo, p, profPref) {
  const t = mundo.terreno;
  if (!a.mente.rumoDuna || mundo.t - a.mente.rumoDuna.t > 25 || dist(a, a.mente.rumoDuna) < 12) {
    const casa = a.casa ?? { x: t.largura / 2, y: t.profundidade / 2, raio: Math.min(t.largura, t.profundidade) * 0.4 };
    for (let i = 0; i < 12; i++) {
      const ang = a.rngMente.entre(-PI, PI), r = a.rngMente.entre(casa.raio * 0.3, casa.raio);
      const x = Math.min(t.largura - 2, Math.max(2, casa.x + cos(ang) * r));
      const y = Math.min(t.profundidade - 2, Math.max(2, casa.y + sen(ang) * r));
      // O destino é escolhido como um animal escolhe: pelo rumo, não pela espessura de areia a 100 m
      // de distância, que ele não tem como saber. Quando o leito aflora no caminho, a rota subterrânea
      // fica incompleta e ele emerge (`rota_subterranea_bloqueada`) — é assim que nasce a emergência.
      const k = indice(t, x, y);
      const serve = k >= 0 && t.bloqueio[k] === 0;
      if (serve) { a.mente.rumoDuna = { x, y, t: mundo.t }; break; }
    }
    a.mente.rumoDuna ??= { x: casa.x, y: casa.y, t: mundo.t };
  }
  const destino = a.mente.rumoDuna;
  if (nadadorDeAreia(a.especie) && naSuperficie(a) && podeMergulhar(a, mundo))
    return intencao('explorando', 'mergulho_de_exploracao', 'mergulha e segue pela duna', { destino, ritmo: 'andar', subsolo: 'mergulhar', profundidade: profPref });
  return intencao('explorando', 'exploracao', `percorre a duna até ${f1(dist(a, destino))} m`, { destino, ritmo: 'andar', profundidade: submerso(a) ? profPref : 0 });
}

// Ir até um ponto no meio que a anatomia permite, mergulhando quando compensa.
function irAte(a, mundo, alvo, p, profPref, estado, codigo, motivo) {
  const destino = { x: alvo.x, y: alvo.y };
  if (nadadorDeAreia(a.especie)) {
    if (naSuperficie(a) && podeMergulhar(a, mundo))
      return intencao(estado, codigo + '_mergulhando', motivo, { destino, ritmo: 'trote', subsolo: 'mergulhar', profundidade: profPref });
    return intencao(estado, codigo, motivo, { destino, ritmo: 'trote', profundidade: profPref });
  }
  // Escavador: anda na superfície até perto e só então se enterra (o avanço subterrâneo dele é quase nulo).
  if (submerso(a) && dist(a, alvo) > 8) {
    if (podeEmergir(a, mundo)) return intencao(estado, codigo + '_emergindo', motivo + '; sai da areia para andar', { destino, ritmo: 'andar', subsolo: 'emergir' });
    return intencao(estado, codigo, motivo, { destino, ritmo: 'andar', profundidade: a.subsolo.prof });
  }
  if (naSuperficie(a) && dist(a, alvo) < 10 && podeMergulhar(a, mundo))
    return intencao(estado, codigo + '_enterrando', motivo + '; enterra-se à espreita', { destino: null, ritmo: 'parado', subsolo: 'mergulhar', profundidade: profPref });
  return intencao(estado, codigo, motivo, { destino, ritmo: 'trote' });
}

const alvoDe = (k) => ({ tipo: 'criatura', id: k.id, x: k.x, y: k.y });

// Um evento por investigação (no máximo um a cada 5 s por animal): é a métrica de "investigou a pista".
function registrarInvestigacao(a, mundo, pista) {
  if (mundo.t - (a.mente.ultimaInvestigacao ?? -99) <= 5) return;
  a.mente.ultimaInvestigacao = mundo.t;
  mundo.evento('investigacao_vibracao', a.id, { x: +pista.x.toFixed(1), y: +pista.y.toFixed(1), erroM: pista.erroM, intensidade: +pista.intensidade.toFixed(4), tipos: [...pista.tipos].join('/'), especieConhecida: pista.especie });
}

function intencao(estado, codigo, motivo, extra = {}) {
  return { estado, codigo, motivo, alvo: null, destino: null, ritmo: 'parado', acao: null, olharPara: null, subsolo: null, profundidade: null, ...extra };
}
