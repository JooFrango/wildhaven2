#!/usr/bin/env node
// Deriva um CORREDOR de navegação que atravessa a divisa entre hexágonos REAIS do Wildhaven
// (somente leitura dos GLBs oficiais). As peças entram nas posições da composição
// (world/playable-eastern-range-v01/composicao_149_hex.json: model_path, center_x, center_z, escala em metros),
// então a grade resultante é contínua: a travessia da divisa é só andar, sem troca de terreno.
//
// Coordenadas: o corredor é uma janela em metros do MUNDO (X leste, Z sul, origem no centro do hexágono C).
// No terreno derivado, x = X − x0 e y = Z − z0; a altura é relativa ao ponto mais baixo da janela (origem.alturaBase).
//
// Uso:
//   node scripts/derivar-corredor-hex.mjs --hexes SE,X7 --procurar [--largura 800 --profundidade 400 --inclinacao 34]
//   node scripts/derivar-corredor-hex.mjs --hexes SE,X7 --x0 3930 --z0 3550 --largura 800 --profundidade 400 --res 1 \
//        --saida config/eco/terrenos/corredor-oasis-transicao.json
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { serializarTerreno, indice } from '../src/eco/terreno.js';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { CATEGORIAS_MUNDO, categoriasVazias, coletarTriangulos, lerGlb, montarTerreno, rasterizar } from './lib-hex-glb.mjs';
import { lerArgs } from './simular-args.mjs';

const RAIZ_REPO = resolve(RAIZ_LAB, '../..');
const COMPOSICAO = 'world/playable-eastern-range-v01/composicao_149_hex.json';

