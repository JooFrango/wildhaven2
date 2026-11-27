//! Criaturas no mundo: spawn determinístico por hex/bioma, percepção da ficha
//! (visão em movimento/parado, audição), presa foge, predador persegue e ataca,
//! pegadas compactas emitidas ao andar (sem pegada na água: rastro interrompido).

use crate::data::{GameData, Species};
use crate::mover::{Mover, Step};
use crate::nav::NavParams;
use crate::portals::PortalIndex;
use crate::rng::XorShift32;
use crate::terrain::TerrainStore;
use crate::tracks::Tracks;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Creature {
    pub id: u64,
    pub species: String,
    #[serde(flatten)]
    pub mv: Mover,
    pub hp: f64,
    pub hp_max: f64,
    pub state: String,
    pub clip: String,
    pub group: u64,
    #[serde(skip)]
    pub home: (f64, f64),
    #[serde(skip)]
    pub sprint_left_s: f64,
    #[serde(skip)]
    pub cooldown_s: f64,
    pub immobilized_until_s: f64,
    #[serde(skip)]
    pub idle_until_s: f64,
    pub target_hunter: Option<String>,
    pub alive: bool,
    pub looted: bool,
    #[serde(skip)]
    pub last_print: (f64, f64),
    #[serde(skip)]
    pub pending_break: bool,
    #[serde(skip)]
    pub lure: Option<(f64, f64, f64)>,
}

/// O que a criatura sabe dos Hunters próximos neste tick.
#[derive(Debug, Clone)]
pub struct HunterView {
    pub id: String,
    pub x: f64,
    pub z: f64,
    pub moving: bool,
    pub crouched: bool,
    pub stealth: u32,
    pub hp: f64,
}

#[derive(Debug, Clone)]
pub struct Shout {
    pub x: f64,
    pub z: f64,
    pub t: f64,
}

pub struct AttackRequest {
    pub creature: u64,
    pub hunter: String,
    pub damage: f64,
}

impl Creature {
    pub fn spawn(id: u64, species: &str, sp: &Species, group: u64, x: f64, z: f64, tile: &str) -> Self {
        Self {
            id,
            species: species.into(),
            mv: Mover::new(x, z, tile),
            hp: sp.hp,
            hp_max: sp.hp,
            state: "forrageando".into(),
            clip: "idle".into(),
            group,
            home: (x, z),
            sprint_left_s: sp.correr_max_s,
            cooldown_s: 0.0,
            immobilized_until_s: 0.0,
            idle_until_s: 0.0,
            target_hunter: None,
            alive: true,
            looted: false,
            last_print: (x, z),
            pending_break: false,
            lure: None,
        }
    }
}

/// Linha de visão sobre o relevo compilado (amostras a cada 4 m, olhos a 1,6 m / 0,4 m).
pub fn line_of_sight(t: &mut TerrainStore, ax: f64, az: f64, ay: f64, bx: f64, bz: f64, by: f64) -> bool {
    let d = ((bx - ax).powi(2) + (bz - az).powi(2)).sqrt();
    let n = (d / 4.0).ceil() as usize;
    for i in 1..n {
        let f = i as f64 / n as f64;
        let (x, z) = (ax + (bx - ax) * f, az + (bz - az) * f);
        if let Some(c) = t.sample(x, z) {
            if c.h > ay + (by - ay) * f {
                return false;
            }
        }
    }
    true
}

