// Anatomia de combate medida no GLB real (somente leitura): para cada ataque da ficha V2 com clipe, qual osso
// golpeia, em que instante do clipe o golpe é mais rápido (impacto) e até onde o membro alcança ao longo do eixo
// da frente. Também a extensão do corpo (frente/trás) para a cápsula de colisão anatômica.
// Unidades: as do modelo (multiplicar pela escala aplicada = comprimentoM / extensão no eixo da frente).
import { abrirGlb, canaisDoClipe, duracaoClipe, local, mul, poseMundial } from './lib-glb.mjs';

const PADROES = [
  [/mordida|bite|bote|pounce|investida|charge/i, /(jaw|mouth|snout|beak|head)/i, 'frente'],
  [/garra|claw|golpe|swipe|slash/i, /(hand|claw|paw|arm|forearm|front.*(paw|foot|hoof))/i, 'velocidade'],
  [/coice|kick/i, /back.*(ankle|hoof|foot|paw)|(hind|rear).*(foot|paw)/i, 'tras'],
  [/chicotada|cauda|tail/i, /(tail)/i, 'velocidade'],
];

export async function anatomiaGlb(arquivo, frente, ataques) {
  const glb = await abrirGlb(arquivo);
  const { g } = glb;
  const eixo = frente[1] === 'X' ? 12 : 14, sinal = frente[0] === '-' ? -1 : 1;
  const fwd = (m) => m[eixo] * sinal;
  const repouso = poseMundial(glb, null, 0);
  // Extensão do corpo ao longo da frente (pose de repouso; malhas com skin usam a pose de ligação).
  let fMax = -Infinity, fMin = Infinity;
  g.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const m = n.skin !== undefined ? local({}) : repouso(i);
    for (const p of g.meshes[n.mesh].primitives) {
      const a = g.accessors[p.attributes.POSITION];
      if (!a.min) continue;
      for (const x of [a.min[0], a.max[0]]) for (const y of [a.min[1], a.max[1]]) for (const z of [a.min[2], a.max[2]]) {
        const w = mul(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
        fMax = Math.max(fMax, fwd(w)); fMin = Math.min(fMin, fwd(w));
      }
    }
  });
  const nome = (i) => g.nodes[i].name ?? '';
  const out = { frenteMax: +fMax.toFixed(3), trasMin: +fMin.toFixed(3), centro: +((fMax + fMin) / 2).toFixed(3), ataques: {} };
  for (const atq of ataques) {
    const an = (g.animations ?? []).find((x) => x.name === atq.clipe);
    if (!an) { out.ataques[atq.nome] = { semClipe: true }; continue; }
    const dur = duracaoClipe(glb, an), can = canaisDoClipe(glb, an);
    const padrao = PADROES.find(([re]) => re.test(atq.nome) || re.test(atq.clipe));
    const N = 60;
    const amostras = [];
    for (let k = 0; k <= N; k++) amostras.push(poseMundial(glb, can, (k / N) * dur));
    // Candidatos pelo nome; entre eles, o que mais se move no clipe.
    let cands = g.nodes.map((_, i) => i).filter((i) => padrao && padrao[1].test(nome(i)));
    if (!cands.length) cands = g.nodes.map((_, i) => i);
    const percurso = (i) => { let s = 0; for (let k = 1; k <= N; k++) { const a = amostras[k](i), b = amostras[k - 1](i); s += Math.hypot(a[12] - b[12], a[13] - b[13], a[14] - b[14]); } return s; };
    const osso = cands.reduce((m, i) => (m === null || percurso(i) > percurso(m) + 1e-9 ? i : m), null);
    const modo = padrao?.[2] ?? 'velocidade';
    let melhor = -Infinity, kImp = 0, fMaxOsso = -Infinity, fMinOsso = Infinity;
    const notas = [0];
    for (let k = 0; k <= N; k++) {
      const p = amostras[k](osso);
      fMaxOsso = Math.max(fMaxOsso, fwd(p)); fMinOsso = Math.min(fMinOsso, fwd(p));
      if (k === 0) continue;
      const q = amostras[k - 1](osso);
      const vF = (fwd(p) - fwd(q)) / (dur / N);
      const v = Math.hypot(p[12] - q[12], p[13] - q[13], p[14] - q[14]) / (dur / N);
      const nota = modo === 'frente' ? vF : modo === 'tras' ? -vF : v;
      notas.push(nota);
      if (nota > melhor) { melhor = nota; kImp = k; }
    }
    // Estocada (frente/trás): o impacto é o fim do avanço — quando a velocidade cai abaixo de 30% do pico.
    if (modo !== 'velocidade') { let k = kImp; while (k < N && notas[k + 1] > melhor * 0.3) k++; kImp = k; }
    const fRep = fwd(repouso(osso));
    // Ponta: cabeça/mandíbula → até a frente da malha; demais → pequena margem (garra, casco, ponta da cauda).
    const ponta = modo === 'frente' ? Math.max(0.05, fMax - fRep) : 0.06;
    const alcance = modo === 'tras' ? fMinOsso - ponta : fMaxOsso + ponta;
    const pImp = amostras[kImp](osso);
    out.ataques[atq.nome] = {
      clipe: atq.clipe, osso: nome(osso), duracao: +dur.toFixed(3), tImpacto: +((kImp / N) * dur).toFixed(3),
      alcance: +alcance.toFixed(3), sentido: alcance < 0 ? 'tras' : 'frente', alturaImpacto: +pImp[13].toFixed(3),
      avancoNoClipe: +(fMaxOsso - fRep).toFixed(3),
    };
  }
  return out;
}
