// Combate e disputas. Ataques têm preparo, alcance, esquiva e região atingida; o dano depende do estado real.
// Disputas entre carnívoros escalam em fases e cada lado decide só com o que percebe ou lembra do rival.
import { atan2, cos, hipot, pot, sen } from '../core/matematica.js';
import { normalizarAngulo } from '../core/geometria.js';
import { massaMedia } from './especies.js';
import { fatorMobilidade, feridoVisivel, ferir, incapacitado } from './saude.js';
import { pontosMaisProximos } from './locomocao.js';
import { registrarRivalidade } from './relacoes.js';
import { separadosNaVertical } from './subsolo.js';
import { linhaDeVisao, perfilMobilidade, indice, segmentoLivre } from './terreno.js';
import { inocular } from './veneno.js';
import { planejarTatica } from './tatica.js';
import { habilitada, decidirTaticaAvancada, comboPodeAtacar, ataquePermitido, registrarResultadoGolpe, registrarComboExecutado, registrarEsquivaEfetiva, registrarFerimentoAvancado, registrarQuedaAvancada, iniciarAgarraoAvancado, confrontoAgarraoAvancado, chanceEscapeAvancado, finalizarAgarraoAvancado, notaAtaqueAprendida } from './combate-avancado.js';

export const FASES = ['observacao', 'intimidacao', 'confronto', 'combate'];
const DURACAO_FASE = { observacao: 2.0, intimidacao: 5.0, confronto: 4.0, combate: 14.0 };

export function adaptarIntencaoTatica(a,i,mundo){
  if(a.hunter||a.subsolo||a.voo||a.serpente||!i)return i;
  // Escape, ecology and physiological priorities remain owned by the species brain.
  if(!['perseguindo','atacando','combatendo','confrontando','intimidando','observando_rival','verificando_intruso'].includes(i.estado))return i;
  const id=i.alvo?.id??a.conflito?.rival,visible=a.contatos.find(c=>c.id===id&&c.via==='visao'),memory=a.memoria.criaturas.get(id),c=visible??(memory?.via==='visao'&&mundo.t-memory.t<.8?memory:null);
  if(!c||c.distancia>12)return i;
  const surprise=c.signal!=='fuga'&&Math.abs(normalizarAngulo((c.direcao??0)-atan2(a.y-c.y,a.x-c.x)))>2;
  const chaseLunge=c.signal==='fuga'&&c.distancia>3&&a.energia>35;
  const attacks=a.especie.combate.ataques.filter(x=>!x.exigeSurpresa||surprise||chaseLunge),usable=attacks.map(x=>{const p=perfilGolpe(a,x);return{x,p,workReach:p.alcance+(x.nome==='bote'&&c.distancia>3?a.especie.movimento.corrida*.55*p.preparo:0)};});
  const longest=usable.sort((u,v)=>v.workReach-u.workReach)[0];if(!longest)return i;
  const s=a.tatica??={};s.enabled=true;
  const profile={reach:longest.workReach,windup:longest.p.preparo,energy:3,lunge:longest.workReach>longest.p.alcance};
  const context=a.conflito||i.estado==='verificando_intruso'?'territory':'hunt';
  const plan=planejarTatica(a,c,mundo,profile,{context});
  const dispute=a.conflito&&mundo.conflitos.find(x=>x.id===a.conflito.id);
  const mayEscalate=context!=='territory'||dispute?.fase==='combate'||c.signal==='preparo';
  const advanced=habilitada(a)&&visible?decidirTaticaAvancada(a,c,mundo,plan.intent?.estado? a.tatica.bands : null,context,plan):null;
  if(advanced)return advanced;
  const combo=mayEscalate&&visible&&habilitada(a)?comboPodeAtacar(a,c,mundo,a.tatica.bands):null;
  if((plan.attack||combo)&&visible&&mayEscalate){const rival=mundo.porId.get(c.id);a.tAtual=mundo.t;const x=rival&&escolherAtaque(a,rival,c.distancia,surprise||chaseLunge,combo);if(x){iniciarAtaque(a,rival,x,mundo);if(dispute)dispute.golpes++;plan.intent.estado='preparando_ataque';plan.intent.destino=null;plan.intent.ritmo='parado';}}
  return plan.intent;
}

// ---------- Anatomia (V3) ----------
// Corpo no plano = cápsula ao longo do rumo (comprimento e raio da ficha; centro deslocado conforme o GLB).
export function capsula(a, x = a.x, y = a.y, dir = a.direcao) {
  const r = a.especie.corpo.raio * a.escala;
  // Corpo longo: a posição do animal é a CABEÇA (o resto do corpo vive no rastro, em serpente.js). A cápsula
  // de contato é a cabeça e o pescoço —  —, não os 14 m, que ficariam metade à frente dela.
  const comp = (a.especie.serpente?.capsulaM ?? a.especie.corpo.comprimentoM) * a.escala;
  const esc = (a.especie.escalaModelo ?? 1) * a.escala;
  const c = a.especie.anatomia ? a.especie.anatomia.centro * esc : 0;
  const meio = Math.max(0, comp / 2 - r);
  const ux = cos(dir), uy = sen(dir);
  const cx = x + ux * c, cy = y + uy * c;
  return { cx, cy, ux, uy, meio, r };
}
// Cápsula de `a` para colisão com `outro`: se o outro é baixo (< 55% da altura de a), a cabeça e o pescoço de `a`
// passam por cima dele — o último 30% do comprimento não bloqueia (ex.: Cromátil sob a cabeça do Varrisco).
export function capsulaContra(a, outro, x = a.x, y = a.y, dir = a.direcao) {
  const k = capsula(a, x, y, dir);
  if (outro.especie.corpo.alturaM * outro.escala >= a.especie.corpo.alturaM * a.escala * 0.55) return k;
  // Remove só a ponta da frente: o eixo encolhe `corte` e o centro recua corte/2.
  const corte = Math.min(2 * k.meio, 0.3 * a.especie.corpo.comprimentoM * a.escala);
  return { ...k, meio: k.meio - corte / 2, cx: k.cx - (k.ux * corte) / 2, cy: k.cy - (k.uy * corte) / 2 };
}
// Distância de um ponto à superfície da cápsula; `s` ∈ [−1, 1] = posição ao longo do corpo (−1 traseira, 1 frente);
// `lado` = afastamento lateral relativo ao raio.
export function pontoNaCapsula(px, py, k) {
  const dx = px - k.cx, dy = py - k.cy;
  const proj = dx * k.ux + dy * k.uy;
  const pc = Math.max(-k.meio, Math.min(k.meio, proj));
  const qx = k.cx + k.ux * pc, qy = k.cy + k.uy * pc;
  const d = Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy)) - k.r;
  const ext = k.meio + k.r;
  return { d, s: Math.max(-1, Math.min(1, proj / Math.max(1e-6, ext))), lado: Math.abs(dx * -k.uy + dy * k.ux) / Math.max(1e-6, k.r) };
}
// Alcance do membro (m, com sinal: negativo = atrás) e instante de impacto, medidos no GLB; senão, da ficha.
export function perfilGolpe(a, atq) {
  const an = a.especie.anatomia?.ataques?.[atq.nome];
  const esc = (a.especie.escalaModelo ?? 1) * a.escala;
  if (an && !an.semClipe) return { alcance: an.alcance * esc, preparo: an.tImpacto, clipeDuracao: an.duracao, altura: an.alturaImpacto * esc, anatomico: true };
  return { alcance: atq.alcance + a.especie.corpo.raio * a.escala * 0.5, preparo: atq.preparoSeg, clipeDuracao: null, altura: a.especie.corpo.alturaM * a.escala * 0.6, anatomico: false };
}
const pontoGolpe = (a, pg, x = a.x, y = a.y, dir = a.direcao) => ({ x: x + cos(dir) * pg.alcance, y: y + sen(dir) * pg.alcance });
// O que encosta não é um ponto: é o trecho final do membro (mandíbula ~35 cm, garra/casco/cauda ~20 cm).
// Devolve a menor distância desse trecho à superfície da cápsula do alvo (e a posição ao longo do corpo).
export function contatoGolpe(a, pg, cap, nome, x = a.x, y = a.y, dir = a.direcao) {
  const prof = /mordida|bote/.test(nome) ? 0.35 : 0.2;
  const s = pg.alcance >= 0 ? 1 : -1;
  let melhor = null;
  for (const f of [0, 0.5, 1]) {
    const r = pg.alcance - s * prof * f;
    const g = pontoNaCapsula(x + cos(dir) * r, y + sen(dir) * r, cap);
    if (!melhor || g.d < melhor.d) melhor = g;
  }
  return melhor;
}
const TOLERANCIA_GOLPE = 0.15; // m além da superfície do corpo (pelagem, imprecisão da cápsula)
// Empurrão relativo por tipo de golpe (quanto da quantidade de movimento do atacante passa à vítima).
const EMPURRA = { bote: 1.0, investida: 1.0, coice: 0.9, cabecada: 0.8, golpe: 0.6, chicotada_cauda: 0.4, garra_foice: 0.35, mordida: 0.25, mordida_defensiva: 0.2 };
// Penetração da proteção natural por tipo de golpe (0 = a proteção vale inteira).
const PENETRA = { garra_foice: 0.5, golpe: 0.45, mordida: 0.35, bote: 0.3, coice: 0.1, chicotada_cauda: 0.1, mordida_defensiva: 0.2 };

