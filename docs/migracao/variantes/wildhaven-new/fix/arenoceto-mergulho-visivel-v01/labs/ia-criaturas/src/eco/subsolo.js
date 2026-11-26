// Controlador físico do deslocamento SOB a areia. É um meio próprio, não a locomoção terrestre com o GLB
// escondido: o animal tem profundidade, velocidade vertical, inércia, raio de giro e limites de passagem
// que vêm da espessura real de areia sobre o leito rochoso (src/eco/areia.js).
//
// Estado em a.subsolo:
//   fase        'superficie' | 'mergulhando' | 'submerso' | 'emergindo'
//   prof        profundidade do CENTRO do corpo abaixo da superfície (m); 0 na superfície
//   vz          velocidade vertical (m/s, positiva descendo)
//   progresso   0..1 da transição em curso (mergulho/emergência)
// A posição horizontal continua em a.x/a.y; a.z passa a ser a altura do centro do corpo no mundo.
//
// Nada aqui usa água: não há empuxo nem `nadar`. A areia resiste, não sustenta.
import { atan2, cos, hipot, PI, sen } from '../core/matematica.js';
import { limitar, normalizarAngulo } from '../core/geometria.js';
import { altura, buscarCaminho, indice, segmentoLivre } from './terreno.js';
import { areiaNavegavel, espessuraAreia, faixaProfundidade, perfilAreia, resistenciaAreia, volumeAreia } from './areia.js';

export const FASES = Object.freeze(['superficie', 'mergulhando', 'submerso', 'emergindo']);

// Perfil físico por espécie, de especie.subsolo. Sem esse bloco a espécie não entra na areia.
export function perfilSubsolo(especie) {
  const s = especie.subsolo;
  if (!s) return null;
  return {
    profundidadeMaxM: s.profundidadeMaxM,
    alturaCorpoM: s.alturaCorpoM ?? especie.corpo.alturaM,
    cruzeiro: s.cruzeiro, arranque: s.arranque,
    aceleracao: s.aceleracao, giroGrausSeg: s.giroGrausSeg,
    subidaMs: s.subidaMs, descidaMs: s.descidaMs,
    mergulhoSeg: s.mergulhoSeg, emergenciaSeg: s.emergenciaSeg,
    // Somente espécies que declaram estas propriedades exigem mergulho profundo e avanço reduzido.
    profundidadeEntradaM: s.profundidadeEntradaM ?? null,
    fatorAvancoTransicao: s.fatorAvancoTransicao ?? 0.6,
    custoPorMetro: s.custoPorMetro, custoVerticalPorMetro: s.custoVerticalPorMetro,
    inclinacaoMaxEntradaGraus: s.inclinacaoMaxEntradaGraus ?? 38,
  };
}

export function estadoInicial(a, mundo, profInicial = 0) {
  const p = perfilSubsolo(a.especie);
  a.subsolo = { fase: 'superficie', prof: 0, profMax: 0, vz: 0, progresso: 0, perfil: p, bloqueios: 0, mergulhos: 0, emergencias: 0, metrosSubsolo: 0, tempoSubsolo: 0, tempoSuperficie: 0 };
  if (p && profInicial > 0 && podeMergulhar(a, mundo)) {
    const f = faixaProfundidade(mundo.terreno, a.x, a.y, p.alturaCorpoM);
    if (f) { a.subsolo.fase = 'submerso'; a.subsolo.prof = limitar(profInicial, f.min, Math.min(f.max, p.profundidadeMaxM)); a.subsolo.profMax = a.subsolo.prof; }
  }
  aplicarAltura(a, mundo);
  return a.subsolo;
}

// Dois corpos separados por areia na vertical não se tocam, mesmo com o mesmo x,y:
// é o que impede mordida através de um volume de areia sólida e empurrão entre meios diferentes.
export function separadosNaVertical(a, b) {
  const pa = a.subsolo?.prof ?? 0, pb = b.subsolo?.prof ?? 0;
  if (pa === 0 && pb === 0) return false;
  const corpos = (a.especie.corpo.alturaM * a.escala + b.especie.corpo.alturaM * b.escala) / 2;
  return Math.abs(pa - pb) > corpos;
}

export const submerso = (a) => a.subsolo?.fase === 'submerso' || a.subsolo?.fase === 'mergulhando';
export const naSuperficie = (a) => !a.subsolo || a.subsolo.fase === 'superficie';
export const emTransicao = (a) => a.subsolo?.fase === 'mergulhando' || a.subsolo?.fase === 'emergindo';

