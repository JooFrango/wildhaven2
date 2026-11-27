//! Paridade por seed com o TypeScript ORIGINAL da Alpha (game/alpha01, somente leitura).
//! Vetores gerados por `node --experimental-strip-types tools/gen-parity-fixtures.mjs`.
use serde_json::Value;
use wh_core::combat::{hunter_damage, strike, StrikeCreature, StrikeHunter};
use wh_core::rng::{clamp, hash, XorShift32};

fn fixtures() -> Value {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../data/parity/alpha01-rng-combat.json");
    serde_json::from_slice(&std::fs::read(p).expect("fixture de paridade ausente")).unwrap()
}

#[test]
fn xorshift32_bit_identical_to_alpha() {
    let f = fixtures();
    let mut n = 0;
    for v in f["rng"].as_array().unwrap() {
        let mut r = XorShift32::new(v["seed"].as_u64().unwrap() as u32);
        for expected in v["values"].as_array().unwrap() {
            assert_eq!(r.next_f64(), expected.as_f64().unwrap());
            n += 1;
        }
        assert_eq!(r.state as u64, v["finalState"].as_u64().unwrap());
    }
    assert_eq!(n, 7 * 64);
}

#[test]
fn hash_bit_identical_to_alpha() {
    let f = fixtures();
    let v = f["hash"].as_array().unwrap();
    assert_eq!(v.len(), 200);
    for h in v {
        let got = hash(h["x"].as_f64().unwrap(), h["z"].as_f64().unwrap(), h["seed"].as_f64().unwrap());
        assert_eq!(got, h["value"].as_f64().unwrap(), "x={} z={} seed={}", h["x"], h["z"], h["seed"]);
    }
}

#[test]
fn clamp_matches_alpha() {
    let f = fixtures();
    for c in f["clamp"].as_array().unwrap() {
        if c["n"].is_null() {
            continue; // NaN: Math.max/min do JS propagam NaN; caso não usado pela simulação
        }
        let got = clamp(c["n"].as_f64().unwrap(), c["a"].as_f64().unwrap(), c["b"].as_f64().unwrap());
        assert_eq!(got, c["value"].as_f64().unwrap());
    }
}

#[test]
fn strike_matches_alpha_for_all_seeded_scenarios() {
    let f = fixtures();
    let v = f["strike"].as_array().unwrap();
    assert_eq!(v.len(), 120);
    for s in v {
        let b = &s["before"];
        let mut h = StrikeHunter {
            x: b["hunter"]["x"].as_f64().unwrap(),
            z: b["hunter"]["z"].as_f64().unwrap(),
            cooldown: b["hunter"]["cooldown"].as_f64().unwrap(),
            forca: b["hunter"]["forca"].as_f64().unwrap(),
            equipped_attack: b["hunter"]["equippedAttack"].as_f64().unwrap(),
            kills: 0,
            haul: 0.0,
        };
        let mut c = StrikeCreature {
            x: b["creature"]["x"].as_f64().unwrap(),
            z: b["creature"]["z"].as_f64().unwrap(),
            hp: b["creature"]["hp"].as_f64().unwrap(),
            food: b["creature"]["food"].as_f64().unwrap(),
        };
        assert_eq!(hunter_damage(h.forca, h.equipped_attack), s["damage"].as_f64().unwrap());
        strike(&mut h, &mut c);
        let a = &s["after"];
        assert_eq!(h.cooldown, a["cooldown"].as_f64().unwrap(), "seed {} k {}", s["seed"], s["k"]);
        assert_eq!(h.kills as u64, a["kills"].as_u64().unwrap());
        assert_eq!(h.haul, a["haul"].as_f64().unwrap());
        assert_eq!(c.hp, a["hp"].as_f64().unwrap());
    }
}
