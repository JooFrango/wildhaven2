// Voo (V7, experimental). Controlador próprio, como o do subsolo: posição 3D real (x, y e altitude sobre o
// terreno), velocidade horizontal e vertical separadas, curva limitada, planeio que perde altura, estol,
// decolagem e pouso. NÃO é locomoção terrestre com altura somada: no ar o animal não para nem vira no lugar.
// Ficha: especie.voo { velMin, velCruzeiro, velMax, aceleracao, giroGrausSeg, subidaMax, descidaMax,
// razaoPlaneio, altitudeCruzeiroM, altitudeMaxM, folgaObstaculoM, custoBatidoPorSeg, custoPlaneioPorSeg,
// decolagemSeg, energiaMinDecolar, energiaPousar, pairar }.
import { atan2, cos, hipot, sen } from '../core/matematica.js';
import { normalizarAngulo } from '../core/geometria.js';
import { altura, indice } from './terreno.js';

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const VZ_QUEDA = 3.5; // m/s de descida no toque acima do qual o pouso vira queda

export function estadoVoo(a, mundo, altInicial = 0) {
  a.voo = { fase: altInicial > 0 ? 'voando' : 'solo', alt: altInicial, vz: 0, modo: 'batido', inclinacao: 0, tFase: 0,
    decolagens: 0, pousos: 0, quedas: 0, arremetidas: 0, desvios: 0, metros: 0, tempo: 0, altMax: altInicial, energiaGasta: 0, negado: null };
  if (altInicial > 0) { a.velocidade = a.especie.voo.velCruzeiro; a.z = altura(mundo.terreno, a.x, a.y) + altInicial; }
}

export const noAr = (a) => !!a.voo && a.voo.fase !== 'solo';
export const altitude = (a) => a.voo?.alt ?? 0;

// Sustentação: ferimento no flanco (onde a asa se prende ao corpo) e veneno reduzem a capacidade de voar.
export function fatorAsas(a) {
  let f = 1;
  for (const w of a.saude.ferimentos) if (w.regiao === 'flanco') f *= Math.max(0, 1 - w.gravidade * 2.5);
  return f * (a.saude.veneno?.mobilidade ?? 1);
}

const agua = (t, k) => t.agua[k] > -1e8;
// Célula serve para pousar ou decolar: dentro do mapa, sem rocha/tronco e sem água.
export function chaoLivre(t, x, y) {
  const k = indice(t, x, y);
  return k >= 0 && t.bloqueio[k] === 0 && !agua(t, k);
}

export function podeDecolar(a, mundo) {
  const cfg = a.especie.voo;
  if (a.saude.caidoAte > mundo.t || a.agarradoPor) return { ok: false, motivo: 'imobilizado' };
  if (a.energia < cfg.energiaMinDecolar) return { ok: false, motivo: 'energia_insuficiente' };
  if (fatorAsas(a) < 0.5) return { ok: false, motivo: 'asa_ferida' };
  // Corrida de decolagem: precisa de chão livre à frente.
  for (const d of [1.5, 3]) if (!chaoLivre(mundo.terreno, a.x + cos(a.direcao) * d, a.y + sen(a.direcao) * d)) return { ok: false, motivo: 'sem_espaco_a_frente' };
  return { ok: true };
}

// Ponto de pouso mais próximo do alvo que serve (espiral curta). null se não houver em 20 m.
export function localDePouso(mundo, alvo) {
  const t = mundo.terreno;
  if (chaoLivre(t, alvo.x, alvo.y)) return { x: alvo.x, y: alvo.y };
  for (let r = 2; r <= 20; r += 2) for (let k = 0; k < 8; k++) {
    const x = alvo.x + cos((k * Math.PI) / 4) * r, y = alvo.y + sen((k * Math.PI) / 4) * r;
    if (chaoLivre(t, x, y)) return { x, y };
  }
  return null;
}

// Maior altura do terreno no rumo `dir`, nos próximos `seg` segundos de voo. Fora do mapa conta como parede.
function relevoAFrente(t, a, dir, v, seg) {
  // Corredor de 6 m para cada lado, não uma linha: em curva o corpo varre mais que o rumo, e paredão de raspão conta.
  // Além da altura máxima, devolve em `relevoAFrente.taxa` a subida exigida (m/s) pelo ponto mais apertado:
  // um morro a 1 s de distância exige muito mais do que o mesmo morro a 6 s.
  let h = -Infinity, taxa = -Infinity;
  const lx = -sen(dir) * 6, ly = cos(dir) * 6;
  for (let s = 0.5; s <= seg; s += 0.5) {
    const x = a.x + cos(dir) * v * s, y = a.y + sen(dir) * v * s;
    if (indice(t, x, y) < 0) return Infinity;
    let hs = altura(t, x, y);
    if (indice(t, x + lx, y + ly) >= 0) hs = Math.max(hs, altura(t, x + lx, y + ly));
    if (indice(t, x - lx, y - ly) >= 0) hs = Math.max(hs, altura(t, x - lx, y - ly));
    h = Math.max(h, hs); taxa = Math.max(taxa, (hs + relevoAFrente.folga - relevoAFrente.z) / s);
  }
  relevoAFrente.taxa = taxa;
  return h;
}

