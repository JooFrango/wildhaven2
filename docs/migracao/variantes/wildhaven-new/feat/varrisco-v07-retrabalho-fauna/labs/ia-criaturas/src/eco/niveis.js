// Três níveis de detalhe. Regra de consistência: cada animal tem `tempo` (até quando suas necessidades foram
// integradas). Qualquer nível integra só o intervalo (tempo → agora); eventos únicos passam pelo ledger.
import { Rng, derivarSemente } from './rng.js';
import { cos, sen } from '../core/matematica.js';
import { indice, perfilMobilidade, segmentoPassavel, buscarCaminho } from './terreno.js';
import { mover } from './locomocao.js';
import { avaliarRival } from './combate.js';
import { ferir, fatorMobilidade, feridoVisivel } from './saude.js';
import { massaMedia } from './especies.js';

export function integrarNecessidades(mundo, a, ate) {
  const dt = ate - a.tempo;
  if (dt <= 0) return;
  const n = a.especie.necessidades, dia = mundo.relogio.segundosPorDia;
  a.fome = Math.min(100, a.fome + (n.fomePorDia * dt) / dia * (a.gestacao ? 1.3 : 1));
  a.sede = Math.min(100, a.sede + (n.sedePorDia * dt) / dia * (mundo.relogio.estacao === 'seca' ? 1.25 : 1));
  a.tempo = ate;
}

// Nível por distância ao foco de observação (câmera/região de interesse). Sem foco: tudo em nível 1.
export function atribuirNiveis(mundo) {
  const obs = mundo.opcoes.observacao;
  const combatentes=new Set();
  if(mundo.opcoes.tatica){
    for(const c of mundo.conflitos)if(!c.resultado){combatentes.add(c.a);combatentes.add(c.b);}
    for(const [id,p]of mundo.perseguicoesAtivas){combatentes.add(id);combatentes.add(p.presa);}
    for(const a of mundo.vivos)if(a.tatica?.enabled&&(a.golpe||a.tatica.action?.end>mundo.t||mundo.t-(a.tatica.lastSeen??-99)<8)){combatentes.add(a.id);if(a.tatica.target)combatentes.add(a.tatica.target);}
  }
  for (const a of mundo.vivos) {
    if(combatentes.has(a.id)){if(a.nivel!==1){integrarNecessidades(mundo,a,mundo.t);a.nivel=1;}continue;}
    // Agente preso ao nível 1 (Hunter acompanhado): trocar de câmera nunca pode rebaixá-lo e encerrar a luta.
    if (a.nivelFixo) continue;
    let n = 1;
    if (obs) {
      const d = Math.sqrt((a.x - obs.x) * (a.x - obs.x) + (a.y - obs.y) * (a.y - obs.y));
      n = d <= obs.raioN1 ? 1 : d <= obs.raioN2 ? 2 : 3;
    } else if (mundo.opcoes.nivelPadrao) n = mundo.opcoes.nivelPadrao;
    if (n !== a.nivel) {
      integrarNecessidades(mundo, a, mundo.t);
      if (a.nivel === 1 && n !== 1) sairDoNivel1(mundo, a);
      mundo.evento('nivel', a.id, { de: a.nivel, para: n });
      mundo.metricas.trocasNivel = (mundo.metricas.trocasNivel ?? 0) + 1;
      a.nivel = n;
      a.caminho = null;
    }
  }
}

function sairDoNivel1(mundo, a) {
  a.golpe = null; a.foco = null;
  if (a.conflito) {
    const c = mundo.conflitos.find((x) => x.id === a.conflito.id);
    if (c && !c.resultado) { c.resultado = { perdedor: null, vencedor: null, motivo: 'fora_de_foco', faseFinal: c.fase, duracao: +(mundo.t - c.inicio).toFixed(1), golpes: c.golpes, t: mundo.t }; mundo.evento('conflito_fim', a.id, { conflito: c.id, ...c.resultado, motivoDisputa: c.motivo }); }
    const r = mundo.porId.get(a.conflito.rival); if (r) { r.conflito = null; r.foco = null; }
    a.conflito = null;
  }
  if (mundo.perseguicoesAtivas.has(a.id)) mundo.fimPerseguicao(a, 'fora_de_foco');
}

const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

