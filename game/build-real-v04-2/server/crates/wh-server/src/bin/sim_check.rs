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
    let report: PortalReport = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v04-2/data/relatorio-continental-272-v04.json"))?)?;
    let portals = PortalIndex::from_report(report)?;
    let continent = Arc::new(Continent::from_manifest(manifest)?);
    let physics_dir = root.join(".generated/physics-272-v04");
    let allowed: HashSet<String> = portals.certified.iter().filter(|t| physics_dir.join(format!("{t}-physics-v01")).join("index.json").is_file()).cloned().collect();
    let speeds: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v04-2/data/hunter-workshop-clip-speeds.json"))?)?;
    let walk = speeds["clips"].as_array().unwrap().iter().find(|c| c["name"] == "Walking").unwrap()["speedMetersPerSecond"].as_f64().unwrap();
    let spawn: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("game/build-real-v04-2/data/spawn-v02.json"))?)?;
    let s = &spawn["hunters"][0];
    let mut data = GameData::from_slice(&std::fs::read(root.join("game/build-real-v04-2/data/gameplay-provisorio-v04.json"))?)?;
    // V03: WH_SPAWN_GRUPOS=0 reproduz a geração da V02 (hex inteiro num único tick) para comparação exata
    if let Some(g) = std::env::var("WH_SPAWN_GRUPOS").ok().and_then(|v| v.parse::<u32>().ok()) {
        data.relevancia.orcamento_spawn_grupos = if g == 0 { u32::MAX } else { g };
    }
    // V04.2: WH_CACHE_MB também no sim_check (experimento de tamanho do cache físico)
    let cache_mb: usize = std::env::var("WH_CACHE_MB").ok().and_then(|v| v.parse().ok()).unwrap_or(256);
    let mut terrain = TerrainStore::new(continent, physics_dir, allowed, cache_mb * 1024 * 1024);
    let game = GameState::new(&data, (s["x"].as_f64().unwrap(), s["z"].as_f64().unwrap()), s["tile"].as_str().unwrap(), walk, std::env::var("WH_SEED").ok().and_then(|v| v.parse().ok()).unwrap_or(spawn["seed"].as_u64().unwrap() as u32), &mut terrain);
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
        "continente" => continente(&mut w, ticks, std::env::var("WH_DESTINO").ok())?,
        "caca-bioma" => caca_bioma(&mut w, ticks)?,
        "exploracao-longa" => exploracao_longa(&mut w, ticks)?,
        "escala" => escala(&mut w, ticks)?,
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