// ---------- Ataques ----------
// Só inicia um golpe se, no instante de impacto previsto (movimento visível do alvo + o próprio), o membro que
// golpeia alcança o corpo do alvo. Golpes para trás (coice, cauda) exigem o alvo atrás.
export function escolherAtaque(a, alvo, d, surpresa, preferir = null) {
  if(a.tatica?.deferAttack)return null;
  if(habilitada(a)&&a.taticaAvancada?.acao?.ate>(a.tAtual??0))return null;
  if(a.tatica?.enabled&&a.tatica.action?.end>(a.tAtual??0))return null;
  if (a.saude.caidoAte > (a.tAtual ?? 0) || a.agarrando) return null;
  // Sem golpe através de areia sólida: corpos separados na vertical não se alcançam.
  if (separadosNaVertical(a, alvo)) return null;
  // Zigue-zague observado: taxa de giro do alvo vista nas últimas leituras (rumo é visível), com decaimento.
  const obs = (a.mente.rumoObs ??= {});
  const o = obs[alvo.id], tNow = a.tAtual ?? 0;
  let omega = 0;
  if (o && tNow > o.t) omega = Math.max(Math.abs(normalizarAngulo(alvo.direcao - o.dir)) / (tNow - o.t), o.omega * Math.max(0, 1 - (tNow - o.t)));
  if (!o || tNow > o.t) obs[alvo.id] = { dir: alvo.direcao, t: tNow, omega: o ? omega : 0 };
  else omega = o.omega;
  const giro = (a.especie.movimento.giroGrausSeg * Math.PI) / 180;
  const opcoes = [];
  for (const x of a.especie.combate.ataques) {
    if (!ataquePermitido(a,x)) continue;
    if (x.exigeSurpresa && !surpresa) continue;
    if ((a.recargas[x.nome] ?? 0) > 0) continue;
    const pg = perfilGolpe(a, x);
    const tp = pg.preparo;
    // Membro mais curto que a frente do próprio corpo (ex.: braços do Varrisco sob o peito): ao encostar, o corpo
    // empurra o alvo antes que o membro chegue. Só serve contra alvo que não será empurrado: preso na própria
    // mordida, caído, ou parado e pesado.
    // Corpo longo: quem avança no bote é a cabeça, não o tronco — o corpo fica onde está. A regra do membro
    // curto existe para quadrúpedes cujo peito empurra o alvo antes do membro chegar, e não se aplica aqui.
    if (pg.alcance >= 0 && !a.especie.serpente) {
      const kA = capsulaContra(a, alvo);
      const frenteA = (kA.cx - a.x) * cos(a.direcao) + (kA.cy - a.y) * sen(a.direcao) + kA.meio + kA.r * 0.9;
      const seen=a.tatica?.enabled?a.contatos.find(c=>c.id===alvo.id&&c.via==='visao'):null;
      const mass=a.tatica?.enabled?(seen?.massaEstimada??massaMedia(alvo.especie)):alvo.massa;
      const imovel = alvo.agarradoPor === a.id || alvo.saude.caidoAte > (a.tAtual ?? 0) || (alvo.velocidade < 0.5 && mass > a.massa * 0.5);
      if (pg.alcance < frenteA && !imovel) continue;
    }
    // Ao golpear, o atacante iguala a velocidade do alvo (+1,5 m/s): não passa direto por ele durante o preparo.
    const vAtq = Math.min(a.velocidade, alvo.velocidade + 1.5);
    // Corpo longo: no bote quem vai à frente é a cabeça, e esse alcance já é o do ataque. O tronco de 14 m
    // não é lançado, então somar o avanço do corpo faria o golpe passar metros além do alvo.
    const avanco = a.especie.serpente ? 0 : (x.nome === 'bote' ? a.especie.movimento.corrida * 0.55 * tp : vAtq * tp);
    // Alvo em movimento ACELERA durante o preparo (uma presa em fuga ganha velocidade). Projetar com
    // velocidade constante deixava o golpe curto: folga real média de 1,17 m contra −0,17 m prevista,
    // em 35 erros medidos no bebedouro, todos com o alvo fugindo. Agora a projeção usa a velocidade média
    // do intervalo, limitada pela corrida da espécie.
    const vFimAlvo = alvo.velocidade > 0.5
      ? Math.min(alvo.especie.movimento.corrida, alvo.velocidade + alvo.especie.movimento.aceleracao * tp)
      : alvo.velocidade;
    const desloc = ((alvo.velocidade + vFimAlvo) / 2) * tp;
    const tx = alvo.x + cos(alvo.direcao) * desloc, ty = alvo.y + sen(alvo.direcao) * desloc;
    const linha = atan2(ty - a.y, tx - a.x);
    // Rumo no impacto: o atacante continua virando para o alvo durante o preparo (até o giro permitido).
    const quer = pg.alcance >= 0 ? linha : normalizarAngulo(linha + Math.PI);
    const dif = normalizarAngulo(quer - a.direcao);
    const dirImp = a.direcao + Math.max(-giro * tp * 0.7, Math.min(giro * tp * 0.7, dif));
    // O corpo do alvo bloqueia o avanço: o atacante só chega até encostar (cápsulas), não atravessa a presa.
    const kt = capsulaContra(alvo, a, tx, ty);
    const encosta = (av) => { const ka = capsulaContra(a, alvo, a.x + cos(dirImp) * av, a.y + sen(dirImp) * av, dirImp); const pp = pontosMaisProximos(ka, kt); return Math.sqrt((pp.bx - pp.ax) * (pp.bx - pp.ax) + (pp.by - pp.ay) * (pp.by - pp.ay)) < (ka.r + kt.r) * 0.9; };
    let av = pg.alcance >= 0 ? avanco : 0;
    if (av > 0 && encosta(av)) { let lo = 0, hi = av; for (let it = 0; it < 7; it++) { const mid = (lo + hi) / 2; if (encosta(mid)) hi = mid; else lo = mid; } av = lo; }
    const ax = a.x + cos(dirImp) * av, ay = a.y + sen(dirImp) * av;
    const r = contatoGolpe(a, pg, capsula(alvo, tx, ty), x.nome, ax, ay, dirImp);
    // Quanto o alvo ainda pode desviar durante o preparo (velocidade × tempo × agilidade): golpe lento em presa
    // rápida e ágil não compensa — o predador espera a presa cansar, virar ou ficar ao alcance de um golpe curto.
    // Excesso de velocidade do atacante que ainda precisa ser freado também tira precisão.
    // Desvio lateral possível do alvo no preparo: depende de quanto ele consegue girar nesse tempo (Cromátil e
    // Velsari mudam de rumo muito rápido). Erros seguidos deixam o atacante mais cauteloso (aprende com a luta).
    // O alvo só reage depois de perceber o golpe (~0,25 s); até lá segue o rumo atual.
    const tReacao = Math.max(0, tp - 0.25);
    const giroAlvo = Math.min(Math.PI / 2, ((alvo.especie.movimento.giroGrausSeg * Math.PI) / 180) * tReacao);
    const mobilidadeVista=a.tatica?.enabled?(a.contatos.find(c=>c.id===alvo.id)?.ferido?.65:1):fatorMobilidade(alvo);
    const lateral = alvo.velocidade * tReacao * sen(giroAlvo) * (alvo.especie.combate.esquiva ?? 0.3) * mobilidadeVista
      + 0.5 * Math.min(omega, 6) * alvo.velocidade * tp * tp
      // frear ao longo do rumo (acelerar já entrou na projeção acima; só a frenagem resta como incerteza)
      + Math.min(
        0.25 * alvo.especie.movimento.aceleracao * tp * tp * (alvo.velocidade < alvo.especie.movimento.corrida * 0.9 ? 1 : 0.3),
        alvo.velocidade * tp
      );
    const cautela = Math.min(0.6, (a.mente.errosSeguidos ?? 0) * 0.15);
    // Sem fôlego ou desesperado de fome: arrisca golpes que normalmente não tentaria (última chance da perseguição).
    const desespero = a.folego < 3 || a.fome > (a.especie.necessidades.fomeDesesperada ?? 80) ? 0.5 : 1;
    const incerteza = a.tatica?.enabled
      ? Math.min(.18, .035 + lateral*.2 + Math.max(0,a.velocidade-vAtq)*.04*tp)
      : (lateral + Math.max(0, a.velocidade - vAtq) * 0.25 * tp * 0.5) * desespero + cautela;
    // Diagnóstico: guarda a folga prevista do escolhido para comparar com a real no impacto.
    if (r.d + incerteza <= TOLERANCIA_GOLPE + 0.1) opcoes.push(x), (a.mente.previsaoGolpe ??= {})[x.nome] = { d: r.d, incerteza, av, vAtq };
  }
  if (!opcoes.length) return null;
  // Prefere o de maior dano esperado por segundo entre os disponíveis.
  return (preferir && opcoes.find(x => x.nome === preferir)) || opcoes.sort((x, y) => notaAtaqueAprendida(a,alvo,y,perfilGolpe(a,y).preparo)-notaAtaqueAprendida(a,alvo,x,perfilGolpe(a,x).preparo))[0];
}

