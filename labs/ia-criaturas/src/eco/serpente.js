// Locomoção de serpente (experimental). O corpo de 15 m não é um objeto rígido que desliza: é uma fila de
// segmentos amarrados ao RASTRO que a cabeça deixou. Quem avança é a cabeça, pelo controlador terrestre
// normal; o corpo passa depois pelo mesmo lugar, e a onda lateral que a cabeça escreve no rastro sobe pelo
// corpo até a ponta da cauda — a propagação cabeça→cauda sai da geometria, sem código que a imponha.
//
// Simplificação declarada: a física (colisão, rota, separação) usa o CENTRO liso da cabeça; a ondulação
// entra só no rastro. Numa serpente de 15 m com onda de ~0,5 m isso não muda nenhuma decisão, e evita que
// a oscilação empurre o corpo para dentro de obstáculos.
// Ficha: especie.serpente { comprimentoM, segmentos, ondaM, comprimentoOndaM, tracaoAreia,
// raioCurvaturaMinM, enrolarRaioM }.
import { atan2, cos, hipot, sen, PI } from '../core/matematica.js';
import { normalizarAngulo } from '../core/geometria.js';


import { altura, indice } from './terreno.js';
import { mover } from './locomocao.js';

const PASSO_RASTRO = 0.25; // m entre pontos gravados: 15 m de corpo ≈ 60 pontos
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

export function estadoSerpente(a, mundo) {
  const cfg = a.especie.serpente;
  if (!cfg) return;
  // O rastro nasce já cheio, com o corpo esticado atrás da cabeça: ela não começa enrolada nem encolhida.
  const t = mundo.terreno, rastro = [];
  const n = Math.ceil(cfg.comprimentoM / PASSO_RASTRO) + 2;
  for (let i = 0; i < n; i++) {
    const d = i * PASSO_RASTRO;
    const x = a.x - cos(a.direcao) * d, y = a.y - sen(a.direcao) * d;
    rastro.push({ x, y, z: altura(t, x, y), s: -d });
  }
  a.serpente = {
    terreno: t, // o corpo precisa do relevo para assentar no chão em pontosDoCorpo
    rastro, // [0] = cabeça; s = comprimento de arco acumulado (cresce com o tempo)
    s: 0, fase: 0, postura: 'estendida', progressoPostura: 0, onda: 0,
    comprimento: cfg.comprimentoM, metros: 0, enrolou: 0, desenrolou: 0,
  };
}

export const ehSerpente = (a) => !!a.serpente;

// Grava o caminho LISO da cabeça. A ondulação é aplicada ao corpo em `pontosDoCorpo`, em função do arco:
// assim mudar a amplitude nunca deixa um degrau gravado, e a onda continua viajando da cabeça à cauda.
// O rastro É o corpo: a curvatura é limitada aqui, na própria estrutura, e não em cada caminho que mexe na
// cabeça. Uma manobra apertada demais (a cabeça girando quase parada) vira uma curva que o corpo aguenta.
function gravar(a, mundo) {
  const s = a.serpente, t = mundo.terreno;
  const x = a.x, y = a.y;
  const ult = s.rastro[0];
  let d = hipot(x - ult.x, y - ult.y);
  if (d < PASSO_RASTRO * 0.5) return;
  d = hipot(x - ult.x, y - ult.y);
  s.s += d;
  s.rastro.unshift({ x, y, z: altura(t, x, y), s: s.s });
  // Guarda o corpo inteiro mais 2 m de folga: podar rente ao comprimento faz a cauda colapsar num ponto
  // (medido: a curvatura saltava de 18° para 65° no passo em que um ponto era descartado).
  const limite = s.s - s.comprimento - 2;
  while (s.rastro.length > 8 && s.rastro[s.rastro.length - 1].s < limite) s.rastro.pop();
}

// Areia solta segura o corpo; a ondulação é o que dá tração. Fator declarado na ficha, não medido em campo.
function tracao(a, mundo) {
  const cfg = a.especie.serpente;
  const k = indice(mundo.terreno, a.x, a.y);
  const areia = k >= 0 && mundo.terreno.areia;
  return areia ? (cfg.tracaoAreia ?? 0.75) : 1;
}

