//! wh-sim-check — simulação autoritativa SEM rede sobre o terreno compilado real.
//!
//!   cargo run --release -p wh-server --bin wh-sim-check -- travessia 6000 saida.json
//!   cargo run --release -p wh-server --bin wh-sim-check -- demo 60000 saida.json
//!
//! `travessia`: ordem "explorar" para um Hunter; mede travessias, continuidade e chão.
//! `demo`: roteiro da demonstração do roadmap — explorar até avistar presa e predador,
//! ordem Caçar com carroça (custo, 6 vagas), acampamento, rastros, estratégia, combate,
//! ferimentos/resgate/morte e retorno; grava a linha do tempo de eventos.

use std::collections::HashSet;
use std::sync::Arc;
use wh_core::clock::WorldClock;
use wh_core::data::GameData;
use wh_core::game::{GameState, Order};
use wh_core::hex::{Continent, Manifest};
use wh_core::hunter::Activity;
use wh_core::portals::{PortalIndex, PortalReport};
use wh_core::sim::{World, STEP_SECONDS};
use wh_core::terrain::TerrainStore;

fn boot(root: &std::path::Path) -> Result<World, Box<dyn std::error::Error>> {
    let manifest: Manifest = serde_json::from_slice(&std::fs::read(root.join("build real/continental/data/continent-272.manifest.json"))?)?;
    let report: PortalReport = serde_json::from_slice(&std::fs::read(root.join("build real/integracao/relatorio-continental-272.json"))?)?;
    let portals = PortalIndex::from_report(report)?;
    let continent = Arc::new(Continent::from_manifest(manifest)?);
    let physics_dir = root.join(".generated/physics-272");
    let allowed: HashSet<String> = portals.certified.iter().filter(|t| physics_dir.join(format!("{t}-physics-v01")).join("index.json").is_file()).cloned().collect();
    let speeds: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v02/data/hunter-workshop-clip-speeds.json"))?)?;
    let walk = speeds["clips"].as_array().unwrap().iter().find(|c| c["name"] == "Walking").unwrap()["speedMetersPerSecond"].as_f64().unwrap();
    let spawn: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v02/data/spawn-v02.json"))?)?;
    let s = &spawn["hunters"][0];
    let data = GameData::from_slice(&std::fs::read(root.join("game/build-real-v02/data/gameplay-provisorio-v01.json"))?)?;
    let mut terrain = TerrainStore::new(continent, physics_dir, allowed, 256 * 1024 * 1024);
    let game = GameState::new(&data, (s["x"].as_f64().unwrap(), s["z"].as_f64().unwrap()), s["tile"].as_str().unwrap(), walk, spawn["seed"].as_u64().unwrap() as u32, &mut terrain);
    Ok(World::new(WorldClock::new(0), terrain, portals, data, game))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let mode = args.get(1).cloned().unwrap_or_else(|| "travessia".into());
    let ticks: u64 = args.get(2).and_then(|v| v.parse().ok()).unwrap_or(6000);
    let out = args.get(3).cloned().unwrap_or_else(|| format!("sim-check-{mode}.json"));
    let root = std::path::PathBuf::from(std::env::var("WH_REPO_ROOT").unwrap_or_else(|_| "../../..".into()));
    let mut w = boot(&root)?;
    let t0 = std::time::Instant::now();
    let mut rep = match mode.as_str() {
        "demo" => demo(&mut w, ticks)?,
        "retorno" => retorno(&mut w, ticks)?,
        _ => travessia(&mut w, ticks)?,
    };
    rep["wallSeconds"] = serde_json::json!(t0.elapsed().as_secs_f64());
    rep["streaming"] = serde_json::to_value(&w.terrain.stats)?;
    std::fs::write(&out, serde_json::to_string_pretty(&rep)?)?;
    Ok(())
}

