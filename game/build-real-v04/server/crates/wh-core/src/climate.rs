//! Clima continental autoritativo (V02). Porte do laboratório `labs/ia-criaturas/src/eco/clima.js`
//! (V7: chuva intensa, tempestade de areia, nevasca, rampas, temperatura diária, fatores de
//! visão/audição/olfato/locomoção, apagamento de rastros), estendido para o continente conforme a
//! proposta `build real/13-clima-dinamico.md` (P0): campo de 272 nós (um por hex), frentes que se
//! movem com o vento dominante e perdem umidade ao cruzar montanhas (sombra de chuva), tipos
//! derivados de parâmetros contínuos (temperatura × precipitação × vento × bioma), megatempestades
//! raras, ciclo lunar e auroras polares à noite. O laboratório V08 NÃO existe no repositório.
//! Determinístico (XorShift32 salvo no estado); sem aleatoriedade por quadro; nada de shader aqui.
//! Todos os números são PROVISÓRIOS (`clima` em gameplay-provisorio-v02.json).

use crate::rng::XorShift32;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum BiomeClass {
    #[default]
    Temperado,
    Floresta,
    Montanha,
    Selva,
    Pantano,
    Savana,
    Deserto,
    Neve,
    Costa,
}

impl BiomeClass {
    pub fn of(biome: &str) -> Self {
        let b = biome.to_lowercase();
        let has = |w: &[&str]| w.iter().any(|x| b.contains(x));
        if has(&["swamp", "pântano", "pantano"]) { return Self::Pantano; }
        if has(&["jungle", "selva"]) { return Self::Selva; }
        if has(&["snow", "ice", "glacial", "neve", "gelo"]) { return Self::Neve; }
        if has(&["savanna", "savana"]) { return Self::Savana; }
        if has(&["dune", "desert", "erg", "duna", "arenito", "mesas", "cânion", "canion", "oásis", "oasis", "arco", "ossada", "maciço"]) { return Self::Deserto; }
        if has(&["praia", "falesia", "falésia", "coast", "costa"]) { return Self::Costa; }
        if has(&["mountain", "montanha"]) { return Self::Montanha; }
        if has(&["forest", "floresta"]) { return Self::Floresta; }
        Self::Temperado
    }
    /// (temperatura média °C, amplitude diária, umidade base, nuvem base)
    fn base(self) -> (f64, f64, f64, f64) {
        match self {
            Self::Temperado => (15.0, 8.0, 0.5, 0.3),
            Self::Floresta => (13.0, 6.0, 0.6, 0.35),
            Self::Montanha => (6.0, 9.0, 0.55, 0.4),
            Self::Selva => (27.0, 6.0, 0.9, 0.5),
            Self::Pantano => (24.0, 5.0, 0.95, 0.55),
            Self::Savana => (26.0, 11.0, 0.35, 0.2),
            Self::Deserto => (31.0, 16.0, 0.1, 0.05),
            Self::Neve => (-8.0, 6.0, 0.5, 0.45),
            Self::Costa => (17.0, 5.0, 0.7, 0.35),
        }
    }
    fn polar(self) -> bool { matches!(self, Self::Neve) }
    fn arenoso(self) -> bool { matches!(self, Self::Deserto | Self::Savana) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub x: f64,
    pub z: f64,
    pub class: BiomeClass,
    pub mountain: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Front {
    pub id: u32,
    pub x: f64,
    pub z: f64,
    pub radius: f64,
    pub humidity: f64,
    pub strength: f64,
    pub age_s: f64,
    pub life_s: f64,
    pub mega: bool,
    /// Frente forçada (menu do desenvolvedor) — tipo pedido, se compatível com o bioma.
    #[serde(default)]
    pub forced: Option<String>,
}

/// Estado local num nó do campo (o que o cliente recebe e o que a IA consulta).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Local {
    pub kind: String,
    pub intensity: f64,
    pub cloud: f64,
    pub temperature_c: f64,
    pub wind: (f64, f64),
    pub aurora: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Climate {
    pub nodes: Vec<Node>,
    pub local: Vec<Local>,
    pub fronts: Vec<Front>,
    pub rng: u32,
    pub next_front_s: f64,
    pub last_update_s: f64,
    pub next_id: u32,
    pub prevailing: (f64, f64),
}

/// Fatores de percepção/locomoção numa posição (1 = sem efeito), já com noite.
#[derive(Debug, Clone, Copy)]
pub struct Effects {
    pub visao: f64,
    pub audicao: f64,
    pub olfato: f64,
    pub locomocao: f64,
    pub apaga_rastros: bool,
    pub wind: (f64, f64),
}
impl Default for Effects {
    fn default() -> Self { Self { visao: 1.0, audicao: 1.0, olfato: 1.0, locomocao: 1.0, apaga_rastros: false, wind: (0.0, 0.0) } }
}

pub struct ClimateCfg<'a> {
    pub fatores: &'a std::collections::BTreeMap<String, crate::data::ClimaFator>,
    pub noite_visao: f64,
    pub frente_intervalo_s: f64,
    pub frente_vida_s: (f64, f64),
    pub mega_chance: f64,
    pub atualizacao_s: f64,
}

impl Climate {
    pub fn new(tiles: &[(String, f64, f64, String)], seed: u32) -> Self {
        let nodes = tiles
            .iter()
            .map(|(id, x, z, b)| Node { id: id.clone(), x: *x, z: *z, class: BiomeClass::of(b), mountain: b.contains("mountain") || b.contains("Maciço") })
            .collect::<Vec<_>>();
        let n = nodes.len();
        Self { nodes, local: vec![Local::default(); n], fronts: vec![], rng: seed.max(1) ^ 0x9e37_79b9, next_front_s: 30.0, last_update_s: -1e9, next_id: 1, prevailing: (1.0, 0.25) }
    }

