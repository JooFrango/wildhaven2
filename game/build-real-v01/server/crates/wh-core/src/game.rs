//! Gameplay autoritativo da fatia demonstrável: ordens do jogador (explorar, caçar),
//! expedições a pé ou de carroça (2 carroças: Chad e Nailon, 6 vagas cada, com custo),
//! acampamento em clareira, busca e rastreamento de pegadas, estratégia autônoma
//! (furtiva/rodeio ou armadilha + grito), combate (regra portada da Alpha), Desvio,
//! ferimentos, resgate e morte permanente. Bestiário e Conhecimento de Monstros.
//! Parâmetros: `data/gameplay-provisorio-v01.json` (PROVISÓRIOS, ver o arquivo).

use crate::bestiary::Bestiary;
use crate::combat::{strike, StrikeCreature, StrikeHunter, StrikeOutcome};
use crate::creature::{line_of_sight, step_creature, AttackRequest, Creature, HunterView, Shout};
use crate::data::GameData;
use crate::hunter::{Activity, Goal, Hunter, HunterState};
use crate::mover::{Mover, Step};
use crate::nav::{walkable_cell, NavParams};
use crate::portals::PortalIndex;
use crate::rng::XorShift32;
use crate::terrain::TerrainStore;
use crate::tracks::{Footprint, Tracks};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wagon {
    pub id: String,
    pub driver: String,
    #[serde(flatten)]
    pub mv: Mover,
    pub state: String,
    pub passengers: Vec<String>,
    pub storage: Vec<String>,
    pub expedition: Option<u32>,
    #[serde(skip)]
    pub route: Vec<(f64, f64)>,
    #[serde(skip)]
    pub route_idx: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Camp {
    pub id: u32,
    pub expedition: u32,
    pub x: f64,
    pub z: f64,
    pub tile: String,
    pub storage: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trap {
    pub id: u32,
    pub owner: String,
    pub kind: String,
    pub x: f64,
    pub z: f64,
    pub armed: bool,
    pub caught: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expedition {
    pub id: u32,
    pub species: String,
    pub members: Vec<String>,
    pub transporte: String,
    pub wagon: Option<String>,
    pub dest_tile: String,
    pub dest: (f64, f64),
    pub camp: Option<u32>,
    pub state: String,
    pub kills: u32,
    pub rescuer: Option<String>,
    pub cost: f64,
    pub threat: Option<u64>,
    pub started_tick: u64,
    #[serde(default)]
    pub rescued: bool,
    #[serde(default)]
    pub hunt_started_s: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub tick: u64,
    pub t: f64,
    pub kind: String,
    pub text: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct GameState {
    pub hunters: Vec<Hunter>,
    pub wagons: Vec<Wagon>,
    pub camps: Vec<Camp>,
    pub expeditions: Vec<Expedition>,
    pub bestiary: Bestiary,
    pub money: f64,
    pub village: (f64, f64),
    pub village_tile: String,
    pub village_storage: Vec<String>,
    pub events: VecDeque<Event>,
    pub next_id: u64,
    pub rng: u32,
    pub traps: Vec<Trap>,
    #[serde(skip)]
    pub creatures: Vec<Creature>,
    #[serde(skip)]
    pub spawned: BTreeSet<String>,
    #[serde(skip)]
    pub tracks: Tracks,
    #[serde(skip)]
    pub shouts: Vec<Shout>,
    #[serde(skip)]
    seen: HashMap<(String, u64), f64>,
    #[serde(skip)]
    pub pending_save: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Order {
    Explorar { hunters: Vec<String> },
    Cacar { species: String, hunters: Vec<String>, transporte: String, carroca: Option<String> },
    Recolher { hunters: Vec<String> },
}

#[derive(Debug, Serialize)]
pub struct GameView<'a> {
    pub money: f64,
    pub creatures: Vec<&'a Creature>,
    pub wagons: &'a [Wagon],
    pub camps: &'a [Camp],
    pub expeditions: &'a [Expedition],
    pub bestiary: &'a Bestiary,
    pub tracks: Vec<Footprint>,
    pub traps: &'a [Trap],
    pub events: Vec<&'a Event>,
    pub village: (f64, f64),
    pub village_storage: &'a [String],
}

pub struct Ctx<'a> {
    pub t: &'a mut TerrainStore,
    pub portals: &'a PortalIndex,
    pub nav: &'a NavParams,
    pub data: &'a GameData,
    pub dt: f64,
    pub tick: u64,
    pub now: f64,
}

fn d2(a: (f64, f64), b: (f64, f64)) -> f64 {
    ((a.0 - b.0).powi(2) + (a.1 - b.1).powi(2)).sqrt()
}

impl GameState {
    pub fn new(data: &GameData, village: (f64, f64), village_tile: &str, walk: f64, seed: u32, t: &mut TerrainStore) -> Self {
        let mut g = GameState { money: data.economia.dinheiro_inicial, village, village_tile: village_tile.into(), rng: seed.max(1), ..Default::default() };
        let mut slots = walkable_ring(t, village, 2.5, 24);
        let mut take = |g: &mut GameState| -> (f64, f64) {
            let p = if slots.is_empty() { village } else { slots.remove(0) };
            let _ = g;
            p
        };
        for (i, d) in data.hunters.lista.iter().enumerate() {
            let (x, z) = take(&mut g);
            g.hunters.push(Hunter::from_def(d, "hunter", data.hunters.hp_base, x, z, village_tile, walk, seed.wrapping_add(7919 * (i as u32 + 1))));
        }
        for (i, w) in data.carrocas.lista.iter().enumerate() {
            let (x, z) = take(&mut g);
            g.wagons.push(Wagon { id: w.id.clone(), driver: w.condutor.clone(), mv: Mover::new(x, z, village_tile), state: "na_vila".into(), passengers: vec![], storage: vec![], expedition: None, route: vec![], route_idx: 0 });
            if let Some(d) = data.hunters.socorristas.iter().find(|s| s.id == w.id) {
                let mut h = Hunter::from_def(d, "socorrista", data.hunters.hp_base, x, z, village_tile, walk, seed.wrapping_add(104_729 * (i as u32 + 1)));
                h.activity = Activity::Conduzindo;
                h.wagon = Some(w.id.clone());
                g.hunters.push(h);
            }
        }
        for h in g.hunters.iter_mut() {
            h.mv.snap_y(t);
        }
        for w in g.wagons.iter_mut() {
            w.mv.snap_y(t);
        }
        g
    }

    fn rand(&mut self) -> f64 {
        let mut r = XorShift32::new(self.rng);
        let v = r.next_f64();
        self.rng = r.state;
        v
    }

    pub fn event(&mut self, tick: u64, t: f64, kind: &str, text: String) {
        self.events.push_back(Event { tick, t, kind: kind.into(), text });
        while self.events.len() > 300 {
            self.events.pop_front();
        }
    }

    pub fn actor_positions(&self) -> Vec<(f64, f64)> {
        let mut v: Vec<(f64, f64)> = self.hunters.iter().filter(|h| h.alive && h.carried_by.is_none()).map(|h| (h.mv.x, h.mv.z)).collect();
        v.extend(self.wagons.iter().map(|w| (w.mv.x, w.mv.z)));
        v.sort_by(|a, b| a.partial_cmp(b).unwrap());
        v.dedup_by(|a, b| d2(*a, *b) < 64.0);
        v
    }

    // ------------------------------------------------------------------ ordens
    pub fn order(&mut self, o: Order, ctx: &mut Ctx) -> Result<String, String> {
        match o {
            Order::Explorar { hunters } => {
                let mut n = 0;
                for id in &hunters {
                    let h = self.hunters.iter_mut().find(|h| &h.id == id).ok_or(format!("Hunter desconhecido: {id}"))?;
                    if h.role != "hunter" || !h.alive || h.activity != Activity::NaVila {
                        return Err(format!("{} não está disponível na vila", h.name));
                    }
                    h.activity = Activity::Patrulhando;
                    h.goal = None;
                    n += 1;
                }
                let txt = format!("Ordem: explorar ({n} Hunters)");
                self.event(ctx.tick, ctx.now, "ordem", txt.clone());
                Ok(txt)
            }
            Order::Recolher { hunters } => {
                for id in &hunters {
                    if let Some(h) = self.hunters.iter_mut().find(|h| &h.id == id && h.activity == Activity::Patrulhando) {
                        h.activity = Activity::VoltandoVila;
                        h.route.clear();
                    }
                }
                Ok("Ordem: recolher à vila".into())
            }
            Order::Cacar { species, hunters, transporte, carroca } => self.order_hunt(species, hunters, transporte, carroca, ctx),
        }
    }

    fn order_hunt(&mut self, species: String, ids: Vec<String>, transporte: String, carroca: Option<String>, ctx: &mut Ctx) -> Result<String, String> {
        let page = self.bestiary.pages.get(&species).ok_or("Espécie sem página no Bestiário: avistar antes de caçar")?;
        if ids.is_empty() {
            return Err("Selecione ao menos um Hunter".into());
        }
        if transporte == "carroca" && ids.len() > ctx.data.carrocas.capacidade {
            return Err(format!("A carroça leva no máximo {} Hunters (pedido: {})", ctx.data.carrocas.capacidade, ids.len()));
        }
        let mut seen_ids = HashSet::new();
        for id in &ids {
            if !seen_ids.insert(id) {
                return Err("Hunter repetido".into());
            }
            let h = self.hunters.iter().find(|h| &h.id == id).ok_or(format!("Hunter desconhecido: {id}"))?;
            if h.role != "hunter" || !h.alive || h.activity != Activity::NaVila {
                return Err(format!("{} não está disponível na vila", h.name));
            }
        }
        // destino: ponto de avistamento registrado (mapinha), nunca a posição atual do animal
        let (tile, x, z) = page
            .pontos
            .iter()
            .filter(|(tl, _, _)| ctx.t.is_allowed(tl) && tl != &self.village_tile)
            .min_by(|a, b| d2((a.1, a.2), self.village).partial_cmp(&d2((b.1, b.2), self.village)).unwrap())
            .cloned()
            .ok_or("Nenhum habitat avistado em hex liberado")?;
        let route = route_between(ctx.t, ctx.portals, &self.village_tile, &tile, (x, z)).ok_or("Sem rota por portais validados até o habitat")?;
        let km = d2(self.village, (x, z)) / 1000.0;
        let (mut cost, mut wagon) = (0.0, None);
        if transporte == "carroca" {
            let wid = carroca.ok_or("Escolha a carroça (chad ou nailon)")?;
            let cap = ctx.data.carrocas.capacidade;
            let w = self.wagons.iter().find(|w| w.id == wid).ok_or("Carroça desconhecida")?;
            if w.state != "na_vila" {
                return Err(format!("A carroça de {} não está na vila", w.driver));
            }
            if ids.len() > cap {
                return Err(format!("A carroça leva no máximo {cap} Hunters (pedido: {})", ids.len()));
            }
            cost = (ctx.data.economia.carroca.base + ctx.data.economia.carroca.por_km * km).round();
            if cost > self.money {
                return Err(format!("Dinheiro insuficiente: custo {cost}, saldo {}", self.money));
            }
            wagon = Some(wid);
        } else if transporte != "a_pe" {
            return Err("Transporte deve ser a_pe ou carroca".into());
        }
        self.money -= cost;
        self.next_id += 1;
        let eid = self.next_id as u32;
        for id in &ids {
            let h = self.hunters.iter_mut().find(|h| &h.id == id).unwrap();
            h.expedition = Some(eid);
            h.route = route.clone();
            h.route_idx = 0;
            h.activity = if wagon.is_some() { Activity::Embarcado } else { Activity::Viajando };
            h.wagon = wagon.clone();
        }
        if let Some(wid) = &wagon {
            let w = self.wagons.iter_mut().find(|w| &w.id == wid).unwrap();
            w.state = "viajando".into();
            w.passengers = ids.clone();
            w.expedition = Some(eid);
            w.route = route.clone();
            w.route_idx = 0;
        }
        let nome = page.nome.clone();
        self.expeditions.push(Expedition { id: eid, species: species.clone(), members: ids.clone(), transporte: transporte.clone(), wagon: wagon.clone(), dest_tile: tile.clone(), dest: (x, z), camp: None, state: "viajando".into(), kills: 0, rescuer: None, cost, threat: None, started_tick: ctx.tick, rescued: false, hunt_started_s: 0.0 });
        let txt = format!("Expedição {eid}: caçar {nome} em {tile} com {} Hunters, {} (custo {cost})", ids.len(), if wagon.is_some() { "de carroça" } else { "a pé" });
        self.event(ctx.tick, ctx.now, "ordem", txt.clone());
        self.pending_save = true;
        Ok(txt)
    }

    // ------------------------------------------------------------------ passo
    pub fn step(&mut self, ctx: &mut Ctx) {
        self.spawn_near_actors(ctx);
        self.tracks.expire(ctx.now, ctx.data.rastros.vida_s);
        self.shouts.retain(|s| ctx.now - s.t < 90.0);
        let views: Vec<HunterView> = self
            .hunters
            .iter()
            .filter(|h| h.standing() && !matches!(h.activity, Activity::Embarcado | Activity::Conduzindo | Activity::NaVila))
            .map(|h| HunterView { id: h.id.clone(), x: h.mv.x, z: h.mv.z, moving: h.state == HunterState::Caminhando, crouched: h.crouched, stealth: h.skill("furtividade"), hp: h.hp })
            .collect();
        let actors = self.actor_positions();
        let radius = ctx.data.spawn.raio_simulacao_detalhada_m;
        let mut attacks: Vec<AttackRequest> = vec![];
        let mut rng = XorShift32::new(self.rng);
        for c in self.creatures.iter_mut() {
            if !actors.iter().any(|a| d2(*a, (c.mv.x, c.mv.z)) <= radius) {
                continue; // fora da janela detalhada: congelada (simulação estratégica ainda não implementada)
            }
            step_creature(c, ctx.data, ctx.t, ctx.portals, ctx.nav, &views, &self.shouts, &mut self.tracks, &mut rng, ctx.dt, ctx.tick, ctx.now, &mut attacks);
        }
        self.rng = rng.state;
        for a in attacks {
            self.resolve_creature_attack(a, ctx);
        }
        self.check_traps(ctx);
        for i in 0..self.hunters.len() {
            self.step_hunter(i, ctx);
        }
        for i in 0..self.wagons.len() {
            self.step_wagon(i, ctx);
        }
        if ctx.tick % 5 == 0 {
            self.perceive(ctx);
        }
        self.check_rescue(ctx);
        self.check_deaths(ctx);
        self.step_expeditions(ctx);
    }

    fn spawn_near_actors(&mut self, ctx: &mut Ctx) {
        let mut want = BTreeSet::new();
        for (x, z) in self.actor_positions() {
            if let Some(tile) = ctx.t.tile_id_at(x, z) {
                want.insert(tile.clone());
                for (n, _) in ctx.portals.neighbors_with_portals(&tile) {
                    want.insert(n);
                }
            }
        }
        for tile in want {
            if self.spawned.contains(&tile) || ctx.data.spawn.excluir.contains(&tile) || !ctx.t.is_allowed(&tile) {
                continue;
            }
            self.spawned.insert(tile.clone());
            let Some(info) = ctx.t.continent.tile(&tile).cloned() else { continue };
            let center = crate::hex::center_of(crate::hex::axial_of(info.x, info.z).0, crate::hex::axial_of(info.x, info.z).1);
            let mut r = XorShift32::new(fnv(&tile) ^ self.rng);
            for (sid, sp) in ctx.data.especies.iter() {
                if !sp.biomas.iter().any(|b| b == &info.biome) {
                    continue;
                }
                for _ in 0..sp.grupos_por_hex {
                    // centro do grupo em célula caminhável do próprio hex
                    let mut home = None;
                    for _ in 0..40 {
                        let a = r.next_f64() * std::f64::consts::TAU;
                        let d = r.next_f64().sqrt() * 2000.0;
                        let (x, z) = (center.0 + a.cos() * d, center.1 + a.sin() * d);
                        if ctx.t.tile_id_at(x, z).as_deref() == Some(tile.as_str()) && walkable_cell(ctx.t, x, z).is_some() {
                            home = Some((x, z));
                            break;
                        }
                    }
                    let Some((hx, hz)) = home else { continue };
                    self.next_id += 1;
                    let group = self.next_id;
                    let n = sp.grupo.0 + ((r.next_f64() * (sp.grupo.1 - sp.grupo.0 + 1) as f64) as u32).min(sp.grupo.1 - sp.grupo.0);
                    for k in 0..n {
                        let a = k as f64 * 2.4;
                        let (x, z) = (hx + a.cos() * (1.5 + k as f64), hz + a.sin() * (1.5 + k as f64));
                        let (x, z) = if walkable_cell(ctx.t, x, z).is_some() { (x, z) } else { (hx, hz) };
                        self.next_id += 1;
                        let mut c = Creature::spawn(self.next_id, sid, sp, group, x, z, &tile);
                        c.home = (hx, hz);
                        c.mv.snap_y(ctx.t);
                        self.creatures.push(c);
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------- percepção
    fn perceive(&mut self, ctx: &mut Ctx) {
        let vis = ctx.data.hunters.visao_m;
        let mut sightings: Vec<(usize, usize)> = vec![];
        for (hi, h) in self.hunters.iter().enumerate() {
            if !h.standing() || h.activity == Activity::NaVila {
                continue;
            }
            for (ci, c) in self.creatures.iter().enumerate() {
                if !c.alive || h.mv.dist(c.mv.x, c.mv.z) > vis {
                    continue;
                }
                let cover = ctx.t.sample(c.mv.x, c.mv.z).map(|s| s.cover).unwrap_or(0);
                let eff = if cover >= 60 { vis * 0.5 } else { vis };
                if h.mv.dist(c.mv.x, c.mv.z) > eff {
                    continue;
                }
                if line_of_sight(ctx.t, h.mv.x, h.mv.z, h.mv.y + 1.6, c.mv.x, c.mv.z, c.mv.y + 0.4) {
                    sightings.push((hi, ci));
                }
            }
        }
        for (hi, ci) in sightings {
            let (hid, hname) = (self.hunters[hi].id.clone(), self.hunters[hi].name.clone());
            let (cid, species, cx, cz, tile) = {
                let c = &self.creatures[ci];
                (c.id, c.species.clone(), c.mv.x, c.mv.z, c.mv.tile_id.clone())
            };
            let key = (hid.clone(), cid);
            let fresh = self.seen.get(&key).map(|t| ctx.now - t > 120.0).unwrap_or(true);
            if fresh {
                self.seen.insert(key, ctx.now);
                let sp = &ctx.data.especies[&species];
                let itens = sp.itens.iter().map(|i| i.nome.clone()).collect();
                if self.bestiary.sight(&species, &sp.nome, itens, &tile, cx, cz, &hname, ctx.tick, ctx.data.conhecimento.avistamentos_para_estudado) {
                    self.event(ctx.tick, ctx.now, "bestiario", format!("{hname} avistou {} pela primeira vez: nova página no Bestiário", sp.nome));
                    self.pending_save = true;
                }
            }
            self.maybe_engage(hi, cid, &species, ctx);
        }
    }

    fn expedition_of(&self, h: &Hunter) -> Option<&Expedition> {
        h.expedition.and_then(|e| self.expeditions.iter().find(|x| x.id == e))
    }

    /// Avistou o alvo durante a busca: escolhe estratégia de forma autônoma.
    fn maybe_engage(&mut self, hi: usize, cid: u64, species: &str, ctx: &mut Ctx) {
        let h = &self.hunters[hi];
        if !matches!(h.activity, Activity::Procurando | Activity::Rastreando) {
            return;
        }
        let Some(exp) = self.expedition_of(h) else { return };
        if exp.species != species || exp.state != "cacando" || h.ignore.get(&cid).map(|t| ctx.now < *t).unwrap_or(false) {
            return;
        }
        let know = self.bestiary.level(species);
        let sp = &ctx.data.especies[species];
        let trap = sp.papel == "predador" && ((know >= 3 && h.skill("armadilhas") >= 3) || h.skill("armadilhas") >= 5);
        let name = h.name.clone();
        let h = &mut self.hunters[hi];
        h.target_creature = Some(cid);
        h.track = None;
        h.approach_final = false;
        if trap {
            h.activity = Activity::ArmandoArmadilha;
            h.last_action = "armadilha + grito".into();
        } else {
            h.activity = Activity::Aproximando;
            h.last_action = if sp.papel == "presa" { "aproximação agachada e rodeio".into() } else { "aproximação e rodeio com espada".into() };
        }
        let what = h.last_action.clone();
        self.event(ctx.tick, ctx.now, "estrategia", format!("{name} avistou {} e escolheu: {what} (conhecimento: {})", sp.nome, ["desconhecido", "avistado", "estudado", "dominado"][know as usize]));
    }

    // --------------------------------------------------------------- combate
    /// Aplica um ataque de criatura diretamente (testes de regra de Desvio/ferimento).
    pub fn debug_attack(&mut self, a: AttackRequest, ctx: &mut Ctx) {
        self.resolve_creature_attack(a, ctx);
    }

    fn resolve_creature_attack(&mut self, a: AttackRequest, ctx: &mut Ctx) {
        let Some(hi) = self.hunters.iter().position(|h| h.id == a.hunter) else { return };
        if !self.hunters[hi].standing() {
            return;
        }
        let cfg = &ctx.data.combate.desvio;
        let desvio = self.hunters[hi].skill("desvio");
        let roll = self.hunters[hi].rng();
        let (name, species) = (self.hunters[hi].name.clone(), self.creatures.iter().find(|c| c.id == a.creature).map(|c| c.species.clone()).unwrap_or_default());
        let h = &mut self.hunters[hi];
        // defesa: quem é atacado passa a combater o atacante
        if !matches!(h.activity, Activity::Combatendo | Activity::Socorrendo) {
            h.activity = Activity::Combatendo;
            h.target_creature = Some(a.creature);
            h.crouched = false;
        }
        if roll < (cfg.chance_por_nivel * desvio as f64).min(0.95) {
            if desvio >= 5 {
                h.busy_until_s = ctx.now + cfg.nivel5.duracao_s;
                h.no_attack_until_s = ctx.now + cfg.nivel5.duracao_s + cfg.nivel5.espera_antes_de_atacar_s;
                h.last_action = "Desvio: rolou e esperou 3 s antes de atacar".into();
            } else {
                h.busy_until_s = ctx.now + cfg.nivel1.duracao_s;
                h.no_attack_until_s = h.busy_until_s;
                h.last_action = "Desvio: jogou-se no chão e levantou".into();
            }
            let up = h.practice("desvio", 25.0, ctx.data.hunters.xp_por_nivel, ctx.data.hunters.nivel_max);
            let txt = format!("{name}: {}", h.last_action);
            let quiet = h.ignore.get(&u64::MAX).map(|t| ctx.now < *t).unwrap_or(false);
            h.ignore.insert(u64::MAX, ctx.now + 10.0); // no máx. 1 evento de Desvio a cada 10 s por Hunter
            if !quiet {
                self.event(ctx.tick, ctx.now, "combate", txt);
            }
            if let Some(l) = up {
                self.event(ctx.tick, ctx.now, "habilidade", format!("{name}: Desvio subiu para {l}"));
            }
            return;
        }
        h.hp = (h.hp - a.damage).max(0.0);
        if h.hp <= 0.0 {
            h.activity = Activity::Caido;
            h.downed_since_s = Some(ctx.now);
            h.mv.stop();
            h.crouched = false;
            let exp = h.expedition;
            let txt = format!("{name} caiu, ferido por {species}");
            self.event(ctx.tick, ctx.now, "ferimento", txt);
            if let Some(e) = exp.and_then(|e| self.expeditions.iter_mut().find(|x| x.id == e)) {
                e.threat = Some(a.creature);
            }
            self.pending_save = true;
        }
    }

    fn hunter_strike(&mut self, hi: usize, cid: u64, ctx: &mut Ctx) {
        let Some(ci) = self.creatures.iter().position(|c| c.id == cid) else { return };
        let arma = ctx.data.combate.armas.get(&self.hunters[hi].arma).cloned();
        let Some(arma) = arma else { return };
        let (hx, hz, cd, forca, lvl) = {
            let h = &self.hunters[hi];
            (h.mv.x, h.mv.z, h.cooldown_s, h.forca, h.skill(&h.arma))
        };
        let c = &self.creatures[ci];
        let food = 0.0;
        let mut sh = StrikeHunter { x: hx, z: hz, cooldown: cd, forca, equipped_attack: arma.ataque + arma.bonus_por_nivel * lvl as f64, kills: 0, haul: 0.0 };
        let mut sc = StrikeCreature { x: c.mv.x, z: c.mv.z, hp: c.hp, food };
        let out = strike(&mut sh, &mut sc);
        if matches!(out, StrikeOutcome::NotReady | StrikeOutcome::OutOfRange) {
            return;
        }
        self.hunters[hi].cooldown_s = sh.cooldown;
        self.creatures[ci].hp = sc.hp;
        let up = {
            let h = &mut self.hunters[hi];
            let k = h.arma.clone();
            h.practice(&k, 10.0, ctx.data.hunters.xp_por_nivel, ctx.data.hunters.nivel_max)
        };
        let name = self.hunters[hi].name.clone();
        if let Some(l) = up {
            self.event(ctx.tick, ctx.now, "habilidade", format!("{name}: espada subiu para {l} (nova técnica desbloqueada no nível {l} — animação pendente)"));
        }
        if out == StrikeOutcome::Killed {
            let species = self.creatures[ci].species.clone();
            self.creatures[ci].alive = false;
            self.creatures[ci].mv.stop();
            let sp = &ctx.data.especies[&species];
            let items: Vec<String> = sp.itens.iter().map(|i| i.nome.clone()).collect();
            self.creatures[ci].looted = true;
            self.hunters[hi].inventory.extend(items.iter().cloned());
            self.bestiary.kill(&species, ctx.data.conhecimento.abates_para_dominado);
            let exp = self.hunters[hi].expedition;
            self.event(ctx.tick, ctx.now, "abate", format!("{name} abateu {} e recolheu: {}", sp.nome, items.join(", ")));
            if let Some(e) = exp.and_then(|e| self.expeditions.iter_mut().find(|x| x.id == e)) {
                if e.threat == Some(cid) {
                    e.threat = None;
                }
                if e.species == species {
                    e.kills += 1;
                }
            }
            let target_species = exp.and_then(|e| self.expeditions.iter().find(|x| x.id == e)).map(|e| e.species.clone());
            for h in self.hunters.iter_mut() {
                // alvo da expedição abatido: todos os membros de pé voltam ao acampamento
                if exp.is_some() && h.expedition == exp && h.role == "hunter" && h.standing() && target_species.as_deref() == Some(species.as_str()) {
                    h.target_creature = None;
                    h.crouched = false;
                    h.track = None;
                    h.mv.stop();
                    h.activity = Activity::RetornandoAoAcampamento;
                    continue;
                }
                if h.target_creature == Some(cid) {
                    h.target_creature = None;
                    if h.standing() && h.role == "hunter" {
                        h.activity = Activity::RetornandoAoAcampamento;
                        h.crouched = false;
                    }
                }
            }
            self.pending_save = true;
        }
    }

    fn check_traps(&mut self, ctx: &mut Ctx) {
        let cfg = &ctx.data.armadilhas;
        for ti in 0..self.traps.len() {
            if !self.traps[ti].armed {
                continue;
            }
            let (tx, tz) = (self.traps[ti].x, self.traps[ti].z);
            let Some(ci) = self.creatures.iter().position(|c| c.alive && c.mv.dist(tx, tz) <= cfg.raio_disparo_m) else { continue };
            let kind = cfg.tipos.iter().find(|k| k.id == self.traps[ti].kind).cloned().unwrap_or_else(|| cfg.tipos[0].clone());
            let owner = self.traps[ti].owner.clone();
            let skill = self.hunters.iter().find(|h| h.id == owner).map(|h| h.skill("armadilhas")).unwrap_or(1);
            let roll = self.rand();
            let roll2 = self.rand();
            let sp = &ctx.data.especies[&self.creatures[ci].species];
            self.traps[ti].armed = false;
            let avoid = cfg.chance_evitar_base * (1.0 - 0.03 * skill as f64).max(0.1);
            if sp.massa_kg > kind.massa_max_kg {
                self.event(ctx.tick, ctx.now, "armadilha", format!("{} rompeu a armadilha ({}): grande demais", sp.nome, kind.id));
            } else if roll < avoid {
                self.event(ctx.tick, ctx.now, "armadilha", format!("{} percebeu e evitou a armadilha ({})", sp.nome, kind.id));
            } else {
                let secs = kind.imobiliza_s.0 + roll2 * (kind.imobiliza_s.1 - kind.imobiliza_s.0);
                self.creatures[ci].immobilized_until_s = ctx.now + secs;
                self.traps[ti].caught = Some(self.creatures[ci].id);
                self.event(ctx.tick, ctx.now, "armadilha", format!("{} preso na armadilha ({}) por {:.1} s", sp.nome, kind.id, secs));
            }
        }
    }

    // ------------------------------------------------------------------ Hunter
    fn camp_of(&self, h: &Hunter) -> Option<(f64, f64)> {
        let e = self.expedition_of(h)?;
        let c = self.camps.iter().find(|c| Some(c.id) == e.camp)?;
        Some((c.x, c.z))
    }

    fn step_hunter(&mut self, i: usize, ctx: &mut Ctx) {
        let data = ctx.data;
        {
            let h = &mut self.hunters[i];
            h.cooldown_s = (h.cooldown_s - ctx.dt).max(0.0);
            h.goal = h.mv.target.map(|(x, z)| Goal { tile: ctx.t.tile_id_at(x, z).unwrap_or_default(), x, z });
        }
        // sem rota há ~10 s: desiste do alvo/ponto atual em vez de travar
        {
            let h = &mut self.hunters[i];
            if h.plan_failures > 50 {
                h.plan_failures = 0;
                h.mv.stop();
                if let Some(c) = h.target_creature.take() {
                    h.ignore.insert(c, ctx.now + 120.0);
                    h.crouched = false;
                    if matches!(h.activity, Activity::Aproximando | Activity::Combatendo | Activity::ArmandoArmadilha | Activity::Aguardando) {
                        h.activity = if h.expedition.is_some() { Activity::Procurando } else { Activity::NaVila };
                    }
                }
                if h.activity == Activity::Rastreando {
                    h.track = None;
                    h.activity = Activity::Procurando;
                }
                if matches!(h.activity, Activity::Viajando | Activity::VoltandoVila) {
                    h.route_idx += 1;
                }
            }
        }
        let act = self.hunters[i].activity.clone();
        let walk = self.hunters[i].speed_mps * (1.0 + data.hunters.velocidade_bonus_por_nivel * (self.hunters[i].skill("velocidade") as f64 - 1.0));
        let mut speed = walk;
        let mut moved = false;
        match act {
            Activity::Morto => {
                self.hunters[i].clip = "Idle".into();
                return;
            }
            Activity::Caido => {
                self.hunters[i].clip = "Idle".into();
                return;
            }
            Activity::NaVila => {
                let h = &mut self.hunters[i];
                if h.mv.dist(self.village.0, self.village.1) > 40.0 {
                    h.mv.go_to(self.village.0, self.village.1, 5.0);
                    moved = true;
                }
            }
            Activity::Embarcado | Activity::Conduzindo => {
                if let Some(w) = self.hunters[i].wagon.clone().and_then(|w| self.wagons.iter().find(|x| x.id == w).cloned()) {
                    let back = if act == Activity::Conduzindo { -1.5 } else { 1.0 + (i % 3) as f64 };
                    self.hunters[i].mv.attach_to(&w.mv, back);
                }
                self.hunters[i].state = HunterState::Descansando;
                self.hunters[i].clip = "Idle".into();
                return;
            }
            Activity::Carregado => {
                if let Some(r) = self.hunters[i].carried_by.clone().and_then(|r| self.hunters.iter().find(|x| x.id == r).map(|x| x.mv.clone())) {
                    self.hunters[i].mv.attach_to(&r, 0.8);
                }
                self.hunters[i].clip = "Idle".into();
                return;
            }
            Activity::Patrulhando => {
                let h = &mut self.hunters[i];
                if h.mv.target.is_none() && ctx.now >= h.rest_until_s {
                    let opts: Vec<(String, f64, f64)> = ctx
                        .portals
                        .neighbors_with_portals(&h.mv.tile_id)
                        .into_iter()
                        .filter(|(n, _)| ctx.t.is_allowed(n))
                        .flat_map(|(n, ps)| ps.iter().map(move |p| (n.clone(), p.center_x, p.center_z)).collect::<Vec<_>>())
                        .collect();
                    if !opts.is_empty() {
                        let k = ((h.rng() * opts.len() as f64) as usize).min(opts.len() - 1);
                        let (tile, px, pz) = opts[k].clone();
                        if let (Some(to), Some(from)) = (ctx.t.continent.tile(&tile).cloned(), ctx.t.continent.tile(&h.mv.tile_id).cloned()) {
                            let (dx, dz) = (to.x - from.x, to.z - from.z);
                            let d = (dx * dx + dz * dz).sqrt();
                            h.mv.go_to(px + dx / d * 30.0, pz + dz / d * 30.0, 1.0);
                        }
                    }
                }
                moved = h.mv.target.is_some();
            }
            Activity::Viajando | Activity::VoltandoVila => {
                let h = &mut self.hunters[i];
                if h.route.is_empty() {
                    if act == Activity::VoltandoVila {
                        h.route = route_between(ctx.t, ctx.portals, &h.mv.tile_id.clone(), &self.village_tile, self.village).unwrap_or_default();
                        h.route_idx = 0;
                    }
                }
                if h.route_idx < h.route.len() {
                    let (x, z) = h.route[h.route_idx];
                    h.mv.go_to(x, z, 1.0);
                    moved = true;
                } else if act == Activity::VoltandoVila {
                    h.activity = Activity::NaVila;
                    h.expedition = None;
                    h.wagon = None;
                    let inv: Vec<String> = h.inventory.drain(..).collect();
                    self.village_storage.extend(inv);
                    let name = h.name.clone();
                    self.event(ctx.tick, ctx.now, "vila", format!("{name} chegou à vila"));
                    self.pending_save = true;
                } else {
                    h.activity = Activity::Procurando;
                }
            }
            Activity::Procurando => {
                let Some(camp) = self.camp_of(&self.hunters[i]) else {
                    let h = &mut self.hunters[i];
                    h.activity = if h.expedition.is_some() { Activity::Viajando } else { Activity::NaVila };
                    return;
                };
                let species = self.expedition_of(&self.hunters[i]).map(|e| e.species.clone()).unwrap_or_default();
                // pegadas próximas: chance por tick de descobrir (Rastreamento)
                let (hx, hz) = (self.hunters[i].mv.x, self.hunters[i].mv.z);
                let near = self.tracks.unrevealed_near(&species, hx, hz, data.rastros.raio_descoberta_m);
                let chance = data.rastros.chance_base + data.rastros.chance_por_nivel * self.hunters[i].skill("rastreamento") as f64;
                for f in near {
                    if self.hunters[i].rng() < chance {
                        self.tracks.revealed.insert(f.id);
                        let h = &mut self.hunters[i];
                        h.track = Some((f.creature, f.seq));
                        h.activity = Activity::Rastreando;
                        h.mv.stop();
                        let up = h.practice("rastreamento", 15.0, data.hunters.xp_por_nivel, data.hunters.nivel_max);
                        let name = h.name.clone();
                        self.event(ctx.tick, ctx.now, "rastro", format!("{name} descobriu pegadas de {species}: brilham em azul"));
                        if let Some(l) = up {
                            self.event(ctx.tick, ctx.now, "habilidade", format!("{name}: Rastreamento subiu para {l}"));
                        }
                        return;
                    }
                }
                let h = &mut self.hunters[i];
                if h.mv.target.is_none() {
                    let a = h.rng() * std::f64::consts::TAU;
                    let r = 20.0 + h.rng() * 380.0;
                    h.mv.go_to(camp.0 + a.cos() * r, camp.1 + a.sin() * r, 1.0);
                }
                moved = true;
            }
            Activity::Rastreando => {
                let Some((cid, seq)) = self.hunters[i].track else {
                    self.hunters[i].activity = Activity::Procurando;
                    return;
                };
                let h = &self.hunters[i];
                let cur = self.tracks.by_creature.get(&cid).and_then(|q| q.iter().find(|f| f.seq == seq).cloned());
                match self.tracks.next_after(cid, seq) {
                    Some(next) if next.break_before => {
                        let name = h.name.clone();
                        let h = &mut self.hunters[i];
                        h.track = None;
                        h.activity = Activity::Procurando;
                        // busca do outro lado: segue a direção da trilha
                        if let Some(c) = cur {
                            let (dx, dz) = (next.x - c.x, next.z - c.z);
                            let d = (dx * dx + dz * dz).sqrt().max(0.1);
                            h.mv.go_to(c.x + dx / d * 40.0, c.z + dz / d * 40.0, 1.0);
                        }
                        self.event(ctx.tick, ctx.now, "rastro", format!("{name}: a trilha se interrompe na água"));
                    }
                    Some(next) => {
                        let h = &mut self.hunters[i];
                        if h.mv.dist(next.x, next.z) <= 1.5 {
                            self.tracks.revealed.insert(next.id);
                            h.track = Some((cid, next.seq));
                        } else {
                            h.mv.go_to(next.x, next.z, 0.5);
                            moved = true;
                        }
                    }
                    None => {
                        // fim da trilha registrada: o animal deve estar perto; procurar em volta
                        let h = &mut self.hunters[i];
                        h.track = None;
                        h.activity = Activity::Procurando;
                    }
                }
            }
            Activity::Aproximando | Activity::Combatendo | Activity::Socorrendo => {
                let target = self.hunters[i].target_creature.and_then(|c| self.creatures.iter().find(|x| x.id == c && x.alive).map(|x| (x.id, x.mv.x, x.mv.z, x.species.clone())));
                if act == Activity::Socorrendo {
                    self.step_rescuer(i, target, ctx);
                    return;
                }
                let Some((cid, cx, cz, species)) = target else {
                    let h = &mut self.hunters[i];
                    h.target_creature = None;
                    h.crouched = false;
                    h.activity = if h.expedition.is_some() { Activity::Procurando } else { Activity::NaVila };
                    return;
                };
                let sp = &data.especies[&species];
                let know = self.bestiary.level(&species);
                let h = &mut self.hunters[i];
                if ctx.now < h.busy_until_s {
                    h.clip = "Idle".into();
                    return;
                }
                let d = h.mv.dist(cx, cz);
                if d > data.hunters.visao_m * 1.5 {
                    h.target_creature = None;
                    h.crouched = false;
                    h.activity = if h.expedition.is_some() { Activity::Procurando } else { Activity::NaVila };
                    return;
                }
                if act == Activity::Aproximando {
                    // conhecimento "estudado" ou mais: agacha antes de entrar no alcance de visão da espécie
                    let crouch_from = if know >= 2 { sp.visao_movimento_m * 1.3 } else { 25.0 };
                    h.crouched = d <= crouch_from;
                    if h.crouched {
                        speed = walk * data.furtividade.velocidade_agachado_fator;
                        let _ = h.practice("furtividade", ctx.dt * 0.5, data.hunters.xp_por_nivel, data.hunters.nivel_max);
                    }
                    if d <= data.furtividade.distancia_ataque_rodeio_m.max(3.0) {
                        h.approach_final = false;
                        h.activity = Activity::Combatendo;
                        h.crouched = false;
                        let _ = h.practice("rodeio", 20.0, data.hunters.xp_por_nivel, data.hunters.nivel_max);
                    }
                }
                // rodeio: na aproximação, contorna para chegar pelas costas (ponto cego)
                let heading = self.creatures.iter().find(|x| x.id == cid).map(|x| x.mv.heading).unwrap_or(0.0);
                let h = &mut self.hunters[i];
                let rd = data.furtividade.rodeio_distancia_m;
                let (bx, bz) = (cx - heading.sin() * rd, cz - heading.cos() * rd);
                // a menos de 8 m, vai direto (sem alternar alvo a cada tick)
                // histerese: contorna (rodeio) só enquanto longe; ao chegar a 10 m, vai direto até o fim
                if d <= 10.0 {
                    h.crouched = true;
                    h.approach_final = true;
                }
                let final_phase = h.approach_final;
                let (gx, gz) = if act == Activity::Aproximando && !final_phase && h.mv.dist(bx, bz) > 1.5 { (bx, bz) } else { (cx, cz) };
                if d > 2.0 {
                    h.mv.go_to(gx, gz, 1.5);
                    moved = true;
                } else {
                    h.mv.stop();
                }
                if self.hunters[i].activity == Activity::Combatendo && d <= 2.6 && ctx.now >= self.hunters[i].no_attack_until_s {
                    self.hunter_strike(i, cid, ctx);
                }
            }
            Activity::ArmandoArmadilha => {
                let target = self.hunters[i].target_creature.and_then(|c| self.creatures.iter().find(|x| x.id == c && x.alive).map(|x| (x.mv.x, x.mv.z)));
                let Some((cx, cz)) = target else {
                    let h = &mut self.hunters[i];
                    h.activity = if h.expedition.is_some() { Activity::Procurando } else { Activity::NaVila };
                    return;
                };
                let kind = data.armadilhas.tipos.last().map(|k| k.id.clone()).unwrap_or_default();
                self.next_id += 1;
                let id = self.next_id as u32;
                let h = &mut self.hunters[i];
                let (hx, hz) = (h.mv.x, h.mv.z);
                self.traps.push(Trap { id, owner: h.id.clone(), kind: kind.clone(), x: hx, z: hz, armed: true, caught: None });
                let up = h.practice("armadilhas", 30.0, data.hunters.xp_por_nivel, data.hunters.nivel_max);
                // recua para trás da armadilha (lado oposto à criatura) e grita
                let (dx, dz) = (hx - cx, hz - cz);
                let d = (dx * dx + dz * dz).sqrt().max(0.1);
                h.mv.go_to(hx + dx / d * 8.0, hz + dz / d * 8.0, 1.0);
                h.activity = Activity::Aguardando;
                h.trap_wait_until_s = ctx.now + 60.0;
                let name = h.name.clone();
                self.shouts.push(Shout { x: hx + dx / d * 8.0, z: hz + dz / d * 8.0, t: ctx.now });
                self.event(ctx.tick, ctx.now, "armadilha", format!("{name} armou {kind} e gritou para atrair a presa"));
                if let Some(l) = up {
                    self.event(ctx.tick, ctx.now, "habilidade", format!("{name}: Armadilhas subiu para {l}"));
                }
                moved = true;
            }
            Activity::Aguardando => {
                let target = self.hunters[i].target_creature.and_then(|c| self.creatures.iter().find(|x| x.id == c && x.alive).map(|x| (x.mv.dist(self.hunters[i].mv.x, self.hunters[i].mv.z), ctx.now < x.immobilized_until_s)));
                let h = &mut self.hunters[i];
                match target {
                    None => h.activity = if h.expedition.is_some() { Activity::Procurando } else { Activity::NaVila },
                    Some((d, stuck)) if stuck || d < 6.0 || ctx.now > h.trap_wait_until_s => {
                        h.activity = Activity::Combatendo;
                    }
                    _ => moved = h.mv.target.is_some(),
                }
            }
            Activity::RetornandoAoAcampamento => {
                let Some(camp) = self.camp_of(&self.hunters[i]) else {
                    self.hunters[i].activity = Activity::VoltandoVila;
                    return;
                };
                let h = &mut self.hunters[i];
                if h.mv.dist(camp.0, camp.1) <= 4.0 {
                    h.activity = Activity::Descansando;
                    h.mv.stop();
                    let inv: Vec<String> = h.inventory.drain(..).collect();
                    let n = inv.len();
                    let name = h.name.clone();
                    let eid = h.expedition;
                    if let Some(c) = eid.and_then(|e| self.expeditions.iter().find(|x| x.id == e)).and_then(|e| e.camp).and_then(|cid| self.camps.iter_mut().find(|c| c.id == cid)) {
                        c.storage.extend(inv);
                    }
                    if n > 0 {
                        self.event(ctx.tick, ctx.now, "acampamento", format!("{name} guardou {n} itens no acampamento e descansa"));
                    }
                } else {
                    h.mv.go_to(camp.0, camp.1, 2.0);
                    moved = true;
                }
            }
            Activity::Descansando => {
                let h = &mut self.hunters[i];
                h.hp = (h.hp + data.acampamento.cura_descanso_hp_s * ctx.dt).min(h.hp_max);
            }
        }
        // regeneração lenta fora do acampamento
        {
            let h = &mut self.hunters[i];
            if h.standing() && h.activity != Activity::Descansando {
                h.hp = (h.hp + data.acampamento.cura_campo_hp_s * ctx.dt).min(h.hp_max);
            }
        }
        if moved && self.hunters[i].mv.target.is_some() {
            let h = &mut self.hunters[i];
            let r = h.mv.advance(ctx.t, ctx.portals, ctx.nav, speed, ctx.dt, 1.0, 120.0, ctx.tick, ctx.now);
            h.state = match r {
                Step::Moving => HunterState::Caminhando,
                Step::Arrived => HunterState::Planejando,
                Step::Blocked => HunterState::SemRota,
            };
            if r == Step::Blocked {
                h.plan_failures += 1;
            } else {
                h.plan_failures = 0;
            }
            if r == Step::Arrived {
                if matches!(h.activity, Activity::Viajando | Activity::VoltandoVila) {
                    h.route_idx += 1;
                }
                if h.activity == Activity::Patrulhando {
                    h.rest_until_s = ctx.now + 5.0 + h.rng() * 10.0;
                }
            }
            h.clip = if r == Step::Moving { "Walking".into() } else { "Idle".into() };
        } else {
            let h = &mut self.hunters[i];
            h.state = HunterState::Descansando;
            h.clip = "Idle".into();
        }
    }

    fn step_rescuer(&mut self, i: usize, threat: Option<(u64, f64, f64, String)>, ctx: &mut Ctx) {
        let Some(eid) = self.hunters[i].expedition else { return };
        let speed = self.hunters[i].speed_mps;
        let mut moved = false;
        if let Some((cid, cx, cz, _)) = threat {
            let h = &mut self.hunters[i];
            let d = h.mv.dist(cx, cz);
            if d > 2.0 {
                h.mv.go_to(cx, cz, 1.5);
                moved = true;
            } else {
                h.mv.stop();
            }
            if d <= 2.6 && ctx.now >= h.no_attack_until_s && ctx.now >= h.busy_until_s {
                self.hunter_strike(i, cid, ctx);
            }
        } else {
            // ameaça vencida: recolhe feridos e leva ao acampamento (ou à vila)
            let rid = self.hunters[i].id.clone();
            let members = self.expeditions.iter().find(|e| e.id == eid).map(|e| e.members.clone()).unwrap_or_default();
            let wounded: Option<(usize, f64, f64)> = self
                .hunters
                .iter()
                .enumerate()
                .filter(|(_, h)| members.contains(&h.id) && h.activity == Activity::Caido && h.carried_by.is_none())
                .map(|(k, h)| (k, h.mv.x, h.mv.z))
                .min_by(|a, b| self.hunters[i].mv.dist(a.1, a.2).partial_cmp(&self.hunters[i].mv.dist(b.1, b.2)).unwrap());
            if let Some((k, wx, wz)) = wounded {
                let d = self.hunters[i].mv.dist(wx, wz);
                if d <= 2.5 {
                    self.hunters[k].activity = Activity::Carregado;
                    self.hunters[k].carried_by = Some(rid.clone());
                    let (a, b) = (self.hunters[i].name.clone(), self.hunters[k].name.clone());
                    self.event(ctx.tick, ctx.now, "resgate", format!("{a} recolheu {b}"));
                } else {
                    self.hunters[i].mv.go_to(wx, wz, 1.0);
                    moved = true;
                }
            } else {
                let camp = self.expeditions.iter().find(|e| e.id == eid).and_then(|e| e.camp).and_then(|c| self.camps.iter().find(|x| x.id == c)).map(|c| (c.x, c.z)).unwrap_or(self.village);
                if self.hunters[i].mv.dist(camp.0, camp.1) <= 4.0 {
                    let name = self.hunters[i].name.clone();
                    let mut n = 0;
                    for h in self.hunters.iter_mut() {
                        if h.carried_by.as_deref() == Some(rid.as_str()) && h.alive {
                            h.carried_by = None;
                            h.activity = Activity::Descansando;
                            h.downed_since_s = None;
                            h.hp = 15.0;
                            n += 1;
                        }
                    }
                    let h = &mut self.hunters[i];
                    h.activity = if h.wagon.is_some() { Activity::Conduzindo } else { Activity::NaVila };
                    h.expedition = None;
                    h.target_creature = None;
                    h.hp = h.hp_max;
                    if let Some(e) = self.expeditions.iter_mut().find(|e| e.id == eid) {
                        e.rescuer = None;
                        e.threat = None;
                        e.rescued = true;
                    }
                    self.event(ctx.tick, ctx.now, "resgate", format!("{name} levou {n} ferido(s) ao acampamento: recuperação acelerada"));
                    self.pending_save = true;
                } else {
                    self.hunters[i].mv.go_to(camp.0, camp.1, 2.0);
                    moved = true;
                }
            }
        }
        let h = &mut self.hunters[i];
        if moved {
            let r = h.mv.advance(ctx.t, ctx.portals, ctx.nav, speed, ctx.dt, 1.0, 120.0, ctx.tick, ctx.now);
            h.state = if r == Step::Moving { HunterState::Caminhando } else { HunterState::Planejando };
            h.clip = if r == Step::Moving { "Walking".into() } else { "Idle".into() };
        } else {
            h.clip = "Idle".into();
        }
    }

    // ----------------------------------------------------------------- carroça
    fn step_wagon(&mut self, i: usize, ctx: &mut Ctx) {
        let data = ctx.data;
        let state = self.wagons[i].state.clone();
        if state != "viajando" && state != "retornando" {
            return;
        }
        let w = &mut self.wagons[i];
        if w.route_idx >= w.route.len() {
            let eid = w.expedition;
            if state == "viajando" {
                // chegou: procura clareira e monta acampamento
                let (x, z) = (w.mv.x, w.mv.z);
                let spot = find_clearing(ctx.t, (x, z), data.acampamento.raio_clareira_m, data.acampamento.inclinacao_max_graus).unwrap_or((x, z));
                w.mv.go_to(spot.0, spot.1, 1.0);
                w.state = "acampada".into();
                let tile = ctx.t.tile_id_at(spot.0, spot.1).unwrap_or_default();
                let driver = w.driver.clone();
                let passengers = std::mem::take(&mut w.passengers);
                self.next_id += 1;
                let cid = self.next_id as u32;
                self.camps.push(Camp { id: cid, expedition: eid.unwrap_or(0), x: spot.0, z: spot.1, tile: tile.clone(), storage: vec![] });
                if let Some(e) = eid.and_then(|e| self.expeditions.iter_mut().find(|x| x.id == e)) {
                    e.camp = Some(cid);
                    e.state = "cacando".into();
                    e.hunt_started_s = ctx.now;
                }
                for (k, p) in passengers.iter().enumerate() {
                    if let Some(h) = self.hunters.iter_mut().find(|h| &h.id == p) {
                        h.activity = Activity::Procurando;
                        h.mv.x = spot.0 + (k as f64 * 1.1).cos() * 3.0;
                        h.mv.z = spot.1 + (k as f64 * 1.1).sin() * 3.0;
                        if walkable_cell(ctx.t, h.mv.x, h.mv.z).is_none() {
                            h.mv.x = spot.0;
                            h.mv.z = spot.1;
                        }
                        h.mv.snap_y(ctx.t);
                        h.mv.tile_id = tile.clone();
                    }
                }
                self.event(ctx.tick, ctx.now, "acampamento", format!("Carroça de {driver} montou acampamento numa clareira em {tile}"));
            } else {
                w.state = "na_vila".into();
                w.expedition = None;
                let driver = w.driver.clone();
                let storage: Vec<String> = w.storage.drain(..).collect();
                let passengers = std::mem::take(&mut w.passengers);
                self.village_storage.extend(storage);
                for p in passengers {
                    if let Some(h) = self.hunters.iter_mut().find(|h| h.id == p) {
                        h.activity = Activity::NaVila;
                        h.expedition = None;
                        h.wagon = None;
                        let inv: Vec<String> = h.inventory.drain(..).collect();
                        self.village_storage.extend(inv);
                    }
                }
                if let Some(e) = eid.and_then(|e| self.expeditions.iter_mut().find(|x| x.id == e)) {
                    if e.state == "retornando" {
                        e.state = "concluida".into();
                    }
                }
                self.event(ctx.tick, ctx.now, "vila", format!("Carroça de {driver} voltou à vila"));
                self.pending_save = true;
            }
            return;
        }
        let (x, z) = w.route[w.route_idx];
        w.mv.go_to(x, z, 1.0);
        match w.mv.advance(ctx.t, ctx.portals, ctx.nav, data.carrocas.velocidade_mps, ctx.dt, 2.0, 120.0, ctx.tick, ctx.now) {
            Step::Arrived => w.route_idx += 1,
            Step::Blocked if w.mv.fails > 30 => {
                w.mv.stop();
                w.route_idx += 1;
            }
            _ => {}
        }
    }

    // ------------------------------------------------------------ expedições
    fn step_expeditions(&mut self, ctx: &mut Ctx) {
        for k in 0..self.expeditions.len() {
            let e = self.expeditions[k].clone();
            if matches!(e.state.as_str(), "concluida" | "fracassada") {
                continue;
            }
            // cópia dos dados dos membros (evita segurar empréstimos durante eventos)
            let members: Vec<(String, bool, Activity, f64, f64, f64, f64)> = self
                .hunters
                .iter()
                .filter(|h| e.members.contains(&h.id))
                .map(|h| (h.id.clone(), h.alive, h.activity.clone(), h.hp, h.hp_max, h.mv.x, h.mv.z))
                .collect();
            let alive: Vec<&(String, bool, Activity, f64, f64, f64, f64)> = members.iter().filter(|m| m.1).collect();
            let searching = members.iter().find(|m| m.2 == Activity::Procurando).map(|m| (m.5, m.6));
            if e.state == "viajando" && e.wagon.is_none() && searching.is_some() {
                self.expeditions[k].state = "chegando".into();
                continue;
            }
            if e.state == "chegando" && e.camp.is_none() {
                if let Some((hx, hz)) = searching {
                    // a pé: o primeiro a chegar monta um acampamento simples
                    let spot = find_clearing(ctx.t, (hx, hz), ctx.data.acampamento.raio_clareira_m, ctx.data.acampamento.inclinacao_max_graus).unwrap_or((hx, hz));
                    self.next_id += 1;
                    let cid = self.next_id as u32;
                    let tile = ctx.t.tile_id_at(spot.0, spot.1).unwrap_or_default();
                    self.camps.push(Camp { id: cid, expedition: e.id, x: spot.0, z: spot.1, tile: tile.clone(), storage: vec![] });
                    self.expeditions[k].camp = Some(cid);
                    self.expeditions[k].state = "cacando".into();
                    self.expeditions[k].hunt_started_s = ctx.now;
                    self.event(ctx.tick, ctx.now, "acampamento", format!("Expedição {} (a pé) montou acampamento numa clareira em {tile}", e.id));
                    continue;
                }
            }
            if alive.is_empty() {
                self.expeditions[k].state = "fracassada".into();
                self.event(ctx.tick, ctx.now, "expedicao", format!("Expedição {} fracassou: nenhum Hunter sobreviveu", e.id));
                let vt = self.village_tile.clone();
                let vp = self.village;
                if let Some(w) = e.wagon.as_ref().and_then(|w| self.wagons.iter_mut().find(|x| &x.id == w)) {
                    if w.state == "acampada" {
                        w.state = "retornando".into();
                        w.route = route_between(ctx.t, ctx.portals, &w.mv.tile_id.clone(), &vt, vp).unwrap_or_default();
                        w.route_idx = 0;
                    }
                }
                self.pending_save = true;
                continue;
            }
            let rested = alive.iter().all(|m| m.2 == Activity::Descansando && m.3 >= m.4 * 0.8);
            let timed_out = e.state == "cacando" && ctx.now - e.hunt_started_s > ctx.data.expedicao.max_horas_sem_abate * 3600.0;
            let any_down = alive.iter().any(|m| matches!(m.2, Activity::Caido | Activity::Carregado));
            if timed_out && e.kills == 0 && !any_down && e.rescuer.is_none() {
                // desiste: todos os de pé voltam ao acampamento para retornar
                let ids: Vec<String> = alive.iter().map(|m| m.0.clone()).collect();
                for h in self.hunters.iter_mut().filter(|h| ids.contains(&h.id) && h.standing() && h.activity != Activity::Descansando) {
                    h.activity = Activity::RetornandoAoAcampamento;
                    h.target_creature = None;
                    h.track = None;
                    h.crouched = false;
                    h.mv.stop();
                }
                self.expeditions[k].rescued = true; // reutiliza a condição de retorno sem abate
                self.event(ctx.tick, ctx.now, "expedicao", format!("Expedição {}: sem sucesso após {} h, voltando ao acampamento", e.id, ctx.data.expedicao.max_horas_sem_abate));
                continue;
            }
            if e.state == "cacando" && (e.kills > 0 || e.rescued) && rested && e.rescuer.is_none() {
                self.expeditions[k].state = "retornando".into();
                let ids: Vec<String> = alive.iter().map(|m| m.0.clone()).collect();
                let camp_storage: Vec<String> = e.camp.and_then(|c| self.camps.iter_mut().find(|x| x.id == c)).map(|c| c.storage.drain(..).collect()).unwrap_or_default();
                let vt = self.village_tile.clone();
                let vp = self.village;
                if let Some(w) = e.wagon.as_ref().and_then(|w| self.wagons.iter_mut().find(|x| &x.id == w)) {
                    w.storage.extend(camp_storage);
                    w.passengers = ids.clone();
                    w.state = "retornando".into();
                    w.route = route_between(ctx.t, ctx.portals, &w.mv.tile_id.clone(), &vt, vp).unwrap_or_default();
                    w.route_idx = 0;
                    for h in self.hunters.iter_mut().filter(|h| ids.contains(&h.id)) {
                        h.activity = Activity::Embarcado;
                    }
                } else {
                    self.village_storage.extend(camp_storage);
                    for h in self.hunters.iter_mut().filter(|h| ids.contains(&h.id)) {
                        h.activity = Activity::VoltandoVila;
                        h.route.clear();
                        h.route_idx = 0;
                    }
                }
                self.event(ctx.tick, ctx.now, "expedicao", format!("Expedição {}: caçada concluída, retornando à vila", e.id));
                continue;
            }
            if e.state == "resgate" && e.rescuer.is_none() && !alive.is_empty() && alive.iter().all(|m| m.2 == Activity::Descansando && m.3 >= m.4 * 0.8) {
                self.expeditions[k].state = "concluida".into();
                let ids: Vec<String> = alive.iter().map(|m| m.0.clone()).collect();
                for h in self.hunters.iter_mut().filter(|h| ids.contains(&h.id)) {
                    h.activity = Activity::NaVila;
                    h.expedition = None;
                }
                self.event(ctx.tick, ctx.now, "resgate", format!("Resgate {} concluído: Hunter recuperado na vila", e.id));
                self.pending_save = true;
                continue;
            }
            if e.state == "retornando" && e.wagon.is_none() && alive.iter().all(|m| m.2 == Activity::NaVila) {
                self.expeditions[k].state = "concluida".into();
                self.event(ctx.tick, ctx.now, "expedicao", format!("Expedição {} concluída", e.id));
                self.pending_save = true;
            }
        }
    }

    // ------------------------------------------------------------------ resgate
    fn check_rescue(&mut self, ctx: &mut Ctx) {
        // Hunter sozinho fora de expedição (explorando) que cai: abre uma operação de resgate
        let lone: Vec<usize> = self.hunters.iter().enumerate().filter(|(_, h)| h.role == "hunter" && h.alive && h.activity == Activity::Caido && h.expedition.is_none()).map(|(i, _)| i).collect();
        for i in lone {
            self.next_id += 1;
            let eid = self.next_id as u32;
            let (hid, x, z, tile) = { let h = &self.hunters[i]; (h.id.clone(), h.mv.x, h.mv.z, h.mv.tile_id.clone()) };
            self.hunters[i].expedition = Some(eid);
            let threat = self.creatures.iter().filter(|c| c.alive && c.target_hunter.as_deref() == Some(hid.as_str())).map(|c| c.id).next();
            self.expeditions.push(Expedition { id: eid, species: String::new(), members: vec![hid], transporte: "resgate".into(), wagon: None, dest_tile: tile, dest: (x, z), camp: None, state: "resgate".into(), kills: 0, rescuer: None, cost: 0.0, threat, started_tick: ctx.tick, rescued: false, hunt_started_s: ctx.now });
        }
        for k in 0..self.expeditions.len() {
            let e = self.expeditions[k].clone();
            if e.rescuer.is_some() || matches!(e.state.as_str(), "concluida" | "fracassada" | "viajando") {
                continue;
            }
            let alive: Vec<&Hunter> = self.hunters.iter().filter(|h| e.members.contains(&h.id) && h.alive).collect();
            let downed = alive.iter().filter(|h| h.activity == Activity::Caido).count();
            if downed == 0 {
                continue;
            }
            let n = alive.len();
            let standing_hp: f64 = alive.iter().filter(|h| h.standing()).map(|h| h.hp).sum();
            let threat_hp = e.threat.and_then(|c| self.creatures.iter().find(|x| x.id == c && x.alive)).map(|c| c.hp).unwrap_or(0.0);
            let hopeless = standing_hp < threat_hp || downed == n;
            let solo = n == 1;
            if !(solo || (downed as f64 / n as f64 >= ctx.data.resgate.fracao_caidos && hopeless)) {
                continue;
            }
            // socorrista: o condutor da carroça desta expedição; a pé, quem estiver na vila
            let cand = self.hunters.iter().position(|h| {
                h.role == "socorrista" && h.standing() && h.expedition.is_none() && match &e.wagon {
                    Some(w) => h.wagon.as_ref() == Some(w),
                    None => self.wagons.iter().any(|w| Some(&w.id) == h.wagon.as_ref() && w.state == "na_vila"),
                }
            });
            let Some(ri) = cand else {
                continue; // resgate não é garantido: sem socorrista disponível
            };
            let threat = e.threat;
            let r = &mut self.hunters[ri];
            r.activity = Activity::Socorrendo;
            r.expedition = Some(e.id);
            r.target_creature = threat;
            r.hp = r.hp_max; // equipa a armadura
            let name = r.name.clone();
            self.expeditions[k].rescuer = Some(self.hunters[ri].id.clone());
            self.event(ctx.tick, ctx.now, "resgate", format!("Situação desesperadora na expedição {}: {name} equipou a armadura e partiu para o resgate", e.id));
        }
        // socorrista caído: resgate fracassou
        for k in 0..self.expeditions.len() {
            if let Some(rid) = self.expeditions[k].rescuer.clone() {
                if self.hunters.iter().any(|h| h.id == rid && !h.standing()) {
                    self.expeditions[k].rescuer = None;
                    let id = self.expeditions[k].id;
                    self.event(ctx.tick, ctx.now, "resgate", format!("O resgate da expedição {id} fracassou: o socorrista caiu"));
                }
            }
        }
    }

    fn check_deaths(&mut self, ctx: &mut Ctx) {
        let limit = ctx.data.combate.caido_ate_morrer_s;
        let mut died = vec![];
        for h in self.hunters.iter_mut() {
            if !h.alive {
                continue;
            }
            if let Some(t0) = h.downed_since_s {
                if matches!(h.activity, Activity::Caido | Activity::Carregado) && ctx.now - t0 > limit {
                    h.alive = false;
                    h.hp = 0.0;
                    h.activity = Activity::Morto;
                    h.carried_by = None;
                    died.push(h.name.clone());
                }
            }
        }
        for n in died {
            self.event(ctx.tick, ctx.now, "morte", format!("{n} morreu: morte permanente"));
            self.pending_save = true;
        }
    }

    pub fn view(&self, data: &GameData) -> GameView<'_> {
        let actors = self.actor_positions();
        let r = data.spawn.raio_simulacao_detalhada_m;
        GameView {
            money: self.money,
            creatures: self.creatures.iter().filter(|c| actors.iter().any(|a| d2(*a, (c.mv.x, c.mv.z)) <= r)).collect(),
            wagons: &self.wagons,
            camps: &self.camps,
            expeditions: &self.expeditions,
            bestiary: &self.bestiary,
            tracks: self.tracks.revealed_near(&actors, 400.0, 800),
            traps: &self.traps,
            events: self.events.iter().rev().take(60).collect(),
            village: self.village,
            village_storage: &self.village_storage,
        }
    }
}

fn fnv(s: &str) -> u32 {
    let mut h: u32 = 0x811c_9dc5;
    for b in s.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x0100_0193);
    }
    h
}

fn walkable_ring(t: &mut TerrainStore, c: (f64, f64), step: f64, n: usize) -> Vec<(f64, f64)> {
    let mut v = vec![];
    let mut r = step;
    while v.len() < n && r < 60.0 {
        for k in 0..8 {
            let a = k as f64 * std::f64::consts::TAU / 8.0;
            let p = (c.0 + a.cos() * r, c.1 + a.sin() * r);
            if walkable_cell(t, p.0, p.1).is_some() {
                v.push(p);
            }
        }
        r += step;
    }
    v
}

/// Clareira: célula caminhável com todo o entorno (raio) caminhável e pouco inclinado.
pub fn find_clearing(t: &mut TerrainStore, near: (f64, f64), radius: f64, max_slope_deg: f64) -> Option<(f64, f64)> {
    let tan = max_slope_deg.to_radians().tan();
    let mut tried = 0;
    let mut r = 0.0;
    while r <= 300.0 {
        let n = if r == 0.0 { 1 } else { ((r * std::f64::consts::TAU) / 16.0).ceil() as usize };
        for k in 0..n {
            tried += 1;
            if tried > 600 {
                return None;
            }
            let a = k as f64 * std::f64::consts::TAU / n as f64;
            let (x, z) = (near.0 + a.cos() * r, near.1 + a.sin() * r);
            let Some(h0) = walkable_cell(t, x, z) else { continue };
            let mut ok = true;
            let mut dx = -radius;
            'outer: while dx <= radius {
                let mut dz = -radius;
                while dz <= radius {
                    let d = (dx * dx + dz * dz).sqrt();
                    if d <= radius {
                        match walkable_cell(t, x + dx, z + dz) {
                            Some(h) if d == 0.0 || (h - h0).abs() / d <= tan => {}
                            _ => {
                                ok = false;
                                break 'outer;
                            }
                        }
                    }
                    dz += 2.0;
                }
                dx += 2.0;
            }
            if ok {
                return Some((x, z));
            }
        }
        r += 12.0;
    }
    None
}

/// Rota estratégica entre hexes: BFS no grafo de portais validados entre hexes liberados;
/// waypoints = centro do portal mais largo de cada passagem (25 m para dentro) + destino.
pub fn route_between(t: &mut TerrainStore, portals: &PortalIndex, from: &str, to: &str, dest: (f64, f64)) -> Option<Vec<(f64, f64)>> {
    use std::collections::VecDeque as Q;
    let mut prev: HashMap<String, String> = HashMap::new();
    let mut q = Q::from([from.to_string()]);
    let mut seen = HashSet::from([from.to_string()]);
    while let Some(a) = q.pop_front() {
        if a == to {
            break;
        }
        for (b, _) in portals.neighbors_with_portals(&a) {
            if !t.is_allowed(&b) || !seen.insert(b.clone()) {
                continue;
            }
            prev.insert(b.clone(), a.clone());
            q.push_back(b);
        }
    }
    if from != to && !prev.contains_key(to) {
        return None;
    }
    let mut chain = vec![to.to_string()];
    while let Some(p) = prev.get(chain.last().unwrap()) {
        chain.push(p.clone());
    }
    chain.reverse();
    let mut pts = vec![];
    for w in chain.windows(2) {
        let (a, b) = (&w[0], &w[1]);
        let p = portals.portals(a, b).iter().max_by(|x, y| x.width_meters.partial_cmp(&y.width_meters).unwrap())?;
        let (ta, tb) = (t.continent.tile(a)?.clone(), t.continent.tile(b)?.clone());
        let (dx, dz) = (tb.x - ta.x, tb.z - ta.z);
        let d = (dx * dx + dz * dz).sqrt();
        pts.push((p.center_x - dx / d * 25.0, p.center_z - dz / d * 25.0));
        pts.push((p.center_x + dx / d * 25.0, p.center_z + dz / d * 25.0));
    }
    pts.push(dest);
    Some(pts)
}
