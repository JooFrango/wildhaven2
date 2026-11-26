//! Hunter autônomo — primeira fatia da Fase 2.
//! Sem controle direto: o jogador não move o Hunter. A IA escolhe um destino em um hex
//! vizinho através de um portal validado, planeja com A* sobre o terreno compilado e
//! caminha na velocidade EXTRAÍDA do clipe `Walking` do GLB do workshop.
//! A posição é global (f64) e não é alterada pela troca de hex.

use crate::nav::{find_path, NavParams};
use crate::portals::PortalIndex;
use crate::rng::XorShift32;
use crate::terrain::TerrainStore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HunterState {
    Planejando,
    Caminhando,
    Descansando,
    SemRota,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub tile: String,
    pub x: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hunter {
    pub id: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub heading: f64,
    pub tile_id: String,
    pub state: HunterState,
    pub clip: String,
    pub speed_mps: f64,
    pub goal: Option<Goal>,
    #[serde(skip)]
    pub path: Vec<(f64, f64)>,
    #[serde(skip)]
    pub path_idx: usize,
    pub rest_until_s: f64,
    pub crossings: Vec<Crossing>,
    pub distance_walked_m: f64,
    pub plan_failures: u32,
    pub rng_state: u32,
}

/// Parâmetros de comportamento. Valores de tempo/distância são PROPOSTAS desta fatia,
/// não regras aprovadas; a velocidade não é parâmetro: vem do clipe.
#[derive(Debug, Clone, Copy)]
pub struct AiParams {
    pub subgoal_max_m: f64,
    pub beyond_portal_m: f64,
    pub arrive_m: f64,
    pub rest_min_s: f64,
    pub rest_max_s: f64,
}
impl Default for AiParams {
    fn default() -> Self {
        Self { subgoal_max_m: 120.0, beyond_portal_m: 30.0, arrive_m: 3.0, rest_min_s: 5.0, rest_max_s: 15.0 }
    }
}

impl Hunter {
    pub fn new(id: &str, name: &str, x: f64, z: f64, tile_id: &str, walk_speed_mps: f64, seed: u32) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            x,
            y: 0.0,
            z,
            heading: 0.0,
            tile_id: tile_id.into(),
            state: HunterState::Planejando,
            clip: "Walking".into(),
            speed_mps: walk_speed_mps,
            goal: None,
            path: vec![],
            path_idx: 0,
            rest_until_s: 0.0,
            crossings: vec![],
            distance_walked_m: 0.0,
            plan_failures: 0,
            rng_state: seed.max(1),
        }
    }

    fn rng(&mut self) -> f64 {
        let mut r = XorShift32::new(self.rng_state);
        let v = r.next_f64();
        self.rng_state = r.state;
        v
    }

    fn choose_goal(&mut self, t: &mut TerrainStore, portals: &PortalIndex, ai: &AiParams) -> Option<Goal> {
        let options: Vec<(String, f64, f64)> = portals
            .neighbors_with_portals(&self.tile_id)
            .into_iter()
            .filter(|(n, _)| t.is_allowed(n))
            .flat_map(|(n, ps)| ps.iter().map(move |p| (n.clone(), p.center_x, p.center_z)).collect::<Vec<_>>())
            .collect();
        if options.is_empty() {
            return None;
        }
        let k = ((self.rng() * options.len() as f64) as usize).min(options.len() - 1);
        let (tile, px, pz) = options[k].clone();
        let to = t.continent.tile(&tile)?;
        let from = t.continent.tile(&self.tile_id)?;
        let (dx, dz) = (to.x - from.x, to.z - from.z);
        let d = (dx * dx + dz * dz).sqrt();
        Some(Goal { tile, x: px + dx / d * ai.beyond_portal_m, z: pz + dz / d * ai.beyond_portal_m })
    }

    fn plan(&mut self, t: &mut TerrainStore, portals: &PortalIndex, nav: &NavParams, ai: &AiParams) -> bool {
        let Some(goal) = self.goal.clone() else { return false };
        let (dx, dz) = (goal.x - self.x, goal.z - self.z);
        let d = (dx * dx + dz * dz).sqrt();
        let base = if d <= ai.subgoal_max_m { (goal.x, goal.z) } else { (self.x + dx / d * ai.subgoal_max_m, self.z + dz / d * ai.subgoal_max_m) };
        // tenta o subobjetivo direto e, se falhar, deslocamentos laterais determinísticos
        let (nx, nz) = if d > 0.0 { (-dz / d, dx / d) } else { (0.0, 0.0) };
        for off in [0.0, 24.0, -24.0, 48.0, -48.0, 96.0, -96.0] {
            let sub = (base.0 + nx * off, base.1 + nz * off);
            if let Some(path) = find_path(t, portals, nav, (self.x, self.z), sub) {
                self.path = path;
                self.path_idx = 0;
                return true;
            }
        }
        false
    }

    pub fn step(&mut self, t: &mut TerrainStore, portals: &PortalIndex, nav: &NavParams, ai: &AiParams, dt: f64, tick: u64, sim_time: f64) {
        if let Some(c) = t.sample(self.x, self.z) {
            self.y = c.h;
        }
        match self.state {
            HunterState::Descansando => {
                self.clip = "Idle".into();
                if sim_time >= self.rest_until_s {
                    self.state = HunterState::Planejando;
                }
            }
            HunterState::SemRota => {
                self.clip = "Idle".into();
            }
            HunterState::Planejando => {
                if self.goal.is_none() {
                    self.goal = self.choose_goal(t, portals, ai);
                    if self.goal.is_none() {
                        self.state = HunterState::SemRota;
                        return;
                    }
                }
                if self.plan(t, portals, nav, ai) {
                    self.state = HunterState::Caminhando;
                } else {
                    self.plan_failures += 1;
                    self.goal = None; // tenta outro portal no próximo tick
                    if self.plan_failures > 24 {
                        self.state = HunterState::SemRota;
                    }
                }
            }
            HunterState::Caminhando => {
                self.clip = "Walking".into();
                let mut budget = self.speed_mps * dt;
                let (sx, sz) = (self.x, self.z);
                while budget > 1e-9 && self.path_idx < self.path.len() {
                    let (wx, wz) = self.path[self.path_idx];
                    let (dx, dz) = (wx - self.x, wz - self.z);
                    let d = (dx * dx + dz * dz).sqrt();
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
                    if d > 1e-9 {
                        self.heading = dx.atan2(dz);
                    }
                }
                let step = ((self.x - sx).powi(2) + (self.z - sz).powi(2)).sqrt();
                self.distance_walked_m += step;
                if let Some(c) = t.sample(self.x, self.z) {
                    self.y = c.h;
                }
                // troca de região: posição global intacta, apenas o hex de residência muda
                if let Some(now) = t.tile_id_at(self.x, self.z) {
                    if now != self.tile_id {
                        self.crossings.push(Crossing {
                            tick,
                            sim_time_s: sim_time,
                            from: self.tile_id.clone(),
                            to: now.clone(),
                            x: self.x,
                            z: self.z,
                            step_m: step,
                        });
                        self.tile_id = now;
                    }
                }
                if self.path_idx >= self.path.len() {
                    let arrived = self
                        .goal
                        .as_ref()
                        .map(|g| ((g.x - self.x).powi(2) + (g.z - self.z).powi(2)).sqrt() <= ai.arrive_m)
                        .unwrap_or(true);
                    if arrived {
                        self.goal = None;
                        self.plan_failures = 0;
                        self.state = HunterState::Descansando;
                        let r = self.rng();
                        self.rest_until_s = sim_time + ai.rest_min_s + r * (ai.rest_max_s - ai.rest_min_s);
                    } else {
                        self.state = HunterState::Planejando;
                    }
                }
            }
        }
    }
}