/// Detecção de um Hunter pela criatura (ficha: visão em movimento/parado, audição,
/// ponto cego traseiro). Visão é probabilística por segundo e cai com a distância.
#[allow(clippy::too_many_arguments)]
pub fn detects(t: &mut TerrainStore, c: &Creature, sp: &Species, h: &HunterView, stealth_red: f64, p_per_s: f64, dt: f64, roll: f64) -> bool {
    let d = c.mv.dist(h.x, h.z);
    let heard = h.moving && !h.crouched && d <= sp.audicao_m;
    if heard {
        return true;
    }
    // agachado e lento conta como alvo "parado" para a visão (ficha: detectStillTargetM)
    let mut vision = if h.moving && !h.crouched { sp.visao_movimento_m } else { sp.visao_parado_m };
    if h.crouched {
        vision *= (1.0 - stealth_red * h.stealth as f64).max(0.2);
    }
    if d > vision {
        return false;
    }
    // ponto cego traseiro: ângulo entre o "para frente" da criatura e a direção do Hunter
    if sp.ponto_cego_traseiro_graus > 0.0 && d > 1.0 {
        let (fx, fz) = (c.mv.heading.sin(), c.mv.heading.cos());
        let (dx, dz) = ((h.x - c.mv.x) / d, (h.z - c.mv.z) / d);
        let ang = (fx * dx + fz * dz).clamp(-1.0, 1.0).acos().to_degrees();
        if ang > 180.0 - sp.ponto_cego_traseiro_graus / 2.0 {
            return false;
        }
    }
    let p = (p_per_s * (1.0 - d / vision).max(0.05) * dt).min(1.0);
    if d > 3.0 && roll >= p {
        return false;
    }
    let hy = t.sample(h.x, h.z).map(|c| c.h).unwrap_or(c.mv.y);
    line_of_sight(t, c.mv.x, c.mv.z, c.mv.y + 0.4, h.x, h.z, hy + 1.6)
}

