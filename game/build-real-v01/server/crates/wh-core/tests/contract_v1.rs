//! O servidor precisa emitir todos os campos exigidos por contracts/v1/snapshot.schema.json.
use serde_json::Value;
use wh_core::clock::WorldClock;
use wh_core::hunter::{Crossing, Hunter};
use wh_core::terrain::StreamStats;

fn schema() -> Value {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../contracts/v1/snapshot.schema.json");
    serde_json::from_slice(&std::fs::read(p).unwrap()).unwrap()
}
fn required(v: &Value) -> Vec<String> {
    v["required"].as_array().unwrap().iter().map(|x| x.as_str().unwrap().to_string()).collect()
}
fn assert_has(obj: &Value, keys: &[String], what: &str) {
    for k in keys {
        assert!(obj.get(k).is_some(), "{what}: campo exigido ausente: {k}");
    }
}

#[test]
fn hunter_clock_streaming_match_schema_v1() {
    let s = schema();
    let mut h = Hunter::new("h1", "Hunter", 1.0, 2.0, "C", 1.1733, 9);
    h.mv.crossings.push(Crossing { tick: 1, sim_time_s: 0.2, from: "C".into(), to: "E".into(), x: 0.0, z: 0.0, step_m: 0.23 });
    let hv = serde_json::to_value(&h).unwrap();
    assert_has(&hv, &required(&s["$defs"]["hunter"]), "hunter");
    assert_has(&hv["crossings"][0], &required(&s["$defs"]["hunter"]["properties"]["crossings"]["items"]), "crossing");
    let states: Vec<&str> = s["$defs"]["hunter"]["properties"]["state"]["enum"].as_array().unwrap().iter().map(|x| x.as_str().unwrap()).collect();
    assert!(states.contains(&hv["state"].as_str().unwrap()));
    let cv = serde_json::to_value(WorldClock::new(0).state(7_300_000)).unwrap();
    assert_has(&cv, &required(&s["$defs"]["clock"]), "clock");
    assert_eq!(cv["phase"], "night");
    let sv = serde_json::to_value(StreamStats::default()).unwrap();
    assert_has(&sv, &required(&s["$defs"]["streaming"]), "streaming");
    assert_eq!(s["properties"]["schema"]["const"], wh_core::sim::SNAPSHOT_SCHEMA);
}
