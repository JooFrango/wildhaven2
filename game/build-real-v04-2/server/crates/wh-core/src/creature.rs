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
use crate::climate::Effects;
use crate::data::Necessidades;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Creature {
    pub id: u64,
    pub species: String,
    #[serde(flatten)]
    pub mv: Mover,
    pub hp: f64,
    pub hp_max: f64,
    pub state: std::borrow::Cow<'static, str>,
    pub clip: std::borrow::Cow<'static, str>,
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
    // ---- V02: necessidades e comportamento (provisório)
    #[serde(skip)]
    pub fome: f64,
    #[serde(skip)]
    pub sede: f64,
    #[serde(skip)]
    pub energia: f64,
    /// Ação temporária em curso (comer, beber, descansar, encarar intruso) até este instante.
    #[serde(skip)]
    pub busy_until_s: f64,
    #[serde(skip)]
    pub water_search_s: f64,
    #[serde(skip)]
    pub prey: Option<u64>,
    /// Instante em que virou carcaça (morta, à espera de ser consumida/decompor).
    pub carcass_since_s: Option<f64>,
    #[serde(skip)]
    pub roam_shift_s: f64,
    /// V04: meio atual ("solo", "ar", "areia") e altura em relação ao chão (voo > 0; submersa < 0, só visual).
    pub meio: String,
    pub alt: f64,
    /// V04: relógio da transição de meio (decolagem/emergência).
    #[serde(skip)]
    pub voo_t: f64,
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
            fome: 0.2 + ((id % 7) as f64) * 0.06,
            sede: 0.1 + ((id % 5) as f64) * 0.08,
            energia: 0.6 + ((id % 4) as f64) * 0.1,
            busy_until_s: 0.0,
            water_search_s: 0.0,
            prey: None,
            carcass_since_s: None,
            roam_shift_s: 0.0,
            meio: crate::meio::MEIO_SOLO.into(),
            alt: 0.0,
            voo_t: 0.0,
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
pub fn detects(t: &mut TerrainStore, c: &Creature, sp: &Species, h: &HunterView, stealth_red: f64, p_per_s: f64, dt: f64, roll: f64, env: &Effects) -> bool {
    let d = c.mv.dist(h.x, h.z);
    let heard = h.moving && !h.crouched && d <= sp.audicao_m * env.audicao;
    if heard {
        return true;
    }
    // olfato: o vento leva o cheiro do Hunter até a criatura (Hunter a barlavento)
    let wmag = (env.wind.0 * env.wind.0 + env.wind.1 * env.wind.1).sqrt();
    if wmag > 0.2 && d > 1.0 {
        let (dx, dz) = ((c.mv.x - h.x) / d, (c.mv.z - h.z) / d);
        let along = (env.wind.0 * dx + env.wind.1 * dz) / wmag;
        if along > 0.6 && d <= sp.audicao_m * 1.25 * env.olfato * along.min(1.0) {
            return true;
        }
    }
    let mut vision = if h.moving { sp.visao_movimento_m } else { sp.visao_parado_m };
    vision *= env.visao;
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

/// O que uma criatura sabe das outras neste tick (presas, predadores, carcaças, bando).
#[derive(Debug, Clone)]
pub struct CreatureView {
    pub id: u64,
    /// V03: `Arc<str>` (antes `String` clonada por criatura por tick).
    pub species: std::sync::Arc<str>,
    pub group: u64,
    pub x: f64,
    pub z: f64,
    pub alive: bool,
    pub carcass: bool,
    pub prey: bool,
    pub mass: f64,
    pub home: (f64, f64),
}

/// Ataque de criatura contra criatura (predação), resolvido depois do laço.
pub struct PreyAttack {
    pub from: u64,
    pub to: u64,
    pub damage: f64,
}

/// Ambiente de um passo (o mesmo para todas as criaturas do tick).
pub struct StepEnv<'a> {
    pub data: &'a GameData,
    pub nec: &'a Necessidades,
    pub dt: f64,
    pub tick: u64,
    pub now: f64,
    pub night: bool,
    /// Nível de relevância: 0 = perto (completo), 1 = médio, 2 = longe (só necessidades/estado).
    pub level: u8,
    /// V04: o hex da criatura é de areia (deserto/dunas/costa arenosa) — define o meio das espécies de subsolo.
    pub areia: bool,
}

fn pick_clip(sp_role_pred: bool, what: &str) -> std::borrow::Cow<'static, str> {
    match what {
        "comer" => if sp_role_pred { "feed" } else { "eat" },
        "beber" => "drink",
        "dormir" => "sleep",
        "descansar" => "rest",
        "encarar" => "growl",
        _ => "idle",
    }
    .into()
}

