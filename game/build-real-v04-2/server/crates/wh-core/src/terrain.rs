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
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;

/// V03: pedido de leitura+verificação+descompressão de um chunk em thread auxiliar (fora do lock do mundo).
struct LoadReq {
    key: ChunkKey,
    path: PathBuf,
    bytes: usize,
    sha: String,
}
struct Prefetch {
    tx: Sender<LoadReq>,
    rx: Receiver<(ChunkKey, Option<Chunk>)>,
    inflight: HashSet<ChunkKey>,
}
impl Prefetch {
    fn spawn() -> Self {
        let (tx, wrx) = channel::<LoadReq>();
        let (wtx, rx) = channel();
        std::thread::Builder::new()
            .name("wh-terrain-io".into())
            .spawn(move || {
                while let Ok(r) = wrx.recv() {
                    let c = std::fs::read(&r.path).ok().and_then(|p| decode_packed(&p, r.bytes, &r.sha).ok());
                    if wtx.send((r.key, c)).is_err() {
                        break;
                    }
                }
            })
            .expect("thread de E/S do terreno");
        Self { tx, rx, inflight: HashSet::new() }
    }
}

/// V03: último chunk amostrado (sem alocar `String` nem consultar o mapa por amostra).
struct LastChunk {
    tile: usize,
    ix: i32,
    iz: i32,
    cm: f64,
    chunk: Arc<Chunk>,
    key: ChunkKey,
    uses: u32,
}

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
    /// V03: chunks lidos pela thread auxiliar (pré-carga da janela) e leituras síncronas no tick.
    #[serde(default)]
    pub prefetched: u64,
    #[serde(default)]
    pub sync_loads: u64,
    #[serde(default)]
    pub inflight: usize,
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
    prefetch: Option<Prefetch>,
    last: Option<LastChunk>,
    /// Posições usadas no último cálculo de janelas (recalcula só quando algum ator anda > 16 m).
    last_window_pos: Vec<(f64, f64)>,
    last_window_keys: Vec<ChunkKey>,
    routable_extra: HashSet<String>,
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
            prefetch: None,
            last: None,
            last_window_pos: vec![],
            last_window_keys: vec![],
            routable_extra: HashSet::new(),
        }
    }

    /// V03: liga a pré-carga em thread auxiliar (servidor). Sem ela (testes), tudo é síncrono e idêntico.
    pub fn enable_prefetch(&mut self) {
        if self.prefetch.is_none() {
            self.prefetch = Some(Prefetch::spawn());
        }
    }

    /// Recebe chunks já decodificados pela thread auxiliar.
    pub fn drain_prefetch(&mut self) {
        let Some(pf) = self.prefetch.as_mut() else { return };
        let mut got = vec![];
        while let Ok((k, c)) = pf.rx.try_recv() {
            pf.inflight.remove(&k);
            got.push((k, c));
        }
        self.stats.inflight = pf.inflight.len();
        for (k, c) in got {
            match c {
                Some(c) if !self.resident.contains_key(&k) => {
                    self.clock += 1;
                    let c = Arc::new(c);
                    self.stats.resident_bytes += c.bytes_resident();
                    self.stats.prefetched += 1;
                    self.resident.insert(k, (c, self.clock));
                }
                Some(_) => {}
                None => self.stats.load_errors += 1,
            }
        }
        self.evict();
    }

    fn locate(&mut self, key: &ChunkKey) -> Option<(PathBuf, usize, String)> {
        let meta = self.meta(&key.0)?;
        let ic = meta.chunks.get(&(key.1, key.2))?;
        let (url, bytes, sha) = (ic.url.clone(), ic.bytes, ic.sha256.clone());
        Some((self.physics_dir.join(format!("{}-physics-v01", key.0)).join(url), bytes, sha))
    }

    /// Pede o chunk à thread auxiliar (ou carrega já, sem pré-carga). Não bloqueia com pré-carga.
    pub fn request(&mut self, key: &ChunkKey) {
        if self.resident.contains_key(key) {
            return;
        }
        if self.prefetch.as_ref().map(|p| p.inflight.contains(key)).unwrap_or(false) {
            return;
        }
        if self.prefetch.is_none() {
            self.ensure(key);
            return;
        }
        let Some((path, bytes, sha)) = self.locate(key) else { return };
        let pf = self.prefetch.as_mut().unwrap();
        pf.inflight.insert(key.clone());
        let _ = pf.tx.send(LoadReq { key: key.clone(), path, bytes, sha });
    }

    fn spawn_prefetch_has_room(&self) -> bool {
        let limit = (self.stats.cap_bytes / (128 * 128 * 10) / 4).min(192);
        self.prefetch.as_ref().is_some_and(|p| p.inflight.len() < limit)
    }

    pub fn warm_spawn_point(&mut self, x: f64, z: f64) {
        if !self.spawn_prefetch_has_room() { return; }
        if let Some(k) = self.chunk_key_at(x, z) { self.request(&k); }
    }

    /// O chunk que contém (x,z) está residente? Se não, pede (assíncrono). Ponto fora de tile liberado: true.
    pub fn ready_at(&mut self, x: f64, z: f64) -> bool {
        let Some(k) = self.chunk_key_at(x, z) else { return true };
        if self.meta(&k.0).map(|m| !m.chunks.contains_key(&(k.1, k.2))).unwrap_or(true) {
            return true; // sem chunk no pacote: a amostragem devolve None sem E/S
        }
        if self.resident.contains_key(&k) {
            return true;
        }
        self.request(&k);
        self.resident.contains_key(&k)
    }

    pub fn is_allowed(&self, tile: &str) -> bool {
        self.allowed_tiles.contains(tile)
    }
    /// V04: hex certificado para rotas, ainda que o pacote local não tenha chegado (distribuição modular).
    pub fn is_routable(&self, tile: &str) -> bool {
        self.allowed_tiles.contains(tile) || self.routable_extra.contains(tile)
    }
    pub fn set_routable_extra(&mut self, tiles: HashSet<String>) {
        self.routable_extra = tiles;
    }
    /// V04: o pacote do hex chegou ao cache local — passa a ser simulado (física disponível).
    pub fn make_present(&mut self, tile: &str) {
        self.routable_extra.remove(tile);
        self.allowed_tiles.insert(tile.to_string());
        self.metas.remove(tile);
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
        let (path, bytes, sha) = self.locate(key)?;
        self.stats.sync_loads += 1;
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
                    if self.last.as_ref().map(|l| l.key == k).unwrap_or(false) {
                        self.last = None;
                    }
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
        self.drain_prefetch();
        // V03: a janela (raio + margem de 128 m) só muda quando algum ator anda > 16 m: reaproveita.
        let same = positions.len() == self.last_window_pos.len()
            && positions.iter().zip(&self.last_window_pos).all(|(a, b)| (a.0 - b.0).abs() < 16.0 && (a.1 - b.1).abs() < 16.0);
        if same && !self.last_window_keys.is_empty() {
            if self.prefetch.is_some() {
                let keys = self.last_window_keys.clone();
                for k in &keys {
                    self.request(k);
                }
            }
            return self.last_window_keys.clone();
        }
        self.last_window_pos = positions.to_vec();
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
            if self.prefetch.is_some() { self.request(k) } else { self.ensure(k); }
        }
        self.stats.pinned_chunks = self.pinned.len();
        self.evict();
        self.last_window_keys = keys.clone();
        keys
    }

    /// A célula pertence ao hex que contém o seu CENTRO (cada tile só rasteriza células
    /// cujo centro está dentro da sua malha; a grade é global e alinhada entre tiles).
    pub fn sample(&mut self, x: f64, z: f64) -> Option<Cell> {
        let first = self.sample_in(x, z, x, z);
        if first.is_some() {
            return first;
        }
        let r = self.cell_meters();
        let (cx, cz) = (((x / r).floor() + 0.5) * r, ((z / r).floor() + 0.5) * r);
        self.sample_in(cx, cz, x, z)
    }

    fn cell_meters(&self) -> f64 {
        2.0 // resolução do lote 272 (--res 2); conferida no índice de cada chunk
    }

    fn sample_in(&mut self, tx: f64, tz: f64, x: f64, z: f64) -> Option<Cell> {
        // V03: atalho — mesmo tile (ponteiro do manifesto imutável) e mesmo índice de chunk do último acesso.
        let tile_ptr = self.continent.tile_at(tx, tz).map(|t| t as *const _ as usize);
        if let (Some(tp), Some(l)) = (tile_ptr, self.last.as_mut()) {
            if l.tile == tp {
                let cm = l.cm;
                if (tx / cm).floor() as i32 == l.ix && (tz / cm).floor() as i32 == l.iz {
                    self.stats.hits += 1;
                    l.uses += 1;
                    let c = l.chunk.clone();
                    if l.uses % 64 == 0 {
                        self.clock += 1;
                        let now = self.clock;
                        let key = l.key.clone();
                        if let Some((_, t)) = self.resident.get_mut(&key) { *t = now; }
                    }
                    return Self::cell_of(&c, x, z);
                }
            }
        }
        let key = self.chunk_key_at(tx, tz)?;
        let c = self.ensure(&key)?;
        if let Some(tp) = tile_ptr {
            let cm = self.meta(&key.0).map(|m| m.chunk_meters).unwrap_or(256.0);
            self.last = Some(LastChunk { tile: tp, ix: key.1, iz: key.2, cm, chunk: c.clone(), key, uses: 0 });
        }
        Self::cell_of(&c, x, z)
    }

    fn cell_of(c: &Chunk, x: f64, z: f64) -> Option<Cell> {
        if c.res as f64 != 2.0 {
            return None;
        }
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