export function iniciarAtaque(a, alvo, ataque, mundo, { contra = false } = {}) {
  const pg = perfilGolpe(a, ataque);
  const preparo = pg.preparo * (contra ? 0.75 : 1);
  a.golpe = { nome: ataque.nome, alvo: alvo.id, inicio: mundo.t, impacto: mundo.t + preparo, ataque, surpresa: !alvo.memoria.criaturas.has(a.id), clipeImpacto: pg.preparo, contra, previsao: a.mente.previsaoGolpe?.[ataque.nome] ?? null, deOnde: { x: a.x, y: a.y, v: a.velocidade } };
  if(mundo.opcoes.tatica){
    const s=a.tatica??={};s.enabled=true;s.lastAttack=mundo.t;
    const recovery=Math.max(.25,Math.min(ataque.recargaSeg*.65,(pg.clipeDuracao??preparo+.65)-preparo+.12));
    s.action={name:ataque.nome,start:mundo.t,impact:mundo.t+preparo,end:mundo.t+preparo+recovery,reach:pg.alcance,heading:a.direcao};
    const observed=a.contatos.find(c=>c.id===alvo.id&&c.via==='visao');
    a.golpe.surpresa=!!observed&&observed.signal!=='fuga'&&Math.abs(normalizarAngulo((observed.direcao??0)-atan2(a.y-observed.y,a.x-observed.x)))>2;
  }
  // Exausto: recupera mais devagar entre golpes.
  const cansaco = a.energia < 20 ? 1 + (20 - a.energia) / 20 : 1;
  a.recargas[ataque.nome] = ataque.recargaSeg * cansaco + preparo;
  a.energia = Math.max(0, a.energia - 1.5 * (a.especie.combate.forca + 0.3));
  // Bote: salto real — o corpo é lançado à frente durante o preparo (o clipe pounce é no lugar).
  if ((ataque.nome === 'bote' || ataque.nome === 'investida') && !a.especie.serpente) {
    const v = a.especie.movimento.corrida * 0.55;
    a.impulso = { vx: cos(a.direcao) * v, vy: sen(a.direcao) * v, ate: a.golpe.impacto, tipo: 'investida' };
  }
  else if(mundo.opcoes.tatica&&!a.hunter&&!a.especie.serpente&&/mordida|garra/.test(ataque.nome)){
    // A short committed anatomical step carries the torso into the bite; no homing or range bonus.
    const step=Math.min(.65,a.especie.corpo.comprimentoM*.22),v=step/Math.max(.15,preparo);
    a.impulso={vx:cos(a.direcao)*v,vy:sen(a.direcao)*v,ate:a.golpe.impacto,tipo:'passo_ataque'};
  }
  registrarComboExecutado(a,alvo,ataque.nome,mundo);
  mundo.evento('ataque_inicio', a.id, { alvo: alvo.id, ataque: ataque.nome, preparo: +preparo.toFixed(2), contra });
}

