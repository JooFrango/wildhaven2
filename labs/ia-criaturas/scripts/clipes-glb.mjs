#!/usr/bin/env node
// Lista os clipes de animação reais de arquivos .glb (sem dependências, só lê o cabeçalho JSON do glTF).
// Uso: npm run clipes -- ../../caminho/modelo.glb [outro.glb ...]   (aceita pastas: varre *.glb)
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const alvos = process.argv.slice(2);
if (!alvos.length) {
  console.error('Uso: npm run clipes -- <arquivo.glb | pasta> [...]');
  process.exit(1);
}

const arquivos = [];
for (const a of alvos) {
  const info = await stat(a).catch(() => null);
  if (!info) { console.error(`não encontrado: ${a}`); continue; }
  if (info.isDirectory()) arquivos.push(...(await listar(a)));
  else arquivos.push(a);
}

const saida = [];
for (const arq of arquivos) {
  try {
    const gltf = lerJsonGlb(await readFile(arq));
    const clipes = (gltf.animations ?? []).map((an, i) => {
      let dur = 0;
      for (const ch of an.channels ?? []) {
        const acc = gltf.accessors?.[an.samplers?.[ch.sampler]?.input];
        if (acc?.max?.[0] > dur) dur = acc.max[0];
      }
      return { nome: an.name ?? `(sem nome #${i})`, duracaoSeg: +dur.toFixed(3), canais: an.channels?.length ?? 0 };
    });
    saida.push({ arquivo: arq, clipes, malhas: gltf.meshes?.length ?? 0, esqueletos: gltf.skins?.length ?? 0 });
  } catch (e) {
    saida.push({ arquivo: arq, erro: e.message });
  }
}
console.log(JSON.stringify(saida, null, 2));

function lerJsonGlb(buf) {
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error('não é GLB (assinatura glTF ausente)');
  const versao = buf.readUInt32LE(4);
  if (versao !== 2) throw new Error(`versão glTF ${versao} não suportada`);
  const tamanho = buf.readUInt32LE(12), tipo = buf.readUInt32LE(16);
  if (tipo !== 0x4e4f534a) throw new Error('primeiro bloco não é JSON');
  return JSON.parse(buf.toString('utf8', 20, 20 + tamanho));
}

async function listar(pasta) {
  const out = [];
  for (const e of await readdir(pasta, { withFileTypes: true })) {
    const p = join(pasta, e.name);
    if (e.isDirectory()) out.push(...(await listar(p)));
    else if (extname(e.name).toLowerCase() === '.glb') out.push(resolve(p));
  }
  return out;
}