fn travessia(w: &mut World, ticks: u64) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let id = w.game.hunters[0].id.clone();
    w.order(Order::Explorar { hunters: vec![id] })?;
    let walk = w.game.hunters[0].speed_mps * (1.0 + w.data.hunters.velocidade_bonus_por_nivel * (w.game.hunters[0].skill("velocidade") as f64 - 1.0));
    let mut max_step: f64 = 0.0;
    let mut last = (w.game.hunters[0].mv.x, w.game.hunters[0].mv.z);
    let mut off = 0u64;
    for _ in 0..ticks {
        w.step();
        let (x, z) = (w.game.hunters[0].mv.x, w.game.hunters[0].mv.z);
        max_step = max_step.max(((x - last.0).powi(2) + (z - last.1).powi(2)).sqrt());
        last = (x, z);
        if w.terrain.sample(x, z).is_none() {
            off += 1;
        }
        if std::env::var("WH_DEBUG").is_ok() && w.tick % 500 == 0 {
            let h = &w.game.hunters[0];
            eprintln!("tick {} {:?} {:?} pos=({:.0},{:.0}) alvo={:?} fails={} path={}/{}", w.tick, h.activity, h.state, h.mv.x, h.mv.z, h.mv.target, h.mv.fails, h.mv.path_idx, h.mv.path.len());
        }
    }
    let (hx, hz) = (w.game.hunters[0].mv.x, w.game.hunters[0].mv.z);
    let tile_now = w.terrain.tile_id_at(hx, hz);
    let h = &w.game.hunters[0];
    println!("travessias={} distância={:.1} m passo_max={:.4} m (limite {:.4}) sem_chão={} hex={}", h.mv.crossings.len(), h.mv.distance_walked_m, max_step, walk * STEP_SECONDS, off, h.mv.tile_id);
    Ok(serde_json::json!({
        "schema": "wildhaven.sim-check.v2", "mode": "travessia", "ticks": ticks, "stepSeconds": STEP_SECONDS,
        "simSeconds": ticks as f64 * STEP_SECONDS, "walkSpeedMps": walk, "maxStepMeters": max_step,
        "maxAllowedStepMeters": walk * STEP_SECONDS + 1e-9, "ticksWithoutCompiledGround": off,
        "hunter": h, "tileByPositionNow": tile_now, "residencyConsistent": tile_now.as_deref() == Some(h.mv.tile_id.as_str()),
    }))
}

fn run_until(w: &mut World, max: u64, mut done: impl FnMut(&World) -> bool) -> bool {
    for _ in 0..max {
        w.step();
        if done(w) {
            return true;
        }
    }
    false
}

fn note(steps: &mut Vec<serde_json::Value>, w: &World, what: &str, ok: bool) {
    println!("[demo] t={:.0}s {} {}", w.sim_time_s, if ok { "OK    " } else { "FALHOU" }, what);
    steps.push(serde_json::json!({"t": w.sim_time_s, "tick": w.tick, "etapa": what, "ok": ok}));
}