// Devolve true quando o voo cuidou do movimento neste passo (no chão sem ordem de decolar devolve false).
export function moverVoo(a, i, mundo, dt) {
  const v = a.voo, cfg = a.especie.voo, t = mundo.terreno;
  if (v.fase === 'solo') {
    if (!i.voar) return false;
    const p = podeDecolar(a, mundo);
    v.negado = p.ok ? null : p.motivo;
    if (!p.ok) return false;
    v.fase = 'decolando'; v.tFase = 0; v.decolagens++;
    mundo.evento('decolagem', a.id, { x: +a.x.toFixed(1), y: +a.y.toFixed(1), energia: +a.energia.toFixed(1) });
  }
  v.tFase += dt; v.tempo += dt;
  // Vento e partículas (clima adverso) tiram sustentação e encarecem o voo.
  const ar = mundo.climaAtivo?.voo ?? 1;
  const asas = fatorAsas(a) * Math.max(0.4, ar);
  const chao = altura(t, a.x, a.y);
  let zAbs = chao + v.alt;
  const dest = i.destino;
  const dDest = dest ? hipot(dest.x - a.x, dest.y - a.y) : Infinity;
  let rumo = dest && dDest > 0.5 ? atan2(dest.y - a.y, dest.x - a.x) : a.direcao;
  let vAlvo = i.ritmo === 'corrida' ? cfg.velMax : cfg.velCruzeiro;
  let altAlvo = Math.min(cfg.altitudeMaxM, i.altitude ?? cfg.altitudeCruzeiroM);
  let pousando = false;

  if (v.fase === 'decolando') {
    // Corrida e salto: ganha velocidade no chão e só então sobe.
    vAlvo = cfg.velCruzeiro; altAlvo = v.tFase < cfg.decolagemSeg * 0.5 ? 0 : 6;
    if (a.velocidade >= cfg.velMin && v.alt > 1.2) v.fase = 'voando';
  } else if (i.pousar && dest) {
    // Aproximação: a rampa de descida leva ao toque no destino; perto do chão reduz para a velocidade mínima.
    pousando = true;
    if (v.fase !== 'pousando') { v.fase = 'pousando'; v.tFase = 0; }
    altAlvo = Math.min(altAlvo, Math.max(0, (dDest - 2) * 0.28));
    if (dDest < 30) vAlvo = Math.max(cfg.velMin, cfg.velMin + (dDest / 30) * (cfg.velCruzeiro - cfg.velMin));
  } else if (v.fase === 'pousando') v.fase = 'voando';

  // Obstáculos: o relevo à frente (montanha, paredão, rocha) exige altitude. Se não der para subir a tempo, desvia.
  // Um rumo está livre quando dá para ganhar a altura do relevo à frente dentro do horizonte.
  // 6 s de antecedência: virar 180° leva ~2,4 s e o corpo segue avançando enquanto vira.
  const horizonte = 6, vRef = Math.max(a.velocidade, cfg.velMin);
  relevoAFrente.folga = cfg.folgaObstaculoM; relevoAFrente.z = zAbs;
  const livre = (dir) => { const h = relevoAFrente(t, a, dir, vRef, horizonte); return h !== Infinity && relevoAFrente.taxa <= cfg.subidaMax * asas * 0.9 ? h : null; };
  if (!pousando || dDest > 12) {
    let h = livre(rumo);
    // O rumo atual também conta: enquanto vira, o corpo ainda avança para onde aponta.
    if (h !== null && Math.abs(normalizarAngulo(rumo - a.direcao)) > 0.3 && livre(a.direcao) === null) h = null;
    if (h === null) {
      // Mantém o lado já escolhido (senão oscila de volta para o obstáculo a cada passo).
      const lado = v.ladoDesvio ?? (normalizarAngulo(rumo - a.direcao) >= 0 ? 1 : -1);
      // 0 primeiro: se o rumo atual já está livre, segue reto contornando — só vira mais se precisar.
      for (const d of [0, 0.5, 1, 1.5, 2.1, -0.5, -1, -1.5, -2.1, Math.PI]) {
        const dir = a.direcao + d * lado;
        const hc = livre(dir);
        if (hc !== null) { h = hc; rumo = dir; if (d !== 0 && d !== Math.PI) v.ladoDesvio = Math.sign(d) * lado; else v.ladoDesvio ??= lado; break; }
      }
      if (!v.desviando) { v.desviando = true; v.desvios++; }
      v.desvioAte = mundo.t + 2;
    } else if (v.desviando && mundo.t > (v.desvioAte ?? 0)) { v.desviando = false; v.ladoDesvio = null; }
    altAlvo = h !== null ? Math.max(altAlvo, h + cfg.folgaObstaculoM - chao) : cfg.altitudeMaxM;
    // Nenhum rumo livre: sobe o que der e reduz para a velocidade mínima (ganha tempo para virar).
    if (h === null) vAlvo = cfg.velMin;
  }

  // Curva: taxa limitada; a inclinação lateral acompanha a curva (só visual e diagnóstico).
  const giroMax = ((cfg.giroGrausSeg * Math.PI) / 180) * dt * (0.5 + 0.5 * asas);
  const delta = limitar(normalizarAngulo(rumo - a.direcao), -giroMax, giroMax);
  a.direcao = normalizarAngulo(a.direcao + delta);
  v.inclinacao += (limitar(delta / giroMax, -1, 1) * 0.7 - v.inclinacao) * Math.min(1, dt * 4);

  // Velocidade horizontal: no ar não se para. Abaixo da mínima há estol (perde sustentação).
  const vMin = cfg.pairar ? 0 : cfg.velMin;
  if (v.fase !== 'decolando') vAlvo = Math.max(vMin, vAlvo);
  a.velocidade += limitar(vAlvo - a.velocidade, -cfg.aceleracao * dt, cfg.aceleracao * dt);
  const estol = v.fase !== 'decolando' && a.velocidade < vMin * 0.85;

  // Vertical: batido sobe e mantém; planeio troca altura por distância; sem energia ou sem asa, só desce.
  const semForca = a.energia <= a.especie.necessidades.limiteExaustao || asas < 0.3;
  let vzAlvo = limitar((altAlvo - v.alt) * 0.8, -cfg.descidaMax, cfg.subidaMax * asas);
  v.modo = semForca || vzAlvo < -0.4 ? 'planeio' : 'batido';
  if (v.modo === 'planeio') vzAlvo = Math.min(vzAlvo, -a.velocidade / cfg.razaoPlaneio);
  if (semForca) vzAlvo = Math.min(vzAlvo, asas < 0.3 ? -cfg.descidaMax * 1.5 : -a.velocidade / cfg.razaoPlaneio);
  if (estol) vzAlvo = -cfg.descidaMax;
  v.vz += limitar(vzAlvo - v.vz, -8 * dt, 8 * dt);

  // Integração 3D.
  const nx = a.x + cos(a.direcao) * a.velocidade * dt, ny = a.y + sen(a.direcao) * a.velocidade * dt;
  zAbs += v.vz * dt;
  // Paredão: o terreno do ponto de chegada está acima do corpo. Não entra na rocha — bate e perde velocidade.
  const dentro = indice(t, nx, ny) >= 0;
  if (dentro && v.fase !== 'decolando' && altura(t, nx, ny) > zAbs + 0.3) {
    a.velocidade = 0; v.vz = Math.min(v.vz, -1);
    if (!v.bateuEm || mundo.t - v.bateuEm > 1) { v.bateuEm = mundo.t; mundo.evento('colisao_paredao', a.id, { x: +a.x.toFixed(1), y: +a.y.toFixed(1), alt: +v.alt.toFixed(1) }); }
  } else if (dentro) { a.x = nx; a.y = ny; v.metros += a.velocidade * dt; }
  const chaoNovo = altura(t, a.x, a.y);
  v.alt = zAbs - chaoNovo;
  if (v.alt > v.altMax) v.altMax = v.alt;

  // Energia: bater asa custa (mais ao subir); planar quase não custa.
  const custo = (v.modo === 'batido' ? cfg.custoBatidoPorSeg * (0.3 + Math.max(0, v.vz) / cfg.subidaMax) : cfg.custoPlaneioPorSeg) * (2 - ar) * dt;
  a.energia = Math.max(0, a.energia - custo); v.energiaGasta += custo;

  // Contato com o chão: nunca atravessa. Pouso, arremetida ou queda.
  if (v.alt <= 0.15 && v.fase !== 'decolando') {
    const forte = -v.vz > VZ_QUEDA || a.velocidade > cfg.velMin * 1.8;
    if (pousando && !forte && !chaoLivre(t, a.x, a.y)) {
      // Local ruim (água, rocha): arremete e o cérebro escolhe outro ponto.
      v.alt = 0.3; v.vz = 2; v.fase = 'voando'; v.arremetidas++;
      mundo.evento('arremetida', a.id, { motivo: 'local_de_pouso_invalido' });
    } else {
      v.alt = 0; v.fase = 'solo'; v.inclinacao = 0;
      if (pousando && !forte) { v.pousos++; mundo.evento('pouso', a.id, { x: +a.x.toFixed(1), y: +a.y.toFixed(1), vz: +v.vz.toFixed(2), v: +a.velocidade.toFixed(1) }); }
      else {
        v.quedas++;
        const dano = a.saude.hpMax * Math.min(0.9, 0.04 * Math.max(0, -v.vz) + 0.01 * a.velocidade);
        a.saude.hp -= dano; a.saude.caidoAte = Math.max(a.saude.caidoAte, mundo.t + 2);
        mundo.evento('queda', a.id, { motivo: pousando ? 'pouso_forte' : semForca ? 'sem_sustentacao' : 'colisao_terreno', vz: +v.vz.toFixed(2), dano: +dano.toFixed(1) });
      }
      v.vz = 0; a.velocidade = Math.min(a.velocidade, a.especie.movimento.andar);
    }
  } else if (v.alt < 0) { v.alt = 0; v.vz = Math.max(0, v.vz); }
  a.z = altura(t, a.x, a.y) + v.alt;
  return true;
}
