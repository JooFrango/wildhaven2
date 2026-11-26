//! Simulação autoritativa: passo fixo, janelas de streaming por Hunter, snapshot v1.

use crate::clock::{ClockState, WorldClock};
use crate::hunter::{AiParams, Hunter};
use crate::nav::NavParams;
use crate::portals::PortalIndex;
use crate::terrain::{StreamStats, TerrainStore};
use serde::Serialize;

pub const SNAPSHOT_SCHEMA: &str = "wildhaven.snapshot.v1";
/// Mesmo passo da Alpha (`STEP = 0.2`), para paridade de futuras fatias portadas.
pub const STEP_SECONDS: f64 = 0.2;

pub struct World {
    pub clock: WorldClock,
    pub terrain: TerrainStore,
    pub portals: PortalIndex,
    pub hunters: Vec<Hunter>,
    pub tick: u64,
    pub sim_time_s: f64,
    pub window_radius_m: f64,
    pub nav: NavParams,
    pub ai: AiParams,
    pub window: Vec<(String, i32, i32)>,
}

#[derive(Debug, Serialize)]
pub struct WindowChunk {
    pub tile: String,
    pub ix: i32,
    pub iz: i32,
}

#[derive(Debug, Serialize)]
pub struct Snapshot<'a> {
    pub schema: &'static str,
    pub tick: u64,
    pub sim_time_s: f64,
    pub clock: ClockState,
    pub hunters: &'a [Hunter],
    pub streaming: StreamStats,
    pub window: Vec<WindowChunk>,
}

impl World {
    pub fn new(clock: WorldClock, terrain: TerrainStore, portals: PortalIndex, hunters: Vec<Hunter>) -> Self {
        Self {
            clock,
            terrain,
            portals,
            hunters,
            tick: 0,
            sim_time_s: 0.0,
            window_radius_m: 384.0,
            nav: NavParams::default(),
            ai: AiParams::default(),
            window: vec![],
        }
    }

    pub fn step(&mut self) {
        self.tick += 1;
        self.sim_time_s = self.tick as f64 * STEP_SECONDS;
        let pos: Vec<(f64, f64)> = self.hunters.iter().map(|h| (h.x, h.z)).collect();
        self.window = self.terrain.update_windows(&pos, self.window_radius_m);
        for h in self.hunters.iter_mut() {
            h.step(&mut self.terrain, &self.portals, &self.nav, &self.ai, STEP_SECONDS, self.tick, self.sim_time_s);
        }
    }

    pub fn snapshot(&self, now_ms: u64) -> Snapshot<'_> {
        let mut window: Vec<WindowChunk> =
            self.window.iter().map(|(t, ix, iz)| WindowChunk { tile: t.clone(), ix: *ix, iz: *iz }).collect();
        window.sort_by(|a, b| (&a.tile, a.ix, a.iz).cmp(&(&b.tile, b.ix, b.iz)));
        Snapshot {
            schema: SNAPSHOT_SCHEMA,
            tick: self.tick,
            sim_time_s: self.sim_time_s,
            clock: self.clock.state(now_ms),
            hunters: &self.hunters,
            streaming: self.terrain.stats.clone(),
            window,
        }
    }
}