// Resolve o golpe no instante de impacto com as posições reais desse instante.
export function resolverGolpe(a, mundo) {
  const g = a.golpe;
  if (!g || mundo.t < g.impacto) return;
  a.golpe = null;
  if(a.tatica?.enabled)a.tatica.lastHit=false;
  if(mundo.opcoes.tatica&&(a.saude.caidoAte>mundo.t||a.saude.atordoadoAte>mundo.t)){
    mundo.evento('golpe_interrompido',a.id,{alvo:g.alvo,ataque:g.nome,motivo:'estado_fisico'});return;
  }
  const alvo = mundo.porId.get(g.alvo);
  if (!alvo || !alvo.vivo) return;
  // O volume de areia entre os corpos impede o contato — sem habilidade declarada, não há dano.
  if (separadosNaVertical(a, alvo)) { mundo.evento('golpe_errou', a.id, { alvo: alvo.id, ataque: g.nome, motivo: a.voo?.alt || alvo.voo?.alt ? 'fora_de_alcance_vertical' : 'areia_entre_os_corpos' }); return; }
  const pg = perfilGolpe(a, g.ataque);
  const cap = capsula(alvo);
  const geo = contatoGolpe(a, pg, cap, g.nome);
  const d = Math.sqrt((alvo.x - a.x) * (alvo.x - a.x) + (alvo.y - a.y) * (alvo.y - a.y));
  // O membro precisa alcançar o corpo da vítima: nada de "acerto" visual com a pata no ar.
  if (geo.d > TOLERANCIA_GOLPE) {
    a.mente.errosSeguidos = (a.mente.errosSeguidos ?? 0) + 1;
    mundo.evento('golpe_errou', a.id, { alvo: alvo.id, ataque: g.nome, distancia: +d.toFixed(2), folga: +geo.d.toFixed(2), vAlvo: +alvo.velocidade.toFixed(1), vA: +a.velocidade.toFixed(1), alvoEstado: alvo.estado, angulo: +((normalizarAngulo(atan2(alvo.y - a.y, alvo.x - a.x) - a.direcao)) * 57.3).toFixed(0), motivo: 'membro_nao_alcanca', previstoD: g.previsao ? +g.previsao.d.toFixed(2) : null, previstoAvanco: g.previsao ? +g.previsao.av.toFixed(2) : null, avancoReal: g.deOnde ? +hipot(a.x - g.deOnde.x, a.y - g.deOnde.y).toFixed(2) : null });
    registrarResultadoGolpe(a,alvo,g,mundo);registrarEsquivaEfetiva(alvo,a,mundo);
    return;
  }
  // Obstáculo sólido entre os corpos: numa luta a dois metros, uma rocha no caminho impede o golpe. É opção
  // do cenário porque ligá-la por padrão mudaria resultados do ecossistema já medidos.
  if(mundo.linhaGolpePrecisa&&!mundo.linhaGolpePrecisa(a,alvo,pg.altura)){mundo.evento('golpe_errou',a.id,{alvo:alvo.id,ataque:g.nome,motivo:'geometria_solida'});registrarResultadoGolpe(a,alvo,g,mundo);return;}
  if (mundo.opcoes.bloqueioGolpePorTerreno && !linhaDeVisao(mundo.terreno, a, alvo, pg.altura, pg.altura).livre) {
    mundo.evento('golpe_errou', a.id, { alvo: alvo.id, ataque: g.nome, distancia: +d.toFixed(2), motivo: 'obstaculo_solido' });
    registrarResultadoGolpe(a,alvo,g,mundo);
    return;
  }
  a.mente.errosSeguidos = 0;
  // Esquiva: agilidade da espécie, perceber o atacante, mobilidade, cansaço, atordoamento, queda, desequilíbrio.
  const s = alvo.saude, t = mundo.t;
  const percebe = alvo.memoria.criaturas.has(a.id) && t - alvo.memoria.criaturas.get(a.id).t < 1.5;
  const estavel = s.caidoAte > t || alvo.agarradoPor ? 0 : s.desequilibradoAte > t ? 0.3 : 1;
  const esquiva = alvo.especie.combate.esquiva * (percebe ? 1 : 0.25) * fatorMobilidade(alvo) * (alvo.energia > 15 ? 1 : 0.5) * (s.atordoadoAte > t ? 0.2 : 1) * estavel;
  if (a.rngCombate.chance(esquiva)) {
    // Passo lateral real (para o lado oposto ao golpe) e, se estiver lutando e tiver um golpe que alcance, contra-ataca.
    const lado = normalizarAngulo(atan2(alvo.y - a.y, alvo.x - a.x) - alvo.direcao) >= 0 ? 1 : -1;
    const ang = atan2(alvo.y - a.y, alvo.x - a.x) + lado * Math.PI / 2;
    const v = 0.7 / 0.3;
    alvo.impulso = { vx: cos(ang) * v, vy: sen(ang) * v, ate: t + 0.3, tipo: 'esquiva' };
    mundo.evento('esquiva', alvo.id, { atacante: a.id, ataque: g.nome });
    registrarResultadoGolpe(a,alvo,g,mundo,{esquivou:true});
    alvo.mente.esquivouEm = t;
    if (!alvo.golpe && (alvo.conflito?.rival === a.id || (alvo.especie.papel === 'herbivoro' && d < 2.5))) {
      alvo.tAtual = t;
      const c = escolherAtaque(alvo, a, d, false);
      if (c) { iniciarAtaque(alvo, a, c, mundo, { contra: true }); mundo.evento('contra_ataque', alvo.id, { alvo: a.id, ataque: c.nome }); }
    }
    return;
  }
  // Região pela geometria do contato (frente/meio/traseira, lateral, altura do golpe), limitada às regiões
  // que esse ataque alcança (ficha).
  const altAlvo = alvo.especie.corpo.alturaM * alvo.escala;
  let regiaoGeo;
  // Bípede: o corpo é uma coluna, então a região vem da ALTURA do golpe e não da posição ao longo do corpo —
  // num humano a cabeça fica acima do quadril, não meio metro à frente dele. Só fichas que declaram
  // `anatomiaHumana` passam por aqui; para as criaturas nada muda.
  if (alvo.especie.anatomiaHumana) {
    const h = pg.altura / Math.max(0.1, altAlvo);
    regiaoGeo = h > 0.86 ? 'cabeca' : h > 0.78 ? 'pescoco' : h > 0.5 ? (geo.lado > 0.6 ? 'bracos' : 'torax') : h > 0.38 ? 'abdomen' : 'pernas';
  } else if (geo.s > 0.55) regiaoGeo = pg.altura > altAlvo * 0.8 ? 'cabeca' : 'pescoco';
  else if (geo.s < -0.6) regiaoGeo = pg.altura < altAlvo * 0.5 ? 'pernas' : 'cauda';
  else regiaoGeo = pg.altura < altAlvo * 0.35 ? 'pernas' : geo.lado > 0.6 ? 'flanco' : 'tronco';
  // Vizinhas humanas no fim de cada lista: `find` só chega nelas se o ataque não alcançar nenhuma vizinha
  // animal, o que nunca acontece com uma criatura (nenhuma ficha de criatura cita torax/abdomen/bracos).
  const VIZ = { cabeca: ['pescoco'], pescoco: ['cabeca', 'tronco', 'torax'], tronco: ['flanco', 'pescoco'], flanco: ['tronco', 'pernas'], pernas: ['flanco', 'cauda', 'abdomen'], cauda: ['pernas', 'flanco'], torax: ['abdomen', 'pescoco', 'bracos'], abdomen: ['torax', 'pernas'], bracos: ['torax', 'abdomen'] };
  const regs = g.ataque.regioes;
  const regiao = regs.includes(regiaoGeo) ? regiaoGeo : (VIZ[regiaoGeo].find((r) => regs.includes(r)) ?? regs[Math.floor(a.rngCombate.proximo() * regs.length) % regs.length]);
  const porte = Math.sqrt(a.massa / massaMedia(a.especie));
  const cb = a.especie.combate;
  const mordida = /mordida|bote/.test(g.nome) ? (cb.forcaMordida ?? 1) : 1;
  const resistencia = alvo.especie.saude.resistencia * (1 + alvo.especie.combate.defesa * (alvo.estado === 'combatendo' ? 0.6 : 0.2));
  const dano = (g.ataque.dano * porte * a.atributos.forca * fatorForca(a) * mordida * a.rngCombate.entre(0.8, 1.2) * (g.surpresa ? 1.35 : 1) * (a.energia < 15 ? 0.7 : 1)) / resistencia;
  const idEvento = `fer:${mundo.contadorEventos + 1}`;
  const fer = ferir(alvo, { dano, regiao, origem: a.id, tipo: g.nome, t, idEvento, penetracao: PENETRA[g.nome] ?? 0.3 });
  if(a.tatica?.enabled)a.tatica.lastHit=true;
  alvo.mente.atingidoPor = { id: a.id, t };
  inocular(a, alvo, g.nome, fer, mundo);
  // Presa com memória de perigo (ficha) guarda ONDE foi atacada e passa a evitar a área.
  if (alvo.especie.memoriaDePerigo) { const ps = (alvo.memoria.perigos ??= []); ps.push({ x: alvo.x, y: alvo.y, t }); if (ps.length > 8) ps.shift(); }
  mundo.evento('ferimento', alvo.id, { atacante: a.id, ataque: g.nome, regiao, dano: +fer.efetivo.toFixed(1), gravidade: fer.gravidade, fratura: fer.fratura, atordoado: s.atordoadoAte > t, hp: +s.hp.toFixed(1), contato: +geo.s.toFixed(2) });
  registrarResultadoGolpe(a,alvo,g,mundo,{acertou:true});
  registrarFerimentoAvancado(alvo,fer,mundo);
  if (s.hp <= 0) { mundo.matar(alvo, a.especie.dieta.presas.includes(alvo.especie.id) ? 'predacao' : 'combate', a.id); return; }
  aplicarImpacto(a, alvo, g, mundo);
  tentarAgarrar(a, alvo, g, regiao, mundo);
}

