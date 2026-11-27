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

// --- campos de gameplay (aditivos ao snapshot v1) ---
export interface Skill { level: number; xp: number; }
export interface HunterGame {
  role: "hunter" | "socorrista"; hp: number; hp_max: number; forca: number; arma: string;
  skills: Record<string, Skill>; inventory: string[]; activity: string; crouched: boolean; alive: boolean;
  downed_since_s: number | null; expedition: number | null; target_creature: number | null; last_action: string;
  carried_by: string | null; wagon: string | null;
}
export type HunterFull = HunterSnap & HunterGame;
export interface CreatureSnap { id: number; species: string; x: number; y: number; z: number; heading: number; tile_id: string; hp: number; hp_max: number; state: string; clip: string; group: number; alive: boolean; immobilized_until_s: number; }
export interface WagonSnap { id: string; driver: string; x: number; y: number; z: number; heading: number; tile_id: string; state: string; passengers: string[]; storage: string[]; expedition: number | null; }
export interface CampSnap { id: number; expedition: number; x: number; z: number; tile: string; storage: string[]; }
export interface ExpeditionSnap { id: number; species: string; members: string[]; transporte: string; wagon: string | null; dest_tile: string; state: string; kills: number; rescuer: string | null; cost: number; }
export interface PageSnap { species: string; nome: string; primeiro_avistamento_tick: number; primeiro_por: string; avistamentos: number; abates: number; conhecimento: string; habitats: string[]; itens: string[]; pontos: [string, number, number][]; }
export interface FootprintSnap { id: number; creature: number; species: string; x: number; z: number; t: number; seq: number; break_before: boolean; }
export interface TrapSnap { id: number; owner: string; kind: string; x: number; z: number; armed: boolean; caught: number | null; }
export interface EventSnap { tick: number; t: number; kind: string; text: string; }
export interface GameSnap {
  money: number; creatures: CreatureSnap[]; wagons: WagonSnap[]; camps: CampSnap[]; expeditions: ExpeditionSnap[];
  bestiary: { pages: Record<string, PageSnap> }; tracks: FootprintSnap[]; traps: TrapSnap[]; events: EventSnap[];
  village: [number, number]; village_storage: string[];
}
export interface SnapshotFull extends Omit<Snapshot, "hunters"> { hunters: HunterFull[]; game: GameSnap; }