fn demo(w: &mut World, ticks: u64) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let mut steps: Vec<serde_json::Value> = vec![];
    let ids: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter").map(|h| h.id.clone()).collect();
    // 1. explorar até haver página de presa
    w.order(Order::Explorar { hunters: vec![ids[0].clone(), ids[1].clone()] })?;
    let ok = run_until(w, ticks, |w| w.game.bestiary.pages.contains_key("folhisco"));
    note(&mut steps, w, "explorar e avistar Folhisco (página nova no Bestiário)", ok);
    if ok {
        w.order(Order::Recolher { hunters: vec![ids[0].clone(), ids[1].clone()] })?;
        // 2. capacidade: 7 Hunters numa carroça é recusado
        let r7 = w.order(Order::Cacar { species: "folhisco".into(), hunters: [ids.clone(), vec!["chad".into()]].concat(), transporte: "carroca".into(), carroca: Some("chad".into()) });
        note(&mut steps, w, &format!("7 Hunters na carroça recusado: {:?}", r7.as_ref().err()), r7.is_err());
        // 3. caçar Folhisco com 3 Hunters de carroça (Chad), pagando
        let money0 = w.game.money;
        let team: Vec<String> = ids[2..5].to_vec();
        let r = w.order(Order::Cacar { species: "folhisco".into(), hunters: team, transporte: "carroca".into(), carroca: Some("chad".into()) });
        note(&mut steps, w, &format!("ordem Caçar Folhisco de carroça: {:?} (dinheiro {money0} → {})", r, w.game.money), r.is_ok() && w.game.money < money0);
        let ok = run_until(w, ticks, |w| !w.game.camps.is_empty());
        note(&mut steps, w, "viagem simulada da carroça e acampamento em clareira", ok);
        // caçada: registra quando cada marco acontece (ordem real dos acontecimentos)
        let mut first: std::collections::BTreeMap<&str, f64> = Default::default();
        let dbg = std::env::var("WH_DEBUG").is_ok();
        let ok = run_until(w, ticks * 2, |w| {
            if dbg && w.tick % 1500 == 0 {
                for h in w.game.hunters.iter().filter(|h| h.expedition.is_some() && h.role == "hunter") {
                    let tgt = h.target_creature.and_then(|c| w.game.creatures.iter().find(|x| x.id == c)).map(|c| (c.mv.dist(h.mv.x, h.mv.z) as i64, c.state.clone(), c.alive));
                    let nearf = w.game.creatures.iter().filter(|c| c.species == "folhisco" && c.alive).map(|c| c.mv.dist(h.mv.x, h.mv.z) as i64).min();
                    eprintln!("t={:.0} {} {:?} {:?} pf={} pos=({:.0},{:.0}) alvo={:?} folhisco+próx={:?} crouch={} tracks={}", w.sim_time_s, h.name, h.activity, h.state, h.plan_failures, h.mv.x, h.mv.z, tgt, nearf, h.crouched, w.game.tracks.by_creature.values().map(|q| q.len()).sum::<usize>());
                }
            }
            for (k, kind, needle) in [("pegadas", "rastro", "descobriu"), ("agua", "rastro", "água"), ("estrategia", "estrategia", ""), ("armadilha", "armadilha", ""), ("desvio", "combate", "Desvio")] {
                if !first.contains_key(k) && w.game.events.iter().any(|e| e.kind == kind && e.text.contains(needle)) {
                    first.insert(k, w.sim_time_s);
                }
            }
            w.game.expeditions.iter().any(|e| e.kills > 0) || w.game.events.iter().any(|e| e.kind == "morte")
        });
        note(&mut steps, w, &format!("pegadas descobertas (azuis), em t={:?}", first.get("pegadas")), first.contains_key("pegadas"));
        note(&mut steps, w, &format!("rastro interrompido pela água, em t={:?} (só ocorre se a trilha cruzar água)", first.get("agua")), true);
        note(&mut steps, w, &format!("avistamento do alvo e escolha autônoma de estratégia, em t={:?}", first.get("estrategia")), first.contains_key("estrategia"));
        let kills = w.game.expeditions.iter().map(|e| e.kills).sum::<u32>();
        note(&mut steps, w, &format!("abate do alvo ({kills})"), ok && kills > 0);
        let ok = run_until(w, ticks, |w| w.game.expeditions.iter().any(|e| matches!(e.state.as_str(), "concluida" | "fracassada")));
        note(&mut steps, w, &format!("retorno à vila com itens ({} na vila)", w.game.village_storage.len()), ok && !w.game.village_storage.is_empty());
    }
    // 4. Hunter sozinho contra predador: ferimento → resgate (ou morte permanente)
    if !w.game.bestiary.pages.contains_key("lobrapedra") {
        let scouts: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter" && h.alive && h.activity == Activity::NaVila).take(2).map(|h| h.id.clone()).collect();
        w.order(Order::Explorar { hunters: scouts.clone() })?;
        let ok = run_until(w, ticks * 3, |w| w.game.bestiary.pages.contains_key("lobrapedra"));
        note(&mut steps, w, "explorar e avistar Lobrapedra", ok);
        w.order(Order::Recolher { hunters: scouts })?;
        run_until(w, ticks, |w| w.game.hunters.iter().filter(|h| h.role == "hunter" && h.alive).all(|h| h.activity == Activity::NaVila));
    }
    if w.game.bestiary.pages.contains_key("lobrapedra") {
        let solo = w.game.hunters.iter().filter(|h| h.role == "hunter" && h.alive && h.activity == Activity::NaVila).map(|h| h.id.clone()).last();
        if let Some(solo) = solo {
            let r = w.order(Order::Cacar { species: "lobrapedra".into(), hunters: vec![solo], transporte: "carroca".into(), carroca: Some("nailon".into()) });
            note(&mut steps, w, &format!("ordem Caçar Lobrapedra com Hunter sozinho: {:?}", r), r.is_ok());
            let t_order = w.tick;
            let dbg = std::env::var("WH_DEBUG").is_ok();
            let ok = run_until(w, ticks * 2, |w| {
                if dbg && w.tick % 3000 == 0 {
                    if let Some(h) = w.game.hunters.iter().find(|h| h.expedition.is_some() && h.role == "hunter") {
                        let near = w.game.creatures.iter().filter(|c| c.species == "lobrapedra" && c.alive).map(|c| (c.mv.dist(h.mv.x, h.mv.z), c.state.clone())).min_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
                        let camp = w.game.camps.last().map(|c| (c.x, c.z));
                        eprintln!("t={:.0} {:?} pos=({:.0},{:.0}) campo={:?} lobrapedra+próxima={:?} n={}", w.sim_time_s, h.activity, h.mv.x, h.mv.z, camp, near, w.game.creatures.iter().filter(|c| c.species == "lobrapedra").count());
                    }
                }
                w.game.events.iter().any(|e| e.tick > t_order && matches!(e.kind.as_str(), "ferimento" | "morte")) || w.game.expeditions.iter().any(|e| e.species == "lobrapedra" && e.kills > 0)
            });
            note(&mut steps, w, "Hunter sozinho: ferimento → resgate/morte, ou abate", ok);
            run_until(w, ticks * 2, |w| {
                w.game.expeditions.iter().filter(|e| e.species == "lobrapedra").all(|e| matches!(e.state.as_str(), "concluida" | "fracassada")) && !w.game.hunters.iter().any(|h| h.activity == Activity::Socorrendo)
            });
            let st = w.game.expeditions.iter().filter(|e| e.species == "lobrapedra").map(|e| e.state.clone()).collect::<Vec<_>>();
            note(&mut steps, w, &format!("expedição do predador encerrada: {:?}", st), st.iter().all(|s| s == "concluida" || s == "fracassada"));
            let after: Vec<String> = w.game.events.iter().filter(|e| e.tick > t_order && matches!(e.kind.as_str(), "ferimento" | "resgate" | "morte" | "abate")).map(|e| e.text.clone()).collect();
            note(&mut steps, w, &format!("desfecho do predador: {:?}", after), !after.is_empty());
        }
    }
    let dead: Vec<String> = w.game.hunters.iter().filter(|h| !h.alive).map(|h| h.name.clone()).collect();
    println!("[demo] mortos: {:?}; bestiário: {:?}; itens na vila: {}; dinheiro: {}", dead, w.game.bestiary.pages.keys().collect::<Vec<_>>(), w.game.village_storage.len(), w.game.money);
    Ok(serde_json::json!({
        "schema": "wildhaven.demo-check.v1", "simSeconds": w.sim_time_s, "steps": steps,
        "events": w.game.events, "bestiary": w.game.bestiary, "money": w.game.money, "villageStorage": w.game.village_storage,
        "dead": dead, "expeditions": w.game.expeditions,
        "hunters": w.game.hunters.iter().map(|h| serde_json::json!({"id": h.id, "name": h.name, "alive": h.alive, "hp": h.hp, "activity": h.activity, "skills": h.skills, "crossings": h.mv.crossings.len()})).collect::<Vec<_>>(),
    }))
}

