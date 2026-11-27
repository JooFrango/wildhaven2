//! Regras confirmadas pelo diretor, testadas sobre um mundo SINTÉTICO de teste
//! (fixture plana gerada aqui; nunca usada como terreno de produção).
use flate2::write::GzEncoder;
use flate2::Compression;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::Write;
use std::sync::Arc;
use wh_core::clock::WorldClock;
use wh_core::creature::AttackRequest;
use wh_core::data::GameData;
use wh_core::game::{GameState, Order};
use wh_core::hex::{Continent, Manifest};
use wh_core::hunter::Activity;
use wh_core::portals::{PortalIndex, PortalReport};
use wh_core::sim::World;
use wh_core::terrain::TerrainStore;

fn hex(b: &[u8]) -> String {
    Sha256::digest(b).iter().map(|x| format!("{x:02x}")).collect()
}

fn fixture_world(tag: &str) -> World {
    let dir = std::env::temp_dir().join(format!("wh-rules-{tag}-{}", std::process::id()));
    let tdir = dir.join("A-physics-v01");
    std::fs::create_dir_all(&tdir).unwrap();
    let mut chunks = vec![];
    for ix in -2..2i32 {
        for iz in -2..2i32 {
            let (nx, nz, res) = (128u16, 128u16, 2u16);
            let n = nx as usize * nz as usize;
            let mut b = vec![];
            b.extend_from_slice(b"WHP1");
            b.extend_from_slice(&1u16.to_le_bytes());
            b.extend_from_slice(&res.to_le_bytes());
            b.extend_from_slice(&nx.to_le_bytes());
            b.extend_from_slice(&nz.to_le_bytes());
            b.extend_from_slice(&((ix * 256) as f64).to_le_bytes());
            b.extend_from_slice(&((iz * 256) as f64).to_le_bytes());
            b.extend_from_slice(&0f64.to_le_bytes());
            for _ in 0..n {
                b.extend_from_slice(&10f32.to_le_bytes());
            }
            for _ in 0..n {
                b.extend_from_slice(&f32::NAN.to_le_bytes());
            }
            b.extend(std::iter::repeat(0u8).take(2 * n));
            let mut e = GzEncoder::new(Vec::new(), Compression::fast());
            e.write_all(&b).unwrap();
            let gz = e.finish().unwrap();
            let url = format!("chunk_{ix}_{iz}.whp.gz");
            std::fs::write(tdir.join(&url), &gz).unwrap();
            chunks.push(serde_json::json!({"ix": ix, "iz": iz, "url": url, "bytes": gz.len(), "sha256": hex(&gz)}));
        }
    }
    std::fs::write(tdir.join("index.json"), serde_json::json!({"schema": "wildhaven.physics.tile.v1", "tileId": "A", "chunkMeters": 256, "chunks": chunks}).to_string()).unwrap();
    let manifest: Manifest = serde_json::from_value(serde_json::json!({"schema": "wildhaven.continent.manifest.v1",
        "tiles": [{"id": "A", "x": 0.0, "z": 0.0, "biome": "teste"}, {"id": "B", "x": 4330.127, "z": 0.0, "biome": "teste"}], "edges": [["A", "B"]]})).unwrap();
    let report: PortalReport = serde_json::from_value(serde_json::json!({"schema": "wildhaven.continental.portal-report.v1",
        "tiles": [{"id": "A", "status": "certificado-tecnico"}, {"id": "B", "status": "certificado-tecnico"}],
        "edges": [{"a": "A", "b": "B", "status": "validado", "portals": [{"widthMeters": 100.0, "centerX": 2165.06, "centerZ": 0.0, "fromS": -50.0, "toS": 50.0}]}]})).unwrap();
    let continent = Arc::new(Continent::from_manifest(manifest).unwrap());
    let portals = PortalIndex::from_report(report).unwrap();
    let data = GameData::from_slice(&std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../../../data/gameplay-provisorio-v01.json")).unwrap()).unwrap();
    let mut terrain = TerrainStore::new(continent, dir, HashSet::from(["A".to_string(), "B".to_string()]), 64 << 20);
    let game = GameState::new(&data, (50.0, 50.0), "A", 1.1733, 7, &mut terrain);
    World::new(WorldClock::new(0), terrain, portals, data, game)
}

fn hunters(w: &World) -> Vec<String> {
    w.game.hunters.iter().filter(|h| h.role == "hunter").map(|h| h.id.clone()).collect()
}

#[test]
fn hunt_requires_bestiary_page_and_wagon_holds_at_most_six() {
    let mut w = fixture_world("cap");
    let ids = hunters(&w);
    assert_eq!(ids.len(), 6);
    assert_eq!(w.game.wagons.len(), 2, "exatamente duas carroças");
    assert_eq!(w.game.wagons.iter().map(|x| x.driver.as_str()).collect::<Vec<_>>(), ["Chad", "Nailon"]);
    let err = w.order(Order::Cacar { species: "folhisco".into(), hunters: ids.clone(), transporte: "carroca".into(), carroca: Some("chad".into()) }).unwrap_err();
    assert!(err.contains("Bestiário"), "{err}");
    w.game.bestiary.sight("folhisco", "Folhisco", vec![], "B", 2400.0, 0.0, "teste", 0, 3);
    let mut seven = ids.clone();
    seven.push("chad".into());
    let err = w.order(Order::Cacar { species: "folhisco".into(), hunters: seven, transporte: "carroca".into(), carroca: Some("chad".into()) }).unwrap_err();
    assert!(err.contains("máximo 6"), "{err}");
    let money = w.game.money;
    let ok = w.order(Order::Cacar { species: "folhisco".into(), hunters: ids.clone(), transporte: "carroca".into(), carroca: Some("chad".into()) });
    assert!(ok.is_ok(), "{ok:?}");
    assert!(w.game.money < money, "carroça cobra");
    assert!(w.game.hunters.iter().filter(|h| h.role == "hunter").all(|h| h.activity == Activity::Embarcado));
}

#[test]
fn wagon_cost_is_checked_against_money() {
    let mut w = fixture_world("money");
    w.game.bestiary.sight("folhisco", "Folhisco", vec![], "B", 2400.0, 0.0, "teste", 0, 3);
    w.game.money = 1.0;
    let ids = hunters(&w);
    let err = w.order(Order::Cacar { species: "folhisco".into(), hunters: vec![ids[0].clone()], transporte: "carroca".into(), carroca: Some("nailon".into()) }).unwrap_err();
    assert!(err.contains("insuficiente"), "{err}");
    // a pé não cobra
    assert!(w.order(Order::Cacar { species: "folhisco".into(), hunters: vec![ids[0].clone()], transporte: "a_pe".into(), carroca: None }).is_ok());
    assert_eq!(w.game.money, 1.0);
}

#[test]
fn dodge_level_5_waits_three_seconds_and_death_is_permanent_after_save() {
    let mut w = fixture_world("dodge");
    // Hunter 06 tem Desvio 6; força esquiva com rng controlado: tenta até esquivar
    let id = "hunter-006".to_string();
    let mut dodged = false;
    for _ in 0..200 {
        let now = w.sim_time_s;
        w.ctx_run(|g, c| {
            let i = g.hunters.iter().position(|h| h.id == id).unwrap();
            g.hunters[i].hp = 100.0;
            g.hunters[i].activity = Activity::Combatendo;
            let _ = c;
            let _ = now;
        });
        let before = w.game.hunters.iter().find(|h| h.id == id).unwrap().no_attack_until_s;
        resolve(&mut w, &id, 5.0);
        let h = w.game.hunters.iter().find(|h| h.id == id).unwrap();
        if h.no_attack_until_s > before && h.last_action.contains("3 s") {
            assert!((h.no_attack_until_s - h.busy_until_s - 3.0).abs() < 1e-9, "Desvio 5: espera 3 s antes de atacar");
            dodged = true;
            break;
        }
    }
    assert!(dodged, "Desvio 6 deve esquivar em 200 tentativas (chance 30%)");
    // morte permanente sobrevive à serialização (persistência)
    let i = w.game.hunters.iter().position(|h| h.id == id).unwrap();
    w.game.hunters[i].alive = false;
    w.game.hunters[i].activity = Activity::Morto;
    let json = serde_json::to_string(&w.game).unwrap();
    let back: GameState = serde_json::from_str(&json).unwrap();
    let h = back.hunters.iter().find(|h| h.id == id).unwrap();
    assert!(!h.alive && h.activity == Activity::Morto);
    let mut w2 = fixture_world("dodge2");
    w2.game = back;
    w2.game.bestiary.sight("folhisco", "Folhisco", vec![], "B", 2400.0, 0.0, "teste", 0, 3);
    let err = w2.order(Order::Cacar { species: "folhisco".into(), hunters: vec![id.clone()], transporte: "a_pe".into(), carroca: None }).unwrap_err();
    assert!(err.contains("não está disponível"), "morto não volta: {err}");
}

fn resolve(w: &mut World, hunter: &str, damage: f64) {
    let a = AttackRequest { creature: 1, hunter: hunter.into(), damage };
    w.ctx_run(|g, c| g.debug_attack(a, c));
}