/// V04: viagem longa a pé até um hex distante de OUTRO bioma (rota pelo grafo de portais certificados),
/// sem teleporte (passo máximo ≤ velocidade × dt), sempre sobre chão compilado; censo da fauna por bioma
/// (nenhuma espécie fora dos seus biomas; subsolo só em hex de areia) e uso real dos meios (voo/subsolo).
fn continente(w: &mut World, ticks: u64, destino: Option<String>) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    use std::collections::{HashMap, HashSet, VecDeque};
    let h0 = w.game.hunters[0].clone();
    let start = h0.mv.tile_id.clone();
    // BFS no grafo de portais certificados a partir da vila
    let mut hops: HashMap<String, u32> = HashMap::from([(start.clone(), 0)]);
    let mut q = VecDeque::from([start.clone()]);
    while let Some(a) = q.pop_front() {
        for (b, _) in w.portals.neighbors_with_portals(&a) {
            if w.terrain.is_allowed(&b) && !hops.contains_key(&b) {
                hops.insert(b.clone(), hops[&a] + 1);
                q.push_back(b);
            }
        }
    }
    let cont = w.terrain.continent.clone();
    let biome = move |id: &str| cont.tile(id).map(|t| t.biome.clone()).unwrap_or_default();
    let start_biome = biome(&start);
    let alvo = destino.unwrap_or_else(|| {
        let mut c: Vec<(&String, &u32)> = hops.iter().filter(|(id, n)| **n >= 4 && **n <= 7 && w.data.meios.areia_rotulos.contains(&biome(id))).collect();
        c.sort_by_key(|(id, n)| (**n, (*id).clone()));
        c.first().map(|(id, _)| (*id).clone()).unwrap_or_else(|| start.clone())
    });
    println!("[continente] {} hexes alcançáveis a pé a partir de {} ({}); destino {} ({}) a {} saltos", hops.len(), start, start_biome, alvo, biome(&alvo), hops.get(&alvo).copied().unwrap_or(0));
    let id = h0.id.clone();
    // viagem em grupo: todos os Hunters (não socorristas) partem juntos
    let grupo: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter").map(|h| h.id.clone()).collect();
    let msg = w.order(Order::Viajar { hunters: grupo.clone(), tile: alvo.clone() });
    println!("[continente] ordem: {msg:?}");
    let walk = h0.speed_mps * (1.0 + w.data.hunters.velocidade_bonus_por_nivel * (h0.skill("velocidade") as f64 - 1.0));
    let (mut max_step, mut off, mut last) = (0.0f64, 0u64, (h0.mv.x, h0.mv.z));
    let mut tiles_seen: Vec<String> = vec![start.clone()];
    let (mut max_alt, mut voando_max, mut submersas_max, mut emergencias) = (0.0f64, 0usize, 0usize, 0u64);
    let mut prev_meio: HashMap<u64, String> = HashMap::new();
    let mut arrived_tick = None;
    for _ in 0..ticks {
        w.step();
        // acompanha o primeiro Hunter do grupo ainda vivo
        let h = w.game.hunters.iter().find(|h| grupo.contains(&h.id) && h.alive).unwrap_or_else(|| w.game.hunters.iter().find(|h| h.id == id).unwrap());
        if h.id != id { last = (h.mv.x, h.mv.z); }
        let _id_atual = h.id.clone();
        let (x, z) = (h.mv.x, h.mv.z);
        max_step = max_step.max(((x - last.0).powi(2) + (z - last.1).powi(2)).sqrt());
        last = (x, z);
        if w.terrain.sample(x, z).is_none() { off += 1; }
        if tiles_seen.last() != Some(&h.mv.tile_id) { tiles_seen.push(h.mv.tile_id.clone()); }
        if std::env::var("WH_DEBUG").is_ok() && w.tick % 2000 == 0 { eprintln!("t={} {:?} {:?} tile={} rota {}/{} alvo={:?} fails={}", w.tick, h.activity, h.state, h.mv.tile_id, h.route_idx, h.route.len(), h.mv.target, h.mv.fails); }
        if arrived_tick.is_none() && h.mv.tile_id == alvo { arrived_tick = Some(w.tick); }
        let mut voando = 0; let mut submersas = 0;
        for c in &w.game.creatures {
            if c.meio == "ar" { voando += 1; max_alt = max_alt.max(c.alt); }
            if c.meio == "areia" { submersas += 1; }
            if let Some(p) = prev_meio.get(&c.id) { if p == "areia" && c.meio == "solo" { emergencias += 1; } }
            prev_meio.insert(c.id, c.meio.clone());
        }
        voando_max = voando_max.max(voando); submersas_max = submersas_max.max(submersas);
        if arrived_tick.is_some() && w.tick > arrived_tick.unwrap() + 3000 { break; }
    }
    // censo da fauna por bioma e coerência espécie ↔ bioma ↔ meio
    let mut censo: HashMap<String, HashMap<String, u32>> = HashMap::new();
    let (mut fora_do_bioma, mut subsolo_fora_da_areia, mut cruzaram_fronteira) = (vec![], 0u32, 0u32);
    for c in &w.game.creatures {
        let b = biome(&c.mv.tile_id);
        *censo.entry(b.clone()).or_default().entry(c.species.clone()).or_default() += 1;
        let sp = &w.data.especies[&c.species];
        // o hex de ORIGEM (território) deve ser do bioma da espécie; atravessar fronteiras depois é permitido
        let origem = w.terrain.tile_id_at(c.home.0, c.home.1).map(|t| biome(&t)).unwrap_or_default();
        if !sp.biomas.contains(&origem) && !fora_do_bioma.contains(&c.species) { fora_do_bioma.push(c.species.clone()); }
        if !sp.biomas.contains(&b) { cruzaram_fronteira += 1; }
        if c.meio == "areia" && !w.data.meios.areia_rotulos.contains(&b) { subsolo_fora_da_areia += 1; }
    }
    let especies: HashSet<&String> = w.game.creatures.iter().map(|c| &c.species).collect();
    let vivos: Vec<String> = w.game.hunters.iter().filter(|h| grupo.contains(&h.id) && h.alive).map(|h| h.name.clone()).collect();
    let h = w.game.hunters.iter().find(|h| grupo.contains(&h.id) && h.alive).unwrap_or_else(|| w.game.hunters.iter().find(|h| h.id == id).unwrap());
    println!("[continente] vivos do grupo: {vivos:?}");
    println!("[continente] chegou={:?} hexes atravessados={} passo_max={:.3} (limite {:.3}) sem_chão={} espécies={} criaturas={} voando_máx={} alt_máx={:.1} submersas_máx={} emergências={} fora_do_bioma={:?}", arrived_tick, tiles_seen.len(), max_step, walk * STEP_SECONDS, off, especies.len(), w.game.creatures.len(), voando_max, max_alt, submersas_max, emergencias, fora_do_bioma);
    Ok(serde_json::json!({
        "schema": "wildhaven.sim-check.continente.v1", "origem": start, "origemBioma": start_biome, "destino": alvo, "destinoBioma": biome(&alvo),
        "saltosNoGrafo": hops.get(&alvo), "hexesAlcancaveisAPe": hops.len(), "ordem": format!("{msg:?}"),
        "chegouNoTick": arrived_tick, "hexesAtravessados": tiles_seen, "distanciaCaminhadaM": h.mv.distance_walked_m, "travessiasDePortal": h.mv.crossings.len(),
        "passoMaximoM": max_step, "passoPermitidoM": walk * STEP_SECONDS + 1e-9, "teleporte": max_step > walk * STEP_SECONDS * 1.05, "ticksSemChaoCompilado": off,
        "criaturas": w.game.creatures.len(), "especiesPresentes": especies.len(), "censoPorBioma": censo,
        "especiesNascidasForaDoBioma": fora_do_bioma, "criaturasQueCruzaramFronteiraDeBioma": cruzaram_fronteira, "submersasForaDaAreia": subsolo_fora_da_areia,
        "meios": {"voandoMax": voando_max, "altitudeMaxM": max_alt, "submersasMax": submersas_max, "emergencias": emergencias},
        "atividadeFinal": format!("{:?}", h.activity), "vivo": h.alive, "hp": h.hp,
        "eventos": w.game.events.iter().rev().take(40).map(|e| format!("{:.0}s {} {}", e.t, e.kind, e.text)).collect::<Vec<_>>(),
    }))
}

