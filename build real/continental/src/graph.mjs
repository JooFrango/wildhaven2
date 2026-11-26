/**
 * Wildhaven continental graph v01 — navigation topology only.
 * Graph connections are NOT proof of physically traversable borders.
 * The renderer must never interpret "route found" as gameplay certification.
 */
export class ContinentError extends Error {}

export function createContinent(manifest) {
  if (manifest?.schema !== "wildhaven.continent.manifest.v1") throw new ContinentError("Unsupported manifest schema");
  const byId = new Map(), neighbors = new Map();
  for (const tile of manifest.tiles) {
    if (!tile?.id || byId.has(tile.id) || !Number.isFinite(tile.x) || !Number.isFinite(tile.z))
      throw new ContinentError("Invalid/duplicate hex: " + tile?.id);
    if (tile.travelCost !== null && !(Number.isFinite(tile.travelCost) && tile.travelCost > 0))
      throw new ContinentError("Invalid cost for " + tile.id);
    byId.set(tile.id, tile);
    neighbors.set(tile.id, new Set());
  }
  const edges = new Set();
  for (const edge of manifest.edges) {
    if (!Array.isArray(edge) || edge.length !== 2) throw new ContinentError("Invalid edge");
    const [a, b] = edge;
    if (!byId.has(a) || !byId.has(b) || a === b) throw new ContinentError("Invalid edge endpoints");
    const key = [a, b].sort().join("|");
    if (edges.has(key)) throw new ContinentError("Repeated edge " + key);
    edges.add(key);
    neighbors.get(a).add(b);
    neighbors.get(b).add(a);
  }
  const distances = manifest.edges.map(([a, b]) => Math.hypot(byId.get(a).x - byId.get(b).x, byId.get(a).z - byId.get(b).z));
  const minPositiveCost = Math.min(...manifest.tiles.filter(t => t.travelCost !== null).map(t => t.travelCost));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const isLand = t => t && t.travelCost !== null;
  function findRoute(from, to, { mode = "foot", portalOpen = null } = {}) {
    const start = byId.get(from), goal = byId.get(to);
    if (!start || !goal) return null;
    // Maritime traversal is intentionally unavailable until physical water paths are certified.
    if (mode !== "foot" && mode !== "strategic") return null;
    if (!isLand(start) || !isLand(goal)) return null;
    if (from === to) return { ids: [from], metersWeighted: 0, requiresPhysicalValidation: true };
    const dist = new Map([[from, 0]]), came = new Map(), open = new Set([from]);
    const heuristic = id => distance(byId.get(id), goal) * minPositiveCost;
    while (open.size) {
      let id = null, score = Infinity;
      for (const key of open) {
        const s = dist.get(key) + heuristic(key);
        if (s < score) { id = key; score = s; }
      }
      if (id === to) {
        const ids = [id];
        while (came.has(ids[0])) ids.unshift(came.get(ids[0]));
        return { ids, metersWeighted: dist.get(id), requiresPhysicalValidation: true };
      }
      open.delete(id);
      for (const next of neighbors.get(id)) {
        const a = byId.get(id), b = byId.get(next);
        if (!isLand(b) || (portalOpen && !portalOpen(id, next, mode))) continue;
        const candidate = dist.get(id) + distance(a, b) * (a.travelCost + b.travelCost) / 2;
        if (candidate < (dist.get(next) ?? Infinity)) {
          came.set(next, id);
          dist.set(next, candidate);
          open.add(next);
        }
      }
    }
    return null;
  }
  function locate(x, z) {
    let best = null, d2 = Infinity;
    for (const t of manifest.tiles) {
      const d = (t.x - x) ** 2 + (t.z - z) ** 2;
      if (d < d2) { d2 = d; best = t; }
    }
    return d2 <= 2500 ** 2 ? best : null;
  }
  return { byId, neighbors, edgeCount: edges.size, tiles: manifest.tiles, minPositiveCost, distances, findRoute, locate };
}