    fn day_temp_offset(amp: f64, phase_day: bool, phase_frac: f64) -> f64 {
        // mínima no fim da noite, máxima à tarde (dia 2 h + noite 40 min)
        let h = if phase_day { 6.0 + 12.0 * phase_frac } else { 18.0 + 12.0 * phase_frac };
        -amp * ((h - 3.0) / 12.0 * std::f64::consts::PI).cos()
    }

    /// Atualiza o campo a cada `atualizacao_s` de tempo SIMULADO (determinístico).
    pub fn update(&mut self, now: f64, day: bool, phase_frac: f64, cfg: &ClimateCfg) {
        if now - self.last_update_s < cfg.atualizacao_s { return; }
        let dt = if self.last_update_s < 0.0 { cfg.atualizacao_s } else { (now - self.last_update_s).min(120.0) };
        self.last_update_s = now;
        let mut r = XorShift32::new(self.rng);
        // vento dominante: deriva lenta (oeste→leste com oscilação)
        let a = (now / 5400.0).sin() * 0.7 + (now / 13000.0).cos() * 0.4;
        self.prevailing = (a.cos() * 1.1, a.sin() * 0.6 + 0.15);
        // nascimento de frentes
        if now >= self.next_front_s && !self.nodes.is_empty() {
            let i = (r.next_f64() * self.nodes.len() as f64) as usize % self.nodes.len();
            let n = &self.nodes[i];
            let (_, _, hum, _) = n.class.base();
            let mega = r.next_f64() < cfg.mega_chance;
            let life = cfg.frente_vida_s.0 + r.next_f64() * (cfg.frente_vida_s.1 - cfg.frente_vida_s.0);
            self.fronts.push(Front { id: self.next_id, x: n.x, z: n.z, radius: if mega { 9000.0 } else { 3500.0 + r.next_f64() * 3500.0 }, humidity: (hum + 0.35 + r.next_f64() * 0.3).min(1.2), strength: 0.0, age_s: 0.0, life_s: life * if mega { 1.6 } else { 1.0 }, mega, forced: None });
            self.next_id += 1;
            self.next_front_s = now + cfg.frente_intervalo_s * (0.6 + r.next_f64() * 0.8);
        }
        // mover/evoluir frentes; montanhas tiram umidade (barlavento chove, sotavento seca)
        let (wx, wz) = self.prevailing;
        for f in self.fronts.iter_mut() {
            f.age_s += dt;
            let speed = if f.forced.is_some() { 0.0 } else { 4.5 }; // m/s de tempo simulado
            f.x += wx * speed * dt;
            f.z += wz * speed * dt;
            let life_t = (f.age_s / f.life_s).clamp(0.0, 1.0);
            f.strength = (life_t * 4.0).min(1.0) * ((1.0 - life_t) * 3.0).min(1.0) * if f.mega { 1.0 } else { 0.85 };
            if let Some(n) = self.nodes.iter().min_by(|a, b| d2(a.x, a.z, f.x, f.z).partial_cmp(&d2(b.x, b.z, f.x, f.z)).unwrap()) {
                if n.mountain && f.forced.is_none() { f.humidity = (f.humidity - 0.02 * dt / 10.0).max(0.0); }
            }
        }
        self.fronts.retain(|f| f.age_s < f.life_s);
        // campo por nó
        let lunar_night = !day;
        for (i, n) in self.nodes.iter().enumerate() {
            let (tmean, amp, hum0, cloud0) = n.class.base();
            let mut cloud = cloud0;
            let mut precip: f64 = 0.0;
            let mut forced: Option<String> = None;
            let mut mega = false;
            for f in &self.fronts {
                let d = d2(n.x, n.z, f.x, f.z).sqrt();
                if d > f.radius { continue; }
                let w = (1.0 - d / f.radius).powf(0.7) * f.strength;
                cloud = cloud.max(w * 0.95);
                precip = precip.max(w * f.humidity.min(1.0) * (0.6 + hum0 * 0.6));
                if f.forced.is_some() && w > 0.2 { forced = f.forced.clone(); precip = precip.max(w); }
                mega |= f.mega && w > 0.5;
            }
            let temp = tmean + Self::day_temp_offset(amp, day, phase_frac) - precip * 4.0;
            let wind_mag = 0.5 + precip * 1.4 + if mega { 1.5 } else { 0.0 };
            let wind = (wx * wind_mag, wz * wind_mag);
            let dry = n.class.arenoso() && hum0 < 0.4;
            let mut kind = if precip < 0.12 { if cloud > 0.55 { "nublado" } else { "limpo" } } else if temp < 0.0 {
                if precip > 0.6 && wind_mag > 1.4 { "nevasca" } else { "neve" }
            } else if dry {
                if wind_mag > 1.1 { "areia" } else { "nublado" }
            } else if precip > 0.65 || mega { "tempestade" } else { "chuva" }
            .to_string();
            let mut intensity = precip.clamp(0.0, 1.0);
            if let Some(fk) = forced {
                // forçado só se o bioma comportar (regra do laboratório: areia exige areia, nevasca exige frio)
                let ok = match fk.as_str() { "areia" => n.class.arenoso(), "neve" | "nevasca" => temp < 4.0 || n.class.polar(), _ => true };
                if ok { kind = fk; intensity = intensity.max(0.85); cloud = cloud.max(0.8); }
            }
            if mega { kind = if temp < 0.0 { "nevasca".into() } else if dry { "areia".into() } else { "tempestade".into() }; intensity = intensity.max(0.95); }
            // aurora: biomas polares, noite, céu limpo (sorteio determinístico por nó e ciclo)
            let aurora = if lunar_night && n.class.polar() && cloud < 0.5 { 0.6 + 0.4 * ((i as f64 * 1.7 + now / 900.0).sin() * 0.5 + 0.5) } else { 0.0 };
            self.local[i] = Local { kind, intensity, cloud: cloud.clamp(0.0, 1.0), temperature_c: temp, wind, aurora };
        }
        self.rng = r.state;
    }