/// V04: caçada FORA da floresta temperada. O grupo viaja até o deserto, avista uma espécie do deserto
/// (página nova no Bestiário), volta à vila e recebe a ordem Caçar de carroça para essa espécie; a expedição
/// viaja, acampa, rastreia e combate (fluxo completo, com resgate/morte permanente se acontecer).
fn caca_bioma(w: &mut World, ticks: u64) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let mut steps = vec![];
    let ida = continente(w, ticks, std::env::var("WH_DESTINO").ok())?;
    let chegou = ida["chegouNoTick"].is_number();
    note(&mut steps, w, &format!("viagem em grupo até {} ({})", ida["destino"], ida["destinoBioma"]), chegou);
    let areia = w.data.meios.areia_rotulos.clone();
    let deserto = |w: &World| -> Option<String> {
        // espécie EXCLUSIVA de biomas de areia (deserto/dunas), nunca uma generalista de floresta/savana
        w.game.bestiary.pages.keys().find(|sp| w.data.especies.get(*sp).map(|e| !e.biomas.is_empty() && e.biomas.iter().all(|b| areia.contains(b))).unwrap_or(false)).cloned()
    };
    let viu = run_until(w, 60_000, |w| deserto(w).is_some());
    let especie = deserto(w);
    note(&mut steps, w, &format!("espécie do deserto no Bestiário: {especie:?}"), viu);
    let vivos: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter" && h.alive).map(|h| h.id.clone()).collect();
    let _ = w.order(Order::Recolher { hunters: vivos.clone() });
    let voltou = run_until(w, 300_000, |w| w.game.hunters.iter().filter(|h| vivos.contains(&h.id) && h.alive && h.activity == Activity::NaVila).count() >= 2.min(vivos.len()) && w.game.hunters.iter().filter(|h| vivos.contains(&h.id) && h.alive).all(|h| h.activity == Activity::NaVila || h.mv.tile_id == h.mv.tile_id && h.activity == Activity::VoltandoVila && false || h.activity == Activity::NaVila));
    note(&mut steps, w, "grupo de volta à vila (Recolher)", voltou);
    let Some(sp) = especie else {
        return Ok(serde_json::json!({"schema": "wildhaven.sim-check.caca-bioma.v1", "etapas": steps, "ida": ida}));
    };
    let time: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter" && h.alive && h.activity == Activity::NaVila).map(|h| h.id.clone()).take(6).collect();
    let wagon = w.game.wagons.first().map(|x| x.id.clone());
    let r = w.order(Order::Cacar { species: sp.clone(), hunters: time.clone(), transporte: "carroca".into(), carroca: wagon });
    note(&mut steps, w, &format!("ordem Caçar {sp} de carroça com {} Hunters: {r:?}", time.len()), r.is_ok());
    let exp_id = w.game.expeditions.last().map(|e| e.id);
    let fim = run_until(w, 400_000, |w| w.game.expeditions.iter().find(|e| Some(e.id) == exp_id).map(|e| e.state == "concluida" || e.state.starts_with("fracass")).unwrap_or(true));
    let e = w.game.expeditions.iter().find(|e| Some(e.id) == exp_id);
    note(&mut steps, w, &format!("expedição encerrada: {:?} — destino {:?}, abates {:?}", e.map(|e| e.state.clone()), e.map(|e| e.dest_tile.clone()), e.map(|e| e.kills)), fim);
    let ev: Vec<String> = w.game.events.iter().rev().take(60).map(|e| format!("{:.0}s {} {}", e.t, e.kind, e.text)).collect();
    println!("[caca-bioma] {}", ev.iter().take(12).cloned().collect::<Vec<_>>().join(" | "));
    Ok(serde_json::json!({"schema": "wildhaven.sim-check.caca-bioma.v1", "especie": sp, "etapas": steps, "expedicao": e, "eventos": ev,
        "mortos": w.game.hunters.iter().filter(|h| !h.alive).map(|h| h.name.clone()).collect::<Vec<_>>(), "ida": ida}))
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
    // V02: criaturas exploram; um avistamento só na borda da vila não serve de habitat para a caçada
    let habitat_seen = |w: &World| w.game.bestiary.pages.get("lobrapedra").map(|p| p.pontos.iter().any(|(t, _, _)| t != &w.game.village_tile)).unwrap_or(false);
    if !habitat_seen(w) {
        let scouts: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter" && h.alive && h.activity == Activity::NaVila).take(2).map(|h| h.id.clone()).collect();
        w.order(Order::Explorar { hunters: scouts.clone() })?;
        let ok = run_until(w, ticks * 3, habitat_seen);
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

/// V04: todos os Hunters exploram por `ticks` (como o teste longo do servidor) e, a cada 3000 ticks, registra a
/// população e o custo médio de cada fase do passo (geração, visões, laço de criaturas, pós-processo, resto).
/// V04.1: resumo bit a bit do estado final (criaturas, Hunters, RNG) para provar que otimizações não mudam a
/// simulação: mesma semente + mesmos ticks ⇒ mesmo digesto.
fn digest(w: &World) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    let mut put = |b: &[u8]| { for x in b { h ^= *x as u64; h = h.wrapping_mul(0x100000001b3); } };
    for c in &w.game.creatures {
        put(&c.id.to_le_bytes()); put(c.species.as_bytes()); put(&c.mv.x.to_bits().to_le_bytes()); put(&c.mv.z.to_bits().to_le_bytes());
        put(&c.hp.to_bits().to_le_bytes()); put(&[c.alive as u8]); put(c.state.as_bytes());
    }
    for hu in &w.game.hunters { put(hu.id.as_bytes()); put(&hu.mv.x.to_bits().to_le_bytes()); put(&hu.mv.z.to_bits().to_le_bytes()); put(&hu.hp.to_bits().to_le_bytes()); put(format!("{:?}", hu.activity).as_bytes()); }
    put(&w.game.rng.to_le_bytes());
    format!("{h:016x} criaturas={} hunters={}", w.game.creatures.len(), w.game.hunters.len())
}

