#!/usr/bin/env node
// Servidor estático do laboratório (sem dependências). Também recebe capturas PNG da página.
// Uso: node scripts/servidor.mjs [--porta 5180] [--dir dist]
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { lerArgs } from './simular-args.mjs';
import { descobrirCatalogo } from './catalogo-criaturas.mjs';

const args = lerArgs(process.argv.slice(2));
const porta = Number(args.porta ?? process.env.PORTA ?? 5180);
const raiz = resolve(RAIZ_LAB, args.dir ?? '.');
const pastaCapturas = join(RAIZ_LAB, 'resultados', 'capturas');
// O laboratório fica em <repo>/labs/ia-criaturas; a raiz do repositório é dois níveis acima.
const RAIZ_REPO = resolve(RAIZ_LAB, args.raizRepo ?? '../..');
const EXT_REPO = new Set(['.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp', '.ktx2', '.json', '.md']);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gif': 'image/gif', '.md': 'text/markdown; charset=utf-8',
};

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/__captura') return receberCaptura(req, res);
    if (req.method === 'POST' && url.pathname === '/__gif/quadro') return receberQuadroGif(req, res, url);
    if (req.method === 'POST' && url.pathname === '/__gif/fim') return finalizarGif(req, res, url);
    if (req.method === 'POST' && url.pathname === '/__resultado') return receberResultado(req, res);
    // Oficina: catálogo local calculado dos GLBs e fichas reais, somente leitura.
    if (req.method === 'GET' && url.pathname === '/__catalogo') {
      const modelos = await descobrirCatalogo(RAIZ_REPO);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ modelos, escopo: 'servidor-local', total: modelos.length }));
      return;
    }
    let caminho = decodeURIComponent(url.pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';
    // /repo/<caminho> → arquivo original do repositório (somente leitura, só assets), p.ex. GLBs das criaturas.
    let base = raiz;
    if (caminho.startsWith('/repo/')) {
      if (!EXT_REPO.has(extname(caminho).toLowerCase())) { res.writeHead(403).end('extensão não permitida em /repo'); return; }
      base = RAIZ_REPO; caminho = caminho.slice('/repo'.length);
    }
    const alvo = normalize(join(base, caminho));
    if (alvo !== base && !alvo.startsWith(base + sep)) { res.writeHead(403).end('proibido'); return; }
    const info = await stat(alvo).catch(() => null);
    if (!info || !info.isFile()) { res.writeHead(404).end('não encontrado'); return; }
    res.writeHead(200, { 'content-type': TIPOS[extname(alvo)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(alvo));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

async function receberCaptura(req, res) {
  let corpo = '';
  for await (const parte of req) { corpo += parte; if (corpo.length > 20e6) { res.writeHead(413).end(); return; } }
  const { nome, dados } = JSON.parse(corpo);
  const seguro = String(nome).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'captura.png';
  const base64 = String(dados).replace(/^data:image\/png;base64,/, '');
  await mkdir(pastaCapturas, { recursive: true });
  await writeFile(join(pastaCapturas, seguro), Buffer.from(base64, 'base64'));
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ caminho: `resultados/capturas/${seguro}` }));
}

// GIF a partir de quadros RGBA reais do canvas (um POST binário por quadro; o fim codifica e grava).
const gravacoes = new Map();
async function lerCorpo(req, limite) {
  const partes = []; let n = 0;
  for await (const p of req) { n += p.length; if (n > limite) throw new Error('corpo grande demais'); partes.push(p); }
  return Buffer.concat(partes);
}
async function receberQuadroGif(req, res, url) {
  const id = url.searchParams.get('id') ?? 'gif';
  const q = await lerCorpo(req, 8e6);
  if (!gravacoes.has(id)) gravacoes.set(id, []);
  gravacoes.get(id).push(q);
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ quadros: gravacoes.get(id).length }));
}
async function finalizarGif(req, res, url) {
  const id = url.searchParams.get('id') ?? 'gif';
  const w = Number(url.searchParams.get('w')), h = Number(url.searchParams.get('h')), fps = Number(url.searchParams.get('fps') ?? 10);
  const nome = String(url.searchParams.get('nome') ?? `${id}.gif`).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const quadros = gravacoes.get(id) ?? [];
  gravacoes.delete(id);
  const { codificarGif } = await import('./gif.mjs');
  const gif = codificarGif(quadros, w, h, fps);
  await mkdir(pastaCapturas, { recursive: true });
  await writeFile(join(pastaCapturas, nome), gif);
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ caminho: `resultados/capturas/${nome}`, quadros: quadros.length, bytes: gif.length }));
}
// Resultados de testes visuais (JSON) gravados pela página em resultados/v3/.
async function receberResultado(req, res) {
  const { nome, dados } = JSON.parse((await lerCorpo(req, 20e6)).toString('utf8'));
  const seguro = String(nome).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const pasta = join(RAIZ_LAB, 'resultados', 'v3');
  await mkdir(pasta, { recursive: true });
  await writeFile(join(pasta, seguro), JSON.stringify(dados, null, 1));
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ caminho: `resultados/v3/${seguro}` }));
}

servidor.listen(porta, '127.0.0.1', () => {
  console.log(`Laboratório de IA em http://localhost:${porta}/  (servindo ${raiz})`);
  console.log(`Exemplo: http://localhost:${porta}/?cenario=obstaculo&semente=7`);
});
