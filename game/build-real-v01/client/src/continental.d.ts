// Tipos para o runtime continental reaproveitado (build real/continental/src, JS puro).
declare module "@continental/streamer.mjs" {
  export interface Payload<T> { value: T; bytes: number; dispose?: (v: T) => void }
  export class TileStreamer {
    constructor(opts: { loader: (id: string, layer: string) => Promise<Payload<any>>; maxBytes?: number; maxConcurrent?: number });
    pin(id: string, layer?: string): void;
    release(id: string, layer?: string): void;
    ensure(id: string, layer?: string): Promise<any>;
    stats(): { bytes: number; cached: number; pinned: number; inFlight: number; queued: number };
  }
}
declare module "@continental/physics-loader.mjs" {
  export function makePhysicsChunkLoader(opts?: { allowUnverified?: boolean }): {
    loadIndex(url: string): Promise<{ base: URL; index: any }>;
    loadChunk(idx: { base: URL; index: any }, meta: any): Promise<any>;
  };
}
