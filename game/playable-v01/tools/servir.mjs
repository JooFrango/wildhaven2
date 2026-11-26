#!/usr/bin/env node
// Servidor estático da Playable Build V01. Raiz = raiz do repositório (ou --dir, p. ex. dist/).
// `/repo/…` aponta para a mesma raiz: é a base de GLBs que labs/ia-criaturas/src/web3d/modelos3d.js espera.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = resolve(fileURLToPath(new URL('..', import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const raiz = arg('dir') ? resolve(aqui, arg('dir')) : resolve(aqui, '../..');
const porta = Number(arg('porta', process.env.PORT ?? 5210));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') { res.writeHead(302, { location: '/game/playable-v01/' }).end(); return; }
  let caminho = decodeURIComponent(url.pathname).replace(/^\/repo\//, '/');
  if (caminho.endsWith('/')) caminho += 'index.html';
  const alvo = normalize(join(raiz, caminho));
  if (alvo !== raiz && !alvo.startsWith(raiz + sep)) { res.writeHead(403).end('proibido'); return; }
  const info = await stat(alvo).catch(() => null);
  if (!info?.isFile()) { res.writeHead(404).end('não encontrado'); return; }
  res.writeHead(200, { 'content-type': TIPOS[extname(alvo)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(await readFile(alvo));
}).listen(porta, '127.0.0.1', () => console.log(`Wildhaven Playable V01: http://127.0.0.1:${porta}/game/playable-v01/  (raiz ${raiz})`));
