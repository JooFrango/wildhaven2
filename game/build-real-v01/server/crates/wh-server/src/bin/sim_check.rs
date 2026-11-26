//! wh-sim-check — roda a simulação autoritativa SEM rede por N ticks sobre o terreno
//! compilado real e grava um relatório de evidência (travessias, continuidade de posição,
//! streaming). Usa a mesma configuração do servidor (variáveis WH_*).
//!
//!   cargo run --release -p wh-server --bin wh-sim-check -- <ticks> <saida.json>

use std::collections::HashSet;
use std::sync::Arc;
use wh_core::clock::WorldClock;
use wh_core::hex::{Continent, Manifest};
use wh_core::hunter::Hunter;
use wh_core::portals::{PortalIndex, PortalReport};
use wh_core::sim::{World, STEP_SECONDS};
use wh_core::terrain::TerrainStore;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let ticks: u64 = args.get(1).and_then(|v| v.parse().ok()).unwrap_or(6000);
    let out = args.get(2).cloned().unwrap_or_else(|| "sim-check.json".into());
    let root = std::path::PathBuf::from(std::env::var("WH_REPO_ROOT").unwrap_or_else(|_| "../../..".into()));
    let manifest: Manifest = serde_json::from_slice(&std::fs::read(root.join("build real/continental/data/continent-272.manifest.json"))?)?;
    let report: PortalReport = serde_json::from_slice(&std::fs::read(root.join("build real/integracao/relatorio-continental-272.json"))?)?;
    let portals = PortalIndex::from_report(report)?;
    let continent = Arc::new(Continent::from_manifest(manifest)?);
    let physics_dir = root.join(".generated/physics-272");
    let allowed: HashSet<String> = portals.certified.iter()
        .filter(|t| physics_dir.join(format!("{t}-physics-v01")).join("index.json").is_file()).cloned().collect();
    let speeds: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v01/data/hunter-workshop-clip-speeds.json"))?)?;
    let walk = speeds["clips"].as_array().unwrap().iter().find(|c| c["name"] == "Walking").unwrap()["speedMetersPerSecond"].as_f64().unwrap();
    let spawn: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v01/data/spawn-v01.json"))?)?;
    let s = &spawn["hunters"][0];
    let h = Hunter::new(s["id"].as_str().unwrap(), s["name"].as_str().unwrap(), s["x"].as_f64().unwrap(), s["z"].as_f64().unwrap(),
        s["tile"].as_str().unwrap(), walk, spawn["seed"].as_u64().unwrap() as u32);
    let terrain = TerrainStore::new(continent.clone(), physics_dir, allowed, 256 * 1024 * 1024);
    let mut w = World::new(WorldClock::new(0), terrain, portals, vec![h]);
    let mut max_step: f64 = 0.0;
    let mut last = (w.hunters[0].x, w.hunters[0].z);
    let mut off_terrain = 0u64;
    let mut off_samples: Vec<serde_json::Value> = vec![];
    let t0 = std::time::Instant::now();
    for _ in 0..ticks {
        w.step();
        let hh = &w.hunters[0];
        let st = ((hh.x - last.0).powi(2) + (hh.z - last.1).powi(2)).sqrt();
        max_step = max_step.max(st);
        last = (hh.x, hh.z);
        if w.terrain.sample(hh.x, hh.z).is_none() {
            off_terrain += 1;
            if off_samples.len() < 20 {
                let raw = w.terrain.chunk_key_at(hh.x, hh.z);
                off_samples.push(serde_json::json!({"tick": w.tick, "x": hh.x, "z": hh.z, "tile": hh.tile_id, "state": hh.state, "chunk": raw}));
            }
        }
    }
    let wall = t0.elapsed().as_secs_f64();
    let hh = &w.hunters[0];
    let tile_now = continent.tile_at(hh.x, hh.z).map(|t| t.id.clone());
    let rep = serde_json::json!({
        "schema": "wildhaven.sim-check.v1",
        "ticks": ticks, "stepSeconds": STEP_SECONDS, "simSeconds": ticks as f64 * STEP_SECONDS, "wallSeconds": wall,
        "walkSpeedMps": walk, "maxStepMeters": max_step, "maxAllowedStepMeters": walk * STEP_SECONDS + 1e-9,
        "ticksWithoutCompiledGround": off_terrain, "ticksWithoutCompiledGroundSamples": off_samples,
        "hunter": hh, "tileByPositionNow": tile_now,
        "residencyConsistent": tile_now.as_deref() == Some(hh.tile_id.as_str()),
        "streaming": w.terrain.stats,
    });
    std::fs::write(&out, serde_json::to_string_pretty(&rep)?)?;
    println!("travessias={} distância={:.1} m passo_max={:.4} m (limite {:.4}) sem_chão={} hex={} parede={:.1}s",
        hh.crossings.len(), hh.distance_walked_m, max_step, walk * STEP_SECONDS, off_terrain, hh.tile_id, wall);
    Ok(())
}
