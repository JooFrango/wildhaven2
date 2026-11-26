// Transição por inércia (inertialization, Bollo, GDC 2018), versão de mola: na troca de clipe guarda o desvio entre a
// pose que estava na tela e a pose nova, e o desvio decai por mola criticamente amortecida, partindo da velocidade
// que a pose anterior tinha. A pose nova toca desde o primeiro quadro; não há instantâneo congelado nem dois clipes.
// Só vista (plano PvE, etapa E3). Quaternions como [x, y, z, w].
export const LAMBDA = 30;          // 1/s: o desvio cai abaixo de 2% em 0,20 s (mistura máxima do contrato, seção 9)
export const DURACAO = .2;

const mul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const inv = (q) => [-q[0], -q[1], -q[2], q[3]];
export function paraVetor(q) {   // quaternion -> vetor de rotação (eixo × ângulo), menor arco
  const s = q[3] < 0 ? -1 : 1, w = Math.min(1, q[3] * s), n = Math.hypot(q[0], q[1], q[2]);
  if (n < 1e-9) return [0, 0, 0];
  const k = 2 * Math.atan2(n, w) / n * s; return [q[0] * k, q[1] * k, q[2] * k];
}
export function deVetor(v) {
  const a = Math.hypot(...v); if (a < 1e-9) return [0, 0, 0, 1];
  const s = Math.sin(a / 2) / a; return [v[0] * s, v[1] * s, v[2] * s, Math.cos(a / 2)];
}
// Desvio no instante t de um canal com desvio inicial x0 e velocidade inicial v0 (vetores de mesmo tamanho).
export function desvio(x0, v0, t) {
  if (t >= DURACAO) return x0.map(() => 0);
  const e = Math.exp(-LAMBDA * t); return x0.map((x, i) => (x + (v0[i] + LAMBDA * x) * t) * e);
}
// Início da transição de um osso: pose anterior (q1), a de um quadro antes (q0, com dt), pose nova (qn).
export function iniciarRotacao(q0, q1, dt, qn) {
  const x0 = paraVetor(mul(q1, inv(qn)));
  const w = dt > 0 && q0 ? paraVetor(mul(q1, inv(q0))).map((x) => x / dt) : [0, 0, 0];   // velocidade angular da pose anterior
  return { x0, v0: w };
}
export function iniciarPosicao(p0, p1, dt, pn) {
  return { x0: p1.map((x, i) => x - pn[i]), v0: dt > 0 && p0 ? p1.map((x, i) => (x - p0[i]) / dt) : [0, 0, 0] };
}
// Aplica: rotação final = desvio(t) · pose nova.
export const aplicarRotacao = (st, t, qn) => mul(deVetor(desvio(st.x0, st.v0, t)), qn);
export const aplicarPosicao = (st, t, pn) => { const d = desvio(st.x0, st.v0, t); return pn.map((x, i) => x + d[i]); };

// Contato de pé autorado (contrato §5, `footContacts`): o pé está plantado se t cai num intervalo [a, b] (s), em laço.
export function peNoChao(intervalos, t, duracao) {
  if (!intervalos) return null;
  const u = duracao > 0 ? ((t % duracao) + duracao) % duracao : t;
  return intervalos.some(([a, b]) => u >= a - 1e-6 && u <= b + 1e-6);
}
