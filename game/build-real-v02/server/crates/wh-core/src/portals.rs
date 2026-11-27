//! Portais de fronteira validados pelo `validate-portals.mjs` (relatório N/N).
//! Uma travessia entre hexes só é permitida dentro de um trecho validado.

use serde::Deserialize;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Deserialize)]
pub struct Portal {
    #[serde(rename = "widthMeters")]
    pub width_meters: f64,
    #[serde(rename = "centerX")]
    pub center_x: f64,
    #[serde(rename = "centerZ")]
    pub center_z: f64,
    #[serde(rename = "fromS")]
    pub from_s: f64,
    #[serde(rename = "toS")]
    pub to_s: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EdgeReport {
    pub a: String,
    pub b: String,
    pub status: String,
    #[serde(default)]
    pub portals: Vec<Portal>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TileReport {
    pub id: String,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PortalReport {
    pub schema: String,
    pub tiles: Vec<TileReport>,
    pub edges: Vec<EdgeReport>,
}

#[derive(Debug, Clone)]
pub struct PortalIndex {
    by_pair: HashMap<(String, String), Vec<Portal>>,
    pub certified: HashSet<String>,
}

fn pair(a: &str, b: &str) -> (String, String) {
    if a < b {
        (a.to_string(), b.to_string())
    } else {
        (b.to_string(), a.to_string())
    }
}

impl PortalIndex {
    pub fn from_report(r: PortalReport) -> Result<Self, String> {
        if r.schema != "wildhaven.continental.portal-report.v1" {
            return Err("schema de relatório de portais inesperado".into());
        }
        let mut by_pair = HashMap::new();
        for e in r.edges {
            if e.status == "validado" && !e.portals.is_empty() {
                by_pair.insert(pair(&e.a, &e.b), e.portals);
            }
        }
        let certified = r.tiles.into_iter().filter(|t| t.status == "certificado-tecnico").map(|t| t.id).collect();
        Ok(Self { by_pair, certified })
    }

    pub fn portals(&self, a: &str, b: &str) -> &[Portal] {
        self.by_pair.get(&pair(a, b)).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// O ponto (x,z) próximo à fronteira A|B está dentro de um trecho validado?
    /// `s` é a coordenada ao longo da aresta, medida como no validador (tangente = perpendicular
    /// à direção A→B com A < B na ordem do relatório não importa: usamos o centro do portal).
    pub fn crossing_allowed(&self, a: &str, b: &str, x: f64, z: f64, margin: f64) -> bool {
        self.portals(a, b).iter().any(|p| {
            let half = p.width_meters / 2.0 - margin;
            half > 0.0 && ((x - p.center_x).powi(2) + (z - p.center_z).powi(2)).sqrt() <= half
        })
    }

    pub fn neighbors_with_portals(&self, a: &str) -> Vec<(String, &[Portal])> {
        let mut v: Vec<(String, &[Portal])> = self
            .by_pair
            .iter()
            .filter_map(|((x, y), p)| {
                if x == a {
                    Some((y.clone(), p.as_slice()))
                } else if y == a {
                    Some((x.clone(), p.as_slice()))
                } else {
                    None
                }
            })
            .collect();
        v.sort_by(|l, r| l.0.cmp(&r.0));
        v
    }
}