// Quantidade de movimento transferida × estabilidade da vítima → empurrão, desequilíbrio ou queda.
function aplicarImpacto(a, alvo, g, mundo) {
  const t = mundo.t;
  const ux = alvo.x - a.x, uy = alvo.y - a.y, n = Math.sqrt(ux * ux + uy * uy) || 1;
  const fechamento = Math.max(0, a.velocidade * cos(a.direcao - atan2(uy, ux)) - alvo.velocidade * cos(alvo.direcao - atan2(uy, ux)));
  const J = a.massa * (fechamento + 2) * (EMPURRA[g.nome] ?? 0.3) * fatorForca(a);
  const S = alvo.massa * estabilidade(alvo, t) * 1.2;
  const razao = J / Math.max(1, S);
  if (razao < 3) return;
  const desloc = Math.min(1.2, 0.08 * razao);
  alvo.impulso = { vx: (ux / n) * desloc / 0.3, vy: (uy / n) * desloc / 0.3, ate: t + 0.3, tipo: 'empurrao' };
  const s = alvo.saude;
  if (razao > 25) {
    s.caidoAte = t + (1.2 + 1.3 * (1 - (alvo.especie.combate.equilibrio ?? 0.5))) * (s.atordoadoAte > t ? 1.4 : 1);
    mundo.evento('queda', alvo.id, { por: a.id, ataque: g.nome, razao: +razao.toFixed(1) });
    registrarQuedaAvancada(alvo,mundo);
  } else if (razao > 10) {
    s.desequilibradoAte = t + 0.5 + 0.4 * (1 - (alvo.especie.combate.equilibrio ?? 0.5));
    mundo.evento('desequilibrio', alvo.id, { por: a.id, ataque: g.nome, razao: +razao.toFixed(1) });
  } else mundo.evento('empurrao', alvo.id, { por: a.id, ataque: g.nome, deslocamento: +desloc.toFixed(2) });
}

// Mordida que pega pescoço/tronco/flanco pode imobilizar quem é bem mais fraco (capacidade da ficha).
function tentarAgarrar(a, alvo, g, regiao, mundo) {
  const cb = a.especie.combate;
  if (!cb.agarrar || !/mordida|bote/.test(g.nome) || !['pescoco', 'tronco', 'flanco'].includes(regiao) || a.agarrando || alvo.agarradoPor) return;
  const forcaA = a.massa * (cb.forcaMordida ?? 1) * a.especie.combate.forca * fatorForca(a);
  const forcaV = alvo.massa * alvo.especie.combate.forca * fatorForca(alvo) * (0.5 + alvo.energia / 200);
  if (forcaA < forcaV * (habilitada(a)?1.0:6)) return;
  a.agarrando = alvo.id; alvo.agarradoPor = a.id;
  mundo.evento('agarrao', a.id, { alvo: alvo.id, regiao });
  iniciarAgarraoAvancado(a,alvo,mundo);
}

