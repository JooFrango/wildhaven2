// Matemática determinística entre motores JS.
// Math.sin/cos/atan2/hypot/pow NÃO têm resultado garantido bit a bit entre versões do V8 (Node vs Chrome),
// e escolhas quase empatadas da IA amplificam diferenças de 1e-16. Aqui só usamos + − × ÷ e Math.sqrt
// (correto por arredondamento na IEEE-754), com contagem fixa de operações: o mesmo resultado em qualquer motor.
// REGRA: todo código em src/core deve usar estas funções (há um teste que verifica).

export const PI = 3.141592653589793;
const DOIS_PI = 6.283185307179586;
const MEIO_PI = 1.5707963267948966;
const QUARTO_PI = 0.7853981633974483;
const TAN_PI_8 = 0.41421356237309503;

export const raiz = (x) => Math.sqrt(x);
export const hipot = (dx, dy) => Math.sqrt(dx * dx + dy * dy);

// Seno por série de Taylor após redução para [-π/2, π/2] (erro < 1e-15).
export function sen(x) {
  let r = x - DOIS_PI * Math.round(x / DOIS_PI); // [-π, π]
  if (r > MEIO_PI) r = PI - r;
  else if (r < -MEIO_PI) r = -PI - r;
  const r2 = r * r;
  let termo = r, soma = r;
  for (let n = 1; n <= 11; n++) {
    termo *= -r2 / ((2 * n) * (2 * n + 1));
    soma += termo;
  }
  return soma;
}

export const cos = (x) => sen(x + MEIO_PI);

function atanReduzido(t) {
  // |t| <= tan(π/8): série de Taylor converge rápido (t² <= 0.172).
  const t2 = t * t;
  let pot = t, soma = t;
  for (let n = 1; n <= 22; n++) {
    pot *= -t2;
    soma += pot / (2 * n + 1);
  }
  return soma;
}

export function atan(z) {
  if (z !== z) return z;
  const neg = z < 0;
  let a = neg ? -z : z;
  let base = 0;
  if (a > 1) { a = 1 / a; base = MEIO_PI; }
  let r;
  if (a > TAN_PI_8) r = QUARTO_PI + atanReduzido((a - 1) / (a + 1));
  else r = atanReduzido(a);
  if (base) r = base - r;
  return neg ? -r : r;
}

export function atan2(y, x) {
  if (x > 0) return atan(y / x);
  if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
  if (y > 0) return MEIO_PI;
  if (y < 0) return -MEIO_PI;
  return 0;
}

// Logaritmo natural: x = m·2^k com m em [1, 2); ln(m) = 2·atanh((m−1)/(m+1)) em série (contagem fixa de termos).
const LN2 = 0.6931471805599453;
export function ln(x) {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  let k = 0, m = x;
  while (m >= 2) { m /= 2; k++; }
  while (m < 1) { m *= 2; k--; }
  const z = (m - 1) / (m + 1), z2 = z * z;
  let termo = z, soma = 0;
  for (let n = 0; n < 30; n++) { soma += termo / (2 * n + 1); termo *= z2; }
  return 2 * soma + k * LN2;
}
// Exponencial: e^y = 2^n · e^r com |r| ≤ ln2/2; série de Taylor com 20 termos.
export function exp(y) {
  if (y > 700) return Infinity;
  if (y < -700) return 0;
  const n = Math.round(y / LN2);
  const r = y - n * LN2;
  let termo = 1, soma = 1;
  for (let i = 1; i <= 20; i++) { termo *= r / i; soma += termo; }
  let f = 1;
  if (n > 0) for (let i = 0; i < n; i++) f *= 2; else for (let i = 0; i < -n; i++) f /= 2;
  return soma * f;
}
export const pot = (x, e) => (x === 0 ? 0 : exp(e * ln(x)));

const POT10 = [1, 10, 100, 1000, 10000, 100000, 1000000];
export const arredondar = (v, casas = 2) => Math.round(v * POT10[casas]) / POT10[casas];
