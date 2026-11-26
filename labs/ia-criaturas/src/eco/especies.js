// Espécies V2 (fichas reais) e indivíduos com variação moderada e herança dentro dos limites biológicos.
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

const CAMPOS = ['id', 'papel', 'corpo.massaKg', 'corpo.comprimentoM', 'movimento.corrida', 'movimento.inclinacaoMaxGraus',
  'percepcao.visao.alcance', 'necessidades.fomePorDia', 'necessidades.sedePorDia', 'dieta', 'temperamento', 'social.tipo',
  'combate.ataques', 'saude.max', 'vida.expectativaAnos', 'vida.maturidadeAnos', 'vida.gestacaoDias', 'modelo.frente'];
const ler = (o, c) => c.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

export function validarEspecies(especies) {
  const erros = [];
  const ids = new Set(especies.map((e) => e.id));
  for (const e of especies) {
    for (const c of CAMPOS) if (ler(e, c) === undefined) erros.push(`${e.id ?? '?'}: falta "${c}"`);
    for (const p of e.dieta?.presas ?? []) if (!ids.has(p)) erros.push(`${e.id}: presa inexistente "${p}"`);
    for (const p of [...(e.teme ?? []), ...(e.competidores ?? [])]) if (!ids.has(p)) erros.push(`${e.id}: espécie citada inexistente "${p}"`);
    if (!['+X', '-X', '+Z', '-Z'].includes(e.modelo?.frente)) erros.push(`${e.id}: modelo.frente inválido`);
  }
  return erros;
}

// Atributos individuais: fatores multiplicativos ~N(1, 6%) limitados a ±15%; temperamento ~N(média, dp) em [0, 1].
export function sortearIndividuo(especie, rng, { pais = null } = {}) {
  const fator = (base) => limitar(base + rng.normal(0, 0.06), 0.85, 1.15);
  const [mMin, mMax] = especie.corpo.massaKg;
  let massa, atributos, temperamento;
  if (pais) {
    // Herança: média dos pais + mutação pequena, sempre dentro da faixa da espécie.
    const [a, b] = pais;
    massa = limitar((a.massaAdulta + b.massaAdulta) / 2 + rng.normal(0, (mMax - mMin) * 0.08), mMin, mMax);
    atributos = {};
    for (const k of Object.keys(a.atributos)) atributos[k] = limitar((a.atributos[k] + b.atributos[k]) / 2 + rng.normal(0, 0.03), 0.85, 1.15);
    temperamento = {};
    for (const k of Object.keys(especie.temperamento)) temperamento[k] = limitar((a.temperamento[k] + b.temperamento[k]) / 2 + rng.normal(0, especie.temperamento[k][1] * 0.5), 0, 1);
  } else {
    massa = limitar(rng.normal((mMin + mMax) / 2, (mMax - mMin) / 4), mMin, mMax);
    atributos = { velocidade: fator(1), resistencia: fator(1), sentidos: fator(1), forca: fator(1) };
    temperamento = {};
    for (const [k, [m, dp]] of Object.entries(especie.temperamento)) temperamento[k] = limitar(rng.normal(m, dp), 0, 1);
  }
  return { massaAdulta: +massa.toFixed(2), atributos, temperamento };
}

export const massaMedia = (e) => (e.corpo.massaKg[0] + e.corpo.massaKg[1]) / 2;
export const ehPresaDe = (predador, presa) => (predador.dieta.presas ?? []).includes(presa.id);
export const teme = (a, b) => (a.teme ?? []).includes(b.id);
export const competidor = (a, b) => a.papel === 'carnivoro' && b.papel === 'carnivoro' && ((a.competidores ?? []).includes(b.id) || (b.competidores ?? []).includes(a.id));
