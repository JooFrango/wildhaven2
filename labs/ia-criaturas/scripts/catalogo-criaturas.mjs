// Descoberta não destrutiva dos GLBs e fichas do repositório. Não escreve no mapa nem na Alpha.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep, dirname, basename } from 'node:path';
import { inferirModoLocomocao } from '../src/eco/capacidades.js';
import { createHash } from 'node:crypto';

const normalizar = (c) => c.split(sep).join('/');
async function visitar(dir, raiz, saida) {
  let itens;
  try { itens = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const item of itens.sort((a, b) => a.name.localeCompare(b.name))) {
    const caminho = join(dir, item.name);
    if (item.isDirectory()) await visitar(caminho, raiz, saida);
    else if (item.isFile() && item.name.toLowerCase().endsWith('.glb'))
      saida.push(normalizar(relative(raiz, caminho)));
  }
}

export async function descobrirCatalogo(raizRepo) {
  const fichas = new Map();
  let arquivos = [];
  try { arquivos = await readdir(join(raizRepo, 'creatures', 'species')); } catch {}
  for (const arq of arquivos.sort()) {
    if (!arq.endsWith('.json')) continue;
    try {
      const obj = JSON.parse(await readFile(join(raizRepo, 'creatures', 'species', arq), 'utf8'));
      for (const p of [obj.assets?.model, obj.assets?.riggedModel].filter(Boolean))
        fichas.set(p.replaceAll('\\', '/'), obj);
    } catch { /* ficha antiga inválida não impede a oficina */ }
  }
  const modelos = [];
  await visitar(join(raizRepo, 'assets', 'models', 'creatures'), raizRepo, modelos);
  const manifests = new Map();
  return await Promise.all(modelos.map(async (glb) => {
    const f = fichas.get(glb);
    const pasta = dirname(glb);
    if (!manifests.has(pasta)) {
      let manifest = null;
      try { manifest = JSON.parse(await readFile(join(raizRepo, pasta, 'manifest.json'), 'utf8')); }
      catch { /* nem todo pacote possui manifest */ }
      manifests.set(pasta, manifest);
    }
    const m = manifests.get(pasta);
    const valido = m && basename(glb) === m.glb;
    const declarados = valido
      ? (m.animated_clips ?? m.clips ?? m.animations ?? []).map((x) => typeof x === 'string' ? x : x.name).filter(Boolean)
      : [];
    const animacoesDeclaradas = [...new Set([...(f?.assets?.animations ?? []), ...declarados])];
    const partes = glb.split('/');
    const especieSlug = partes[3] ?? 'desconhecida';
    return {
      id: 'cat_' + createHash('sha1').update(glb).digest('hex').slice(0, 14),
      nome: f?.name ?? especieSlug.replaceAll('-', ' '),
      glb, arquivo: partes.at(-1), origemEspecie: especieSlug,
      ficha: f?.id ?? null, status: f?.status ?? 'sem_ficha',
      papelSugerido: f?.category ?? null,
      comportamentos: Array.isArray(f?.behaviors) ? f.behaviors : [],
      animacoesDeclaradas,
      modoSugerido: inferirModoLocomocao(animacoesDeclaradas),
      manifest: valido ? normalizar(join(pasta, 'manifest.json')) : null,
      massaSugerida: Number.isFinite(f?.body?.massMinKg) && Number.isFinite(f?.body?.massMaxKg)
        ? (f.body.massMinKg + f.body.massMaxKg) / 2 : null,
      habitat: Array.isArray(f?.habitats) ? f.habitats : []
    };
  }));
}