// ---------------- Nível 2: 1 Hz, necessidades, deslocamento, encontros resolvidos com sorteio chaveado ----------------
export function passoNivel2(mundo, dt) {
  const lista = mundo.vivos.filter((a) => a.nivel === 2);
  if (!lista.length) return;
  const t0 = agora();
  for (const a of lista) {
    if (!a.vivo) continue;
    integrarNecessidades(mundo, a, mundo.t);
    if (mundo.tick % 20 === 0) esquecerAguaSeca(mundo, a);
    const e = a.especie, n = e.necessidades;
    let destino = null, ritmo = 'andar', acao = null;
    const agua = a.memoria.recursos.agua.reduce((m, p) => (!m || d2(p, a) < d2(m, a) ? p : m), null);
    if (a.sede > n.sedeProcurar && agua) { if (d2(a, agua) < 2.5) acao = 'beber'; else destino = agua; }
    else if (a.sede > n.sedeProcurar) destino = alvoExploracao(mundo, a);
    else if (e.papel === 'herbivoro' && a.fome > (n.fomeProcurar ?? 45)) {
      const k = indice(mundo.terreno, a.x, a.y);
      // Mantém o pasto escolhido até chegar (antes, a amostragem relativa à posição mudava a cada passo e o animal
      // oscilava entre manchas sem nunca comer). Pasto esgotado em volta: amplia a busca (15 → 40 → 90 m).
      const alvoPasto = a.mente.pastoN2;
      const kAlvo = alvoPasto ? indice(mundo.terreno, alvoPasto.x, alvoPasto.y) : -1;
      if (k >= 0 && mundo.terreno.vegetacao[k] > 4) { acao = 'comer'; a.mente.pastoN2 = null; }
      else if (kAlvo >= 0 && mundo.terreno.vegetacao[kAlvo] > 4 && d2(a, alvoPasto) > 0.25) destino = alvoPasto;
      else {
        a.mente.pastoN2 = pastoProximo(mundo, a, 15) ?? pastoProximo(mundo, a, 40) ?? pastoProximo(mundo, a, 90);
        destino = a.mente.pastoN2 ?? a.casa;
      }
    } else if (e.papel === 'carnivoro' && a.fome > n.fomeCacar) {
      encontroN2(mundo, a);
      destino = a.casa;
    } else if (a.casa && d2(a, a.casa) > a.casa.raio * a.casa.raio * 0.5) destino = a.casa;
    if (!a.vivo) continue;
    a.intencao = { estado: acao === 'comer' ? 'pastando' : acao === 'beber' ? 'bebendo' : destino ? 'deslocando' : 'descansando', codigo: 'n2', motivo: 'simulação simplificada (nível 2)', alvo: null, destino, ritmo, acao, olharPara: null };
    a.estado = a.intencao.estado;
    mover(a, a.intencao, mundo, dt);
    if (acao === 'comer') { const k = indice(mundo.terreno, a.x, a.y); const q = Math.min(n.comerPorSeg * dt, mundo.terreno.vegetacao[k]); mundo.terreno.vegetacao[k] -= q; a.fome = Math.max(0, a.fome - q * 1.2); mundo.metricas.vegetacaoConsumida += q; }
    if (acao === 'beber') a.sede = Math.max(0, a.sede - n.beberPorSeg * dt);
    for (const f of a.saude.ferimentos) if (f.sangramento > 0) { a.saude.hp -= f.sangramento * dt; f.sangramento = Math.max(0, f.sangramento - 0.05 * dt); }
    if (a.saude.hp <= 0) mundo.matar(a, 'sangramento', null);
  }
  for (const a of lista) if (a.vivo && a.especie.papel === 'carnivoro') disputaN2(mundo, a);
  mundo.custo.n2 += agora() - t0; mundo.custo.passosN2 += lista.length;
}

