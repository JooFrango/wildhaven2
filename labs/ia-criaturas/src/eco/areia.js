// Volume de areia navegável das dunas: espessura do corpo de areia, leito rochoso sob ele e resistência do material.
// Derivado do relevo REAL do hexágono (alturas, bloqueio, água) e da classificação de substrato gravada na
// derivação (t.areia, da cor de vértice do GLB oficial). Nenhum modelo oficial é modificado.
//
// AREIA NÃO É ÁGUA. Este módulo não usa nada de `profundidadeAgua`/`nadar`; o meio é sólido granular:
// o corpo precisa de espessura suficiente acima do leito, a resistência cresce perto do leito e a superfície
// é uma fronteira que custa energia atravessar (mergulho/emergência), não um nível de flutuação.
//
// Modelo do leito: abertura morfológica do relevo (mínimo seguido de máximo numa janela de `raioBaseM`).
// Numa duna real a areia se acumula sobre um leito muito mais liso que a crista; a abertura devolve
// justamente esse envelope inferior. É um mapa EXPERIMENTAL, validado contra a malha (test/dunas-fisica).
import { indice } from './terreno.js';

// raioBaseM ≈ meio comprimento de onda da duna: medido nas megadunas DN_09/DN_10, 150 m deixa 71% da janela
// navegável com até 45 m de areia, enquanto 60 m acompanha a crista e devolve 1,3 m de espessura média.
export const PADRAO = Object.freeze({ raioBaseM: 150, espessuraMaxM: 45, crostaM: 0.35 });
// O envelope do leito é liso: calculá-lo numa grade de ~5 m e reamostrar custa ~25× menos que na grade fina.
const PASSO_BASE_M = 5;

// Mínimo (erosão) e máximo (dilatação) separáveis numa janela quadrada de lado 2r+1 células.
function janela(src, nx, ny, r, pior) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let v = src[j * nx + i];
    for (let d = -r; d <= r; d++) { const a = i + d; if (a < 0 || a >= nx) continue; v = pior(v, src[j * nx + a]); }
    tmp[j * nx + i] = v;
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let v = tmp[j * nx + i];
    for (let d = -r; d <= r; d++) { const b = j + d; if (b < 0 || b >= ny) continue; v = pior(v, tmp[b * nx + i]); }
    out[j * nx + i] = v;
  }
  return out;
}

// Abertura morfológica do relevo numa grade grossa (~5 m), reamostrada de volta para a grade do terreno.
function envelopeDoLeito(t, raioBaseM) {
  const { nx, ny, res } = t;
  const p = Math.max(1, Math.round(PASSO_BASE_M / res));
  const gx = Math.ceil(nx / p), gy = Math.ceil(ny / p);
  const grosso = new Float32Array(gx * gy);
  for (let b = 0; b < gy; b++) for (let a = 0; a < gx; a++) {
    let v = Infinity;
    for (let j = b * p; j < Math.min(ny, (b + 1) * p); j++) for (let i = a * p; i < Math.min(nx, (a + 1) * p); i++) v = Math.min(v, t.alturas[j * nx + i]);
    grosso[b * gx + a] = Number.isFinite(v) ? v : 0;
  }
  const r = Math.max(1, Math.round(raioBaseM / (p * res)));
  const aberto = janela(janela(grosso, gx, gy, r, Math.min), gx, gy, r, Math.max);
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out[j * nx + i] = aberto[Math.min(gy - 1, Math.floor(j / p)) * gx + Math.min(gx - 1, Math.floor(i / p))];
  return out;
}

