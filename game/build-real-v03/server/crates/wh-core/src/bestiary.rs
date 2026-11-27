//! Bestiário: uma página por espécie, criada no PRIMEIRO avistamento e atualizada
//! (nunca duplicada) nos seguintes. Conhecimento de Monstros vive só aqui, mas a IA
//! dos Hunters o consulta (ver `game.rs`).

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub species: String,
    pub nome: String,
    pub primeiro_avistamento_tick: u64,
    pub primeiro_por: String,
    pub avistamentos: u32,
    pub abates: u32,
    pub conhecimento: String,
    pub habitats: BTreeSet<String>,
    pub itens: Vec<String>,
    /// Últimos pontos de avistamento (mapinha de habitat). Não é a posição atual do animal.
    #[serde(default)]
    pub pontos: Vec<(String, f64, f64)>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Bestiary {
    pub pages: BTreeMap<String, Page>,
}

impl Bestiary {
    /// Devolve true se criou página nova.
    #[allow(clippy::too_many_arguments)]
    pub fn sight(&mut self, species: &str, nome: &str, itens: Vec<String>, tile: &str, x: f64, z: f64, by: &str, tick: u64, estudado: u32) -> bool {
        let new = !self.pages.contains_key(species);
        let p = self.pages.entry(species.into()).or_insert_with(|| Page {
            species: species.into(),
            nome: nome.into(),
            primeiro_avistamento_tick: tick,
            primeiro_por: by.into(),
            avistamentos: 0,
            abates: 0,
            conhecimento: "avistado".into(),
            habitats: BTreeSet::new(),
            itens,
            pontos: vec![],
        });
        p.pontos.push((tile.into(), x, z));
        if p.pontos.len() > 8 {
            p.pontos.remove(0);
        }
        p.avistamentos += 1;
        p.habitats.insert(tile.into());
        if p.conhecimento == "avistado" && p.avistamentos >= estudado {
            p.conhecimento = "estudado".into();
        }
        new
    }

    pub fn kill(&mut self, species: &str, dominado: u32) {
        if let Some(p) = self.pages.get_mut(species) {
            p.abates += 1;
            if p.abates >= dominado {
                p.conhecimento = "dominado".into();
            }
        }
    }

    pub fn level(&self, species: &str) -> u8 {
        match self.pages.get(species).map(|p| p.conhecimento.as_str()) {
            Some("dominado") => 3,
            Some("estudado") => 2,
            Some(_) => 1,
            None => 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn first_sighting_creates_then_updates_without_duplicating() {
        let mut b = Bestiary::default();
        assert!(b.sight("folhisco", "Folhisco", vec!["Penas".into()], "FX_20", 0.0, 0.0, "h1", 10, 3));
        assert!(!b.sight("folhisco", "Folhisco", vec![], "FX_19", 1.0, 1.0, "h2", 20, 3));
        assert_eq!(b.pages.len(), 1);
        let p = &b.pages["folhisco"];
        assert_eq!((p.avistamentos, p.primeiro_por.as_str(), p.habitats.len()), (2, "h1", 2));
        assert_eq!(b.level("folhisco"), 1);
        b.sight("folhisco", "Folhisco", vec![], "FX_20", 2.0, 2.0, "h1", 30, 3);
        assert_eq!(b.level("folhisco"), 2);
        b.kill("folhisco", 1);
        assert_eq!(b.level("folhisco"), 3);
        // ida e volta por JSON (persistência) mantém a página
        let s = serde_json::to_string(&b).unwrap();
        let b2: Bestiary = serde_json::from_str(&s).unwrap();
        assert_eq!(b2.pages["folhisco"].avistamentos, 3);
    }
}