// A cada passo: a vítima agarrada fica presa à boca do predador, sangra mais e luta para se soltar.
export function atualizarAgarroes(mundo, dt) {
  for (const a of mundo.vivos) {
    if (!a.agarrando) continue;
    const v = mundo.porId.get(a.agarrando);
    const soltar = (motivo) => { if (v) v.agarradoPor = null; a.agarrando = null; mundo.evento('soltou', a.id, { alvo: v?.id ?? null, motivo }); finalizarAgarraoAvancado(a,mundo,motivo); };
    if (!v || !v.vivo) { a.agarrando = null; finalizarAgarraoAvancado(a,mundo,'presa_ausente'); continue; }
    // Na camada avançada, uma disputa CONTRA A PRÓPRIA presa é um
    // agarrão tático legítimo. Só outra ameaça externa força soltura.
    const rivalExterno=!!a.conflito&&(!habilitada(a)||a.conflito.rival!==v.id);
    if (a.saude.caidoAte > mundo.t || a.saude.atordoadoAte > mundo.t || a.energia < 8 || rivalExterno) { soltar(rivalExterno ? 'rival_externo' : 'cansaco_ou_golpe'); continue; }
    const forceBreak=confrontoAgarraoAvancado(a,v,mundo,dt);
    if(forceBreak){soltar(forceBreak);continue;}
    const pg = perfilGolpe(a, a.especie.combate.ataques.find((x) => /mordida/.test(x.nome)) ?? a.especie.combate.ataques[0]);
    const alvoX = a.x + cos(a.direcao) * pg.alcance, alvoY = a.y + sen(a.direcao) * pg.alcance;
    // D1: só reposiciona se a célula de destino for transitável para a vítima (água/rocha/inclinação);
    // contra parede/obstáculo a presa fica onde está, presa na boca, sem atravessar.
    const kAlvo = indice(mundo.terreno, alvoX, alvoY);
    const passavel = kAlvo >= 0 && perfilMobilidade(mundo.terreno, v.especie.movimento).passavel[kAlvo];
    // Na IA avançada, nem mesmo uma célula final livre permite atravessar uma rocha intermediária.
    const trajetoSeguro=!habilitada(a)||segmentoLivre(mundo.terreno,perfilMobilidade(mundo.terreno,v.especie.movimento),v,{x:alvoX,y:alvoY},v.especie.corpo.raio*v.escala,.08);
    if (passavel && trajetoSeguro) { v.x = alvoX; v.y = alvoY; }
    v.velocidade = 0;
    v.saude.hp -= a.especie.combate.ataques[0].dano * 0.04 * dt;
    a.energia = Math.max(0, a.energia - 0.5 * dt);
    v.energia = Math.max(0, v.energia - 2.5 * dt);
    // Tentativa de soltar-se a cada segundo (sorteio do próprio animal).
    v.mente.lutaAgarrao = (v.mente.lutaAgarrao ?? 0) + dt;
    if (v.mente.lutaAgarrao >= 1) {
      v.mente.lutaAgarrao = 0;
      const p = 0.08 + 0.6 * ((v.massa * v.especie.combate.forca) / (a.massa * a.especie.combate.forca * (a.especie.combate.forcaMordida ?? 1))) * (v.energia / 100);
      if (v.rngCombate.chance(chanceEscapeAvancado(a,v,p))) {
        soltar('vitima_escapou');
        const ang = a.direcao;
        v.impulso = { vx: cos(ang) * 3, vy: sen(ang) * 3, ate: mundo.t + 0.3, tipo: 'escape' };
        mundo.evento('escapou_agarrao', v.id, { de: a.id });
      }
    }
    if (v.saude.hp <= 0) { mundo.matar(v, 'predacao', a.id); if(a.agarrando)soltar('presa_morreu'); }
  }
}

// Força útil: lesões musculares, dor e exaustão.
export function fatorForca(a) {
  let f = 1;
  for (const fer of a.saude.ferimentos) if (fer.muscular) f *= 1 - fer.muscular * 0.6;
  f *= 1 - a.saude.dor * 0.35 * (1 - (a.especie.combate.resistenciaDor ?? 0.4));
  if (a.energia < 20) f *= 0.6 + a.energia / 50;
  f *= a.saude.veneno?.forca ?? 1;
  return Math.max(0.2, f);
}

// Estabilidade (0..1): equilíbrio da espécie, pernas/cauda feridas, cansaço, desequilíbrio atual.
export function estabilidade(a, t) {
  let e = a.especie.combate.equilibrio ?? 0.5;
  e *= fatorMobilidade(a);
  for (const f of a.saude.ferimentos) if (f.regiao === 'cauda') e *= 1 - f.gravidade;
  if (a.energia < 20) e *= 0.7;
  if (a.saude.desequilibradoAte > t) e *= 0.4;
  return Math.max(0.05, e);
}

// ---------- Avaliação de rival (só percepção/memória) ----------
const forcaEspecie = (e) => e.combate.forca;
// Porte pesa mais que linearmente em disputas de exibição (massa^1.2): um animal 50% mais pesado é bem mais temível.
export function poderProprio(a) {
  return pot(a.massa, 1.2) * forcaEspecie(a.especie) * a.atributos.forca * (a.saude.hp / a.saude.hpMax) * (0.5 + 0.5 * Math.sqrt(a.energia / 100)) * (1 - a.saude.dor * 0.4);
}
export function poderPercebido(contato, especieRival) {
  const massa = contato.massaEstimada ?? massaMedia(especieRival);
  let p = pot(massa, 1.2) * forcaEspecie(especieRival);
  if (contato.ferido) p *= 0.65;
  if (contato.comportamento === 'lutando') p *= 0.85;
  return p;
}

// Retorna {disposicao, vantagem, risco}: disposição > 0 favorece enfrentar; < 0 favorece ceder.
export function avaliarRival(a, contato, especieRival, contexto) {
  const pa = poderProprio(a), pr = poderPercebido(contato, especieRival);
  const vantagem = pa / (pa + pr);
  const tmp = a.temperamento;
  const exp = a.memoria.experiencias.get(contato.id);
  const historico = exp ? 0.12 * (exp.vitorias - exp.derrotas) : 0;
  const fome = a.fome / 100;
  const ferido = 1 - a.saude.hp / a.saude.hpMax + (fatorMobilidade(a) < 0.8 ? 0.3 : 0);
  const cansado = a.energia < 30 ? 0.35 : 0;
  const risco = (1 - vantagem) * Math.min(1.5, (especieRival.combate.ataques[0].dano * Math.sqrt((contato.massaEstimada ?? massaMedia(especieRival)) / massaMedia(especieRival))) / Math.max(1, a.saude.hp) * 3);
  const disposicao =
    (vantagem - 0.5) * 3.0 + tmp.agressividade * 0.35 + tmp.coragem * 0.25 - tmp.medo * 0.5
    + (contexto.valor ?? 0) * 0.4 + (contexto.territorioProprio ? 0.2 : 0) + (fome > 0.9 ? 0.25 : 0)
    + historico - ferido * 0.8 - cansado - risco * 0.6;
  return { disposicao, vantagem, risco };
}

