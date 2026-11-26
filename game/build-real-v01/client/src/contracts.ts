// Espelho TypeScript de contracts/v1/snapshot.schema.json (wildhaven.snapshot.v1).
export type Phase = "day" | "night";
export interface ClockState { epoch_ms: number; now_ms: number; cycle: number; phase: Phase; phase_elapsed_s: number; phase_remaining_s: number; cycle_fraction: number; }
export interface Crossing { tick: number; sim_time_s: number; from: string; to: string; x: number; z: number; step_m: number; }
export type HunterState = "planejando" | "caminhando" | "descansando" | "sem_rota";
export interface HunterSnap {
  id: string; name: string; x: number; y: number; z: number; heading: number; tile_id: string;
  state: HunterState; clip: string; speed_mps: number; goal: { tile: string; x: number; z: number } | null;
  rest_until_s: number; crossings: Crossing[]; distance_walked_m: number; plan_failures: number; rng_state: number;
}
export interface StreamStats { resident_chunks: number; resident_bytes: number; cap_bytes: number; pinned_chunks: number; hits: number; misses: number; evictions: number; load_errors: number; }
export interface WindowChunk { tile: string; ix: number; iz: number; }
export interface Snapshot { schema: "wildhaven.snapshot.v1"; tick: number; sim_time_s: number; clock: ClockState; hunters: HunterSnap[]; streaming: StreamStats; window: WindowChunk[]; }
export interface ContinentTile { id: string; x: number; z: number; biome: string; status: string; }
export interface ContinentSummary { schema: "wildhaven.continent.summary.v1"; hexRadius: number; tiles: ContinentTile[]; summary: Record<string, number>; }
export const SNAPSHOT_SCHEMA = "wildhaven.snapshot.v1";