function pastoProximo(mundo, a, raio) {
  const t = mundo.terreno;
  const passo = Math.max(5, Math.round(raio / 8));
  let m = null, v = 8;
  for (let dy = -raio; dy <= raio; dy += passo) for (let dx = -raio; dx <= raio; dx += passo) {
    const k = indice(t, a.x + dx, a.y + dy);
    if (k < 0 || t.bloqueio[k] || t.agua[k] > t.alturas[k]) continue;
    // Prefere pasto rico sem se afastar demais da área de vida.
    const cx = a.x + dx - (a.casa?.x ?? 0), cy = a.y + dy - (a.casa?.y ?? 0);
    const casa = a.casa ? Math.sqrt(cx * cx + cy * cy) / Math.max(30, a.casa.raio * 2) : 0;
    const s = t.vegetacao[k] * (1 - Math.min(0.6, casa * 0.3));
    if (s > v) { v = s; m = { x: (Math.floor((a.x + dx) / t.res) + 0.5) * t.res, y: (Math.floor((a.y + dy) / t.res) + 0.5) * t.res }; }
  }
  return m;
}

function biomassaAoRedor(t, a, r) {
  let s = 0;
  for (let dy = -r; dy <= r; dy += t.res) for (let dx = -r; dx <= r; dx += t.res) { const k = indice(t, a.x + dx, a.y + dy); if (k >= 0) s += t.vegetacao[k]; }
  return s;
}

// Ao chegar perto de um bebedouro que secou, o animal o esquece; e descobre os que entram no seu alcance de visão
// (vale para todos os níveis — o conhecimento continua vindo só do que o animal alcança).
export function esquecerAguaSeca(mundo, a) {
  const existe = new Set(mundo.pontosAgua.map((p) => p.id));
  a.memoria.recursos.agua = a.memoria.recursos.agua.filter((p) => existe.has(p.id) || d2(p, a) > 40 * 40);
  const vis = a.especie.percepcao.visao.alcance;
  const conhecidos = new Set(a.memoria.recursos.agua.map((p) => p.id));
  for (const p of mundo.pontosAgua) if (!conhecidos.has(p.id) && d2(p, a) < vis * vis) a.memoria.recursos.agua.push({ ...p });
}

// Sede alta sem água conhecida: explora (direção estável por animal e dia), sem teleporte.
export function alvoExploracao(mundo, a) {
  const rng = new Rng(derivarSemente(mundo.semente, `busca-agua:${a.id}:${mundo.relogio.diaInteiro}`));
  const ang = rng.entre(-Math.PI, Math.PI);
  const t = mundo.terreno;
  return { x: Math.min(t.largura - 5, Math.max(5, a.x + cos(ang) * 150)), y: Math.min(t.profundidade - 5, Math.max(5, a.y + sen(ang) * 150)) };
}
function explorarAgua(mundo, a, alcance) { andarAte(mundo, a, alvoExploracao(mundo, a), alcance); }

function encontroN2(mundo, pred) {
  const presas = mundo.vivos.filter((p) => p.nivel !== 3 && pred.especie.dieta.presas.includes(p.especie.id) && d2(p, pred) < 35 * 35);
  if (!presas.length || pred.energia < 30) return;
  const janela = Math.floor(mundo.t / 10);
  for (const presa of presas) {
    const chave = `enc:${pred.id}:${presa.id}:${janela}`;
    if (mundo.ledger.has(chave)) continue;
    mundo.ledger.add(chave);
    const rng = new Rng(derivarSemente(mundo.semente, chave));
    const vigil = presa.temperamento.vigilancia * (presa.grupoId ? 1.4 : 1) * (1 - (presa.especie.furtividade?.camuflagem ?? 0) * 0.3);
    const furt = (pred.especie.furtividade?.camuflagem ?? 0) + (1 - (pred.especie.furtividade?.ruidoPassos ?? 1)) * 0.5;
    const pSurpresa = Math.max(0.05, Math.min(0.8, 0.35 + furt - vigil * 0.4));
    const vuln = (feridoVisivel(presa) ? 1.8 : 1) * (presa.juvenil ? 1.5 : 1) * (2 - fatorMobilidade(presa));
    const pSucesso = Math.min(0.85, pSurpresa * 0.6 * vuln * (pred.energia / 100));
    const r = rng.proximo();
    pred.energia = Math.max(0, pred.energia - 15);
    let resultado;
    if (r < pSucesso) {
      resultado = 'abate';
      ferir(presa, { dano: presa.saude.hp + 1, regiao: 'pescoco', origem: pred.id, tipo: 'n2', t: mundo.t, idEvento: `fer:${chave}` });
      mundo.matar(presa, 'predacao', pred.id);
    } else if (r < pSucesso + 0.2) {
      resultado = 'ferida_escapou';
      ferir(presa, { dano: presa.saude.hpMax * rng.entre(0.15, 0.4), regiao: rng.chance(0.6) ? 'pernas' : 'flanco', origem: pred.id, tipo: 'n2', t: mundo.t, idEvento: `fer:${chave}` });
    } else resultado = 'escapou';
    mundo.evento('encontro_n2', pred.id, { presa: presa.id, resultado, pSucesso: +pSucesso.toFixed(3) });
    mundo.metricas.encontrosN2 = (mundo.metricas.encontrosN2 ?? 0) + 1;
    return;
  }
}

