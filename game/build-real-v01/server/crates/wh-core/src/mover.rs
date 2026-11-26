//! Locomoção comum (Hunters, criaturas, carroças) sobre o terreno compilado:
//! subobjetivos de até `subgoal_m`, A* local, troca de hex só por portal validado,
//! posição global preservada e registro de travessias.

use crate::nav::{find_path, NavParams};
use crate::portals::PortalIndex;
use crate::terrain::TerrainStore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Crossing {
    pub tick: u64,
    pub sim_time_s: f64,
    pub from: String,
    pub to: String,
    pub x: f64,
    pub z: f64,
    /// Deslocamento no tick da travessia: prova de que não houve teleporte.
    pub step_m: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Mover {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub heading: f64,
    pub tile_id: String,
    pub crossings: Vec<Crossing>,
    pub distance_walked_m: f64,
    #[serde(skip)]
    pub path: Vec<(f64, f64)>,
    #[serde(skip)]
    pub path_idx: usize,
    #[serde(skip)]
    pub target: Option<(f64, f64)>,
    #[serde(skip)]
    pub fails: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    Arrived,
    Moving,
    /// Sem rota encontrada neste tick (o chamador decide se insiste ou desiste).
    Blocked,
}

impl Mover {
    pub fn new(x: f64, z: f64, tile: &str) -> Self {
        Self { x, z, tile_id: tile.into(), ..Default::default() }
    }

    pub fn dist(&self, x: f64, z: f64) -> f64 {
        ((self.x - x).powi(2) + (self.z - z).powi(2)).sqrt()
    }

    /// Define destino; só reinicia a rota se ele mudou mais de `tol` metros.
    pub fn go_to(&mut self, x: f64, z: f64, tol: f64) {
        let changed = match self.target {
            Some((tx, tz)) => ((tx - x).powi(2) + (tz - z).powi(2)).sqrt() > tol,
            None => true,
        };
        if changed {
            self.target = Some((x, z));
            self.path.clear();
            self.path_idx = 0;
            self.fails = 0;
        }
    }

    pub fn stop(&mut self) {
        self.target = None;
        self.path.clear();
        self.path_idx = 0;
    }

    fn plan(&mut self, t: &mut TerrainStore, portals: &PortalIndex, nav: &NavParams, subgoal_m: f64) -> bool {
        let Some((gx, gz)) = self.target else { return false };
        let (dx, dz) = (gx - self.x, gz - self.z);
        let d = (dx * dx + dz * dz).sqrt();
        let base = if d <= subgoal_m { (gx, gz) } else { (self.x + dx / d * subgoal_m, self.z + dz / d * subgoal_m) };
        let (nx, nz) = if d > 0.0 { (-dz / d, dx / d) } else { (0.0, 0.0) };
        let offsets: &[f64] = if d <= subgoal_m { &[0.0, 6.0, -6.0, 14.0, -14.0] } else { &[0.0, 24.0, -24.0, 48.0, -48.0, 96.0, -96.0] };
        for &off in offsets {
            let sub = (base.0 + nx * off, base.1 + nz * off);
            if let Some(path) = find_path(t, portals, nav, (self.x, self.z), sub) {
                self.path = path;
                // o 1º ponto é o centro da célula atual: pulá-lo evita passo para trás a cada replanejamento
                self.path_idx = if self.path.len() > 1 { 1 } else { 0 };
                return true;
            }
        }
        false
    }

    #[allow(clippy::too_many_arguments)]
    pub fn advance(
        &mut self,
        t: &mut TerrainStore,
        portals: &PortalIndex,
        nav: &NavParams,
        speed: f64,
        dt: f64,
        arrive_m: f64,
        subgoal_m: f64,
        tick: u64,
        sim_time: f64,
    ) -> Step {
        let Some((gx, gz)) = self.target else { return Step::Arrived };
        if self.dist(gx, gz) <= arrive_m {
            self.stop();
            return Step::Arrived;
        }
        if self.path_idx >= self.path.len() && !self.plan(t, portals, nav, subgoal_m) {
            self.fails += 1;
            return Step::Blocked;
        }
        let mut budget = speed * dt;
        let (sx, sz) = (self.x, self.z);
        while budget > 1e-9 && self.path_idx < self.path.len() {
            let (wx, wz) = self.path[self.path_idx];
            let (dx, dz) = (wx - self.x, wz - self.z);
            let d = (dx * dx + dz * dz).sqrt();
            if d > 1e-9 {
                self.heading = dx.atan2(dz);
            }
            if d <= budget {
                self.x = wx;
                self.z = wz;
                budget -= d;
                self.path_idx += 1;
            } else {
                self.x += dx / d * budget;
                self.z += dz / d * budget;
                budget = 0.0;
            }
        }
        let step = ((self.x - sx).powi(2) + (self.z - sz).powi(2)).sqrt();
        self.distance_walked_m += step;
        if let Some(c) = t.sample(self.x, self.z) {
            self.y = c.h;
        }
        if let Some(now) = t.tile_id_at(self.x, self.z) {
            if now != self.tile_id {
                self.crossings.push(Crossing { tick, sim_time_s: sim_time, from: self.tile_id.clone(), to: now.clone(), x: self.x, z: self.z, step_m: step });
                if self.crossings.len() > 64 {
                    self.crossings.remove(0);
                }
                self.tile_id = now;
            }
        }
        self.fails = 0;
        Step::Moving
    }

    /// Acompanha outro corpo (passageiro na carroça, ferido carregado). Sem física própria.
    pub fn attach_to(&mut self, other: &Mover, back_m: f64) {
        self.x = other.x - other.heading.sin() * back_m;
        self.z = other.z - other.heading.cos() * back_m;
        self.y = other.y;
        self.heading = other.heading;
        self.tile_id = other.tile_id.clone();
    }

    pub fn snap_y(&mut self, t: &mut TerrainStore) {
        if let Some(c) = t.sample(self.x, self.z) {
            self.y = c.h;
        }
    }
}