// ---------- Ciclo de vida de uma disputa ----------
// conflito = { id, a, b, motivo, recurso, fase, desde, inicio, golpes, resultado }
export function abrirConflito(mundo, a, b, motivo, recurso) {
  const c = { id: `cf${++mundo.contadorConflitos}`, a: a.id, b: b.id, motivo, recurso: recurso ?? null, fase: 'observacao', desde: mundo.t, inicio: mundo.t, golpes: 0, fasesVistas: ['observacao'] };
  mundo.conflitos.push(c);
  for (const [x, y] of [[a, b], [b, a]]) x.conflito = { id: c.id, rival: y.id };
  a.foco = b.id; b.foco = a.id;
  mundo.evento('conflito_inicio', a.id, { rival: b.id, motivo, conflito: c.id, recurso: recurso?.id ?? null });
  return c;
}

// Cada participante decide sua postura neste passo. Retorna a intenção de movimento/ação.
export function decidirNoConflito(a, mundo) {
  const c = mundo.conflitos.find((x) => x.id === a.conflito.id);
  const rival = mundo.porId.get(a.conflito.rival);
  if (!c || !rival || !rival.vivo || c.resultado) return encerrarParticipacao(a, mundo, c, rival ? 'rival_ausente' : 'rival_morto');
  const contato = a.contatos.find((k) => k.id === rival.id && k.via === 'visao') ?? a.memoria.criaturas.get(rival.id);
  if (!contato || mundo.t - (contato.t ?? mundo.t) > 4) return encerrar(mundo, c, a, 'perdeu_contato');
  const contexto = { valor: valorRecurso(a, c, mundo), territorioProprio: dentroTerritorio(a, mundo.opcoes.tatica?contato:rival) };
  const av = avaliarRival(a, contato, rival.especie, contexto);
  a.mente.ultimaAvaliacao = { t: mundo.t, ...av };
  const d = Math.sqrt((rival.x - a.x) * (rival.x - a.x) + (rival.y - a.y) * (rival.y - a.y));
  // Recuo: sem disposição, ferido gravemente ou exausto.
  // Dor acima do que a espécie tolera também faz abandonar (HP não é o único critério).
  const dorDemais = a.saude.dor > 0.45 + 0.4 * (a.especie.combate.resistenciaDor ?? 0.4);
  if (av.disposicao < -0.15 || incapacitado(a) || a.energia < 6 || a.saude.hp < a.saude.hpMax * 0.3 || dorDemais) {
    return encerrar(mundo, c, a, av.disposicao < -0.15 ? 'cedeu' : dorDemais ? 'dor' : 'ferido_ou_exausto');
  }
  // Avanço de fase: só quando ambos continuam e o tempo da fase passou; disposição alta acelera.
  const tempoFase = mundo.t - c.desde;
  const idx = FASES.indexOf(c.fase);
  // Escalar custa: luta física só com disposição alta e após exibição prolongada sem ninguém ceder.
  const quer = av.disposicao > 0.8 ? 3 : av.disposicao > 0.45 ? 2 : av.disposicao > 0.08 ? 1 : 0;
  if (idx < 3 && tempoFase > DURACAO_FASE[c.fase] && quer > idx) avancarFase(mundo, c, a);
  // Intimidação recebida desgasta a determinação; quem se percebe em desvantagem tende a ceder.
  if ((c.fase === 'intimidacao' || c.fase === 'confronto') && ['exibindo', 'confrontando'].includes(contato.comportamento)) {
    a.mente.desgaste = (a.mente.desgaste ?? 0) + mundo.dt * (1 - av.vantagem) * (0.5 + a.temperamento.medo);
    if (a.mente.desgaste > 1.5 + Math.max(0, av.disposicao) * 2.5) { a.mente.desgaste = 0; return encerrar(mundo, c, a, 'intimidado'); }
  }
  if (c.fase === 'intimidacao') a.energia = Math.max(0, a.energia - 0.4 * mundo.dt);
  if (idx === 3 && tempoFase > DURACAO_FASE.combate) return encerrar(mundo, c, a, 'abandono_mutuo');
  const alvoPos = mundo.opcoes.tatica?{x:contato.x,y:contato.y}:{ x: rival.x, y: rival.y };
  switch (c.fase) {
    case 'observacao':
      return { estado: 'observando_rival', codigo: 'observacao', motivo: `avaliando ${rival.id} (vantagem estimada ${av.vantagem.toFixed(2)})`, alvo: { tipo: 'criatura', id: rival.id, ...alvoPos }, destino: null, ritmo: 'parado', olharPara: alvoPos };
    case 'intimidacao':
      if (!a.mente.exibiuEm || mundo.t - a.mente.exibiuEm > 2.5) { a.mente.exibiuEm = mundo.t; mundo.som(a, 'rugido', 60 + a.massa * 0.3, { sobre: rival.id }); }
      return { estado: 'intimidando', codigo: 'exibicao', motivo: `exibição contra ${rival.id}`, alvo: { tipo: 'criatura', id: rival.id, ...alvoPos }, destino: d > 6 ? alvoPos : null, ritmo: 'andar', olharPara: alvoPos, acao: 'exibicao' };
    case 'confronto': {
      // Circula o rival a ~4 m, com avanços e recuos curtos.
      const ang = atan2(a.y - rival.y, a.x - rival.x) + 0.35 * (a.numero % 2 ? 1 : -1);
      const raio = 4 + (a.rngMente.chance(0.1) ? -2 : 0);
      const p = { x: rival.x + cos(ang) * raio, y: rival.y + sen(ang) * raio };
      return { estado: 'confrontando', codigo: 'circular', motivo: `circulando ${rival.id}`, alvo: { tipo: 'criatura', id: rival.id, ...alvoPos }, destino: p, ritmo: 'trote', olharPara: alvoPos };
    }
    default: {
      const atq = !a.golpe && escolherAtaque(a, rival, d, false);
      if (atq) { iniciarAtaque(a, rival, atq, mundo); c.golpes++; }
      return { estado: 'combatendo', codigo: 'luta', motivo: `lutando com ${rival.id} (vida ${Math.round((100 * a.saude.hp) / a.saude.hpMax)}%)`, alvo: { tipo: 'criatura', id: rival.id, ...alvoPos }, destino: d > 1.2 ? alvoPos : null, ritmo: 'corrida', olharPara: alvoPos };
    }
  }
}

