//! Simulação autoritativa: passo fixo, janelas de streaming por ator (Hunters e
//! carroças, nunca a câmera), gameplay e snapshot v1 (campos de gameplay aditivos).

use crate::clock::{ClockState, WorldClock};
use crate::data::GameData;
use crate::game::{Ctx, GameState, GameView, Order};
use crate::hunter::Hunter;
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
    pub data: GameData,
    pub game: GameState,
    pub tick: u64,
    pub sim_time_s: f64,
    pub window_radius_m: f64,
    pub nav: NavParams,
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
    pub game: GameView<'a>,
}

impl World {
    pub fn new(clock: WorldClock, terrain: TerrainStore, portals: PortalIndex, data: GameData, game: GameState) -> Self {
        Self { clock, terrain, portals, data, game, tick: 0, sim_time_s: 0.0, window_radius_m: 384.0, nav: NavParams::default(), window: vec![] }
    }

    pub fn ctx_run<R>(&mut self, f: impl FnOnce(&mut GameState, &mut Ctx) -> R) -> R {
        let mut ctx = Ctx { t: &mut self.terrain, portals: &self.portals, nav: &self.nav, data: &self.data, dt: STEP_SECONDS, tick: self.tick, now: self.sim_time_s };
        f(&mut self.game, &mut ctx)
    }

    pub fn order(&mut self, o: Order) -> Result<String, String> {
        self.ctx_run(|g, c| g.order(o, c))
    }

    pub fn step(&mut self) {
        self.tick += 1;
        self.sim_time_s = self.tick as f64 * STEP_SECONDS;
        let pos = self.game.actor_positions();
        self.window = self.terrain.update_windows(&pos, self.window_radius_m);
        self.ctx_run(|g, c| g.step(c));
    }

    pub fn snapshot(&self, now_ms: u64) -> Snapshot<'_> {
        let mut window: Vec<WindowChunk> = self.window.iter().map(|(t, ix, iz)| WindowChunk { tile: t.clone(), ix: *ix, iz: *iz }).collect();
        window.sort_by(|a, b| (&a.tile, a.ix, a.iz).cmp(&(&b.tile, b.ix, b.iz)));
        Snapshot {
            schema: SNAPSHOT_SCHEMA,
            tick: self.tick,
            sim_time_s: self.sim_time_s,
            clock: self.clock.state(now_ms),
            hunters: &self.game.hunters,
            streaming: self.terrain.stats.clone(),
            window,
            game: self.game.view(&self.data),
        }
    }
}
