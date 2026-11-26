#!/usr/bin/env node
// Auditoria tecnica de todos os GLBs de criaturas do repositorio.
//
// Para cada arquivo .glb sob assets/models/creatures/ (e sob
// docs/migracao/variantes/), o script le o container GLB diretamente e
// relata: validade do container, triangulos, malhas, animacoes (nomes),
// rig (skins e juntas), texturas embutidas ou externas, LOD detectado pelo
// nome do arquivo e o hash do objeto git. Tambem acusa arquivos vazios e
// ponteiros do Git LFS gravados no lugar do binario.
//
// Uso:
//   node tools/auditar-criaturas.mjs            # relatorio no terminal
//   node tools/auditar-criaturas.mjs --json     # relatorio em JSON
//   node tools/auditar-criaturas.mjs --falhas   # so o que falhou
//
// Sai com codigo 1 se algum arquivo falhar a validacao.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const RAIZES = ['assets/models/creatures', 'docs/migracao/variantes'];

function listarArquivos(dir, saida = []) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return saida;
  }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listarArquivos(p, saida);
    else saida.push(p);
  }
  return saida;
}

const hashGit = (buf) =>
  createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]))
    .digest('hex');

// Le o container GLB sem dependencias externas.
function lerGlb(buf) {
  if (buf.length < 12) return { erro: 'arquivo menor que o cabecalho GLB' };
  if (buf.slice(0, 4).toString('ascii') !== 'glTF') {
    const inicio = buf.slice(0, 64).toString('utf8');
    if (inicio.includes('git-lfs.github.com')) return { erro: 'ponteiro Git LFS, sem o binario' };
    return { erro: 'magic invalido, nao e um GLB' };
  }
  const versao = buf.readUInt32LE(4);
  const total = buf.readUInt32LE(8);
  if (total !== buf.length) {
    return { erro: `tamanho declarado ${total} difere do arquivo ${buf.length}` };
  }
  let off = 12;
  let json = null;
  let temBin = false;
  while (off + 8 <= buf.length) {
    const tam = buf.readUInt32LE(off);
    const tipo = buf.slice(off + 4, off + 8).toString('ascii');
    const ini = off + 8;
    const fim = ini + tam;
    if (fim > buf.length) return { erro: `chunk ${tipo.trim()} passa do fim do arquivo` };
    if (tipo === 'JSON') {
      try {
        json = JSON.parse(buf.slice(ini, fim).toString('utf8'));
      } catch (e) {
        return { erro: 'chunk JSON invalido: ' + String(e.message).slice(0, 80) };
      }
    } else if (tipo.startsWith('BIN')) {
      temBin = true;
    }
    off = fim + ((4 - (tam % 4)) % 4);
  }
  if (!json) return { erro: 'GLB sem chunk JSON' };
  return { versao, json, temBin };
}

// Triangulos por primitiva, respeitando o modo de desenho.
function contarTriangulos(json) {
  const acessores = json.accessors || [];
  let tris = 0;
  let malhas = 0;
  for (const m of json.meshes || []) {
    malhas++;
    for (const p of m.primitives || []) {
      const modo = p.mode ?? 4;
      let n;
      if (p.indices != null) n = acessores[p.indices]?.count ?? 0;
      else n = acessores[p.attributes?.POSITION]?.count ?? 0;
      if (modo === 4) tris += Math.floor(n / 3);
      else if (modo === 5 || modo === 6) tris += Math.max(0, n - 2);
    }
  }
  return { tris, malhas };
}