// Altura do centro do corpo: superfície do terreno menos a profundidade.
export function aplicarAltura(a, mundo) {
  const h = altura(mundo.terreno, a.x, a.y);
  a.z = h - (a.subsolo?.prof ?? 0);
  return a.z;
}

// Pode iniciar o mergulho aqui? Areia navegável, espessura para o corpo e encosta não vertical.
export function podeMergulhar(a, mundo) {
  const p = a.subsolo?.perfil;
  if (!p) return false;
  const t = mundo.terreno;
  const k = indice(t, a.x, a.y);
  if (k < 0 || t.inclinacao[k] > p.inclinacaoMaxEntradaGraus) return false;
  const faixa = faixaProfundidade(t, a.x, a.y, p.alturaCorpoM);
  if (!faixa) return false;
  const entrada = Math.max(faixa.min, p.profundidadeEntradaM ?? 0);
  // O Arenoceto não inicia mergulho onde a areia não permite realmente enterrá-lo.
  return entrada <= Math.min(faixa.max, p.profundidadeMaxM);
}

// Pode emergir aqui? Precisa de areia (não rocha nem água funda) e de espaço livre acima.
export function podeEmergir(a, mundo) {
  const t = mundo.terreno;
  const k = indice(t, a.x, a.y);
  if (k < 0) return false;
  if (t.bloqueio[k] === 1) return false;
  if (t.agua[k] - t.alturas[k] > (a.especie.movimento.profundidadeMaxM ?? 0.5)) return false;
  return areiaNavegavel(t, a.x, a.y) || espessuraAreia(t, a.x, a.y) <= volumeAreia(t).crostaM;
}

// Ponto de emergência viável mais próximo do desejado, varrendo em anéis. null = nenhum no raio.
export function pontoDeEmergencia(a, mundo, alvo, raioM = 25) {
  const t = mundo.terreno;
  const base = alvo ?? { x: a.x, y: a.y };
  const salvo = { x: a.x, y: a.y };
  try {
    for (let r = 0; r <= raioM; r += Math.max(2, t.res)) {
      const passos = r === 0 ? 1 : Math.max(8, Math.round((2 * PI * r) / Math.max(2, t.res)));
      let melhor = null;
      for (let i = 0; i < passos; i++) {
        const ang = (2 * PI * i) / passos;
        const x = base.x + cos(ang) * r, y = base.y + sen(ang) * r;
        a.x = x; a.y = y;
        if (!podeEmergir(a, mundo)) continue;
        const d = (x - base.x) * (x - base.x) + (y - base.y) * (y - base.y);
        if (!melhor || d < melhor.d) melhor = { x, y, d };
      }
      if (melhor) return { x: melhor.x, y: melhor.y };
    }
  } finally { a.x = salvo.x; a.y = salvo.y; }
  return null;
}

// Passo físico no meio granular. `intencao` é a mesma do resto da IA; `intencao.subsolo` pede a transição:
//   'mergulhar' | 'emergir' | null (segue na fase atual).
export function moverSubsolo(a, intencao, mundo, dt) {
  const s = a.subsolo, p = s.perfil, t = mundo.terreno;
  if (s.fase === 'mergulhando' || s.fase === 'emergindo') { avancarTransicao(a, mundo, dt); return; }

  if (s.fase === 'superficie') {
    s.tempoSuperficie += dt;
    if (intencao.subsolo === 'mergulhar' && podeMergulhar(a, mundo)) iniciarMergulho(a, mundo);
    return;
  }

  // ---- submerso ----
  s.tempoSubsolo += dt;
  const destino = intencao.destino;
  const alvoVel = velocidadeSubsolo(a, intencao.ritmo);

  // Giro: raio de curva limitado pela inércia (massa) — o Arenoceto não vira como a arraia.
  const ponto = destino && alvoVel > 0 ? proximoPontoAreia(a, destino, mundo) : null;
  if (ponto) {
    const desejado = atan2(ponto.y - a.y, ponto.x - a.x);
    const maxGiro = (p.giroGrausSeg * PI) / 180 * dt * (1 - 0.5 * limitar(a.velocidade / Math.max(0.1, p.arranque), 0, 1));
    const d = normalizarAngulo(desejado - a.direcao);
    a.direcao = normalizarAngulo(a.direcao + limitar(d, -maxGiro, maxGiro));
    a.velAngular = limitar(d, -maxGiro, maxGiro) / dt;
  } else a.velAngular = 0;

  // Resistência do material freia e encarece o avanço.
  const resist = resistenciaAreia(t, a.x, a.y);
  const vLimite = alvoVel * (1 - 0.7 * resist);
  const acel = p.aceleracao * dt;
  a.velocidade = a.velocidade < vLimite ? Math.min(vLimite, a.velocidade + acel) : Math.max(vLimite, a.velocidade - acel * 1.6);

  // Profundidade desejada: pedida pela intenção, limitada pela espessura real do ponto de chegada.
  const nx = a.x + cos(a.direcao) * a.velocidade * dt, ny = a.y + sen(a.direcao) * a.velocidade * dt;
  const f = faixaProfundidade(t, nx, ny, p.alturaCorpoM);
  if (!f) {
    // Leito rochoso, rocha ou areia rasa à frente: não atravessa. Perde velocidade e sobe se puder.
    s.bloqueios++;
    mundo.metricas.subsoloBloqueios = (mundo.metricas.subsoloBloqueios ?? 0) + 1;
    a.velocidade *= 0.2;
    if (a.caminhoAreia) a.caminhoAreia.invalido = true;
    ajustarProfundidade(a, mundo, Math.max(0.5, s.prof - 1), dt);
    aplicarAltura(a, mundo);
    gastarEnergiaSubsolo(a, 0, dt);
    return;
  }
  const pedida = intencao.profundidade != null ? intencao.profundidade : s.prof;
  const alvoProf = limitar(pedida, f.min, Math.min(f.max, p.profundidadeMaxM));
  const dz = ajustarProfundidade(a, mundo, alvoProf, dt);

  const passo = hipot(nx - a.x, ny - a.y);
  a.x = limitar(nx, 0.01, t.largura - 0.01); a.y = limitar(ny, 0.01, t.profundidade - 0.01);
  s.metrosSubsolo += passo;
  aplicarAltura(a, mundo);
  gastarEnergiaSubsolo(a, passo, dt, dz);

  if (intencao.subsolo === 'emergir') iniciarEmergencia(a, mundo);
}