    /// Clima numa posição: interpolação dos 3 nós mais próximos (sem fronteira hexagonal visível).
    pub fn at(&self, x: f64, z: f64) -> Local {
        if self.nodes.is_empty() { return Local { kind: "limpo".into(), cloud: 0.2, ..Default::default() }; }
        let mut best: [(f64, usize); 3] = [(f64::MAX, 0); 3];
        for (i, n) in self.nodes.iter().enumerate() {
            let d = d2(n.x, n.z, x, z);
            if d < best[2].0 { best[2] = (d, i); best.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap()); }
        }
        let mut wsum = 0.0;
        let mut out = Local::default();
        let mut kinds: Vec<(f64, &str)> = vec![];
        for (d, i) in best.iter().filter(|(d, _)| *d < f64::MAX) {
            let w = 1.0 / (d.sqrt() + 200.0);
            let l = &self.local[*i];
            wsum += w;
            out.intensity += l.intensity * w; out.cloud += l.cloud * w; out.temperature_c += l.temperature_c * w;
            out.wind.0 += l.wind.0 * w; out.wind.1 += l.wind.1 * w; out.aurora += l.aurora * w;
            kinds.push((w * (0.2 + l.intensity), l.kind.as_str()));
        }
        if wsum > 0.0 { out.intensity /= wsum; out.cloud /= wsum; out.temperature_c /= wsum; out.wind.0 /= wsum; out.wind.1 /= wsum; out.aurora /= wsum; }
        kinds.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        out.kind = kinds.first().map(|k| k.1.to_string()).unwrap_or_else(|| "limpo".into());
        out
    }

