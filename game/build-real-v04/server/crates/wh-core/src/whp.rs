//! Leitor WHP1 (formato do compilador `build real/continental/compiler/physics.mjs`).
//! Header de 36 bytes + alturas f32 + água f32 + bloqueio u8 + cobertura u8, little-endian.
//! O pacote `.whp.gz` é verificado por SHA-256 antes de descompactar.

use flate2::read::GzDecoder;
use sha2::{Digest, Sha256};
use std::io::Read;

pub const MAGIC: &[u8; 4] = b"WHP1";
pub const HEADER_BYTES: usize = 36;

#[derive(Debug, Clone)]
pub struct Chunk {
    pub res: u16,
    pub nx: u16,
    pub nz: u16,
    pub x0: f64,
    pub z0: f64,
    pub base_y: f64,
    pub heights: Vec<f32>,
    pub water: Vec<f32>,
    pub blocked: Vec<u8>,
    pub cover: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Cell {
    /// Altura absoluta do terreno (m, mesmo datum dos GLBs); NaN = sem chão.
    pub h: f64,
    /// Superfície de água acima do chão, se houver.
    pub water: Option<f64>,
    pub blocked: bool,
    pub cover: u8,
}

#[derive(Debug)]
pub enum WhpError {
    Sha256Mismatch,
    ByteLength,
    Gzip(String),
    Magic,
    Dimensions,
}

impl std::fmt::Display for WhpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for WhpError {}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let d = Sha256::digest(bytes);
    d.iter().map(|b| format!("{b:02x}")).collect()
}

/// Verifica bytes + SHA-256 do arquivo comprimido e decodifica.
pub fn decode_packed(packed: &[u8], expected_bytes: usize, expected_sha256: &str) -> Result<Chunk, WhpError> {
    if packed.len() != expected_bytes {
        return Err(WhpError::ByteLength);
    }
    if sha256_hex(packed) != expected_sha256.to_ascii_lowercase() {
        return Err(WhpError::Sha256Mismatch);
    }
    let mut raw = Vec::new();
    GzDecoder::new(packed).read_to_end(&mut raw).map_err(|e| WhpError::Gzip(e.to_string()))?;
    decode_raw(&raw)
}

pub fn decode_raw(b: &[u8]) -> Result<Chunk, WhpError> {
    if b.len() < HEADER_BYTES || &b[0..4] != MAGIC {
        return Err(WhpError::Magic);
    }
    let u16_at = |o: usize| u16::from_le_bytes([b[o], b[o + 1]]);
    let f64_at = |o: usize| f64::from_le_bytes(b[o..o + 8].try_into().unwrap());
    let version = u16_at(4);
    let (res, nx, nz) = (u16_at(6), u16_at(8), u16_at(10));
    let n = nx as usize * nz as usize;
    if version != 1 || res == 0 || nx == 0 || nz == 0 || b.len() != HEADER_BYTES + n * 10 {
        return Err(WhpError::Dimensions);
    }
    let mut o = HEADER_BYTES;
    let mut f32s = |count: usize| {
        let v: Vec<f32> = (0..count)
            .map(|i| f32::from_le_bytes(b[o + i * 4..o + i * 4 + 4].try_into().unwrap()))
            .collect();
        o += count * 4;
        v
    };
    let heights = f32s(n);
    let water = f32s(n);
    let blocked = b[o..o + n].to_vec();
    let cover = b[o + n..o + 2 * n].to_vec();
    Ok(Chunk { res, nx, nz, x0: f64_at(12), z0: f64_at(20), base_y: f64_at(28), heights, water, blocked, cover })
}

impl Chunk {
    pub fn bytes_resident(&self) -> usize {
        self.heights.len() * 10
    }
    pub fn cell(&self, x: f64, z: f64) -> Option<Cell> {
        let r = self.res as f64;
        let i = ((x - self.x0) / r).floor();
        let j = ((z - self.z0) / r).floor();
        if i < 0.0 || j < 0.0 || i >= self.nx as f64 || j >= self.nz as f64 {
            return None;
        }
        let k = j as usize * self.nx as usize + i as usize;
        let h = self.heights[k] as f64 + self.base_y;
        let w = self.water[k];
        Some(Cell {
            h,
            water: if w.is_finite() { Some(w as f64 + self.base_y) } else { None },
            blocked: self.blocked[k] == 1,
            cover: self.cover[k],
        })
    }
}
