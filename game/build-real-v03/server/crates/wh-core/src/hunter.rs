//! Hunter autônomo. O jogador NÃO move o Hunter: dá ordens (explorar, caçar) e a IA
//! (`game.rs`) decide movimento, estratégia e golpes. Sem nível geral: habilidades 1–20
//! independentes, com progresso por prática.
//! A posição é global (f64, em `Mover`) e não muda na troca de hex.

use crate::data::HunterDef;
pub use crate::mover::Crossing;
use crate::mover::Mover;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Estado de locomoção (contrato v1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HunterState {
    Planejando,
    Caminhando,
    Descansando,
    SemRota,
}

/// Atividade de gameplay (aditiva ao contrato v1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Activity {
    NaVila,
    Patrulhando,
    Embarcado,
    Conduzindo,
    Viajando,
    Procurando,
    Rastreando,
    Aproximando,
    ArmandoArmadilha,
    Aguardando,
    Combatendo,
    Caido,
    Morto,
    Carregado,
    RetornandoAoAcampamento,
    Descansando,
    VoltandoVila,
    Socorrendo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub tile: String,
    pub x: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Skill {
    pub level: u32,
    pub xp: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hunter {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub mv: Mover,
    pub state: HunterState,
    pub clip: String,
    pub speed_mps: f64,
    pub goal: Option<Goal>,
    pub rest_until_s: f64,
    pub plan_failures: u32,
    pub rng_state: u32,
    // --- gameplay ---
    pub role: String,
    pub hp: f64,
    pub hp_max: f64,
    pub forca: f64,
    pub arma: String,
    pub skills: BTreeMap<String, Skill>,
    pub inventory: Vec<String>,
    pub activity: Activity,
    pub crouched: bool,
    pub alive: bool,
    pub downed_since_s: Option<f64>,
    pub expedition: Option<u32>,
    pub target_creature: Option<u64>,
    pub cooldown_s: f64,
    pub busy_until_s: f64,
    pub no_attack_until_s: f64,
    pub last_action: String,
    /// Último gesto de combate para o apresentador animar (golpe_leve, golpe_pesado, desvio_1,
    /// desvio_5, atingido, armadilha). Só apresentação: a regra já foi resolvida no servidor.
    #[serde(default)]
    pub anim: String,
    /// Instante de simulação (s) em que `anim` começou.
    #[serde(default)]
    pub anim_t: f64,
    pub carried_by: Option<String>,
    pub wagon: Option<String>,
    #[serde(skip)]
    pub track: Option<(u64, u64)>,
    #[serde(skip)]
    pub route: Vec<(f64, f64)>,
    #[serde(skip)]
    pub route_idx: usize,
    #[serde(skip)]
    pub trap_wait_until_s: f64,
    /// Alvos que este Hunter não conseguiu alcançar (id → até quando ignorar).
    #[serde(skip)]
    pub ignore: std::collections::HashMap<u64, f64>,
    /// Fase final da aproximação (a ≤10 m vai direto, sem rodeio).
    #[serde(skip)]
    pub approach_final: bool,
    /// Patrulha alterna: interior do hex atual ↔ próximo portal.
    #[serde(skip)]
    pub patrol_interior_next: bool,
}

impl Hunter {
    pub fn new(id: &str, name: &str, x: f64, z: f64, tile_id: &str, walk_speed_mps: f64, seed: u32) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            mv: Mover::new(x, z, tile_id),
            state: HunterState::Descansando,
            clip: "Idle".into(),
            speed_mps: walk_speed_mps,
            goal: None,
            rest_until_s: 0.0,
            plan_failures: 0,
            rng_state: seed.max(1),
            role: "hunter".into(),
            hp: 100.0,
            hp_max: 100.0,
            forca: 8.0,
            arma: "espada".into(),
            skills: BTreeMap::new(),
            inventory: vec![],
            activity: Activity::NaVila,
            crouched: false,
            alive: true,
            downed_since_s: None,
            expedition: None,
            target_creature: None,
            cooldown_s: 0.0,
            busy_until_s: 0.0,
            no_attack_until_s: 0.0,
            last_action: String::new(),
            anim: String::new(),
            anim_t: 0.0,
            carried_by: None,
            wagon: None,
            track: None,
            route: vec![],
            route_idx: 0,
            trap_wait_until_s: 0.0,
            ignore: Default::default(),
            approach_final: false,
            patrol_interior_next: false,
        }
    }

    pub fn from_def(d: &HunterDef, role: &str, hp_base: f64, x: f64, z: f64, tile: &str, walk: f64, seed: u32) -> Self {
        let mut h = Self::new(&d.id, &d.nome, x, z, tile, walk, seed);
        h.role = role.into();
        h.hp_max = hp_base + d.armadura_hp;
        h.hp = h.hp_max;
        h.forca = d.forca;
        h.arma = d.arma.clone();
        h.skills = d.habilidades.iter().map(|(k, v)| (k.clone(), Skill { level: (*v).clamp(1, 20), xp: 0.0 })).collect();
        h
    }

    pub fn skill(&self, k: &str) -> u32 {
        self.skills.get(k).map(|s| s.level).unwrap_or(1)
    }

    /// Progresso por prática; devolve o novo nível se subiu.
    pub fn practice(&mut self, k: &str, xp: f64, per_level: f64, max: u32) -> Option<u32> {
        let s = self.skills.entry(k.into()).or_insert(Skill { level: 1, xp: 0.0 });
        if s.level >= max {
            return None;
        }
        s.xp += xp;
        if s.xp >= per_level * s.level as f64 {
            s.xp = 0.0;
            s.level += 1;
            return Some(s.level);
        }
        None
    }

    pub fn standing(&self) -> bool {
        self.alive && self.hp > 0.0 && !matches!(self.activity, Activity::Caido | Activity::Morto | Activity::Carregado)
    }

    pub fn rng(&mut self) -> f64 {
        let mut r = crate::rng::XorShift32::new(self.rng_state);
        let v = r.next_f64();
        self.rng_state = r.state;
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn skills_level_by_practice_without_general_level() {
        let mut h = Hunter::new("h", "H", 0.0, 0.0, "C", 1.0, 1);
        h.skills.insert("espada".into(), Skill { level: 1, xp: 0.0 });
        assert_eq!(h.practice("espada", 60.0, 100.0, 20), None);
        assert_eq!(h.practice("espada", 50.0, 100.0, 20), Some(2));
        h.skills.insert("desvio".into(), Skill { level: 20, xp: 0.0 });
        assert_eq!(h.practice("desvio", 1e9, 100.0, 20), None);
        let v = serde_json::to_value(&h).unwrap();
        assert!(v.get("level").is_none(), "Hunter não tem nível geral");
        assert!(v.get("x").is_some() && v.get("tile_id").is_some(), "Mover achatado no contrato v1");
    }
}
