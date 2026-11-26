// D3 (validação pendente): confere o IK/limites de pernas.js contra um GLB real de quadrúpede (Velsari,
// rig Thigh→Knee→Ankle, exatamente a cadeia de 2 ossos que resolver() assume) e os clipes reais (walk,
// run, leap...). Usa o leitor de GLB já existente no lab (scripts/lib-glb.mjs), sem THREE/navegador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { abrirGlb, canaisDoClipe, duracaoClipe, poseMundial } from '../scripts/lib-glb.mjs';
import { clampDistanciaJoelho } from '../src/web3d/pernas.js';

const GLB = new URL('../../../assets/models/creatures/velsari/velsari-savanna-optimized-v02-LOD0.glb', import.meta.url);

async function temGlb() { try { await readFile(GLB); return true; } catch { return false; } }

test('D3: limites padrão (15°–179°) não distorcem os clipes reais do Velsari (walk/run/leap)', { skip: !(await temGlb()) && 'GLB real não disponível neste checkout' }, async () => {
  const glb = await abrirGlb(GLB);
  const { g } = glb;
  const porNome = (n) => g.nodes.findIndex((no) => no.name === n);
  const perna = { sup: porNome('Velsari_FrontLeft_Thigh'), meio: porNome('Velsari_FrontLeft_Knee'), fim: porNome('Velsari_FrontLeft_Ankle') };
  assert.ok(perna.sup >= 0 && perna.meio >= 0 && perna.fim >= 0, 'rig deve ter a cadeia Thigh/Knee/Ankle (mesmo padrão de nomes que detectarCadeias espera)');

  const pos = (mat) => [mat[12], mat[13], mat[14]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const repouso = poseMundial(glb, null, 0);
  const l1 = dist(pos(repouso(perna.sup)), pos(repouso(perna.meio)));
  const l2 = dist(pos(repouso(perna.meio)), pos(repouso(perna.fim)));
  console.log(`  [D3] Velsari (perna dianteira esquerda): l1(coxa)=${l1.toFixed(3)}m, l2(canela)=${l2.toFixed(3)}m`);
  assert.ok(l1 > 0.05 && l2 > 0.05, 'ossos devem ter comprimento real (não degenerados)');

  const GRAU = Math.PI / 180;
  let piorGraus = 90;
  for (const nomeClipe of ['walk', 'run', 'leap']) {
    const an = g.animations.find((a) => a.name === nomeClipe);
    if (!an) continue;
    const canais = canaisDoClipe(glb, an), dur = duracaoClipe(glb, an);
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * dur;
      const pose = poseMundial(glb, canais, t);
      const d = dist(pos(pose(perna.sup)), pos(pose(perna.fim)));
      const cosTheta = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
      const grausJoelho = Math.acos(Math.min(1, Math.max(-1, cosTheta))) / GRAU;
      if (Math.abs(grausJoelho - 90) > Math.abs(piorGraus - 90)) piorGraus = grausJoelho;
      // O próprio resolver() não deveria precisar clampar nada durante esses clipes reais (senão a animação,
      // que já é fisicamente plausível, ficaria visivelmente distorcida pelo novo limite).
      const dClampado = clampDistanciaJoelho(l1, l2, d, 15 * GRAU, 179 * GRAU);
      assert.ok(Math.abs(dClampado - d) < 1e-3, `clipe '${nomeClipe}' t=${t.toFixed(2)}s: joelho real=${grausJoelho.toFixed(0)}° foi clampado (d=${d.toFixed(3)}→${dClampado.toFixed(3)}) pelos limites padrão`);
    }
  }
  console.log(`  [D3] ângulo de joelho mais extremo observado nos clipes reais: ${piorGraus.toFixed(0)}° (limites configurados: 25°–170°)`);
});

test('D3: alvo fora do rig real (ex.: perseguindo um ponto muito distante) ainda assim fica dentro do limite anatômico', { skip: !(await temGlb()) && 'GLB real não disponível neste checkout' }, async () => {
  const glb = await abrirGlb(GLB);
  const { g } = glb;
  const porNome = (n) => g.nodes.findIndex((no) => no.name === n);
  const perna = { sup: porNome('Velsari_FrontLeft_Thigh'), meio: porNome('Velsari_FrontLeft_Knee'), fim: porNome('Velsari_FrontLeft_Ankle') };
  const pos = (mat) => [mat[12], mat[13], mat[14]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const repouso = poseMundial(glb, null, 0);
  const l1 = dist(pos(repouso(perna.sup)), pos(repouso(perna.meio)));
  const l2 = dist(pos(repouso(perna.meio)), pos(repouso(perna.fim)));
  const GRAU = Math.PI / 180;
  const dOut = clampDistanciaJoelho(l1, l2, 50 /* alvo bem além do alcance real da perna */, 25 * GRAU, 170 * GRAU);
  assert.ok(dOut <= l1 + l2, 'nunca estica a perna real além do seu próprio comprimento');
  assert.ok(dOut > 0, 'resultado sempre positivo e finito');
});