// Rota pelo volume de areia: A* no perfil de areia (contorna leito rochoso, rocha e passagem estreita).
// Replaneja quando o destino muda muito ou depois de 4 s — o mesmo ritmo do seguidor terrestre.
function proximoPontoAreia(a, destino, mundo) {
  const t = mundo.terreno, p = a.subsolo.perfil;
  const perfil = perfilAreia(t, p.alturaCorpoM);
  const raio = a.especie.corpo.raio * a.escala;
  const c = a.caminhoAreia;
  const mudou = !c || hipot(c.destino.x - destino.x, c.destino.y - destino.y) > Math.max(4, hipot(destino.x - a.x, destino.y - a.y) * 0.15)
    || mundo.t - c.quando > 4 || c.invalido;
  if (mudou) {
    if (segmentoLivre(t, perfil, a, destino, raio, raio * 1.5 + 1)) {
      a.caminhoAreia = { destino: { ...destino }, pontos: [destino], i: 0, quando: mundo.t, completo: true };
    } else {
      const r = buscarCaminho(t, perfil, a, destino, { maxExpansoes: 12000, custoAgua: 0, raio });
      mundo.metricas.buscasCaminhoAreia = (mundo.metricas.buscasCaminhoAreia ?? 0) + 1;
      const pts = r?.pontos.slice(1) ?? [];
      a.caminhoAreia = { destino: { ...destino }, pontos: pts.length ? pts : [destino], i: 0, quando: mundo.t, completo: !!r?.completo };
    }
  }
  const cc = a.caminhoAreia;
  const chegou = (q, r) => hipot(q.x - a.x, q.y - a.y) < r;
  while (cc.i < cc.pontos.length - 1 && chegou(cc.pontos[cc.i], Math.max(2, raio * 1.5))) cc.i++;
  return cc.pontos[cc.i] ?? destino;
}

export function velocidadeSubsolo(a, ritmo) {
  const p = a.subsolo?.perfil;
  if (!p || ritmo === 'parado') return 0;
  const v = ritmo === 'corrida' ? p.arranque : ritmo === 'trote' ? (p.cruzeiro + p.arranque) / 2 : p.cruzeiro;
  return v * a.atributos.velocidade * (a.juvenil ? 0.55 + 0.45 * a.crescimento : 1);
}

// Sobe/desce respeitando a taxa vertical da espécie. Devolve o |Δ| realmente aplicado.
function ajustarProfundidade(a, mundo, alvo, dt) {
  const s = a.subsolo, p = s.perfil;
  const d = alvo - s.prof;
  const taxa = d > 0 ? p.descidaMs : p.subidaMs;
  const passo = limitar(d, -taxa * dt, taxa * dt);
  s.prof += passo;
  if (s.prof > s.profMax) s.profMax = s.prof;
  s.vz = passo / dt;
  return Math.abs(passo);
}

