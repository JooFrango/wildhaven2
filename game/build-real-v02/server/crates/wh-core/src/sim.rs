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
    /// Relógio universal: o servidor informa a hora real; sem isso (sim-check) usa época + tempo simulado.
    pub clock_now_ms: Option<u64>,
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
        Self { clock, terrain, portals, data, game, tick: 0, sim_time_s: 0.0, window_radius_m: 384.0, nav: NavParams::default(), window: vec![], clock_now_ms: None }
    }

    pub fn ctx_run<R>(&mut self, f: impl FnOnce(&mut GameState, &mut Ctx) -> R) -> R {
        let now_ms = self.clock_now_ms.unwrap_or(self.clock.epoch_ms + (self.sim_time_s * 1000.0) as u64);
        let cs = self.clock.state(now_ms);
        let night = cs.phase == crate::clock::Phase::Night;
        let phase_frac = cs.phase_elapsed_s / (cs.phase_elapsed_s + cs.phase_remaining_s).max(1.0);
        let moon = crate::climate::Climate::moon_phase(cs.cycle, cs.cycle_fraction, self.data.clima.ciclo_lunar_ciclos);
        let mut ctx = Ctx { t: &mut self.terrain, portals: &self.portals, nav: &self.nav, data: &self.data, dt: STEP_SECONDS, tick: self.tick, now: self.sim_time_s, night, phase_frac, moon };
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
        let t0 = std::time::Instant::now();
        self.ctx_run(|g, c| g.step(c));
        let ms = t0.elapsed().as_secs_f64() * 1000.0;
        let m = &mut self.game.metrics;
        m.tick_ms = ms;
        m.tick_ms_max = m.tick_ms_max.max(ms);
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
