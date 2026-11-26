#!/usr/bin/env node
// Gera config/eco/modelos.json: perfil de cada GLB real usado pelas espécies V2 (frente anatômica, extensão,
// duração e velocidade natural de cada clipe), a partir de scripts/auditar-glb.mjs. Os GLBs não são copiados.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { anatomiaGlb } from './anatomia-glb.mjs';

const cfg = await carregarConfigEcoNode();
const raizRepo = join(RAIZ_LAB, '..', '..');
const perfis = {};
for (const e of Object.values(cfg.especies)) {
  // Espécies das dunas nunca tiveram perfil: medir a anatomia delas agora mudaria o combate já validado (V5/V6).
  if (e.subsolo) continue;
  const arq = join(raizRepo, e.modelo.glb);
  const [a] = JSON.parse(execFileSync(process.execPath, [join(RAIZ_LAB, 'scripts', 'auditar-glb.mjs'), arq, '--json'], { encoding: 'utf8', maxBuffer: 1e8 }));
  if (a.erro) throw new Error(`${e.id}: ${a.erro}`);
  // Auditoria sem evidência de frente (rig sem osso de cabeça/cauda reconhecível): vale a ficha, conferida no rig.
  if (a.frente === 'indeterminado') a.frente = e.modelo.frente;
  if (a.frente !== e.modelo.frente) console.warn(`aviso: ${e.id} frente auditada ${a.frente} ≠ ficha V2 ${e.modelo.frente}`);
  const sha256 = createHash('sha256').update(await readFile(arq)).digest('hex');
  perfis[e.id] = {
    glb: e.modelo.glb, sha256, bytes: a.bytes, frente: a.frente, evidenciaFrente: a.evidenciaFrente, ossos: a.ossos,
    extensao: a.extensao.map((v) => +v.toFixed(4)),
    clipes: Object.fromEntries(a.clipes.map((c) => [c.nome, { duracao: c.duracao, velNatural: c.velNatural ?? null, rootMotion: c.rootMotion }])),
    // V3: anatomia de combate medida no rig (osso que golpeia, instante de impacto, alcance real do membro).
    anatomia: await anatomiaGlb(arq, a.frente, e.combate.ataques.filter((x) => x.clipe)),
  };
  // Corpo longo: o alcance é medido do CENTRO do modelo, e num corpo de 15 m isso devolve metade da
  // serpente como "alcance do bote". A origem real do golpe é a cabeça, que se move — vale a ficha.
  if (e.serpente) perfis[e.id].anatomia = null;
  // Rig por pivôs sem osso nomeado: o instante e o alcance do golpe não são mensuráveis — vale a ficha.
  if (Object.values(perfis[e.id].anatomia?.ataques ?? {}).some((x) => !x.osso)) perfis[e.id].anatomia = null;
  console.log(e.id, a.frente, Object.keys(perfis[e.id].clipes).length, 'clipes');
}
await writeFile(join(RAIZ_LAB, 'config', 'eco', 'modelos.json'), JSON.stringify({ _ajuda: 'Gerado por npm run perfis-modelos (auditoria dos GLBs originais, somente leitura). velNatural em unidades do modelo por segundo: multiplicar pela escala aplicada.', perfis }, null, 1));