function iniciarMergulho(a, mundo) {
  const s = a.subsolo;
  s.fase = 'mergulhando'; s.progresso = 0; s.profInicio = s.prof; s.mergulhos++;
  a.velocidade = Math.min(a.velocidade, velocidadeSubsolo(a, 'andar'));
  mundo.evento('mergulho_inicio', a.id, { x: +a.x.toFixed(1), y: +a.y.toFixed(1), espessura: +espessuraAreia(mundo.terreno, a.x, a.y).toFixed(1) });
  vibracaoDeTransicao(a, mundo, 'mergulho');
}

function iniciarEmergencia(a, mundo) {
  const s = a.subsolo;
  if (!podeEmergir(a, mundo)) { s.bloqueios++; return false; }
  s.fase = 'emergindo'; s.progresso = 0; s.profInicio = s.prof; s.emergencias++;
  mundo.evento('emergencia_inicio', a.id, { x: +a.x.toFixed(1), y: +a.y.toFixed(1) });
  vibracaoDeTransicao(a, mundo, 'emergencia');
  return true;
}

// Transição contínua: o corpo atravessa a superfície em `mergulhoSeg`/`emergenciaSeg`, sem salto de posição.
function avancarTransicao(a, mundo, dt) {
  const s = a.subsolo, p = s.perfil;
  const mergulhando = s.fase === 'mergulhando';
  const total = mergulhando ? p.mergulhoSeg : p.emergenciaSeg;
  s.progresso = Math.min(1, s.progresso + dt / total);
  const t = mundo.terreno;
  // Priorizar afundar em vez de deslizar por cima. Só avança se o novo ponto ainda tiver
  // espessura para a imersão exigida pela espécie; não atravessa leito raso ao mergulhar.
  const v = velocidadeSubsolo(a, 'andar') * p.fatorAvancoTransicao;
  const nx = limitar(a.x + cos(a.direcao) * v * dt, 0.01, t.largura - 0.01);
  const ny = limitar(a.y + sen(a.direcao) * v * dt, 0.01, t.profundidade - 0.01);
  const prox = faixaProfundidade(t, nx, ny, p.alturaCorpoM);
  const limiteProx = prox && Math.min(prox.max, p.profundidadeMaxM);
  const podeAvancar = !mergulhando || (prox && limiteProx >= Math.max(prox.min, p.profundidadeEntradaM ?? 0));
  if (podeAvancar) { a.x = nx; a.y = ny; }
  else { s.bloqueios++; mundo.metricas.subsoloBloqueios = (mundo.metricas.subsoloBloqueios ?? 0) + 1; }
  a.velocidade = podeAvancar ? v : 0;
  const faixa = faixaProfundidade(t, a.x, a.y, p.alturaCorpoM);
  const fim = mergulhando ? Math.min(p.profundidadeMaxM, faixa?.max ?? 0, Math.max(faixa?.min ?? 0, p.profundidadeEntradaM ?? 0)) : 0;
  // A profundidade aumenta continuamente. No Arenoceto, o alvo é pelo menos sua altura
  // corporal, fazendo metade do corpo cruzar a superfície até metade do clipe de mergulho.
  s.profInicio ??= s.prof;
  const antes = s.prof;
  s.prof = mergulhando ? s.profInicio + (fim - s.profInicio) * s.progresso : s.profInicio * (1 - s.progresso);
  s.vz = (s.prof - antes) / dt;
  if (s.progresso >= 1) {
    s.fase = mergulhando ? 'submerso' : 'superficie';
    s.prof = mergulhando ? fim : 0;
    if (s.prof > s.profMax) s.profMax = s.prof;
    s.progresso = 0; s.profInicio = null;
    mundo.evento(mergulhando ? 'mergulho_fim' : 'emergencia_fim', a.id, { prof: +s.prof.toFixed(2) });
  }
  aplicarAltura(a, mundo);
  gastarEnergiaSubsolo(a, (podeAvancar ? v : 0) * dt, dt, Math.abs(s.vz) * dt);
}

function gastarEnergiaSubsolo(a, metros, dt, verticais = 0) {
  const p = a.subsolo.perfil, n = a.especie.necessidades;
  const custo = metros * p.custoPorMetro + verticais * p.custoVerticalPorMetro + n.custoBasePorSeg * dt;
  a.energia = Math.max(0, a.energia - custo);
}

// Transições fazem a areia tremer — o gancho é preenchido por vibracoes.js quando o mundo o instala.
function vibracaoDeTransicao(a, mundo, tipo) {
  mundo.vibracao?.(a, tipo, a.massa);
}