function auditarGlb(caminho) {
  const buf = readFileSync(caminho);
  const r = { arquivo: caminho.split(sep).join('/'), bytes: buf.length, sha_git: hashGit(buf) };
  if (buf.length === 0) return { ...r, ok: false, erro: 'arquivo vazio' };
  const g = lerGlb(buf);
  if (g.erro) return { ...r, ok: false, erro: g.erro };
  const json = g.json;
  const { tris, malhas } = contarTriangulos(json);
  const imagens = json.images || [];
  const externas = imagens.filter((i) => i.uri && !i.uri.startsWith('data:')).map((i) => i.uri);
  const nome = r.arquivo.split('/').pop();
  const lod = (nome.match(/LOD([0-2])/i) || [])[1] ?? null;
  return {
    ...r,
    ok: true,
    versao_glb: g.versao,
    gerador: json.asset?.generator ?? null,
    malhas,
    triangulos: tris,
    nos: (json.nodes || []).length,
    animacoes: (json.animations || []).map((a, i) => a.name ?? `animacao_${i}`),
    skins: (json.skins || []).length,
    juntas: (json.skins || []).reduce((s, k) => s + (k.joints || []).length, 0),
    imagens: imagens.length,
    texturas_embutidas: imagens.length - externas.length,
    texturas_externas: externas,
    tem_chunk_bin: g.temBin,
    lod,
  };
}

const alvos = RAIZES.flatMap((raiz) => listarArquivos(raiz)).filter((p) =>
  p.toLowerCase().endsWith('.glb'),
);

const resultados = alvos.map((p) => {
  try {
    return auditarGlb(p);
  } catch (e) {
    return { arquivo: p.split(sep).join('/'), ok: false, erro: String(e.message).slice(0, 160) };
  }
});

// Agrupa por criatura, usando a pasta imediatamente sob creatures/.
for (const r of resultados) {
  const m = r.arquivo.match(/assets\/models\/creatures\/([^/]+)\//);
  r.criatura = m ? m[1] : '(fora de creatures/)';
}

const falhas = resultados.filter((r) => !r.ok);
const vazios = resultados.filter((r) => r.bytes === 0);
const semRig = resultados.filter((r) => r.ok && r.skins === 0);
const comAnim = resultados.filter((r) => r.ok && r.animacoes.length > 0);
const comExterna = resultados.filter((r) => r.ok && r.texturas_externas.length > 0);
const semImagem = resultados.filter((r) => r.ok && r.imagens === 0);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ gerado_em: new Date().toISOString(), resultados }, null, 1));
} else {
  const mostrar = process.argv.includes('--falhas') ? falhas : resultados;
  for (const r of mostrar.sort((a, b) => a.arquivo.localeCompare(b.arquivo))) {
    if (!r.ok) {
      console.log(`FALHA  ${r.arquivo}  ${r.erro}`);
      continue;
    }
    console.log(
      [
        'ok   ',
        r.arquivo,
        `${(r.bytes / 1024).toFixed(0)}KB`,
        `${r.triangulos}tri`,
        `${r.malhas}malhas`,
        `anim=${r.animacoes.length}`,
        `skins=${r.skins}`,
        `juntas=${r.juntas}`,
        `tex=${r.texturas_embutidas}emb`,
        r.texturas_externas.length ? `EXTERNAS=${r.texturas_externas.length}` : '',
        r.lod ? `LOD${r.lod}` : '',
      ]
        .filter(Boolean)
        .join('  '),
    );
  }
  const criaturas = new Set(resultados.map((r) => r.criatura));
  console.log('');
  console.log(`GLBs auditados........ ${resultados.length}`);
  console.log(`criaturas............. ${criaturas.size}`);
  console.log(`falhas................ ${falhas.length}`);
  console.log(`arquivos vazios....... ${vazios.length}`);
  console.log(`com animacao.......... ${comAnim.length}`);
  console.log(`sem rig (skins=0)..... ${semRig.length}`);
  console.log(`sem nenhuma imagem.... ${semImagem.length}`);
  console.log(`com textura externa... ${comExterna.length}`);
  console.log(
    `triangulos totais..... ${resultados.reduce((s, r) => s + (r.triangulos || 0), 0)}`,
  );
}

process.exit(falhas.length ? 1 : 0);