function disputaN2(mundo, a) {
  for (const b of mundo.vivos) {
    if (b === a || b.nivel === 3 || b.especie.papel !== 'carnivoro' || !(a.especie.competidores ?? []).includes(b.especie.id)) continue;
    if (d2(a, b) > 25 * 25 || a.numero > b.numero && b.nivel === 2) continue;
    const carc = mundo.carcacas.find((c) => (c.dono === a.id || c.dono === b.id) && c.carne > 0 && d2(c, a) < 30 * 30);
    if (!carc) continue;
    const chave = `disp:${[a.id, b.id].sort().join(':')}:${carc.id}`;
    if (mundo.ledger.has(chave)) continue;
    mundo.ledger.add(chave);
    const rng = new Rng(derivarSemente(mundo.semente, chave));
    // Avaliação com sinais observáveis (porte com erro, ferimento aparente).
    const ver = (o) => ({ id: o.id, massaEstimada: o.massa * rng.entre(0.85, 1.15), ferido: feridoVisivel(o), comportamento: 'movendo' });
    const avA = avaliarRival(a, ver(b), b.especie, { valor: 0.5 }), avB = avaliarRival(b, ver(a), a.especie, { valor: 0.5 });
    const luta = avA.disposicao > 0.3 && avB.disposicao > 0.3;
    const pA = avA.vantagem / (avA.vantagem + (1 - avA.vantagem));
    const vencedor = rng.proximo() < pA ? a : b, perdedor = vencedor === a ? b : a;
    if (luta && rng.chance(0.6)) ferir(perdedor, { dano: perdedor.saude.hpMax * rng.entre(0.1, 0.35), regiao: rng.escolher(['tronco', 'pernas', 'flanco', 'pescoco']), origem: vencedor.id, tipo: 'disputa_n2', t: mundo.t, idEvento: `fer:${chave}` });
    carc.dono = vencedor.id;
    mundo.evento('disputa_n2', vencedor.id, { perdedor: perdedor.id, carcaca: carc.id, combate: luta });
    mundo.metricas.disputasN2 = (mundo.metricas.disputasN2 ?? 0) + 1;
    if (perdedor.saude.hp <= 0) mundo.matar(perdedor, 'combate', vencedor.id);
  }
}

