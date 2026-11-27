//! Rastros como registros compactos (não objetos 3D): por criatura, um anel limitado de
//! pegadas com sequência e marca de quebra (água). Só pegadas DESCOBERTAS vão ao cliente,
//! que as desenha em azul.

use serde::Serialize;
use std::collections::{BTreeSet, HashMap, VecDeque};

#[derive(Debug, Clone, Serialize)]
pub struct Footprint {
    pub id: u64,
    pub creature: u64,
    pub species: String,
    pub x: f64,
    pub z: f64,
    pub t: f64,
    pub seq: u64,
    /// A pegada anterior desta criatura ficou do outro lado de água: trilha interrompida.
    pub break_before: bool,
}

#[derive(Debug, Default)]
pub struct Tracks {
    pub by_creature: HashMap<u64, VecDeque<Footprint>>,
    pub revealed: BTreeSet<u64>,
    next_id: u64,
    seq: HashMap<u64, u64>,
}

impl Tracks {
    #[allow(clippy::too_many_arguments)]
    pub fn push(&mut self, creature: u64, species: &str, x: f64, z: f64, t: f64, break_before: bool, cap: usize) {
        self.next_id += 1;
        let s = self.seq.entry(creature).or_insert(0);
        *s += 1;
        let q = self.by_creature.entry(creature).or_default();
        q.push_back(Footprint { id: self.next_id, creature, species: species.into(), x, z, t, seq: *s, break_before });
        while q.len() > cap {
            if let Some(old) = q.pop_front() {
                self.revealed.remove(&old.id);
            }
        }
    }

    pub fn expire(&mut self, now: f64, life_s: f64) {
        for q in self.by_creature.values_mut() {
            while q.front().map(|f| now - f.t > life_s).unwrap_or(false) {
                let f = q.pop_front().unwrap();
                self.revealed.remove(&f.id);
            }
        }
    }

    /// Pegadas não reveladas de uma espécie num raio (para a busca do Hunter).
    pub fn unrevealed_near(&self, species: &str, x: f64, z: f64, r: f64) -> Vec<Footprint> {
        let mut v = vec![];
        for q in self.by_creature.values() {
            if q.front().map(|f| f.species != species).unwrap_or(true) {
                continue;
            }
            for f in q {
                if !self.revealed.contains(&f.id) && ((f.x - x).powi(2) + (f.z - z).powi(2)).sqrt() <= r {
                    v.push(f.clone());
                }
            }
        }
        v
    }

    /// Próxima pegada da mesma criatura depois de `seq` (seguindo a trilha).
    pub fn next_after(&self, creature: u64, seq: u64) -> Option<Footprint> {
        self.by_creature.get(&creature)?.iter().find(|f| f.seq > seq).cloned()
    }

    pub fn revealed_near(&self, points: &[(f64, f64)], r: f64, cap: usize) -> Vec<Footprint> {
        let mut v = vec![];
        for q in self.by_creature.values() {
            for f in q {
                if self.revealed.contains(&f.id) && points.iter().any(|(x, z)| ((f.x - x).powi(2) + (f.z - z).powi(2)).sqrt() <= r) {
                    v.push(f.clone());
                    if v.len() >= cap {
                        return v;
                    }
                }
            }
        }
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ring_cap_and_break_flag() {
        let mut t = Tracks::default();
        for i in 0..10 {
            t.push(7, "folhisco", i as f64 * 2.0, 0.0, i as f64, i == 5, 4);
        }
        let q = &t.by_creature[&7];
        assert_eq!(q.len(), 4);
        assert_eq!(q.front().unwrap().seq, 7);
        assert!(t.next_after(7, 7).unwrap().seq == 8);
        let mut t2 = Tracks::default();
        t2.push(1, "folhisco", 0.0, 0.0, 0.0, false, 10);
        t2.push(1, "folhisco", 2.0, 0.0, 1.0, true, 10);
        assert!(t2.next_after(1, 1).unwrap().break_before);
        assert_eq!(t2.unrevealed_near("folhisco", 0.0, 0.0, 3.0).len(), 2);
        assert_eq!(t2.unrevealed_near("lobrapedra", 0.0, 0.0, 3.0).len(), 0);
    }
}