// Grades do volume de areia, cacheadas no terreno. `t.areia` ausente ⇒ substrato estimado
// (tudo que não é rocha nem água conta como areia) e `estimado: true` no resultado.
export function volumeAreia(t, opcoes = {}) {
  if (t.volumeAreia && t.volumeAreia.chave === chave(opcoes)) return t.volumeAreia;
  const { raioBaseM, espessuraMaxM, crostaM } = { ...PADRAO, ...opcoes };
  const { nx, ny, res } = t, n = nx * ny;
  const base = envelopeDoLeito(t, raioBaseM);
  const espessura = new Float32Array(n), navegavel = new Uint8Array(n), resistencia = new Float32Array(n);
  const estimado = !t.areia;
  for (let k = 0; k < n; k++) {
    // A abertura pode passar acima do relevo num vale estreito: a espessura nunca é negativa.
    const esp = Math.min(espessuraMaxM, Math.max(0, t.alturas[k] - Math.min(base[k], t.alturas[k])));
    const temAreia = estimado ? t.bloqueio[k] === 0 && t.agua[k] <= t.alturas[k] : t.areia[k] >= 50;
    espessura[k] = temAreia ? esp : 0;
    navegavel[k] = temAreia && esp > crostaM ? 1 : 0;
    // Material: areia solta no corpo da duna, compactada perto do leito. 0 = solta, 1 = impenetrável.
    resistencia[k] = navegavel[k] ? Math.min(1, 0.15 + 0.5 * Math.max(0, 1 - esp / 6)) : 1;
  }
  // Rocha vizinha endurece a passagem (bloco enterrado na borda da duna).
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!navegavel[k]) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      if (t.bloqueio[b * nx + a]) { resistencia[k] = Math.min(1, resistencia[k] + 0.3); break; }
    }
  }
  const v = { chave: chave(opcoes), base, espessura, navegavel, resistencia, estimado, raioBaseM, espessuraMaxM, crostaM };
  t.volumeAreia = v;
  return v;
}
const chave = (o) => `${o.raioBaseM ?? PADRAO.raioBaseM}|${o.espessuraMaxM ?? PADRAO.espessuraMaxM}|${o.crostaM ?? PADRAO.crostaM}`;

const amostrar = (t, g, x, y) => { const k = indice(t, x, y); return k < 0 ? 0 : g[k]; };

export const espessuraAreia = (t, x, y) => amostrar(t, volumeAreia(t).espessura, x, y);
export const resistenciaAreia = (t, x, y) => { const k = indice(t, x, y); return k < 0 ? 1 : volumeAreia(t).resistencia[k]; };
export const areiaNavegavel = (t, x, y) => { const k = indice(t, x, y); return k >= 0 && volumeAreia(t).navegavel[k] === 1; };
export const leitoRochoso = (t, x, y) => amostrar(t, volumeAreia(t).base, x, y);

// Faixa de profundidade (m abaixo da superfície, no centro do corpo) em que um corpo de `alturaCorpo` m cabe.
// `null` quando não cabe: areia rasa, rocha, água ou fora da grade. É o teste de passagem estreita.
export function faixaProfundidade(t, x, y, alturaCorpo) {
  if (!areiaNavegavel(t, x, y)) return null;
  const esp = espessuraAreia(t, x, y);
  const meio = alturaCorpo / 2;
  const min = volumeAreia(t).crostaM + meio; // costas cobertas pela crosta
  const max = esp - meio;                    // barriga acima do leito
  return max >= min ? { min, max, espessura: esp } : null;
}

// Perfil de mobilidade NO VOLUME DE AREIA, com a mesma forma do perfil terrestre ({ passavel, mov }),
// para reusar A*, folga e segmentoLivre de terreno.js. Passável = o corpo cabe entre a crosta e o leito.
// Cacheado por altura de corpo: é assim que um animal grande deixa de caber onde um pequeno passa.
export function perfilAreia(t, alturaCorpo) {
  const chave = `areia:${alturaCorpo}`;
  if (t.perfis.has(chave)) return t.perfis.get(chave);
  const v = volumeAreia(t), n = t.nx * t.ny;
  const passavel = new Uint8Array(n);
  const minimo = v.crostaM + alturaCorpo;
  for (let k = 0; k < n; k++) passavel[k] = v.navegavel[k] && v.espessura[k] >= minimo ? 1 : 0;
  // `mov` só é lido pelo custo do A*; na areia a inclinação da superfície quase não pesa.
  const p = { chave, passavel, mov: { inclinacaoMaxGraus: 90, profundidadeMaxM: 0, nadar: false, escalarRochas: false }, areia: true, alturaCorpo };
  t.perfis.set(chave, p);
  return p;
}

// Volume que o corpo ocupa cabe no ponto, na profundidade pedida?
export function cabeEm(t, x, y, prof, alturaCorpo) {
  const f = faixaProfundidade(t, x, y, alturaCorpo);
  return !!f && prof >= f.min - 1e-6 && prof <= f.max + 1e-6;
}
