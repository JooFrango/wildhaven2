//! wh-bench — benchmark reproduzível do CUSTO COMPLETO do servidor (V03), sem rede.
//!
//!   cargo run --release -p wh-server --bin wh-bench -- saida.json [lotes_x1] [modo]
//!
//! Reproduz o laço do servidor: a cada intervalo de 200 ms, `escala` passos de simulação e
//! (modo `v02`) a serialização do snapshot completo, ou (modo `v03`) o snapshot imutável +
//! delta. Mede separadamente: janelas físicas (streaming WHP1), gameplay, montagem da visão,
//! serialização e bytes; p50/p95/p99/máx por fase, para ×1, ×5, ×10 e ×50.
//! Roteiro fixo (semente do spawn): todos os Hunters exploram; mesma ordem e mesmo mundo.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;
use wh_core::clock::WorldClock;
use wh_core::data::GameData;
use wh_core::game::{GameState, Order};
use wh_core::hex::{Continent, Manifest};
use wh_core::portals::{PortalIndex, PortalReport};
use wh_core::sim::World;
use wh_core::terrain::TerrainStore;

fn boot(root: &std::path::Path) -> Result<World, Box<dyn std::error::Error>> {
    let manifest: Manifest = serde_json::from_slice(&std::fs::read(root.join("build real/continental/data/continent-272.manifest.json"))?)?;
    let report: PortalReport = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v04/data/relatorio-continental-272-v04.json"))?)?;
    let portals = PortalIndex::from_report(report)?;
    let continent = Arc::new(Continent::from_manifest(manifest)?);
    let physics_dir = root.join(".generated/physics-272-v04");
    let allowed: HashSet<String> = portals.certified.iter().filter(|t| physics_dir.join(format!("{t}-physics-v01")).join("index.json").is_file()).cloned().collect();
    let speeds: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v04/data/hunter-pve-v01-clip-speeds.json"))?)?;
    let walk = speeds["clips"].as_array().unwrap().iter().find(|c| c["name"] == "Walking").unwrap()["speedMetersPerSecond"].as_f64().unwrap();
    let spawn: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v04/data/spawn-v02.json"))?)?;
    let s = &spawn["hunters"][0];
    let mut data = GameData::from_slice(&std::fs::read(root.join("game/build-real-v04/data/gameplay-provisorio-v04.json"))?)?;
    // V03: WH_SPAWN_GRUPOS=0 reproduz a geração da V02 (hex inteiro num único tick) para comparação exata
    if let Some(g) = std::env::var("WH_SPAWN_GRUPOS").ok().and_then(|v| v.parse::<u32>().ok()) {
        data.relevancia.orcamento_spawn_grupos = if g == 0 { u32::MAX } else { g };
    }
    let mut terrain = TerrainStore::new(continent, physics_dir, allowed, 256 * 1024 * 1024);
    let game = GameState::new(&data, (s["x"].as_f64().unwrap(), s["z"].as_f64().unwrap()), s["tile"].as_str().unwrap(), walk, spawn["seed"].as_u64().unwrap() as u32, &mut terrain);
    Ok(World::new(WorldClock::new(0), terrain, portals, data, game))
}

