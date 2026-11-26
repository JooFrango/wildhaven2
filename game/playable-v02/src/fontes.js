// Hexágonos com GLB de terreno disponível nesta build: HV_01 (vila, PR #99) e os 40 de
// world/playable-eastern-range-v01/play/region.json (Serra Oriental, florestas e planícies vizinhas).
// Os outros 231 hexágonos de Auralis só têm navegação simplificada até seus GLBs serem validados aqui.
import { extrairHex, montarRegiao, extraVila } from './regiao.js';
import { QUADRO } from './quadro.js';

export function fontesHex(regiaoLeste, site) {
  const f = new Map([['HV_01', { path: 'world/hunters-village-v01/models/hv_01_terrain.glb', cx: site.worldCoord[0], cz: site.worldCoord[2], render: ['world/hunters-village-v01/models/hv_01_terrain.glb', 'world/hunters-village-v01/models/hv_01_forest.glb', 'world/hunters-village-v01/models/phase_1.glb', 'world/hunters-village-v01/models/phase_1_inside.glb'] }]]);
  for (const t of regiaoLeste.tiles) f.set(t.id, { path: t.model_path, cx: t.center_x, cz: t.center_z, render: [t.model_path] });
  return f;
}

// Núcleo do provedor: cache de triângulos por hexágono e montagem da grade (síncrona). O provedor do navegador
// roda isto num Web Worker; o do Node chama direto.
export function nucleoProvedor({ fontes, lerBytes, site, progressao, runtimeVila }) {
  const cache = new Map(), extras = [extraVila(site, progressao.phases[0], runtimeVila)];
  const hex = (id) => { if (!cache.has(id)) { const f = fontes.get(id); cache.set(id, { id, tris: extrairHex(lerBytes(f.path), f) }); } return cache.get(id); };
  return {
    disponivel: (id) => fontes.has(id),
    carregado: (id) => cache.has(id),
    hex,
    montar: (spec) => montarRegiao(spec.hexes.filter((id) => fontes.has(id)).map(hex), { ...spec, res: 2, base: QUADRO.alturaBase, extras: spec.hexes.includes('HV_01') ? extras : [] }).t,
    liberar: (manter) => { for (const id of cache.keys()) if (!manter.has(id)) cache.delete(id); },
  };
}
