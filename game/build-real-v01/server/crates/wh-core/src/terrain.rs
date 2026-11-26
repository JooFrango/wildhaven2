//! Streaming autoritativo de chunks WHP1 com cache LRU limitado por bytes e janela
//! móvel em torno de CADA Hunter (nunca da câmera ou da vila).
//!
//! Regras:
//! - um chunk só é lido de um pacote cujo tile está liberado (certificado técnico,
//!   ou modo revisão explícito);
//! - chunks dentro da janela de qualquer Hunter ficam "pinned" e não são despejados;
//! - fora da janela, despejo LRU quando o total residente passa do teto;
//! - a amostragem usa o pacote do tile que CONTÉM o ponto (grade global alinhada).

use crate::hex::Continent;
use crate::whp::{decode_packed, Cell, Chunk};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
struct IndexChunk {
    ix: i32,
    iz: i32,
    url: String,
    bytes: usize,
    sha256: String,
}

#[derive(Debug, Deserialize)]
struct TileIndex {
    schema: String,
    #[serde(rename = "tileId")]
    tile_id: String,
    #[serde(rename = "chunkMeters")]
    chunk_meters: f64,
    chunks: Vec<IndexChunk>,
}

struct TileMeta {
    chunk_meters: f64,
    chunks: HashMap<(i32, i32), IndexChunk>,
}

pub type ChunkKey = (String, i32, i32);

#[derive(Debug, Default, Clone, Serialize)]
pub struct StreamStats {
    pub resident_chunks: usize,
    pub resident_bytes: usize,
    pub cap_bytes: usize,
    pub pinned_chunks: usize,
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub load_errors: u64,
}

pub struct TerrainStore {
    pub continent: Arc<Continent>,
    physics_dir: PathBuf,
    allowed_tiles: HashSet<String>,
    metas: HashMap<String, Option<TileMeta>>,
    resident: HashMap<ChunkKey, (Arc<Chunk>, u64)>,
    pinned: HashSet<ChunkKey>,
    clock: u64,
    pub stats: StreamStats,
}

impl TerrainStore {
    pub fn new(continent: Arc<Continent>, physics_dir: PathBuf, allowed_tiles: HashSet<String>, cap_bytes: usize) -> Self {
        Self {
            continent,
            physics_dir,
            allowed_tiles,
            metas: HashMap::new(),
            resident: HashMap::new(),
            pinned: HashSet::new(),
            clock: 0,
            stats: StreamStats { cap_bytes, ..Default::default() },
        }
    }

    pub fn is_allowed(&self, tile: &str) -> bool {
        self.allowed_tiles.contains(tile)
    }

    fn meta(&mut self, tile: &str) -> Option<&TileMeta> {
        if !self.metas.contains_key(tile) {
            let m = if self.allowed_tiles.contains(tile) { self.read_meta(tile) } else { None };
            self.metas.insert(tile.to_string(), m);
        }
        self.metas.get(tile).and_then(|m| m.as_ref())
    }

    fn read_meta(&self, tile: &str) -> Option<TileMeta> {
        let p = self.physics_dir.join(format!("{tile}-physics-v01")).join("index.json");
        let idx: TileIndex = serde_json::from_slice(&std::fs::read(p).ok()?).ok()?;
        if idx.schema != "wildhaven.physics.tile.v1" || idx.tile_id != tile {
            return None;
        }
        Some(TileMeta {
            chunk_meters: idx.chunk_meters,
            chunks: idx.chunks.into_iter().map(|c| ((c.ix, c.iz), c)).collect(),
        })
    }

    pub fn chunk_key_at(&mut self, x: f64, z: f64) -> Option<ChunkKey> {
        let tile = self.continent.tile_at(x, z)?.id.clone();
        let cm = self.meta(&tile)?.chunk_meters;
        Some((tile, (x / cm).floor() as i32, (z / cm).floor() as i32))
    }

    /// Garante o chunk residente (carrega e verifica se preciso).
    pub fn ensure(&mut self, key: &ChunkKey) -> Option<Arc<Chunk>> {
        self.clock += 1;
        let now = self.clock;
        if let Some((c, t)) = self.resident.get_mut(key) {
            *t = now;
            self.stats.hits += 1;
            return Some(c.clone());
        }
        self.stats.misses += 1;
        let (url, bytes, sha) = {
            let meta = self.meta(&key.0)?;
            let ic = meta.chunks.get(&(key.1, key.2))?;
            (ic.url.clone(), ic.bytes, ic.sha256.clone())
        };
        let path = self.physics_dir.join(format!("{}-physics-v01", key.0)).join(url);
        let packed = match std::fs::read(path) {
            Ok(p) => p,
            Err(_) => {
                self.stats.load_errors += 1;
                return None;
            }
        };
        let chunk = match decode_packed(&packed, bytes, &sha) {
            Ok(c) => Arc::new(c),
            Err(_) => {
                self.stats.load_errors += 1;
                return None;
            }
        };
        self.stats.resident_bytes += chunk.bytes_resident();
        self.resident.insert(key.clone(), (chunk.clone(), now));
        self.evict();
        Some(chunk)
    }

    fn evict(&mut self) {
        while self.stats.resident_bytes > self.stats.cap_bytes {
            let victim = self
                .resident
                .iter()
                .filter(|(k, _)| !self.pinned.contains(*k))
                .min_by_key(|(_, (_, t))| *t)
                .map(|(k, _)| k.clone());
            match victim {
                Some(k) => {
                    if let Some((c, _)) = self.resident.remove(&k) {
                        self.stats.resident_bytes -= c.bytes_resident();
                        self.stats.evictions += 1;
                    }
                }
                None => break, // tudo pinned: respeita a janela dos Hunters
            }
        }
        self.stats.resident_chunks = self.resident.len();
    }

    /// Recalcula as janelas: todos os chunks num raio `radius` de cada posição ficam pinned
    /// e são carregados. Devolve as chaves da janela (para o cliente/telemetria).
    pub fn update_windows(&mut self, positions: &[(f64, f64)], radius: f64) -> Vec<ChunkKey> {
        let mut want = HashSet::new();
        for &(x, z) in positions {
            let step = 128.0; // amostragem < 256 m de chunk para não pular chunks
            let n = (radius / step).ceil() as i32;
            for i in -n..=n {
                for j in -n..=n {
                    let (px, pz) = (x + i as f64 * step, z + j as f64 * step);
                    if ((px - x).powi(2) + (pz - z).powi(2)).sqrt() > radius + step {
                        continue;
                    }
                    if let Some(k) = self.chunk_key_at(px, pz) {
                        want.insert(k);
                    }
                }
            }
        }
        self.pinned = want.clone();
        let keys: Vec<ChunkKey> = want.into_iter().collect();
        for k in &keys {
            self.ensure(k);
        }
        self.stats.pinned_chunks = self.pinned.len();
        self.evict();
        keys
    }

    pub fn sample(&mut self, x: f64, z: f64) -> Option<Cell> {
        let key = self.chunk_key_at(x, z)?;
        let c = self.ensure(&key)?;
        let cell = c.cell(x, z)?;
        if cell.h.is_finite() {
            Some(cell)
        } else {
            None
        }
    }

    pub fn tile_id_at(&self, x: f64, z: f64) -> Option<String> {
        self.continent.tile_at(x, z).map(|t| t.id.clone())
    }
}