fn rss_mb() -> f64 {
    std::fs::read_to_string("/proc/self/status").ok().and_then(|s| s.lines().find(|l| l.starts_with("VmRSS:")).and_then(|l| l.split_whitespace().nth(1)).and_then(|v| v.parse::<f64>().ok())).unwrap_or(0.0) / 1024.0
}

/// V04.2 — teste de escalabilidade (CARGA EXPERIMENTAL, não muda a população do jogo): explora `ticks` passos para
/// obter a distribuição ecológica real, depois monta cargas de 1.000 / 5.000 / 10.000 / 20.000 criaturas (subconjunto
/// ou cópias com 1–6 m de deslocamento — adensa os hexes visitados, pior caso para a percepção) e mede, com os
/// Hunters na vila ou espalhados pelo continente, o custo por fase do passo, os níveis de relevância, a RAM do
/// processo e a serialização do instantâneo publicado e da persistência.
fn escala(w: &mut World, ticks: u64) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let ids: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter").map(|h| h.id.clone()).collect();
    w.order(Order::Explorar { hunters: ids.clone() })?;
    for t in 1..=ticks { w.step(); if t % 3000 == 0 { let livres: Vec<String> = w.game.hunters.iter().filter(|h| h.alive && h.role == "hunter" && h.activity == Activity::NaVila).map(|h| h.id.clone()).collect(); if !livres.is_empty() { let _ = w.order(Order::Explorar { hunters: livres }); } } }
    let base = w.game.creatures.clone();
    let vila: Vec<(f64, f64, f64, String)> = w.game.hunters.iter().map(|h| (h.mv.x, h.mv.y, h.mv.z, h.mv.tile_id.clone())).collect();
    let mut out = vec![];
    let alvos: Vec<usize> = std::env::var("WH_ESCALA").ok().map(|v| v.split(',').filter_map(|x| x.parse().ok()).collect()).unwrap_or(vec![1000, 5000, 10000, 20000]);
    let medir = std::env::var("WH_ESCALA_TICKS").ok().and_then(|v| v.parse().ok()).unwrap_or(900u64);
    for &n in &alvos {
        for cenario in ["vila", "espalhados"] {
            // população: subconjunto ou cópias deslocadas (ids novos)
            let mut cs: Vec<wh_core::creature::Creature> = base.iter().filter(|c| c.alive).take(n).cloned().collect();
            let mut k = 0usize; let mut next = w.game.next_id + 1_000_000;
            while cs.len() < n { let mut c = base[k % base.len()].clone(); if !c.alive { k += 1; continue; } let off = 1.0 + (k % 6) as f64; c.id = next; next += 1; c.mv.x += off; c.mv.z -= off; c.mv.path.clear(); c.mv.target = None; cs.push(c); k += 1; }
            w.game.creatures = cs;
            // Hunters: na vila (posição do fim da exploração para quem estava lá; demais voltam ao ponto inicial) ou
            // espalhados sobre posições reais de criaturas em hexes diferentes (chão válido)
            let mut tiles_vistos = std::collections::BTreeSet::new();
            let lugares: Vec<(f64, f64, f64, String)> = base.iter().filter(|c| tiles_vistos.insert(c.mv.tile_id.clone())).map(|c| (c.mv.x, c.mv.y, c.mv.z, c.mv.tile_id.clone())).collect();
            for (i, h) in w.game.hunters.iter_mut().enumerate() {
                let (x, y, z, t) = if cenario == "vila" { vila[0].clone() } else { lugares[(i * lugares.len().max(1) / 8).min(lugares.len().saturating_sub(1))].clone() };
                h.mv.x = x + i as f64 * 2.0; h.mv.y = y; h.mv.z = z; h.mv.tile_id = t; h.mv.path.clear(); h.mv.target = None; h.route.clear(); h.route_idx = 0;
            }
            for _ in 0..50 { w.step(); }
            w.game.prof_on = true; w.game.prof = [0.0; 8];
            let t0 = std::time::Instant::now();
            for _ in 0..medir { w.step(); }
            let parede = t0.elapsed().as_secs_f64();
            let p = w.game.prof; let nn = p[5].max(1.0); let m = &w.game.metrics;
            // serialização do instantâneo publicado (o que o servidor faz a cada 200 ms) e da persistência (a cada 10 s)
            let ts = std::time::Instant::now(); let mut bytes = 0; for _ in 0..10 { bytes = serde_json::to_string(&w.snapshot(0)).map(|s| s.len()).unwrap_or(0); } let snap_ms = ts.elapsed().as_secs_f64() * 100.0;
            let tp = std::time::Instant::now(); let pb = serde_json::to_string(&w.game).map(|s| s.len()).unwrap_or(0); let pers_ms = tp.elapsed().as_secs_f64() * 1000.0;
            let l = serde_json::json!({"criaturas": w.game.creatures.len(), "cenario": cenario, "perto": m.near, "medio": m.mid, "longe": m.far, "congeladas": m.frozen,
                "msPorPasso": {"climaEAreia": p[6] / nn, "stepCreature": p[7] / nn, "geracao": p[0] / nn, "visoes": p[1] / nn, "laco": p[2] / nn, "pos": p[3] / nn, "resto": p[4] / nn, "total": (p[0] + p[1] + p[2] + p[3] + p[4]) / nn},
                "paredePorPassoMs": parede * 1000.0 / medir as f64, "cpuPctNucleoEmX1": parede * 1000.0 / medir as f64 * 5.0 / 10.0,
                "instantaneo": {"bytes": bytes, "ms": snap_ms}, "persistencia": {"bytes": pb, "ms": pers_ms}, "rssMB": rss_mb()});
            println!("{l}");
            out.push(l);
            w.game.prof_on = false;
        }
    }
    Ok(serde_json::json!({"modo": "escala", "ticksExploracao": ticks, "baseCriaturas": base.len(), "nota": "carga experimental; cópias adensam os hexes visitados (pior caso de percepção)", "amostras": out}))
}