    /// Fatores para a IA (mesma fonte que o cliente desenha — não existe tempestade "só da câmera").
    pub fn effects(&self, x: f64, z: f64, night: bool, cfg: &ClimateCfg) -> Effects {
        let l = self.at(x, z);
        let mut e = Effects { wind: l.wind, ..Default::default() };
        if let Some(f) = cfg.fatores.get(&l.kind) {
            let i = l.intensity;
            e.visao = 1.0 + (f.visao - 1.0) * i;
            e.audicao = 1.0 + (f.audicao - 1.0) * i;
            e.olfato = 1.0 + (f.olfato - 1.0) * i;
            e.locomocao = 1.0 + (f.locomocao - 1.0) * i;
            e.apaga_rastros = f.apaga_rastros && i > 0.5;
        }
        if night { e.visao *= cfg.noite_visao; }
        e
    }

    /// Fase lunar 0..1 (0 = nova, 0,5 = cheia) — ciclo de `ciclos` dias completos.
    pub fn moon_phase(cycle: u64, cycle_fraction: f64, ciclos: f64) -> f64 {
        ((cycle as f64 + cycle_fraction) / ciclos.max(1.0)).fract()
    }

    /// Menu do desenvolvedor: força um tipo de clima centrado numa posição (para testes visuais e de IA).
    pub fn force(&mut self, x: f64, z: f64, kind: &str, now: f64, dur_s: f64) {
        self.fronts.retain(|f| f.forced.is_none());
        if kind == "limpo" { self.last_update_s = -1e9; return; }
        self.fronts.push(Front { id: self.next_id, x, z, radius: 6000.0, humidity: 1.0, strength: 1.0, age_s: dur_s * 0.3, life_s: dur_s, mega: false, forced: Some(kind.into()) });
        self.next_id += 1;
        self.last_update_s = -1e9;
        let _ = now;
    }
}

fn d2(ax: f64, az: f64, bx: f64, bz: f64) -> f64 { (ax - bx).powi(2) + (az - bz).powi(2) }

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    fn cfg(f: &BTreeMap<String, crate::data::ClimaFator>) -> ClimateCfg<'_> {
        ClimateCfg { fatores: f, noite_visao: 0.5, frente_intervalo_s: 300.0, frente_vida_s: (1800.0, 3600.0), mega_chance: 0.0, atualizacao_s: 10.0 }
    }
    fn tiles() -> Vec<(String, f64, f64, String)> {
        vec![("A".into(), 0.0, 0.0, "erg_dune_desert".into()), ("B".into(), 4330.0, 0.0, "snow-forest".into()), ("C".into(), 8660.0, 0.0, "temperate forest".into())]
    }
    #[test]
    fn deterministic_and_biome_bound_forcing() {
        let mut f = BTreeMap::new();
        f.insert("areia".into(), crate::data::ClimaFator { visao: 0.15, audicao: 0.5, olfato: 0.6, locomocao: 0.8, delta_temperatura_c: -2.0, apaga_rastros: true });
        let c = cfg(&f);
        let (mut a, mut b) = (Climate::new(&tiles(), 7), Climate::new(&tiles(), 7));
        for k in 0..400 { a.update(k as f64 * 10.0, true, 0.5, &c); b.update(k as f64 * 10.0, true, 0.5, &c); }
        assert_eq!(serde_json::to_string(&a.local).unwrap(), serde_json::to_string(&b.local).unwrap(), "mesmo seed → mesmo clima");
        // areia forçada só vale no deserto, nunca na floresta nevada
        a.force(0.0, 0.0, "areia", 4000.0, 600.0);
        a.update(4010.0, true, 0.5, &c);
        assert_eq!(a.local[0].kind, "areia");
        assert_ne!(a.local[1].kind, "areia");
        let e = a.effects(0.0, 0.0, false, &c);
        assert!(e.visao < 0.4 && e.apaga_rastros, "tempestade de areia reduz a visão e apaga rastros");
        let n = a.effects(0.0, 0.0, true, &c);
        assert!(n.visao < e.visao, "noite reduz a visão");
    }
}