#[allow(clippy::too_many_arguments)]
pub fn step_creature(
    c: &mut Creature,
    env: &StepEnv,
    eff: &Effects,
    t: &mut TerrainStore,
    portals: &PortalIndex,
    nav: &NavParams,
    hunters: &[&HunterView],
    others: &[&CreatureView],
    shouts: &[Shout],
    tracks: &mut Tracks,
    rng: &mut XorShift32,
    astar_budget: &mut u32,
    attacks: &mut Vec<AttackRequest>,
    prey_attacks: &mut Vec<PreyAttack>,
) {
    let (data, nec, dt, tick, now) = (env.data, env.nec, env.dt, env.tick, env.now);
    if !c.alive {
        c.clip = "death".into();
        if c.carcass_since_s.is_some() {
            c.state = "carcaca".into();
        }
        return;
    }
    let sp = &data.especies[&c.species];
    let predator = sp.papel == "predador";
    c.cooldown_s = (c.cooldown_s - dt).max(0.0);
    // ---- necessidades (provisório): fome e sede sobem; energia cai em atividade e volta em repouso
    let resting = c.state == "descansando" || c.state == "dormindo";
    c.fome = (c.fome + dt / nec.fome_cheia_s).min(1.2);
    c.sede = (c.sede + dt / nec.sede_cheia_s).min(1.2);
    if resting {
        c.energia = (c.energia + dt / nec.recuperacao_energia_s).min(1.0);
        c.hp = (c.hp + c.hp_max * 0.002 * dt).min(c.hp_max); // recuperação em repouso (provisório)
    } else {
        c.energia = (c.energia - dt / nec.energia_duracao_s).max(0.0);
    }
    if now < c.immobilized_until_s {
        c.state = "imobilizada".into();
        c.clip = "idle".into();
        return;
    }
    if env.level >= 2 {
        // longe dos Hunters: só necessidades e estado (sem rota detalhada, sem A*)
        c.state = if c.energia < nec.limiar_cansaco { "descansando" } else if c.fome > nec.limiar_fome { "alimentando" } else { "forrageando" }.into();
        if c.state == "alimentando" { c.fome = (c.fome - dt / 600.0).max(0.0); }
        if c.sede > nec.limiar_sede { c.sede = (c.sede - dt / 900.0).max(0.0); }
        return;
    }
    let stealth_red = data.furtividade.reducao_deteccao_por_nivel;
    let p_s = data.furtividade.chance_deteccao_por_segundo;
    // acompanhar ameaça já confirmada: mesmo alcance da V01; detectar nova: inclui o olfato (a favor do vento)
    let keep = sp.visao_movimento_m.max(sp.audicao_m);
    let reach = keep.max(sp.audicao_m * 1.25 * eff.olfato);
    let mut seen: Option<&HunterView> = c.target_hunter.as_ref().and_then(|id| hunters.iter().find(|h| &h.id == id && h.hp > 0.0 && c.mv.dist(h.x, h.z) <= keep).copied());
    // V04: submersa na areia não enxerga; percebe pela VIBRAÇÃO dos passos (agachado vibra bem menos)
    let submersa = c.meio == crate::meio::MEIO_AREIA;
    if submersa {
        let vib = sp.subsolo.as_ref().map(|s| s.vibracao_m).unwrap_or(sp.audicao_m);
        seen = hunters.iter().filter(|h| h.hp > 0.0 && c.mv.dist(h.x, h.z) <= if h.moving && !h.crouched { vib } else { vib * 0.25 }).min_by(|a, b| c.mv.dist(a.x, a.z).partial_cmp(&c.mv.dist(b.x, b.z)).unwrap()).copied();
    }
    if seen.is_none() && !submersa {
        seen = hunters
            .iter()
            .filter(|h| h.hp > 0.0 && c.mv.dist(h.x, h.z) <= reach)
            .filter(|h| {
                let roll = rng.next_f64();
                detects(t, c, sp, h, stealth_red, p_s, dt, roll, eff)
            })
            .min_by(|a, b| c.mv.dist(a.x, a.z).partial_cmp(&c.mv.dist(b.x, b.z)).unwrap())
            .copied();
    }
    // presas também fogem de predadores de outras espécies que estejam perto e à vista
    let predator_near = if !predator {
        others.iter().filter(|o| o.alive && !o.prey && *o.species != *c.species && c.mv.dist(o.x, o.z) < sp.visao_movimento_m * eff.visao * 0.8).min_by(|a, b| c.mv.dist(a.x, a.z).partial_cmp(&c.mv.dist(b.x, b.z)).unwrap()).map(|o| (*o).clone())
    } else { None };
    let low_hp = c.hp < c.hp_max * 0.25;
    let mut speed = sp.andar_mps;
    let sprint = |c: &mut Creature, speed: &mut f64| {
        if c.sprint_left_s > 0.0 {
            *speed = sp.correr_mps;
            c.sprint_left_s -= dt;
        }
    };
    if let Some(h) = seen.cloned() {
        c.busy_until_s = 0.0;
        if predator && !low_hp {
            c.state = "perseguindo".into();
            c.target_hunter = Some(h.id.clone());
            let d = c.mv.dist(h.x, h.z);
            // subsolo: emerge para o bote quando o alvo está a ~2 alcances de ataque
            if let Some(sub) = sp.subsolo.as_ref() {
                speed = crate::meio::step_subsolo(c, sub, env.areia, d <= sp.alcance_ataque_m * 2.0 + 2.0, true, now, speed);
            }
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
            sprint(c, &mut speed);
        } else {
            flee_from(c, h.x, h.z);
            sprint(c, &mut speed);
        }
    } else if let Some(p) = predator_near {
        c.busy_until_s = 0.0;
        c.target_hunter = None;
        flee_from(c, p.x, p.z);
        sprint(c, &mut speed);
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
        if c.lure.is_none() && !decide_needs(c, sp, predator, env, eff, t, others, rng, &mut speed, prey_attacks) {
            return; // ação parada (comer, beber, descansar, encarar)
        }
    }
    // V04: voo — decola/voa/pousa sem o A* do chão (o ar não tem os bloqueios do relevo)
    if let Some(voo) = sp.voo.as_ref() {
        let fleeing = c.state == "fugindo";
        if crate::meio::step_voo(c, voo, t, dt, fleeing) {
            return;
        }
    }
    // V04: subsolo — fora do bote, segue submersa (cruzeiro) quando há areia sob ela
    if let Some(sub) = sp.subsolo.as_ref() {
        if c.state != "perseguindo" {
            speed = crate::meio::step_subsolo(c, sub, env.areia, false, false, now, speed);
        }
    }
    if c.mv.target.is_none() {
        c.clip = if c.meio == crate::meio::MEIO_AREIA { "swim_sand".into() } else if c.state == "forrageando" && c.species == "folhisco" { "peck".into() } else { "idle".into() };
        return;
    }
    // orçamento de A* por tick: quem precisa replanejar e não tem orçamento espera o próximo tick
    let needs_plan = c.mv.path_idx >= c.mv.path.len();
    if needs_plan {
        if *astar_budget == 0 {
            c.clip = "idle".into();
            return;
        }
        *astar_budget -= 1;
    }
    let small_nav = NavParams { max_expansions: 20_000, margin_m: 24.0, ..*nav };
    match c.mv.advance(t, portals, &small_nav, speed * eff.locomocao, dt, 1.0, 40.0, tick, now) {
        Step::Arrived => {
            c.idle_until_s = now + 3.0 + rng.next_f64() * 8.0;
            if c.state == "fugindo" {
                c.home = (c.mv.x, c.mv.z);
            }
            if c.state == "buscando_agua" {
                c.state = "bebendo".into();
                c.busy_until_s = now + 10.0;
            }
        }
        Step::Blocked => {
            if c.mv.fails > 3 {
                c.mv.stop();
                c.idle_until_s = now + 2.0;
                if c.state == "buscando_agua" { c.state = "forrageando".into(); c.water_search_s = now + 60.0; }
            }
        }
        Step::Moving => {}
    }
    if c.meio == crate::meio::MEIO_AREIA {
        c.clip = if speed > sp.subsolo.as_ref().map(|s| s.cruzeiro_mps).unwrap_or(sp.andar_mps) { "swim_fast".into() } else { "swim_sand".into() };
        return; // submersa: sem pegadas
    }
    c.clip = if speed > sp.andar_mps { "run".into() } else { "walk".into() };
    emit_footprint(c, data, t, tracks, now, eff.apaga_rastros);
}

