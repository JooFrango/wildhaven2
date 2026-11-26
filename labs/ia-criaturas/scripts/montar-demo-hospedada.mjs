#!/usr/bin/env node
// Monta dist-eco/: versão autocontida da demo 3D para hospedar (página + módulos + configs + GLBs originais).
// Os GLBs são lidos do repositório e copiados SÓ para dist-eco/ (ignorada pelo Git) — nada é duplicado no repositório.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { RAIZ_LAB } from '../src/node/carregar-node.js';

const dist = join(RAIZ_LAB, 'dist-eco');
const raizRepo = join(RAIZ_LAB, '..', '..');
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'modelos'), { recursive: true });
for (const d of ['src/eco', 'src/web3d']) await cp(join(RAIZ_LAB, d), join(dist, d), { recursive: true });
await mkdir(join(dist, 'src', 'core'), { recursive: true });
for (const f of ['matematica.js', 'geometria.js', 'rng.js']) await cp(join(RAIZ_LAB, 'src', 'core', f), join(dist, 'src', 'core', f));
await cp(join(RAIZ_LAB, 'config', 'eco'), join(dist, 'config', 'eco'), { recursive: true });
const perfis = JSON.parse(await readFile(join(RAIZ_LAB, 'config', 'eco', 'modelos.json'), 'utf8')).perfis;
// O host de Artifacts não serve .glb: cada GLB vai como base64 em .b64.txt (bytes idênticos; SHA-256 conferido).
const { createHash } = await import('node:crypto');
for (const p of Object.values(perfis)) {
  const bytes = await readFile(join(raizRepo, p.glb));
  if (createHash('sha256').update(bytes).digest('hex') !== p.sha256) throw new Error(`SHA-256 divergente: ${p.glb}`);
  await writeFile(join(dist, 'modelos', `${basename(p.glb)}.b64.txt`), bytes.toString('base64'));
}
// Peças de hexágono dos corredores (origem.hexes dos terrenos derivados): mesmo caminho, senão o cenário de
// travessia abre sem chão na versão hospedada. O SHA-256 conferido é o do arquivo usado para derivar o terreno.
const pastaTerrenos = join(RAIZ_LAB, 'config', 'eco', 'terrenos');
for (const f of await readdir(pastaTerrenos)) {
  if (!f.endsWith('.json')) continue;
  const { origem } = JSON.parse(await readFile(join(pastaTerrenos, f), 'utf8'));
  for (const h of origem?.hexes ?? []) {
    const bytes = await readFile(join(raizRepo, h.glb));
    if (createHash('sha256').update(bytes).digest('hex') !== h.sha256) throw new Error(`SHA-256 divergente: ${h.glb} (terreno ${f})`);
    await writeFile(join(dist, 'modelos', `${basename(h.glb)}.b64.txt`), bytes.toString('base64'));
    console.log(`peça ${h.id} (${h.label}) em base64: ${basename(h.glb)}.b64.txt (${(bytes.length / 1048576).toFixed(1)} MB)`);
  }
}
// Página: corpo do HTML (o host do Artifact fornece doctype/html/head/body) + base dos modelos.
let html = await readFile(join(RAIZ_LAB, 'ecossistema.html'), 'utf8');
const head = html.slice(html.indexOf('<title>'), html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const pagina = `${head.replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '')}\n<script>window.WILDHAVEN_MODELOS = 'modelos/';</script>\n${body}`;
await writeFile(join(dist, 'index.html'), pagina);
// Bancada do Varrisco: página completa (doctype próprio), mesmos módulos, GLBs em base64.
const lab = (await readFile(join(RAIZ_LAB, 'laboratorio-varrisco.html'), 'utf8')).replace("window.WILDHAVEN_MODELOS = window.WILDHAVEN_MODELOS ?? '/repo/';", "window.WILDHAVEN_MODELOS = 'modelos/';");
await writeFile(join(dist, 'laboratorio-varrisco.html'), lab);
const arquivos = [];
const listar = async (d, rel = '') => { for (const e of await readdir(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) await listar(join(d, e.name), r); else if (r !== 'index.html') arquivos.push(r); } };
await listar(dist);
await writeFile(join(dist, 'arquivos.json'), JSON.stringify(arquivos, null, 1));
console.log(`dist-eco/ pronta: index.html + ${arquivos.length} arquivos`);
