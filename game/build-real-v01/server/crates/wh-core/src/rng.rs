//! Porte incremental de `game/alpha01/src/core/random.ts` (somente leitura).
//! Paridade bit a bit por seed verificada contra vetores gerados executando o
//! TypeScript original (`tools/gen-parity-fixtures.mjs`).

/// xorshift32 idêntico a `random(w)` da Alpha: devolve o próximo estado e o valor em [0,1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct XorShift32 {
    pub state: u32,
}

impl XorShift32 {
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }
    pub fn next_f64(&mut self) -> f64 {
        // JS: x = w.rng | 0 (int32); x ^= x << 13; x ^= x >>> 17; x ^= x << 5; w.rng = x >>> 0
        let mut x = self.state as i32;
        x ^= x.wrapping_shl(13);
        x ^= ((x as u32) >> 17) as i32;
        x ^= x.wrapping_shl(5);
        self.state = x as u32;
        self.state as f64 / 4_294_967_296.0
    }
}

/// `hash(x, z, seed)` da Alpha. Entradas são truncadas para int32 como `x | 0` em JS.
pub fn hash(x: f64, z: f64, seed: f64) -> f64 {
    let xi = js_to_int32(x);
    let zi = js_to_int32(z);
    let si = js_to_int32(seed);
    let mut n = xi.wrapping_mul(374_761_393) ^ zi.wrapping_mul(668_265_263) ^ si;
    n = (n ^ ((n as u32) >> 13) as i32).wrapping_mul(1_274_126_177);
    ((n ^ ((n as u32) >> 16) as i32) as u32) as f64 / 4_294_967_295.0
}

pub fn clamp(n: f64, a: f64, b: f64) -> f64 {
    a.max(b.min(n))
}

/// ToInt32 do ECMAScript (truncamento modular), necessário para paridade com `| 0`.
pub fn js_to_int32(v: f64) -> i32 {
    if !v.is_finite() {
        return 0;
    }
    let t = v.trunc();
    let m = t.rem_euclid(4_294_967_296.0);
    (m as u64 as u32) as i32
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn to_int32_matches_js() {
        assert_eq!(js_to_int32(-1.5), -1);
        assert_eq!(js_to_int32(4_294_967_297.0), 1);
        assert_eq!(js_to_int32(2_147_483_648.0), -2_147_483_648);
        assert_eq!(js_to_int32(f64::NAN), 0);
    }
}
