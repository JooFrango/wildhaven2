//! Geometria do continente: hexágonos pointy-top, 5.000 m de ponta a ponta
//! (raio 2.500 m) e 4.330,127 m de face a face, conforme o manifesto e conforme
//! MEDIDO nos GLBs reais pelo validador de portais.

use serde::Deserialize;
use std::collections::HashMap;

pub const HEX_RADIUS: f64 = 2500.0;
pub const SQRT3: f64 = 1.732_050_807_568_877_2;

#[derive(Debug, Clone, Deserialize)]
pub struct ManifestTile {
    pub id: String,
    pub x: f64,
    pub z: f64,
    pub biome: String,
}

#[derive(Debug, Deserialize)]
pub struct Manifest {
    pub schema: String,
    pub tiles: Vec<ManifestTile>,
    pub edges: Vec<(String, String)>,
}

/// Converte posição global → coordenada axial (q, r) arredondada.
pub fn axial_of(x: f64, z: f64) -> (i32, i32) {
    let r = z / (1.5 * HEX_RADIUS);
    let q = x / (SQRT3 * HEX_RADIUS) - r / 2.0;
    cube_round(q, r)
}

pub fn center_of(q: i32, r: i32) -> (f64, f64) {
    (SQRT3 * HEX_RADIUS * (q as f64 + r as f64 / 2.0), 1.5 * HEX_RADIUS * r as f64)
}

fn cube_round(q: f64, r: f64) -> (i32, i32) {
    let s = -q - r;
    let (mut rq, mut rr, rs) = (q.round(), r.round(), s.round());
    let (dq, dr, ds) = ((rq - q).abs(), (rr - r).abs(), (rs - s).abs());
    if dq > dr && dq > ds {
        rq = -rr - rs;
    } else if dr > ds {
        rr = -rq - rs;
    }
    (rq as i32, rr as i32)
}

#[derive(Debug, Clone)]
pub struct Continent {
    pub tiles: Vec<ManifestTile>,
    by_axial: HashMap<(i32, i32), usize>,
    by_id: HashMap<String, usize>,
    pub edges: Vec<(String, String)>,
}

impl Continent {
    pub fn from_manifest(m: Manifest) -> Result<Self, String> {
        if m.schema != "wildhaven.continent.manifest.v1" {
            return Err("schema de manifesto inesperado".into());
        }
        let mut by_axial = HashMap::new();
        let mut by_id = HashMap::new();
        for (i, t) in m.tiles.iter().enumerate() {
            let a = axial_of(t.x, t.z);
            let (cx, cz) = center_of(a.0, a.1);
            if (cx - t.x).abs() > 1.0 || (cz - t.z).abs() > 1.0 {
                return Err(format!("tile {} fora da grade hexagonal", t.id));
            }
            if by_axial.insert(a, i).is_some() {
                return Err(format!("dois tiles na mesma célula axial: {}", t.id));
            }
            by_id.insert(t.id.clone(), i);
        }
        Ok(Self { tiles: m.tiles, by_axial, by_id, edges: m.edges })
    }
    pub fn tile_at(&self, x: f64, z: f64) -> Option<&ManifestTile> {
        self.by_axial.get(&axial_of(x, z)).map(|&i| &self.tiles[i])
    }
    pub fn tile(&self, id: &str) -> Option<&ManifestTile> {
        self.by_id.get(id).map(|&i| &self.tiles[i])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn axial_roundtrip_and_borders() {
        for q in -8..8 {
            for r in -8..8 {
                let (x, z) = center_of(q, r);
                assert_eq!(axial_of(x, z), (q, r));
                // 2.000 m dentro do hex continua no mesmo hex (apótema = 2.165 m)
                assert_eq!(axial_of(x + 2000.0, z), (q, r));
            }
        }
        // vizinho leste a 4.330,127 m
        let (x, _) = center_of(1, 0);
        assert!((x - 4330.127).abs() < 0.001);
    }
}