const args = lerArgs(process.argv.slice(2));
const comp = JSON.parse(await readFile(join(RAIZ_REPO, args.composicao ?? COMPOSICAO), 'utf8'));
if (args.auditarShas) { await auditarShas(); process.exit(0); }
const ids = String(args.hexes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (ids.length < 1) throw new Error('informe --hexes <id,id,...> com ids de peças da composição');
const pecas = ids.map((id) => {
  const t = comp.tiles.find((x) => x.id === id);
  if (!t) throw new Error(`peça ${id} não está na composição (${COMPOSICAO})`);
  return t;
});

const largura = Number(args.largura ?? 800), prof = Number(args.profundidade ?? 400);
const res = Number(args.res ?? 1);
const inclMax = Number(args.inclinacao ?? 34);

// Janela: --x0/--z0 em metros do mundo, ou centrada na divisa das duas primeiras peças.
const divisa = pecas.length >= 2 ? pontoDaDivisa(pecas[0], pecas[1]) : { x: pecas[0].center_x, z: pecas[0].center_z, eixo: 'x' };
const x0 = args.x0 != null ? Number(args.x0) : divisa.x - largura / 2;
const z0 = args.z0 != null ? Number(args.z0) : divisa.z - prof / 2;

// Triângulos de todas as peças na mesma grade do mundo (cada uma deslocada pelo seu centro na composição).
const banda = args.procurar
  ? { x0: divisa.x - largura / 2 - 10, x1: divisa.x + largura / 2 + 10, z0: divisa.z - 2200, z1: divisa.z + 2200 }
  : { x0: x0 - 10, x1: x0 + largura + 10, z0: z0 - 10, z1: z0 + prof + 10 };
const tris = categoriasVazias();
const hexes = [];
for (const p of pecas) {
  const buf = await readFile(join(RAIZ_REPO, p.model_path));
  const sha256 = createHash('sha256').update(buf).digest('hex');
  coletarTriangulos(lerGlb(buf), { categorias: CATEGORIAS_MUNDO, desloc: { x: p.center_x, z: p.center_z }, limites: banda, tris });
  hexes.push({ id: p.id, label: p.label, glb: p.model_path, sha256, center_x: p.center_x, center_z: p.center_z, confereSha: sha256 === p.source_sha256 });
  console.log(`peça ${p.id} (${p.label}) carregada de ${p.model_path}${p.source_sha256 && sha256 !== p.source_sha256 ? ' — ATENÇÃO: sha256 difere da composição' : ''}`);
}
console.log('triângulos na janela por categoria:', Object.fromEntries(Object.entries(tris).map(([k, v]) => [k, v.length])));
if (!tris.terreno.length) throw new Error('nenhum triângulo de terreno na janela: confira --x0/--z0 e as peças');

if (args.procurar) {
  // Varre a divisa em res 5 m e lista as janelas mais caminháveis (menos bloqueio, menos inclinação).
  const passo = Number(args.passo ?? 100);
  const { t } = montarTerreno(tris, { x0: banda.x0, z0: banda.z0, largura: banda.x1 - banda.x0, profundidade: banda.z1 - banda.z0, res: 5 });
  // Grade grossa separada só para marcar as células sem triângulo de terreno (fora da peça ou buraco no GLB).
  const semDados = rasterizarFaltantes(tris.terreno, banda, 5);
  const cands = [];
  for (let zc = divisa.z - 1800; zc <= divisa.z + 1800; zc += passo) {
    let n = 0, livre = 0, agua = 0, bloq = 0, vazio = 0, hMin = Infinity, hMax = -Infinity, incMax = 0;
    for (let z = zc - prof / 2; z < zc + prof / 2; z += 5) for (let x = divisa.x - largura / 2; x < divisa.x + largura / 2; x += 5) {
      const k = indice(t, x - banda.x0, z - banda.z0);
      if (k < 0) continue;
      n++;
      if (semDados[k]) { vazio++; continue; }
      if (t.bloqueio[k]) bloq++;
      else if (t.agua[k] > t.alturas[k]) agua++;
      else if (t.inclinacao[k] <= inclMax) livre++;
      hMin = Math.min(hMin, t.alturas[k]); hMax = Math.max(hMax, t.alturas[k]);
      incMax = Math.max(incMax, t.inclinacao[k]);
    }
    if (n) cands.push({ x0: +(divisa.x - largura / 2).toFixed(1), z0: +(zc - prof / 2).toFixed(1), zCentro: +zc.toFixed(1), semDadosPct: +((100 * vazio) / n).toFixed(1), livrePct: +((100 * livre) / n).toFixed(1), aguaPct: +((100 * agua) / n).toFixed(1), bloqueioPct: +((100 * bloq) / n).toFixed(1), desnivelM: +(hMax - hMin).toFixed(1), inclinacaoMaxGraus: +incMax.toFixed(1) });
  }
  // Melhores: sem buracos, mais caminháveis e com relevo de verdade (um corredor plano não mostra nada).
  cands.sort((a, b) => (a.semDadosPct - b.semDadosPct) || (b.livrePct - a.livrePct) || (b.desnivelM - a.desnivelM));
  console.log(`divisa ${pecas[0].id}|${pecas[1]?.id} no eixo ${divisa.eixo} em ${divisa.eixo === 'x' ? divisa.x.toFixed(1) : divisa.z.toFixed(1)} m`);
  console.log(JSON.stringify(cands.slice(0, 10), null, 1));
  process.exit(0);
}

const { t, cont, base } = montarTerreno(tris, { x0, z0, largura, profundidade: prof, res });
const saida = args.saida ?? 'config/eco/terrenos/corredor.json';
const dados = {
  ...serializarTerreno(t),
  origem: {
    tipo: 'corredor-hexes',
    composicao: COMPOSICAO, versaoComposicao: comp.version, escalaM: comp.scale_m,
    nota: 'Derivado (somente leitura) dos GLBs oficiais nas posições da composição. Coordenadas: x = X − x0, y = Z − z0 (metros do mundo); altura relativa ao ponto mais baixo da janela.',
    x0, z0, alturaBase: +base.toFixed(3),
    divisa: pecas.length >= 2 ? { eixo: divisa.eixo, mundo: +divisa[divisa.eixo].toFixed(3), local: +(divisa.eixo === 'x' ? divisa.x - x0 : divisa.z - z0).toFixed(3), entre: [pecas[0].id, pecas[1].id] } : null,
    hexes, contagens: cont, geradoEm: new Date().toISOString(),
  },
};
await mkdir(dirname(join(RAIZ_LAB, saida)), { recursive: true });
await writeFile(join(RAIZ_LAB, saida), JSON.stringify(dados));
// Sem spread: a grade do corredor tem centenas de milhares de células (Math.max(...) estoura a pilha).
let desnivel = 0;
for (const h of t.alturas) if (h > desnivel) desnivel = h;
console.log('corredor gravado:', saida, `${largura}×${prof} m res ${res}`, JSON.stringify(cont), 'desnível', desnivel.toFixed(1), 'm', '· divisa local x =', dados.origem.divisa?.local);

// Divisa entre duas peças vizinhas: as peças são retângulos de 4330×5000 m centrados em center_x/center_z,
// então vizinhas no mesmo Z encostam num plano X constante (e vice-versa).
// Confere o SHA-256 e a contagem de triângulos de cada peça da composição contra o arquivo em disco.
// O campo `source_sha256` da composição é do arquivo-fonte antes da exportação final: peças re-exportadas
// (as de transição e as de floresta) divergem no hash mas mantêm a mesma geometria. Daí conferir também
// os triângulos — é isso que distingue metadado desatualizado de arquivo trocado ou corrompido.
async function auditarShas() {
  const linhas = [];
  for (const t of comp.tiles) {
    if (!t.source_sha256) continue;
    const buf = await readFile(join(RAIZ_REPO, t.model_path)).catch(() => null);
    if (!buf) { linhas.push({ id: t.id, glb: t.model_path, erro: 'arquivo ausente' }); continue; }
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const g = lerGlb(buf);
    let triangulos = 0;
    for (const m of g.json.meshes ?? []) for (const p of m.primitives) {
      triangulos += (p.indices !== undefined ? g.json.accessors[p.indices].count : g.json.accessors[p.attributes.POSITION].count) / 3;
    }
    triangulos = Math.round(triangulos);
    linhas.push({
      id: t.id, glb: t.model_path, updated: t.updated ?? null, bytes: buf.length,
      shaComposicao: t.source_sha256, shaArquivo: sha256, shaConfere: sha256 === t.source_sha256,
      triangulosComposicao: t.triangles ?? null, triangulosArquivo: triangulos, triangulosConferem: t.triangles === triangulos,
      gerador: g.json.asset?.generator ?? null,
    });
  }
  const dif = linhas.filter((l) => l.shaConfere === false);
  const geometriaDiferente = dif.filter((l) => l.triangulosConferem === false);
  const saidaAud = args.saidaAuditoria ?? 'resultados/v3/auditoria-hexes.json';
  const dados = {
    composicao: COMPOSICAO, versaoComposicao: comp.version, geradoEm: new Date().toISOString(),
    pecasNaComposicao: comp.tiles.length, pecasComSha: linhas.length,
    shaConfere: linhas.length - dif.length, shaDivergente: dif.length, geometriaDiferente: geometriaDiferente.length,
    nota: 'source_sha256 é do arquivo-fonte antes da exportação final. Divergência com a mesma contagem de triângulos é metadado desatualizado na composição, não arquivo trocado. O laboratório lê os GLBs somente leitura e grava o SHA-256 real do arquivo usado em cada terreno derivado.',
    pecas: linhas,
  };
  await mkdir(dirname(join(RAIZ_LAB, saidaAud)), { recursive: true });
  await writeFile(join(RAIZ_LAB, saidaAud), JSON.stringify(dados, null, 1));
  console.log(`peças com source_sha256: ${linhas.length} de ${comp.tiles.length} · hash confere em ${linhas.length - dif.length} · diverge em ${dif.length}`);
  for (const l of dif) console.log(`  ${l.id.padEnd(6)} ${l.glb} · updated=${l.updated} · triângulos ${l.triangulosArquivo} (composição ${l.triangulosComposicao}) ${l.triangulosConferem ? '— mesma geometria, metadado desatualizado' : '— GEOMETRIA DIFERENTE'}`);
  if (geometriaDiferente.length) console.log(`ATENÇÃO: ${geometriaDiferente.length} peça(s) com geometria diferente da composição.`);
  console.log('auditoria gravada:', saidaAud);
}

// 1 onde nenhum triângulo de terreno cobre o centro da célula (fora da peça, ou buraco no GLB).
function rasterizarFaltantes(trisTerreno, banda, res) {
  const nx = Math.round((banda.x1 - banda.x0) / res), nz = Math.round((banda.z1 - banda.z0) / res);
  const alt = rasterizar(trisTerreno, banda.x0, banda.z0, nx, nz, res);
  const out = new Uint8Array(nx * nz);
  for (let k = 0; k < out.length; k++) out[k] = Number.isFinite(alt[k]) ? 0 : 1;
  return out;
}

function pontoDaDivisa(a, b) {
  const dx = Math.abs(a.center_x - b.center_x), dz = Math.abs(a.center_z - b.center_z);
  // Vizinhas na diagonal não encostam: os retângulos de 4330×5000 m se sobrepõem 1250 m (o passo em Z é 3750 m),
  // e as duas malhas acabariam empilhadas na mesma célula. Só vizinhas no mesmo X ou no mesmo Z têm divisa.
  if (dx > 1 && dz > 1) throw new Error(`peças ${a.id} e ${b.id} são vizinhas na diagonal (dx ${dx.toFixed(0)} m, dz ${dz.toFixed(0)} m): os retângulos se sobrepõem e não há divisa única. Use duas peças no mesmo X ou no mesmo Z.`);
  const eixo = dx >= dz ? 'x' : 'z';
  return { x: (a.center_x + b.center_x) / 2, z: (a.center_z + b.center_z) / 2, eixo };
}