fn flee_from(c: &mut Creature, x: f64, z: f64) {
    c.state = "fugindo".into();
    let (dx, dz) = (c.mv.x - x, c.mv.z - z);
    let d = (dx * dx + dz * dz).sqrt().max(0.1);
    c.mv.go_to(c.mv.x + dx / d * 40.0, c.mv.z + dz / d * 40.0, 15.0);
}

/// Comportamento sem ameaça: descanso, água, alimentação (pasto ou predação/carniça),
/// território, coesão do bando e exploração. Retorna false quando a criatura está parada numa ação.
#[allow(clippy::too_many_arguments)]
fn decide_needs(c: &mut Creature, sp: &Species, predator: bool, env: &StepEnv, eff: &Effects, t: &mut TerrainStore, others: &[&CreatureView], rng: &mut XorShift32, speed: &mut f64, prey_attacks: &mut Vec<PreyAttack>) -> bool {
    let (nec, now, dt) = (env.nec, env.now, env.dt);
    // ação temporária em curso
    if now < c.busy_until_s {
        c.mv.stop();
        let what = match &*c.state { "bebendo" => "beber", "alimentando" => "comer", "dormindo" => "dormir", "descansando" => "descansar", "territorial" => "encarar", _ => "idle" };
        c.clip = pick_clip(predator, what);
        if c.state == "bebendo" { c.sede = (c.sede - dt / 8.0).max(0.0); }
        if c.state == "alimentando" { c.fome = (c.fome - dt / if predator { 30.0 } else { 18.0 }).max(0.0); }
        return false;
    }
    // descanso: cansaço, ou presas à noite
    let night_rest = env.night && !predator && nec.presas_descansam_a_noite;
    if c.energia < nec.limiar_cansaco || (night_rest && c.energia < 0.98) || ((c.state == "descansando" || c.state == "dormindo") && c.energia < 0.9) {
        c.mv.stop();
        c.state = if env.night { "dormindo" } else { "descansando" }.into();
        c.clip = pick_clip(predator, if env.night { "dormir" } else { "descansar" });
        return false;
    }
    // sede: procurar água no relevo compilado (anel de amostras, no máx. a cada 60 s)
    if c.sede > nec.limiar_sede && c.state != "buscando_agua" && now >= c.water_search_s {
        c.water_search_s = now + 60.0;
        let mut best: Option<(f64, f64, f64)> = None;
        let mut r = 16.0;
        while r <= nec.busca_agua_raio_m && best.is_none() {
            for k in 0..16 {
                let a = k as f64 / 16.0 * std::f64::consts::TAU;
                let (x, z) = (c.mv.x + a.cos() * r, c.mv.z + a.sin() * r);
                if t.sample(x, z).map(|cell| cell.water.is_some()).unwrap_or(false) {
                    // margem: um passo antes da água (onde dá para pisar)
                    let (bx, bz) = (c.mv.x + a.cos() * (r - 4.0), c.mv.z + a.sin() * (r - 4.0));
                    best = Some((bx, bz, r));
                    break;
                }
            }
            r += 24.0;
        }
        if let Some((x, z, _)) = best {
            c.state = "buscando_agua".into();
            c.mv.go_to(x, z, 2.5);
            return true;
        }
        // sem água por perto: muda o território na direção de um ponto aleatório (exploração)
        let a = rng.next_f64() * std::f64::consts::TAU;
        c.home = (c.home.0 + a.cos() * 150.0, c.home.1 + a.sin() * 150.0);
        c.sede = nec.limiar_sede * 0.7;
        c.state = "explorando".into();
        c.mv.go_to(c.home.0, c.home.1, 4.0);
        return true;
    }
    if c.state == "buscando_agua" && c.mv.target.is_some() {
        return true;
    }
    // fome
    if c.fome > nec.limiar_fome {
        if predator {
            // carniça perto primeiro; depois presa viva de outra espécie (até 1,5× a massa)
            let carcass = others.iter().filter(|o| o.carcass && c.mv.dist(o.x, o.z) < 200.0).min_by(|a, b| c.mv.dist(a.x, a.z).partial_cmp(&c.mv.dist(b.x, b.z)).unwrap());
            if let Some(o) = carcass {
                if c.mv.dist(o.x, o.z) < 2.5 {
                    c.state = "alimentando".into();
                    c.busy_until_s = now + 35.0;
                    c.mv.stop();
                    return false;
                }
                c.state = "carnica".into();
                c.mv.go_to(o.x, o.z, 2.0);
                return true;
            }
            let vis = sp.visao_movimento_m * eff.visao * 1.6;
            let target = c.prey.and_then(|id| others.iter().find(|o| o.id == id && o.alive)).or_else(|| {
                others.iter().filter(|o| o.alive && o.prey && *o.species != *c.species && o.mass <= sp.massa_kg * 1.5 && c.mv.dist(o.x, o.z) < vis).min_by(|a, b| c.mv.dist(a.x, a.z).partial_cmp(&c.mv.dist(b.x, b.z)).unwrap())
            });
            if let Some(o) = target.cloned() {
                c.prey = Some(o.id);
                c.state = "cacando".into();
                let d = c.mv.dist(o.x, o.z);
                if d <= sp.alcance_ataque_m {
                    c.mv.stop();
                    c.clip = "bite".into();
                    if c.cooldown_s <= 0.0 {
                        prey_attacks.push(PreyAttack { from: c.id, to: o.id, damage: sp.dano });
                        c.cooldown_s = sp.recarga_ataque_s;
                    }
                    return false;
                }
                if d > vis * 1.5 { c.prey = None; }
                c.mv.go_to(o.x, o.z, 1.5);
                if c.sprint_left_s > 0.0 && d < 40.0 { *speed = sp.correr_mps; c.sprint_left_s -= dt; }
                return true;
            }
            c.prey = None;
            // patrulha o território (maior que a área de forrageio)
            if c.mv.target.is_none() && now >= c.idle_until_s {
                c.state = "patrulhando".into();
                let a = rng.next_f64() * std::f64::consts::TAU;
                let r = sp.raio_forrageio_m * nec.territorio_fator * rng.next_f64().sqrt();
                c.mv.go_to(c.home.0 + a.cos() * r, c.home.1 + a.sin() * r, 2.0);
            }
            return true;
        }
        // presa: pasta perto de casa
        if c.mv.target.is_none() && now >= c.idle_until_s {
            if rng.next_f64() < 0.5 {
                c.state = "alimentando".into();
                c.busy_until_s = now + 12.0 + rng.next_f64() * 14.0;
                c.mv.stop();
                return false;
            }
        }
    }
    // território: predador encara outro adulto da mesma espécie (outro grupo) perto de casa
    if predator {
        if let Some(o) = others.iter().find(|o| o.alive && *o.species == *c.species && o.group != c.group && c.mv.dist(o.x, o.z) < 25.0) {
            let mine = ((o.x - c.home.0).powi(2) + (o.z - c.home.1).powi(2)).sqrt() < ((o.x - o.home.0).powi(2) + (o.z - o.home.1).powi(2)).sqrt();
            if mine {
                c.state = "territorial".into();
                c.busy_until_s = now + 6.0;
                c.mv.stop();
                c.mv.heading = (o.x - c.mv.x).atan2(o.z - c.mv.z);
                return false;
            }
            // intruso recua para o próprio território
            c.state = "recuando".into();
            c.mv.go_to(c.home.0, c.home.1, 6.0);
            return true;
        }
    }
    // coesão do bando: segue o líder (menor id vivo do grupo) quando se afasta demais
    if let Some(l) = others.iter().filter(|o| o.alive && o.group == c.group && o.id != c.id).min_by_key(|o| o.id) {
        if l.id < c.id && c.mv.dist(l.x, l.z) > 30.0 {
            c.state = "seguindo_bando".into();
            c.home = l.home;
            c.mv.go_to(l.x, l.z, 6.0);
            return true;
        }
    }
    // exploração: de tempos em tempos desloca a área de vida
    if now >= c.roam_shift_s {
        c.roam_shift_s = now + 600.0 + rng.next_f64() * 900.0;
        if rng.next_f64() < 0.35 {
            let a = rng.next_f64() * std::f64::consts::TAU;
            c.home = (c.home.0 + a.cos() * 90.0, c.home.1 + a.sin() * 90.0);
            c.state = "explorando".into();
            c.mv.go_to(c.home.0, c.home.1, 4.0);
            return true;
        }
    }
    if c.mv.target.is_none() && now >= c.idle_until_s {
        c.state = "forrageando".into();
        let a = rng.next_f64() * std::f64::consts::TAU;
        let r = 4.0 + rng.next_f64() * (sp.raio_forrageio_m - 4.0).max(1.0);
        c.mv.go_to(c.home.0 + a.cos() * r, c.home.1 + a.sin() * r, 1.0);
    }
    true
}

fn emit_footprint(c: &mut Creature, data: &GameData, t: &mut TerrainStore, tracks: &mut Tracks, now: f64, rain_erases: bool) {
    let (lx, lz) = c.last_print;
    if ((c.mv.x - lx).powi(2) + (c.mv.z - lz).powi(2)).sqrt() < data.rastros.passo_m {
        return;
    }
    c.last_print = (c.mv.x, c.mv.z);
    let wet = t.sample(c.mv.x, c.mv.z).map(|cell| cell.water.is_some()).unwrap_or(true);
    if wet || rain_erases {
        // água interrompe o rastro; chuva/areia/nevasca fortes apagam a pegada (clima V7)
        c.pending_break = true;
        return;
    }
    tracks.push(c.id, &c.species, c.mv.x, c.mv.z, now, c.pending_break, data.rastros.max_por_criatura);
    c.pending_break = false;
}
