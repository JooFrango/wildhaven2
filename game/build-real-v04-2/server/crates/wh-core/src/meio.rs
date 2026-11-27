//! V04 — Controladores de meio de locomoção portados (simplificados) do laboratório de IA
//! (`labs/ia-criaturas/src/eco/cerebro-voo.js`, `voo.js`, `cerebro-dunas.js`, `subsolo.js`). O cérebro de
//! necessidades continua o mesmo para todas as espécies (núcleo compartilhado); estes módulos decidem só o MEIO
//! e o deslocamento dentro dele, respeitando os parâmetros de cada espécie (todos PROVISÓRIOS, do laboratório).
//!
//! **Voo:** decola quando o destino passa de `distanciaVoarM` (ou para fugir), se houver energia; sobe até a
//! altitude de cruzeiro acima do relevo (com folga de obstáculo), voa em linha reta (sem A* — o ar não tem os
//! bloqueios do chão), desce ao chegar e pousa numa célula caminhável. Voando não deixa pegadas.
//!
//! **Subsolo (areia):** a criatura fica submersa por padrão, desloca-se sob a areia na velocidade de cruzeiro
//! (arranque ao caçar), percebe Hunters pela VIBRAÇÃO dos passos (alcance próprio, independe da visão) e só
//! EMERGE para atacar (ou quando sai da areia); volta a submergir depois. Submersa não deixa pegadas e só é
//! vista de muito perto. Fora de bioma de areia ela permanece na superfície (não "nada" em rocha ou grama).
use crate::creature::Creature;
use crate::data::{Subsolo, Voo};
use crate::terrain::TerrainStore;

pub const MEIO_SOLO: &str = "solo";
pub const MEIO_AR: &str = "ar";
pub const MEIO_AREIA: &str = "areia";

/// Distância de que um Hunter enxerga uma criatura submersa (rastro de areia mexida).
pub const VISTA_SUBMERSA_M: f64 = 6.0;

/// Avança uma criatura voadora. Retorna `true` se ela está no ar neste tick (o chamador não usa o A* do chão).
pub fn step_voo(c: &mut Creature, voo: &Voo, t: &mut TerrainStore, dt: f64, fleeing: bool) -> bool {
    let target = c.mv.target;
    let ground = t.sample(c.mv.x, c.mv.z).map(|s| s.h).unwrap_or(c.mv.y - c.alt);
    let in_air = c.meio == MEIO_AR;
    let dist = target.map(|(x, z)| c.mv.dist(x, z)).unwrap_or(0.0);
    // decidir decolar
    if !in_air {
        let want = target.is_some() && (dist > voo.distancia_voar_m || (fleeing && dist > 4.0));
        if !want || c.energia * 100.0 < voo.energia_min_decolar {
            return false;
        }
        c.meio = MEIO_AR.into();
        c.voo_t = 0.0;
        c.mv.path.clear();
        c.mv.path_idx = 0;
    }
    c.voo_t += dt;
    let (tx, tz) = target.unwrap_or((c.mv.x, c.mv.z));
    let landing = dist < 8.0 + c.alt * 0.5 || target.is_none();
    // altitude desejada: cruzeiro acima do relevo à frente (folga de obstáculo), ou descida para pousar
    let ahead = {
        let d = dist.max(0.1);
        let k = (voo.vel_cruzeiro * 2.0).min(d);
        let (ax, az) = (c.mv.x + (tx - c.mv.x) / d * k, c.mv.z + (tz - c.mv.z) / d * k);
        t.sample(ax, az).map(|s| s.h).unwrap_or(ground)
    };
    let want_alt = if landing { 0.0 } else { voo.altitude_cruzeiro_m + (ahead - ground).max(0.0) + voo.folga_obstaculo_m };
    let climb = if c.voo_t < voo.decolagem_seg { voo.subida_max * 1.5 } else { voo.subida_max };
    c.alt = if want_alt > c.alt { (c.alt + climb * dt).min(want_alt) } else { (c.alt - voo.descida_max * dt).max(want_alt) };
    // deslocamento horizontal em linha reta (desacelera ao pousar)
    let speed = if fleeing { voo.vel_max } else if landing { (voo.vel_cruzeiro * 0.5).max(2.0) } else { voo.vel_cruzeiro };
    if dist > 0.5 {
        let step = (speed * dt).min(dist);
        let (dx, dz) = ((tx - c.mv.x) / dist, (tz - c.mv.z) / dist);
        c.mv.x += dx * step;
        c.mv.z += dz * step;
        c.mv.heading = dx.atan2(dz);
        c.mv.distance_walked_m += step;
    }
    let g = t.sample(c.mv.x, c.mv.z).map(|s| s.h).unwrap_or(ground);
    c.mv.y = g + c.alt;
    // energia: bater asas ao subir, planar no cruzeiro (custos por segundo do laboratório, escala 0..100)
    let custo = if c.alt < want_alt - 0.5 { voo.custo_batido_por_seg } else { voo.custo_planeio_por_seg };
    c.energia = (c.energia - custo / 100.0 * dt).max(0.0);
    c.clip = if c.voo_t < voo.decolagem_seg { "takeoff".into() } else if landing && c.alt < 4.0 { "land".into() } else { "fly".into() };
    // pousou: volta ao chão numa célula caminhável
    if landing && c.alt <= 0.05 {
        if crate::nav::walkable_cell(t, c.mv.x, c.mv.z).is_some() {
            c.meio = MEIO_SOLO.into();
            c.alt = 0.0;
            c.mv.snap_y(t);
            if dist <= 8.0 {
                c.mv.stop();
            }
            return true;
        }
        c.alt = 2.0; // sem chão firme: continua planando baixo até achar
    }
    true
}

/// Areia sob a criatura (célula caminhável, seca, num hex de bioma arenoso).
pub fn tem_areia(biome_is_sand: bool, t: &mut TerrainStore, x: f64, z: f64) -> bool {
    biome_is_sand && t.sample(x, z).map(|s| s.water.is_none() && !s.blocked).unwrap_or(false)
}

/// Ajusta o meio de uma criatura de subsolo antes do deslocamento. Retorna a velocidade a usar.
/// `ataque`: há presa/Hunter ao alcance de bote (emergir); `perseguindo`: arranque.
pub fn step_subsolo(c: &mut Creature, sub: &Subsolo, areia: bool, ataque: bool, perseguindo: bool, now: f64, base_speed: f64) -> f64 {
    if !areia {
        // fora da areia: superfície (não atravessa rocha/grama submersa)
        if c.meio == MEIO_AREIA {
            c.meio = MEIO_SOLO.into();
            c.alt = 0.0;
            c.voo_t = now; // instante da emergência
        }
        return base_speed;
    }
    if ataque {
        if c.meio == MEIO_AREIA {
            c.meio = MEIO_SOLO.into();
            c.alt = 0.0;
            c.voo_t = now;
            c.clip = "breach".into();
        }
        return base_speed;
    }
    // volta a submergir depois do tempo de emergência
    if c.meio != MEIO_AREIA && now - c.voo_t > sub.emergencia_s {
        c.meio = MEIO_AREIA.into();
        c.voo_t = now;
        c.clip = "dive".into();
    }
    if c.meio == MEIO_AREIA {
        // profundidade visual: rasa ao perseguir, preferida (metade da máxima, limitada) em cruzeiro
        c.alt = -(if perseguindo { 1.5 } else { (sub.profundidade_max_m * 0.5).min(6.0) });
        return if perseguindo { sub.arranque_mps } else { sub.cruzeiro_mps.min(base_speed.max(sub.cruzeiro_mps)) };
    }
    base_speed
}
