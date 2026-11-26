import { UnpreparedTileError } from "./streamer.mjs";
/**
 * Runtime provider for pre-built, approved bundles.
 * Expected future per-tile contract:
 * manifest.tiles[].packages.physics = { url, bytes, sha256 }
 * manifest.tiles[].packages.visual_lod0 = { url, bytes, sha256 }
 * The source GLB path is NEVER loaded as a substitute for a physics package.
 */
export function makeHttpProvider(manifest, { baseUrl = "./", fetchImpl = globalThis.fetch } = {}) {
  const tiles = new Map(manifest.tiles.map(tile => [tile.id, tile]));
  if (typeof fetchImpl !== "function") throw new TypeError("fetch is required");
  return async function loadTile(id, layer = "physics") {
    const tile = tiles.get(id), pack = tile?.packages?.[layer];
    if (!pack?.url) throw new UnpreparedTileError(id, layer, "bundle not built/certified");
    const base = new URL(baseUrl, globalThis.location?.href ?? "https://local.invalid/");
    const url = new URL(pack.url, base);
    // Reject accidental cross-origin private source URLs; use the deploy's own asset directory.
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
      throw new UnpreparedTileError(id, layer, "bundle outside asset root");
    const response = await fetchImpl(url.toString());
    if (!response.ok) throw new UnpreparedTileError(id, layer, "HTTP " + response.status);
    const bytes = await response.arrayBuffer();
    if (pack.bytes !== undefined && bytes.byteLength !== pack.bytes)
      throw new UnpreparedTileError(id, layer, "byte count mismatch");
    if (pack.sha256) {
      if (!globalThis.crypto?.subtle) throw new UnpreparedTileError(id, layer, "SHA-256 verification unavailable");
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== pack.sha256.toLowerCase()) throw new UnpreparedTileError(id, layer, "SHA-256 mismatch");
    }
    return { value: bytes, bytes: bytes.byteLength };
  };
}