export function moverSerpente(a, intencao, mundo, dt) {
  const s = a.serpente, cfg = a.especie.serpente;
  const quer = intencao.postura ?? (intencao.estado === 'descansando' || intencao.estado === 'digerindo' || intencao.estado === 'emboscado' ? 'enrolada' : 'estendida');
  // Enrolar é percorrer uma espiral, não trocar de forma: o corpo continua seguindo o mesmo rastro, então o
  // comprimento se conserva sozinho e não há pose nova para inventar.
  let i = postura(a, intencao, mundo, quer, dt) ?? intencao;
  // Um corpo de 15 m não manobra em cima do destino: ao chegar, para. Sem isso a cabeça orbita o ponto e
  // escreve no rastro uma volta fechada que o corpo não consegue seguir.
  // Vale para ir a um lugar; não para chegar a uma presa, onde o contato final é o objetivo.
  if (!s.enrolando && i.destino && i.alvo?.tipo !== 'criatura' && hipot(i.destino.x - a.x, i.destino.y - a.y) < (cfg.raioCurvaturaMinM ?? 1.5)) i = { ...i, destino: null, ritmo: 'parado' };

  const antes = { x: a.x, y: a.y };
  mover(a, i, mundo, dt);
  const andou = hipot(a.x - antes.x, a.y - antes.y);
  s.metros += andou; s.andouNoPasso = andou;
  // Tração: o que ela de fato avança por metro de onda. Nunca empurra para a frente, só segura.
  const tr = tracao(a, mundo);
  if (tr < 1 && andou > 0) {
    a.x = antes.x + (a.x - antes.x) * tr; a.y = antes.y + (a.y - antes.y) * tr;
    a.velocidade *= tr;
  }
  // A onda anda com o corpo: um comprimento de onda a cada `comprimentoOndaM` percorridos.
  s.fase += (hipot(a.x - antes.x, a.y - antes.y) / (cfg.comprimentoOndaM ?? 6)) * 2 * PI;
  // Amplitude proporcional ao esforço; ao enrolar a espiral já é a curva, a onda só atrapalharia.
  // A amplitude não liga nem desliga de um passo para o outro: um corte seco deixa um degrau lateral no
  // rastro (medido: 0,76 m num trecho de 0,25 m, uma quina de 65° que o corpo copiava).
  const ondaAlvo = (cfg.ondaM ?? 0.6) * limitar(a.velocidade / a.especie.movimento.trote, 0, 1.2) * (1 - s.progressoPostura);
  s.onda += (ondaAlvo - s.onda) * Math.min(1, dt * 1.5);
  gravar(a, mundo);
  a.z = altura(mundo.terreno, a.x, a.y);
}

// Postura: devolve a intenção que leva a cabeça a desenhar a espiral (ou null para seguir a intenção normal).
// O progresso é quanto do corpo já está dentro da espiral; enrolada de vez, ela para.
function postura(a, intencao, mundo, quer, dt) {
  const s = a.serpente, cfg = a.especie.serpente;
  const enrolando = quer === 'enrolada';
  s.enrolando = enrolando || s.progressoPostura > 0; // enrolar curva mais que o raio mínimo: é a exceção
  if (!enrolando && s.progressoPostura <= 0) { s.postura = 'estendida'; return null; }
  // O progresso é quanto do CORPO já entrou na espiral, medido em metros percorridos — não um relógio.
  const antes = s.progressoPostura;
  s.metrosEspiral = limitar((s.metrosEspiral ?? 0) + (enrolando ? 1 : -1) * (s.andouNoPasso ?? 0), 0, s.comprimento);
  s.progressoPostura = s.metrosEspiral / s.comprimento;
  if (antes < 1 && s.progressoPostura >= 1) { s.postura = 'enrolada'; s.enrolou++; mundo.evento('serpente_enrolou', a.id, {}); }
  if (antes > 0 && s.progressoPostura <= 0) { s.postura = 'estendida'; s.desenrolou++; mundo.evento('serpente_desenrolou', a.id, { }); }
  // Enrolada por completo: a cabeça para no miolo da espiral e o corpo fica como está.
  if (s.postura === 'enrolada' && enrolando) { a.velocidade = 0; a.velAngular = 0; return { ...intencao, destino: null, ritmo: 'parado' }; }
  // Caminho em espiral de Arquimedes em torno do ponto onde começou: o raio diminui ao enrolar e cresce ao sair.
  s.centro ??= { x: a.x + cos(a.direcao) * (cfg.enrolarRaioM ?? 1.2) * 2.5, y: a.y + sen(a.direcao) * (cfg.enrolarRaioM ?? 1.2) * 2.5 };
  const dx = a.x - s.centro.x, dy = a.y - s.centro.y;
  const r = Math.max(cfg.enrolarRaioM ?? 1.2, hipot(dx, dy));
  const ang = atan2(dy, dx);
  // Passo à frente ao longo do círculo, com o raio indo para dentro (enrolando) ou para fora (saindo).
  const avanco = 0.9, dr = enrolando ? -0.35 : 0.5;
  const dAng = avanco / r;
  const rNovo = Math.max(cfg.enrolarRaioM ?? 1.2, r + dr * dAng * 3);
  // Saiu da espiral: esquece o centro e volta a andar normalmente a partir do próximo passo.
  if (!enrolando && s.progressoPostura <= 0) { s.centro = null; return null; }
  return { ...intencao, destino: { x: s.centro.x + cos(ang + dAng) * rNovo, y: s.centro.y + sen(ang + dAng) * rNovo }, ritmo: 'andar' };
}