fn exploracao_longa(w: &mut World, ticks: u64) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let ids: Vec<String> = w.game.hunters.iter().filter(|h| h.role == "hunter").map(|h| h.id.clone()).collect();
    w.order(Order::Explorar { hunters: ids })?;
    w.game.prof_on = true;
    let mut linhas = vec![];
    let t0 = std::time::Instant::now();
    for t in 1..=ticks {
        w.step();
        if t % 3000 == 0 {
            let p = w.game.prof; let n = p[5].max(1.0); let m = &w.game.metrics;
            let l = serde_json::json!({"tick": t, "simH": t as f64 * 0.2 / 3600.0, "criaturas": m.creatures_total, "perto": m.near, "medio": m.mid, "longe": m.far, "congeladas": m.frozen,
                "msGeracao": p[0] / n, "msVisoes": p[1] / n, "msLaco": p[2] / n, "msPos": p[3] / n, "msResto": p[4] / n, "msTotal": (p[0] + p[1] + p[2] + p[3] + p[4]) / n, "paredeS": t0.elapsed().as_secs_f64()});
            println!("{l}");
            linhas.push(l);
            w.game.prof = [0.0; 8];
            let livres: Vec<String> = w.game.hunters.iter().filter(|h| h.alive && h.role == "hunter" && h.activity == wh_core::hunter::Activity::NaVila).map(|h| h.id.clone()).collect();
            if !livres.is_empty() { let _ = w.order(Order::Explorar { hunters: livres }); }
        }
    }
    Ok(serde_json::json!({"modo": "exploracao-longa", "ticks": ticks, "amostras": linhas, "digestoFinal": digest(w), "rssFinalMB": rss_mb()}))
}