#[allow(clippy::too_many_arguments)]
pub fn step_creature(
    c: &mut Creature,
    data: &GameData,
    t: &mut TerrainStore,
    portals: &PortalIndex,
    nav: &NavParams,
    hunters: &[HunterView],
    shouts: &[Shout],
    tracks: &mut Tracks,
    rng: &mut XorShift32,
    dt: f64,
    tick: u64,
    now: f64,
    attacks: &mut Vec<AttackRequest>,
) {
    if !c.alive {
        c.clip = "death".into();
        return;
    }
    let sp = &data.especies[&c.species];
    c.cooldown_s = (c.cooldown_s - dt).max(0.0);
    if now < c.immobilized_until_s {
        c.state = "imobilizada".into();
        c.clip = "idle".into();
        return;
    }
    let stealth_red = data.furtividade.reducao_deteccao_por_nivel;
    let p_s = data.furtividade.chance_deteccao_por_segundo;
    // ameaça já confirmada continua acompanhada enquanto estiver perto (sem rolar de novo)
    // predador mantém a presa confirmada; a presa só reage a nova detecção
    let mut seen: Option<&HunterView> = if sp.papel == "predador" {
        c.target_hunter.as_ref().and_then(|id| hunters.iter().find(|h| &h.id == id && h.hp > 0.0 && c.mv.dist(h.x, h.z) <= sp.visao_movimento_m.max(sp.audicao_m)))
    } else {
        None
    };
    if sp.papel != "predador" && c.state == "fugindo" && c.mv.target.is_some() {
        // já fugindo: termina a fuga antes de reavaliar
        seen = None;
    }
    if seen.is_none() {
        seen = hunters
            .iter()
            .filter(|h| h.hp > 0.0 && c.mv.dist(h.x, h.z) <= sp.visao_movimento_m.max(sp.audicao_m))
            .filter(|h| {
                let roll = rng.next_f64();
                detects(t, c, sp, h, stealth_red, p_s, dt, roll)
            })
            .min_by(|a, b| c.mv.dist(a.x, a.z).partial_cmp(&c.mv.dist(b.x, b.z)).unwrap());
    }
    let predator = sp.papel == "predador";
    let low_hp = c.hp < c.hp_max * 0.25;
    let mut speed = sp.andar_mps;
    if let Some(h) = seen.cloned() {
        if predator && !low_hp {
            c.state = "perseguindo".into();
            c.target_hunter = Some(h.id.clone());
            let d = c.mv.dist(h.x, h.z);
            if d <= sp.alcance_ataque_m {
                c.mv.stop();
                c.clip = "bite".into();
                if c.cooldown_s <= 0.0 {
                    attacks.push(AttackRequest { creature: c.id, hunter: h.id.clone(), damage: sp.dano });
                    c.cooldown_s = sp.recarga_ataque_s;
                }
                return;
            }
            c.mv.go_to(h.x, h.z, 3.0);
            if c.sprint_left_s > 0.0 {
                speed = sp.correr_mps;
                c.sprint_left_s -= dt;
            }
        } else {
            // presa (ou predador muito ferido): foge para longe da ameaça
            c.state = "fugindo".into();
            c.target_hunter = Some(h.id.clone());
            let (dx, dz) = (c.mv.x - h.x, c.mv.z - h.z);
            let d = (dx * dx + dz * dz).sqrt().max(0.1);
            c.mv.go_to(c.mv.x + dx / d * 40.0, c.mv.z + dz / d * 40.0, 15.0);
            if c.sprint_left_s > 0.0 {
                speed = sp.correr_mps;
                c.sprint_left_s -= dt;
            }
        }
    } else if sp.papel != "predador" && c.state == "fugindo" && c.mv.target.is_some() {
        if c.sprint_left_s > 0.0 {
            speed = sp.correr_mps;
            c.sprint_left_s -= dt;
        }
    } else {
        c.sprint_left_s = (c.sprint_left_s + dt * 0.5).min(sp.correr_max_s);
        c.target_hunter = None;
        // predador atraído por grito recente
        if predator {
            if let Some(s) = shouts.iter().filter(|s| now - s.t < 30.0 && c.mv.dist(s.x, s.z) <= data.armadilhas.grito_alcance_m).last() {
                c.lure = Some((s.x, s.z, s.t));
            }
        }
        if let Some((lx, lz, lt)) = c.lure {
            if now - lt > 60.0 || c.mv.dist(lx, lz) < 2.0 {
                c.lure = None;
            } else {
                c.state = "atraida".into();
                c.mv.go_to(lx, lz, 3.0);
            }
        }
        if c.lure.is_none() {
            if c.mv.target.is_none() && now >= c.idle_until_s {
                c.state = "forrageando".into();
                let a = rng.next_f64() * std::f64::consts::TAU;
                let r = 4.0 + rng.next_f64() * (sp.raio_forrageio_m - 4.0).max(1.0);
                c.mv.go_to(c.home.0 + a.cos() * r, c.home.1 + a.sin() * r, 1.0);
            }
        }
    }
    if c.mv.target.is_none() {
        c.clip = if c.species == "folhisco" { "peck".into() } else { "idle".into() };
        return;
    }
    let small_nav = NavParams { max_expansions: 20_000, margin_m: 24.0, ..*nav };
    match c.mv.advance(t, portals, &small_nav, speed, dt, 1.0, 40.0, tick, now) {
        Step::Arrived => {
            let (p0, p1) = sp.pausa_forrageio_s;
            c.idle_until_s = now + p0 + rng.next_f64() * (p1 - p0);
            if c.state == "fugindo" {
                c.home = (c.mv.x, c.mv.z);
            }
        }
        Step::Blocked => {
            if c.mv.fails > 3 {
                c.mv.stop();
                c.idle_until_s = now + 2.0;
            }
        }
        Step::Moving => {}
    }
    c.clip = if speed > sp.andar_mps { "run".into() } else { "walk".into() };
    emit_footprint(c, data, t, tracks, now);
}

fn emit_footprint(c: &mut Creature, data: &GameData, t: &mut TerrainStore, tracks: &mut Tracks, now: f64) {
    let (lx, lz) = c.last_print;
    if ((c.mv.x - lx).powi(2) + (c.mv.z - lz).powi(2)).sqrt() < data.rastros.passo_m {
        return;
    }
    c.last_print = (c.mv.x, c.mv.z);
    let wet = t.sample(c.mv.x, c.mv.z).map(|cell| cell.water.is_some()).unwrap_or(true);
    if wet {
        c.pending_break = true; // água interrompe o rastro: nenhuma pegada registrada
        return;
    }
    tracks.push(c.id, &c.species, c.mv.x, c.mv.z, now, c.pending_break, data.rastros.max_por_criatura);
    c.pending_break = false;
}