// ---------------- Nível 3: por hora ecológica, agregado (populações, recursos, predação, contágio) ----------------
export function passoNivel3(mundo) {
  const lista = mundo.vivos.filter((a) => a.nivel === 3);
  if (!lista.length) return;
  const t0 = agora();
  const horaSeg = mundo.relogio.segundosPorDia / 24;
  const hora = Math.floor(mundo.t / horaSeg);
  const t = mundo.terreno;
  for (const a of lista) {
    if (!a.vivo) continue;
    integrarNecessidades(mundo, a, mundo.t);
    const e = a.especie, n = e.necessidades;
    // Água: vai até o ponto conhecido mais próximo (deslocamento limitado pela velocidade) e bebe.
    const agua = a.memoria.recursos.agua.reduce((m, p) => (!m || d2(p, a) < d2(m, a) ? p : m), null);
    // Nível 3 integra deslocamento em tempo ECOLÓGICO: ~90 s de caminhada ativa por hora (independente de quanto o
    // relógio do laboratório comprime o dia). Sempre por caminho transitável (andarAte), nunca por teleporte.
    const alcanceHora = e.movimento.andar * fatorMobilidade(a) * SEG_ATIVOS_HORA;
    esquecerAguaSeca(mundo, a);
    if (a.sede > n.sedeProcurar && agua) {
      andarAte(mundo, a, agua, alcanceHora);
      if (d2(a, agua) < 9 && mundo.pontosAgua.some((p) => p.id === agua.id)) a.sede = 0;
    } else if (a.sede > n.sedeProcurar) {
      explorarAgua(mundo, a, alcanceHora);
      esquecerAguaSeca(mundo, a);
    } else if (e.papel === 'herbivoro' && a.fome > 12) {
      // Pasto local esgotado: anda até o melhor pasto ao alcance desta hora (perto da área de vida).
      const local = biomassaAoRedor(t, a, 4);
      // Busca até 120 m (o vaivém água ↔ pasto é diário); anda só o que cabe nesta hora.
      if (local < 30) { a.mente.pastoN3 ??= null; if (!a.mente.pastoN3 || biomassaAoRedor(t, a.mente.pastoN3, 4) < 30) a.mente.pastoN3 = pastoProximo(mundo, a, 120); if (a.mente.pastoN3) andarAte(mundo, a, a.mente.pastoN3, alcanceHora); }
    } else if (a.casa && d2(a, a.casa) > a.casa.raio * a.casa.raio) andarAte(mundo, a, a.casa, alcanceHora);
    if (e.papel === 'herbivoro' && a.fome > 15) {
      let comido = 0; const meta = Math.min(a.fome, (n.fomePorDia / 24) * 2);
      for (let dy = -4; dy <= 4 && comido < meta; dy += 2) for (let dx = -4; dx <= 4 && comido < meta; dx += 2) {
        const k = indice(t, a.x + dx, a.y + dy);
        if (k < 0 || t.bloqueio[k]) continue;
        const q = Math.min(t.vegetacao[k], (meta - comido) / 1.2);
        t.vegetacao[k] -= q; comido += q * 1.2;
      }
      a.fome = Math.max(0, a.fome - comido); mundo.metricas.vegetacaoConsumida += comido / 1.2;
    }
    a.energia = Math.min(n.energiaMax, a.energia + 8);
    for (const f of a.saude.ferimentos) f.sangramento = 0;
  }
  // Pressão de predação agregada: vítimas específicas e determinísticas.
  for (const pred of lista) {
    if (!pred.vivo || pred.especie.papel !== 'carnivoro') continue;
    // Carcaça própria: come antes de caçar de novo (até ~3% da massa por hora).
    const propria = mundo.carcacas.find((cc) => cc.dono === pred.id && cc.carne > 0);
    if (propria && pred.fome > -50) {
      const kg = Math.min(propria.carne, pred.massa * 0.03);
      propria.carne -= kg; propria.consumo[pred.id] = (propria.consumo[pred.id] ?? 0) + kg;
      pred.fome = Math.max(-60, pred.fome - (kg * 100) / (pred.massa * 0.08));
      continue;
    }
    if (pred.fome < pred.especie.necessidades.fomeCacar) continue;
    // Pequenos vertebrados (dieta da ficha: "ground_vertebrates"): recurso agregado que se regenera, não indivíduos.
    const mf = mundo.microfauna;
    if (pred.especie.dieta.microfauna && mf && mf.kg > 1) {
      const chaveMf = `mf:${pred.id}:${hora}`;
      if (!mundo.ledger.has(chaveMf)) {
        mundo.ledger.add(chaveMf);
        const densidade = mf.kg / mf.max;
        if (new Rng(derivarSemente(mundo.semente, chaveMf)).chance(0.25 * densidade)) {
          const kg = Math.min(mf.kg, 0.4 + 0.6 * densidade);
          mf.kg -= kg; mf.consumidoKg += kg;
          pred.fome = Math.max(0, pred.fome - (kg * 100) / (pred.massa * 0.08));
          mundo.metricas.microfauna = (mundo.metricas.microfauna ?? 0) + 1;
          if (pred.fome < pred.especie.necessidades.fomeCacar) continue;
        }
      }
    }
    const chave = `n3:${pred.id}:${hora}`;
    if (mundo.ledger.has(chave)) continue;
    mundo.ledger.add(chave);
    const rng = new Rng(derivarSemente(mundo.semente, chave));
    // Só presas ao alcance do que o predador percorre em uma hora (trote, com fadiga): sem teleporte.
    const alcance = pred.especie.movimento.trote * fatorMobilidade(pred) * SEG_ATIVOS_HORA * 0.6;
    const presas = lista.filter((p) => p.vivo && pred.especie.dieta.presas.includes(p.especie.id) && d2(p, pred) < alcance * alcance);
    if (!presas.length) {
      // Carniça conhecida?
      const c = mundo.carcacas.find((cc) => cc.carne > 0 && pred.especie.dieta.carnica && d2(cc, pred) < 150 * 150);
      if (c) { const kg = Math.min(c.carne, pred.massa * 0.06); c.carne -= kg; pred.fome = Math.max(-60, pred.fome - (kg * 100) / (pred.massa * 0.08)); }
      continue;
    }
    const vuln = (p) => (feridoVisivel(p) ? 2 : 1) * (p.juvenil ? 1.6 : 1) * (p.grupoId ? 0.7 : 1) * (p.idadeAnos > p.especie.vida.expectativaAnos * 0.8 ? 1.5 : 1);
    // Sucesso por hora de caça (a maioria das tentativas falha); provisório, ver CHECKPOINT-V2.md.
    const pCaca = 0.03 * (pred.fome / 100) * (pred.saude.hp / pred.saude.hpMax);
    if (!rng.chance(pCaca)) continue;
    const vitima = [...presas].sort((x, y) => vuln(y) - vuln(x) || x.numero - y.numero)[0];
    andarAte(mundo, pred, vitima, alcance);
    if (d2(pred, vitima) > 9) continue; // relevo impediu a aproximação nesta hora
    ferir(vitima, { dano: vitima.saude.hp + 1, regiao: 'pescoco', origem: pred.id, tipo: 'n3', t: mundo.t, idEvento: `fer:${chave}` });
    mundo.matar(vitima, 'predacao', pred.id);
    const c = mundo.carcacas[mundo.carcacas.length - 1];
    const kg = Math.min(c.carne, pred.massa * 0.03);
    c.carne -= kg; c.consumo[pred.id] = (c.consumo[pred.id] ?? 0) + kg; pred.fome = Math.max(-60, pred.fome - (kg * 100) / (pred.massa * 0.08));
    mundo.evento('predacao_n3', pred.id, { vitima: vitima.id });
  }
  // Contágio agregado.
  for (const a of lista) for (const d of a.saude.doencas) {
    const cfg = mundo.doencas[d.id];
    if (!cfg || d.dias < cfg.incubacaoDias * 0.5) continue;
    for (const b of lista) {
      if (b === a || !cfg.especies.includes(b.especie.id) || b.saude.doencas.some((x) => x.id === d.id) || d2(a, b) > 36) continue;
      const chave = `cont:${a.id}:${b.id}:${hora}`;
      if (mundo.ledger.has(chave)) continue;
      mundo.ledger.add(chave);
      if (new Rng(derivarSemente(mundo.semente, chave)).chance(cfg.transmissaoPorSegContato * horaSeg * 0.3 * b.especie.saude.suscetibilidadeDoenca)) {
        b.saude.doencas.push({ id: d.id, dias: 0, intensidade: 0.1, origem: a.id }); mundo.metricas.contagios++; mundo.evento('doenca_contagio', b.id, { de: a.id, doenca: d.id, nivel: 3 });
      }
    }
  }
  mundo.custo.n3 += agora() - t0; mundo.custo.passosN3 += lista.length;
}

// Deslocamento agregado: anda em linha reta enquanto for transitável; se bloquear, usa A* (sem teleporte).
function andarAte(mundo, a, destino, maxDist) {
  const t = mundo.terreno, perfil = perfilMobilidade(t, a.especie.movimento);
  const dx = destino.x - a.x, dy = destino.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.5) return;
  const passo = Math.min(d, maxDist);
  const alvo = { x: a.x + (dx / d) * passo, y: a.y + (dy / d) * passo };
  if (segmentoPassavel(t, perfil.passavel, a, alvo)) { a.x = alvo.x; a.y = alvo.y; return; }
  const r = buscarCaminho(t, perfil, a, destino, { maxExpansoes: 6000 });
  if (!r) return;
  let resta = passo;
  for (const p of r.pontos.slice(1)) {
    const s = Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
    if (s >= resta) { a.x += ((p.x - a.x) / s) * resta; a.y += ((p.y - a.y) / s) * resta; break; }
    a.x = p.x; a.y = p.y; resta -= s;
  }
}

const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);
export const SEG_ATIVOS_HORA = 90;
export { massaMedia };