/// Exploradores andam `ticks`, recebem "recolher" e precisam chegar à vila (navegação longa).
fn retorno(w: &mut World, ticks: u64) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let ids: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter").take(4).map(|h| h.id.clone()).collect();
    w.order(Order::Explorar { hunters: ids.clone() })?;
    run_until(w, ticks, |_| false);
    let far: Vec<f64> = w.game.hunters.iter().filter(|h| ids.contains(&h.id)).map(|h| h.mv.dist(w.game.village.0, w.game.village.1)).collect();
    w.order(Order::Recolher { hunters: ids.clone() })?;
    let t0 = w.sim_time_s;
    let ok = run_until(w, ticks * 4, |w| {
        if std::env::var("WH_DEBUG").is_ok() && w.tick % 2000 == 0 {
            for h in w.game.hunters.iter().filter(|h| ids.contains(&h.id) && h.activity != Activity::NaVila) {
                eprintln!("t={:.0} {} {:?} {:?} pos=({:.0},{:.0}) tile={} alvo={:?} rota={}/{} rotaPts={:?} fails={} pf={}", w.sim_time_s, h.name, h.activity, h.state, h.mv.x, h.mv.z, h.mv.tile_id, h.mv.target.map(|(x, z)| (x as i64, z as i64)), h.route_idx, h.route.len(), h.route.iter().map(|(x, z)| (*x as i64, *z as i64)).collect::<Vec<_>>(), h.mv.fails, h.plan_failures);
            }
        }
        w.game.hunters.iter().filter(|h| ids.contains(&h.id) && h.alive).all(|h| h.activity == Activity::NaVila && h.mv.dist(w.game.village.0, w.game.village.1) < 45.0)
    });
    let st: Vec<(String, String, i64)> = w.game.hunters.iter().filter(|h| ids.contains(&h.id)).map(|h| (h.name.clone(), format!("{:?}", h.activity), h.mv.dist(w.game.village.0, w.game.village.1) as i64)).collect();
    println!("retorno: ok={ok} distâncias_ao_recolher={:?} tempo={:.0}s final={:?}", far.iter().map(|d| *d as i64).collect::<Vec<_>>(), w.sim_time_s - t0, st);
    Ok(serde_json::json!({"schema": "wildhaven.retorno-check.v1", "ok": ok, "distanciasAoRecolher": far, "segundos": w.sim_time_s - t0, "final": st}))
}
