//! Porte incremental (etapa 1) de `game/alpha01/src/combat/combat.ts`.
//! Só as funções puras `distance`, `hunterDamage` e a regra de golpe `strike`
//! sobre um estado mínimo. Paridade verificada contra o TypeScript original.
//! Não é o sistema de combate da Build Real; é a primeira fatia portada.

pub fn distance(ax: f64, az: f64, bx: f64, bz: f64) -> f64 {
    (ax - bx).hypot(az - bz)
}

/// `3 + força * 0.65 + ataque_da_arma_equipada`.
pub fn hunter_damage(forca: f64, equipped_attack: f64) -> f64 {
    3.0 + forca * 0.65 + equipped_attack
}

#[derive(Debug, Clone, PartialEq)]
pub struct StrikeHunter {
    pub x: f64,
    pub z: f64,
    pub cooldown: f64,
    pub forca: f64,
    pub equipped_attack: f64,
    pub kills: u32,
    pub haul: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StrikeCreature {
    pub x: f64,
    pub z: f64,
    pub hp: f64,
    pub food: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StrikeOutcome {
    NotReady,
    OutOfRange,
    Hit,
    Killed,
}

/// Regra de `strike(w, h, c)`: alcance 2,6 m, cooldown 1,2 s, dano não deixa hp < 0.
pub fn strike(h: &mut StrikeHunter, c: &mut StrikeCreature) -> StrikeOutcome {
    if h.cooldown > 0.0 {
        return StrikeOutcome::NotReady;
    }
    if distance(h.x, h.z, c.x, c.z) > 2.6 {
        return StrikeOutcome::OutOfRange;
    }
    h.cooldown = 1.2;
    c.hp = (c.hp - hunter_damage(h.forca, h.equipped_attack)).max(0.0);
    if c.hp == 0.0 {
        h.kills += 1;
        h.haul += c.food;
        StrikeOutcome::Killed
    } else {
        StrikeOutcome::Hit
    }
}
