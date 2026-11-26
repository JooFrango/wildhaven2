/**
 * Region residency for autonomous Hunters; no positional mutation until a
 * physical package and a certified border transition are available.
 * This manager is independent of camera/viewer, and does not simulate combat.
 */
export class HunterRegionManager {
  constructor({ graph, streamer, canCross = () => false, onCommit = () => {} }) {
    if (!graph || !streamer) throw new TypeError("graph and streamer required");
    this.graph = graph;
    this.streamer = streamer;
    this.canCross = canCross; // explicit portal-validation adapter
    this.onCommit = onCommit; // authoritative engine commits position externally
    this.hunters = new Map();
    this.busy = new Set();
  }
  async place(hunterId, targetHex) {
    if (this.hunters.has(hunterId)) throw new Error("Hunter already registered");
    const tile = this.graph.byId.get(targetHex);
    if (!tile || tile.travelCost === null) return { ok: false, reason: "not-walkable" };
    this.streamer.pin(targetHex);
    try {
      await this.streamer.ensure(targetHex);
      const accepted = await this.onCommit({ hunterId, from: null, to: targetHex });
      if (accepted === false) throw new Error("Spawn commit rejected");
      this.hunters.set(hunterId, targetHex);
      return { ok: true, hex: targetHex };
    } catch (error) {
      this.streamer.release(targetHex);
      return { ok: false, reason: "physical-package-unavailable", error: String(error) };
    }
  }
  async cross(hunterId, nextHex) {
    if (this.busy.has(hunterId)) return { ok: false, reason: "transition-in-progress" };
    this.busy.add(hunterId);
    try {
    const current = this.hunters.get(hunterId);
    if (!current) return { ok: false, reason: "unknown-hunter" };
    if (current === nextHex) return { ok: true, hex: current };
    const target = this.graph.byId.get(nextHex);
    if (!target || target.travelCost === null || !this.graph.neighbors.get(current)?.has(nextHex))
      return { ok: false, reason: "invalid-adjacent-hex" };
    if (!this.canCross(current, nextHex, "foot", hunterId))
      return { ok: false, reason: "border-not-certified" };
    this.streamer.pin(nextHex);
    try {
      await this.streamer.ensure(nextHex, "physics");
      // Caller must atomically check/copy the original world position.
      // A failure must keep previous residency and terrain intact.
      const accepted = await this.onCommit({ hunterId, from: current, to: nextHex });
      if (accepted === false) throw new Error("Transition commit rejected");
      this.hunters.set(hunterId, nextHex);
      this.streamer.release(current);
      return { ok: true, hex: nextHex };
    } catch (error) {
      this.streamer.release(nextHex);
      return { ok: false, reason: "transition-failed", error: String(error) };
    }
    } finally {
      this.busy.delete(hunterId);
    }
  }
  remove(hunterId) {
    const current = this.hunters.get(hunterId);
    if (current) this.streamer.release(current);
    this.hunters.delete(hunterId);
  }
  prefetch(hunterId) {
    const hex = this.hunters.get(hunterId);
    if (!hex) return Promise.resolve([]);
    return this.streamer.prefetch([...this.graph.neighbors.get(hex)].filter(
      id => this.graph.byId.get(id).travelCost !== null
    ));
  }
  snapshot() { return Object.fromEntries(this.hunters); }
}