function avancarFase(mundo, c, a) {
  c.fase = FASES[FASES.indexOf(c.fase) + 1];
  c.desde = mundo.t;
  c.fasesVistas.push(c.fase);
  mundo.evento('conflito_fase', a.id, { conflito: c.id, fase: c.fase });
}

export function encerrar(mundo, c, quemSai, motivo) {
  if (!c || c.resultado) return encerrarParticipacao(quemSai, mundo, c, motivo);
  const outro = mundo.porId.get(c.a === quemSai.id ? c.b : c.a);
  const vencedor = outro?.vivo ? outro : null;
  c.resultado = { perdedor: quemSai.id, vencedor: vencedor?.id ?? null, motivo, faseFinal: c.fase, duracao: +(mundo.t - c.inicio).toFixed(1), golpes: c.golpes, t: mundo.t };
  mundo.evento('conflito_fim', quemSai.id, { conflito: c.id, ...c.resultado, motivoDisputa: c.motivo });
  // Consequências: vencedor fica com o recurso; experiência registrada nos dois lados.
  if (vencedor) {
    regExp(vencedor, quemSai.id, true); regExp(quemSai, vencedor.id, false);
    registrarRivalidade(vencedor, quemSai, true); registrarRivalidade(quemSai, vencedor, false);
    if (c.recurso?.tipo === 'carcaca') { const cc = mundo.carcacas.find((x) => x.id === c.recurso.id); if (cc) { cc.dono = vencedor.id; cc.donoDesde = mundo.t; } }
    if (c.motivo === 'territorio' && quemSai.territorio && vencedor.territorio) {
      // Perdedor desloca o centro do território para longe do vencedor.
      const dx = quemSai.territorio.x - vencedor.x, dy = quemSai.territorio.y - vencedor.y;
      const n = Math.sqrt(dx * dx + dy * dy) || 1;
      quemSai.territorio.x += (dx / n) * quemSai.territorio.raio * 0.4; quemSai.territorio.y += (dy / n) * quemSai.territorio.raio * 0.4;
      mundo.evento('territorio_perdido', quemSai.id, { para: vencedor.id });
    }
  }
  for (const id of [c.a, c.b]) {
    const p = mundo.porId.get(id);
    if (p) { p.conflito = null; p.foco = null; p.cooldownRival.set(id === c.a ? c.b : c.a, mundo.t + 120); }
  }
  quemSai.mente.recuarDe = { id: outro?.id, ate: mundo.t + 6 };
  // D7: ao contrário de contagio_fuga (cerebro.js), este destino de recuo é fixo por até 6 s (recuarDe.ate) —
  // perto da borda do mapa, afastar() mirava um ponto fora da grade e a criatura ficava parada "tentando
  // fugir" indefinidamente (buscarCaminho nunca completa para fora do terreno). Clampa só aqui, na origem.
  const t = mundo.terreno, destino = outro ? afastar(quemSai, outro, 25) : null;
  if (destino) { destino.x = Math.min(t.largura - 1, Math.max(1, destino.x)); destino.y = Math.min(t.profundidade - 1, Math.max(1, destino.y)); }
  return { estado: 'recuando', codigo: `recuo_${motivo}`, motivo: `saiu da disputa: ${motivo}`, alvo: null, destino, ritmo: 'trote' };
}

function encerrarParticipacao(a, mundo, c, motivo) {
  a.conflito = null; a.foco = null;
  return { estado: 'vagando', codigo: `fim_disputa_${motivo}`, motivo: `disputa encerrada (${motivo})`, alvo: null, destino: null, ritmo: 'andar' };
}

function regExp(a, rivalId, venceu) {
  const e = a.memoria.experiencias.get(rivalId) ?? { vitorias: 0, derrotas: 0 };
  if (venceu) e.vitorias++; else e.derrotas++;
  a.memoria.experiencias.set(rivalId, e);
}

export function afastar(a, de, dist) {
  const dx = a.x - de.x, dy = a.y - de.y;
  const n = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: a.x + (dx / n) * dist, y: a.y + (dy / n) * dist };
}

function valorRecurso(a, c, mundo) {
  const fome = a.fome / 100;
  switch (c.motivo) {
    case 'carcaca': case 'defesa_carcaca': { const cc = mundo.carcacas.find((x) => x.id === c.recurso?.id); return cc ? Math.min(1, cc.carne / (a.massa * 0.1)) * (0.4 + fome) : 0; }
    case 'presa': return 0.3 + fome * 0.6;
    case 'territorio': return 0.35;
    case 'parceiro': return 0.6;
    default: return 0.2;
  }
}

export function dentroTerritorio(a, outro) {
  const t = a.territorio;
  if (!t) return false;
  return (outro.x - t.x) * (outro.x - t.x) + (outro.y - t.y) * (outro.y - t.y) <= t.raio * t.raio;
}

// Gatilhos de disputa (nunca só proximidade). Retorna {motivo, recurso} ou null.
export function gatilhoDisputa(a, k, rival, mundo) {
  if ((a.cooldownRival.get(rival.id) ?? 0) > mundo.t) return null;
  if (a.conflito || rival.conflito) return null;
  const minhaCarcaca = mundo.carcacas.find((c) => c.dono === a.id && c.carne > 0);
  if (minhaCarcaca && k.distancia < 18) return { motivo: 'defesa_carcaca', recurso: { tipo: 'carcaca', id: minhaCarcaca.id } };
  if (k.comportamento === 'comendo_carcaca' && a.fome > 45) {
    const cc = mundo.carcacas.find((c) => c.dono === rival.id && c.carne > 0);
    if (cc) return { motivo: 'carcaca', recurso: { tipo: 'carcaca', id: cc.id } };
  }
  if (a.alvo?.tipo === 'criatura' && k.perseguindo && k.perseguindo === a.alvo.id && (['perseguindo', 'espreitando'].includes(a.estado)||a.tatica?.context==='hunt')) return { motivo: 'presa', recurso: { tipo: 'presa', id: a.alvo.id } };
  if (a.especie.social.territorial && dentroTerritorio(a, rival) && !feridoVisivel(a)) {
    // Intrusão só vira disputa se o intruso permanece: exige ter visto o mesmo rival no território antes.
    const visto = a.mente.intrusos?.[rival.id];
    a.mente.intrusos = { ...(a.mente.intrusos ?? {}), [rival.id]: visto ?? mundo.t };
    if (visto !== undefined && mundo.t - visto > 8) return { motivo: 'territorio', recurso: null };
  }
  if (mundo.relogio.estacao === a.especie.vida.estacaoReprodutiva && a.sexo === 'M' && rival.sexo === 'M' && rival.especie.id === a.especie.id && a.mente.parceiraAlvo) return { motivo: 'parceiro', recurso: null };
  return null;
}