// Os `n` pontos do corpo, da cabeça à cauda, espaçados por comprimento de arco. É o que o renderizador usa
// para dobrar os ossos e o que os testes medem. Em postura enrolada, interpola para uma espiral de Arquimedes.
export function pontosDoCorpo(a, n) {
  const s = a.serpente, cfg = a.especie.serpente;
  const passo = s.comprimento / (n - 1);
  const reto = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    const alvo = s.s - k * passo;
    while (i < s.rastro.length - 2 && s.rastro[i + 1].s > alvo) i++;
    const p0 = s.rastro[i], p1 = s.rastro[Math.min(i + 1, s.rastro.length - 1)];
    const d = p0.s - p1.s;
    // Faltou rastro (a serpente mal andou desde que nasceu): segue reto para trás em vez de amontoar a cauda.
    const u = d > 1e-9 ? (p0.s - alvo) / d : 0;
    reto.push({ x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u, z: p0.z + (p1.z - p0.z) * u });
  }
  // Rigidez: um corpo de 15 m não copia o zigue-zague fino que a cabeça faz ao manobrar parada. Duas passadas
  // de média móvel tiram o que o corpo não aguenta; depois os segmentos voltam ao passo exato, para que
  // suavizar não encurte a serpente.
  // Ondulação: desvio lateral senoidal em função do arco, perpendicular ao caminho. A fase anda com os
  // metros percorridos, então a onda viaja da cabeça até a ponta da cauda sem código que a propague.
  const lambda = cfg.comprimentoOndaM ?? 6;
  const base = reto.map((p) => ({ ...p }));
  for (let k = 0; k < n; k++) {
    const prox = base[Math.min(n - 1, k + 1)], ant = base[Math.max(0, k - 1)];
    const dir = atan2(prox.y - ant.y, prox.x - ant.x);
    const lat = sen(s.fase - ((k * passo) / lambda) * 2 * PI) * s.onda;
    reto[k].x = base[k].x - sen(dir) * lat; reto[k].y = base[k].y + cos(dir) * lat;
  }
  for (let volta = 0; volta < (cfg.rigidez ?? 2); volta++) {
    const c = reto.map((p) => ({ ...p }));
    for (let k = 1; k < n - 1; k++) {
      reto[k].x = (c[k - 1].x + 2 * c[k].x + c[k + 1].x) / 4;
      reto[k].y = (c[k - 1].y + 2 * c[k].y + c[k + 1].y) / 4;
    }
  }
  for (let k = 1; k < n; k++) {
    const dx = reto[k].x - reto[k - 1].x, dy = reto[k].y - reto[k - 1].y;
    const d = hipot(dx, dy) || 1e-9;
    reto[k].x = reto[k - 1].x + (dx / d) * passo;
    reto[k].y = reto[k - 1].y + (dy / d) * passo;
  }
  // O corpo assenta no relevo onde ele de fato está depois de suavizado, não onde o rastro passou.
  if (s.terreno) for (const p of reto) p.z = altura(s.terreno, p.x, p.y);
  return reto;
}

// Medidas que os testes e o inspetor usam: comprimento real, retidão e auto-interseção do corpo simulado.
export function medirCorpo(a, n = 24) {
  const p = pontosDoCorpo(a, n);
  let comp = 0;
  for (let i = 1; i < p.length; i++) comp += hipot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  let curvMax = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const a1 = atan2(p[i].y - p[i - 1].y, p[i].x - p[i - 1].x), a2 = atan2(p[i + 1].y - p[i].y, p[i + 1].x - p[i].x);
    curvMax = Math.max(curvMax, Math.abs(normalizarAngulo(a2 - a1)));
  }
  const raio = (a.especie.corpo.raio ?? 0.5);
  let cruzamentos = 0, folga = Infinity;
  for (let i = 0; i < p.length; i++) for (let k = i + 3; k < p.length; k++) {
    const d = hipot(p[i].x - p[k].x, p[i].y - p[k].y);
    if (d < raio * 2) cruzamentos++;
    folga = Math.min(folga, d - raio * 2);
  }
  const pontaAPonta = hipot(p[0].x - p[n - 1].x, p[0].y - p[n - 1].y);
  return { comprimento: comp, pontaAPonta, retidao: pontaAPonta / comp, curvMaxGraus: (curvMax * 180) / PI, cruzamentos, folgaMinima: folga, pontos: p };
}
