// Dobra a coluna real do GLB da serpente ao longo do corpo simulado. O GLB não é alterado: só as rotações
// das juntas, por quadro, depois que o mixer aplicou o clipe. Os clipes continuam dando o detalhe local
// (língua, mandíbula, respiração); o caminho do corpo vem de `pontosDoCorpo` — é por isso que a cauda segue
// a cabeça e a onda sobe pelo corpo mesmo com o clipe animando no lugar.
import { pontosDoCorpo } from '../eco/serpente.js';

const FACIAL = /mandible|tongue|jaw|fang|teeth|eye/i;

// Acha a cadeia mais longa de juntas (a coluna), da raiz para a ponta, ignorando o que é cabeça/face.
function acharColuna(modelo) {
  const ossos = [];
  modelo.traverse((o) => { if (o.isBone) ossos.push(o); });
  if (!ossos.length) return null;
  const filhosOsso = (b) => b.children.filter((c) => c.isBone && !FACIAL.test(c.name));
  const maisLonga = (b) => {
    let melhor = [];
    for (const f of filhosOsso(b)) { const c = maisLonga(f); if (c.length > melhor.length) melhor = c; }
    return [b, ...melhor];
  };
  let coluna = [];
  for (const b of ossos) { if (b.parent?.isBone) continue; const c = maisLonga(b); if (c.length > coluna.length) coluna = c; }
  return coluna.length >= 8 ? coluna : null;
}

export function prepararSerpente(THREE, v) {
  if (v.serpente !== undefined) return v.serpente;
  const coluna = acharColuna(v.modelo);
  if (!coluna) { v.serpente = null; return null; }
  // Direção de repouso de cada junta para a seguinte, no espaço local da junta, e o comprimento do elo.
  const elos = coluna.slice(0, -1).map((b, i) => {
    const p = coluna[i + 1].position;
    const d = p.length() || 1e-6;
    return { dir: p.clone().divideScalar(d), comp: d };
  });
  // Rotação de repouso de cada junta: a dobra parte dela todo quadro. Sem isso a rotação acumularia e o
  // corpo se enrolaria numa bola em poucos segundos.
  const repouso = coluna.map((b) => b.quaternion.clone());
  v.serpente = { coluna, elos, repouso, q: new THREE.Quaternion(), vA: new THREE.Vector3(), vB: new THREE.Vector3(), mInv: new THREE.Matrix4() };
  return v.serpente;
}

// `pontos` vem da simulação, da cabeça para a cauda; a cadeia do GLB vai da cauda para a cabeça.
export function dobrarSerpente(THREE, v, a, W, D) {
  const s = prepararSerpente(THREE, v);
  if (!s) return false;
  const n = s.coluna.length;
  const pts = pontosDoCorpo(a, n);
  // A raiz do personagem já está na cabeça (animador.js); aqui só orientamos as juntas no espaço do modelo.
  v.raiz.updateMatrixWorld(true);
  for (let i = 0; i < n - 1; i++) {
    const osso = s.coluna[i];
    osso.quaternion.copy(s.repouso[i]);
    // Junta i da cadeia = ponto (n-1-i) do corpo (a cadeia começa na cauda).
    const pA = pts[n - 1 - i], pB = pts[n - 2 - i];
    osso.updateMatrixWorld(true);
    s.mInv.copy(osso.matrixWorld).invert();
    // Vetor desejado, em mundo, convertido para o espaço local da própria junta.
    s.vA.set(pB.x - W - (pA.x - W), pB.z - pA.z, pB.y - D - (pA.y - D));
    if (s.vA.lengthSq() < 1e-12) continue;
    s.vB.copy(s.vA).normalize();
    // Só a rotação importa: aplica a matriz inversa sem a translação.
    const e = s.mInv.elements;
    const lx = e[0] * s.vB.x + e[4] * s.vB.y + e[8] * s.vB.z;
    const ly = e[1] * s.vB.x + e[5] * s.vB.y + e[9] * s.vB.z;
    const lz = e[2] * s.vB.x + e[6] * s.vB.y + e[10] * s.vB.z;
    s.vA.set(lx, ly, lz).normalize();
    s.q.setFromUnitVectors(s.elos[i].dir, s.vA);
    osso.quaternion.multiply(s.q);
    osso.updateMatrixWorld(true);
  }
  // A hierarquia do GLB nasce na CAUDA, mas `raiz.position` é a posição da cabeça do animal. Depois de
  // dobrar, desloca a raiz para que a última junta (o pescoço) caia onde a cabeça simulada está.
  const cab = s.coluna[n - 1];
  cab.updateMatrixWorld(true);
  const e = cab.matrixWorld.elements;
  v.raiz.position.x += (pts[0].x - W) - e[12];
  v.raiz.position.y += pts[0].z - e[13];
  v.raiz.position.z += (pts[0].y - D) - e[14];
  v.raiz.updateMatrixWorld(true);
  return true;
}

// Posição de mundo da cabeça da serpente, para a câmera e as capturas.
export function cabecaSerpente(a, W, D, alturaEm) {
  const p = pontosDoCorpo(a, 8)[0];
  return { x: p.x - W, y: alturaEm(p.x, p.y), z: p.y - D };
}
