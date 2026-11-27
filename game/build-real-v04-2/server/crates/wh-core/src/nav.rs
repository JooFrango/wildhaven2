//! Navegação local A* sobre a grade física WHP1 (2 m). Usa SOMENTE dados compilados:
//! célula sem chão, bloqueada ou com água é intransponível; inclinação máxima entre
//! células vizinhas é limitada; mudar de hex só dentro de portal validado.

use crate::portals::PortalIndex;
use crate::terrain::TerrainStore;
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};

#[derive(Debug, Clone, Copy)]
pub struct NavParams {
    pub cell: f64,
    pub max_slope_tan: f64,
    pub margin_m: f64,
    pub max_expansions: usize,
    pub portal_margin_m: f64,
}

impl Default for NavParams {
    fn default() -> Self {
        Self {
            cell: 2.0,
            max_slope_tan: (35.0f64).to_radians().tan(),
            margin_m: 48.0,
            max_expansions: 300_000,
            portal_margin_m: 1.0,
        }
    }
}

#[derive(Copy, Clone, PartialEq)]
struct Node {
    f: f64,
    g: f64,
    i: i32,
    j: i32,
}
impl Eq for Node {}
impl Ord for Node {
    fn cmp(&self, o: &Self) -> Ordering {
        o.f.partial_cmp(&self.f).unwrap_or(Ordering::Equal).then_with(|| (self.i, self.j).cmp(&(o.i, o.j)))
    }
}
impl PartialOrd for Node {
    fn partial_cmp(&self, o: &Self) -> Option<Ordering> {
        Some(self.cmp(o))
    }
}

pub fn walkable_cell(t: &mut TerrainStore, x: f64, z: f64) -> Option<f64> {
    let c = t.sample(x, z)?;
    if c.blocked || c.water.is_some() {
        return None;
    }
    Some(c.h)
}

/// Pode passar de (ax,az) para (bx,bz) (células adjacentes)?
pub fn step_ok(t: &mut TerrainStore, portals: &PortalIndex, p: &NavParams, ax: f64, az: f64, bx: f64, bz: f64) -> bool {
    let (Some(ha), Some(hb)) = (walkable_cell(t, ax, az), walkable_cell(t, bx, bz)) else { return false };
    let d = ((bx - ax).powi(2) + (bz - az).powi(2)).sqrt();
    if (hb - ha).abs() / d > p.max_slope_tan {
        return false;
    }
    let (ta, tb) = (t.tile_id_at(ax, az), t.tile_id_at(bx, bz));
    match (ta, tb) {
        (Some(a), Some(b)) if a == b => true,
        (Some(a), Some(b)) => {
            t.is_allowed(&b) && portals.crossing_allowed(&a, &b, (ax + bx) / 2.0, (az + bz) / 2.0, p.portal_margin_m)
        }
        _ => false,
    }
}

/// A* de start→goal. Devolve waypoints (x,z) em coordenadas GLOBAIS, centros de célula.
pub fn find_path(
    t: &mut TerrainStore,
    portals: &PortalIndex,
    p: &NavParams,
    start: (f64, f64),
    goal: (f64, f64),
) -> Option<Vec<(f64, f64)>> {
    let c = p.cell;
    let to_ij = |x: f64, z: f64| ((x / c).floor() as i32, (z / c).floor() as i32);
    let center = |i: i32, j: i32| ((i as f64 + 0.5) * c, (j as f64 + 0.5) * c);
    let (si, sj) = to_ij(start.0, start.1);
    let (gi, gj) = to_ij(goal.0, goal.1);
    let m = (p.margin_m / c).ceil() as i32;
    let (imin, imax) = (si.min(gi) - m, si.max(gi) + m);
    let (jmin, jmax) = (sj.min(gj) - m, sj.max(gj) + m);
    let h = |i: i32, j: i32| (((i - gi) as f64).powi(2) + ((j - gj) as f64).powi(2)).sqrt() * c;
    let mut open = BinaryHeap::new();
    let mut g: HashMap<(i32, i32), f64> = HashMap::new();
    let mut came: HashMap<(i32, i32), (i32, i32)> = HashMap::new();
    g.insert((si, sj), 0.0);
    open.push(Node { f: h(si, sj), g: 0.0, i: si, j: sj });
    let mut expansions = 0;
    const DIRS: [(i32, i32); 8] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)];
    while let Some(n) = open.pop() {
        if (n.i, n.j) == (gi, gj) {
            let mut path = vec![center(gi, gj)];
            let mut cur = (gi, gj);
            while let Some(&prev) = came.get(&cur) {
                path.push(center(prev.0, prev.1));
                cur = prev;
            }
            path.reverse();
            return Some(path);
        }
        if n.g > *g.get(&(n.i, n.j)).unwrap_or(&f64::INFINITY) {
            continue;
        }
        expansions += 1;
        if expansions > p.max_expansions {
            return None;
        }
        let (ax, az) = center(n.i, n.j);
        for (di, dj) in DIRS {
            let (ni, nj) = (n.i + di, n.j + dj);
            if ni < imin || ni > imax || nj < jmin || nj > jmax {
                continue;
            }
            let (bx, bz) = center(ni, nj);
            if !step_ok(t, portals, p, ax, az, bx, bz) {
                continue;
            }
            // diagonais não cortam cantos bloqueados
            if di != 0 && dj != 0 {
                let (cx1, cz1) = center(n.i + di, n.j);
                let (cx2, cz2) = center(n.i, n.j + dj);
                if walkable_cell(t, cx1, cz1).is_none() || walkable_cell(t, cx2, cz2).is_none() {
                    continue;
                }
            }
            let ng = n.g + c * ((di * di + dj * dj) as f64).sqrt();
            if ng < *g.get(&(ni, nj)).unwrap_or(&f64::INFINITY) {
                g.insert((ni, nj), ng);
                came.insert((ni, nj), (n.i, n.j));
                open.push(Node { f: ng + h(ni, nj), g: ng, i: ni, j: nj });
            }
        }
    }
    None
}
