/**
 * A small deterministic infrastructure for asynchronous tile-package loading.
 * No GLB parsing or fake terrain generation occurs here.
 * A provider supplies already-produced payloads: { value, bytes, dispose? }.
 * Pinned tiles and in-flight tiles cannot be evicted; all other tiles use LRU.
 */
export class UnpreparedTileError extends Error {
  constructor(id, layer, message = "physical package absent") {
    super(id + "/" + layer + ": " + message);
    this.name = "UnpreparedTileError";
    this.id = id;
    this.layer = layer;
  }
}
export class TileStreamer {
  constructor({ loader, maxBytes = 64 * 1024 * 1024, maxConcurrent = 3 } = {}) {
    if (typeof loader !== "function") throw new TypeError("TileStreamer requires loader");
    if (!(maxBytes > 0) || !(maxConcurrent >= 1)) throw new RangeError("Invalid budgets");
    this.loader = loader;
    this.maxBytes = maxBytes;
    this.maxConcurrent = maxConcurrent;
    this.cache = new Map();
    this.inFlight = new Map();
    this.queue = [];
    this.activeLoads = 0;
    this.totalBytes = 0;
    this.pins = new Map();
  }
  key(id, layer) { return layer + ":" + id; }
  pin(id, layer = "physics") {
    const key = this.key(id, layer);
    this.pins.set(key, (this.pins.get(key) ?? 0) + 1);
  }
  release(id, layer = "physics") {
    const key = this.key(id, layer), n = this.pins.get(key) ?? 0;
    if (n <= 1) this.pins.delete(key);
    else this.pins.set(key, n - 1);
    this.evict();
  }
  get(id, layer = "physics") {
    const key = this.key(id, layer), e = this.cache.get(key);
    if (!e) return null;
    // Map iteration order is the LRU order.
    this.cache.delete(key);
    this.cache.set(key, e);
    return e.value;
  }
  async ensure(id, layer = "physics") {
    const key = this.key(id, layer);
    if (this.cache.has(key)) return this.get(id, layer);
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    this.inFlight.set(key, promise);
    this.queue.push({ id, layer, key, resolve, reject });
    this.pump();
    return promise;
  }
  pump() {
    while (this.activeLoads < this.maxConcurrent && this.queue.length) {
      const job = this.queue.shift();
      this.activeLoads++;
      Promise.resolve().then(() => this.loader(job.id, job.layer)).then(payload => {
        if (!payload || !Number.isFinite(payload.bytes) || payload.bytes < 0 || !("value" in payload))
          throw new TypeError("Loader must return { value, bytes, dispose? }");
        if (this.cache.has(job.key)) this.destroy(job.key);
        const entry = { value: payload.value, bytes: payload.bytes, dispose: payload.dispose };
        this.cache.set(job.key, entry);
        this.totalBytes += entry.bytes;
        // Do not evict newly loaded object until the consumer observes it.
        job.resolve(entry.value);
        this.evict(job.key);
      }).catch(job.reject).finally(() => {
        this.inFlight.delete(job.key);
        this.activeLoads--;
        this.evict();
        this.pump();
      });
    }
  }
  destroy(key) {
    const e = this.cache.get(key);
    if (!e) return;
    this.cache.delete(key);
    this.totalBytes -= e.bytes;
    if (e.dispose) e.dispose(e.value);
  }
  evict(protectedKey = null) {
    if (this.totalBytes <= this.maxBytes) return;
    for (const key of [...this.cache.keys()]) {
      if (this.totalBytes <= this.maxBytes) break;
      if (key === protectedKey || this.pins.has(key) || this.inFlight.has(key)) continue;
      this.destroy(key);
    }
  }
  prefetch(ids, layer = "physics") {
    return Promise.allSettled([...new Set(ids)].map(id => this.ensure(id, layer)));
  }
  stats() {
    return { bytes: this.totalBytes, cached: this.cache.size, pinned: this.pins.size, inFlight: this.inFlight.size, queued: this.queue.length };
  }
  clearUnused() {
    for (const key of [...this.cache.keys()]) if (!this.pins.has(key)) this.destroy(key);
  }
}