#[derive(Default)]
struct Series(Vec<f64>);
impl Series {
    fn push(&mut self, v: f64) { self.0.push(v); }
    fn stats(&self) -> serde_json::Value {
        let mut v = self.0.clone();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let q = |p: f64| if v.is_empty() { 0.0 } else { v[((v.len() as f64 - 1.0) * p).round() as usize] };
        let mean = if v.is_empty() { 0.0 } else { v.iter().sum::<f64>() / v.len() as f64 };
        serde_json::json!({"n": v.len(), "mean": mean, "p50": q(0.5), "p95": q(0.95), "p99": q(0.99), "max": v.last().copied().unwrap_or(0.0)})
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let out = args.get(1).cloned().unwrap_or_else(|| "bench-servidor.json".into());
    let base: usize = args.get(2).and_then(|v| v.parse().ok()).unwrap_or(900);
    let mode = args.get(3).cloned().unwrap_or_else(|| "v03".into());
    let root = std::path::PathBuf::from(std::env::var("WH_REPO_ROOT").unwrap_or_else(|_| "../../..".into()));
    let t_boot = Instant::now();
    let mut w = boot(&root)?;
    let boot_ms = t_boot.elapsed().as_secs_f64() * 1000.0;
    if mode == "v03" {
        // mesmo arranjo do servidor V03: E/S de chunks em thread auxiliar e teto de tempo na fila de geração
        w.terrain.enable_prefetch();
        w.game.spawn_time_budget_ms = Some(3.0);
    }
    let ids: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter").map(|h| h.id.clone()).collect();
    w.order(Order::Explorar { hunters: ids })?;
    let mut res = serde_json::Map::new();
    res.insert("schema".into(), "wildhaven.bench.servidor.v1".into());
    res.insert("modo".into(), mode.clone().into());
    res.insert("boot_ms".into(), boot_ms.into());
    let mut epoch_ms: u64 = 1_800_000_000_000;
    let mut pub_state = wh_server_bench::Publisher::new();
    for scale in [1usize, 5, 10, 50] {
        let batches = (base / scale.max(1)).max(60);
        let (mut win, mut game, mut step_total, mut view, mut ser, mut bytes, mut batch) = (Series::default(), Series::default(), Series::default(), Series::default(), Series::default(), Series::default(), Series::default());
        let t_wall = Instant::now();
        for _ in 0..batches {
            epoch_ms += 200;
            let tb = Instant::now();
            w.clock_now_ms = Some(epoch_ms);
            for _ in 0..scale {
                let ts = Instant::now();
                w.step();
                step_total.push(ts.elapsed().as_secs_f64() * 1000.0);
                win.push(w.game.metrics.window_ms);
                game.push(w.game.metrics.tick_ms);
            }
            let (v_ms, s_ms, b) = pub_state.publish(&w, epoch_ms, &mode);
            view.push(v_ms);
            ser.push(s_ms);
            bytes.push(b as f64);
            batch.push(tb.elapsed().as_secs_f64() * 1000.0);
        }
        let m = &w.game.metrics;
        res.insert(format!("x{scale}"), serde_json::json!({
            "lotes": batches, "passos": batches * scale, "wall_s": t_wall.elapsed().as_secs_f64(),
            "janela_fisica_ms": win.stats(), "gameplay_ms": game.stats(), "passo_total_ms": step_total.stats(),
            "visao_ms": view.stats(), "serializacao_ms": ser.stats(), "bytes_por_envio": bytes.stats(), "lote_200ms_ms": batch.stats(),
            "ocupacao_intervalo_pct_p95": batch.stats()["p95"].as_f64().unwrap_or(0.0) / 200.0 * 100.0,
            "criaturas": m.creatures_total, "perto": m.near, "medio": m.mid, "longe": m.far, "congeladas": m.frozen,
            "streaming": serde_json::to_value(&w.terrain.stats)?,
        }));
        eprintln!("x{scale}: lote p95 {:.2} ms, passo p95 {:.3} ms, ser p95 {:.3} ms, bytes p50 {:.0}", batch.stats()["p95"], step_total.stats()["p95"], ser.stats()["p95"], bytes.stats()["p50"]);
    }
    res.insert("sim_time_s".into(), w.sim_time_s.into());
    std::fs::write(&out, serde_json::to_string_pretty(&serde_json::Value::Object(res))?)?;
    Ok(())
}

mod wh_server_bench {
    use std::time::Instant;
    use wh_core::sim::World;
    pub struct Publisher {
        base: Option<serde_json::Value>,
    }
    impl Publisher {
        pub fn new() -> Self { Publisher { base: None } }
        /// v02: snapshot completo serializado a cada intervalo (exatamente como o servidor V02).
        /// v03: valor imutável publicado + diff contra o último estado enviado ao cliente (modo 3D, 5 Hz).
        pub fn publish(&mut self, w: &World, now_ms: u64, mode: &str) -> (f64, f64, usize) {
            let tv = Instant::now();
            if mode == "v02" {
                let snap = w.snapshot(now_ms);
                let v = tv.elapsed().as_secs_f64() * 1000.0;
                let ts = Instant::now();
                let s = serde_json::to_string(&snap).unwrap_or_default();
                return (v, ts.elapsed().as_secs_f64() * 1000.0, s.len());
            }
            let value = serde_json::to_value(w.snapshot(now_ms)).unwrap_or_default();
            let v = tv.elapsed().as_secs_f64() * 1000.0;
            let ts = Instant::now();
            let msg = match &self.base {
                None => serde_json::to_string(&value).unwrap_or_default(),
                Some(b) => serde_json::to_string(&serde_json::json!({"$t": "d", "p": wh_core::wire::diff(b, &value, "").unwrap_or_default()})).unwrap_or_default(),
            };
            self.base = Some(value);
            (v, ts.elapsed().as_secs_f64() * 1000.0, msg.len())
        }
    }
}
