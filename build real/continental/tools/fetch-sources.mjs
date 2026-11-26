#!/usr/bin/env node
/**
 * Wildhaven — fetch reproduzível dos 272 GLBs de terreno (sem npm).
 *
 * Materializa as duas árvores que `compiler/cli.mjs --all` espera
 * (`--old-root` = layout de carioca1111/wildhaven@5865b5d…,
 *  `--new-root` = layout de carioca1111/wildhaven-new@f20febb…)
 * a partir de um espelho Git fixado por commit, e confere CADA arquivo:
 * bytes, SHA-1 de blob Git (manifesto) e SHA-256 (quando o manifesto tem).
 *
 * Fontes, em ordem de tentativa por tile:
 *   1. espelho  — joofrango/wildhaven2 no commit fixo MIRROR_COMMIT,
 *                 caminho assets/world/continental-272/<id>/<arquivo>
 *                 (via `git cat-file`, não depende da working tree);
 *   2. origem   — commit fixo do repositório de origem, se o remote indicado
 *                 em --legacy-remote / --original-remote existir localmente
 *                 com o objeto (o repositório privado NÃO é contornado).
 * Um tile sem fonte válida é FALHA registrada; nunca se cria substituto.
 *
 * Uso (na raiz do checkout):
 *   node "build real/continental/tools/fetch-sources.mjs" --out .generated/sources
 *   [--mirror-commit <sha>] [--legacy-remote legacy] [--original-remote original]
 *   [--link]  (usa hardlink da working tree quando o blob coincide; economiza disco)
 *   [--around <ID>]  (modo leve: só o hex <ID> e seus vizinhos no grafo)
 */
import {readFile, writeFile, mkdir, link, stat, rm} from "node:fs/promises";
import {execFileSync, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {resolve, join, dirname, basename} from "node:path";
import {fileURLToPath} from "node:url";

export const MIRROR_REPOSITORY = "joofrango/wildhaven2";
export const MIRROR_COMMIT = "0a7aab5cfaa8446f6ddcbd5fb567516ad83d7d7c";
export const MIRROR_PREFIX = "assets/world/continental-272";

const argv = process.argv.slice(2), opts = {};
for (let i = 0; i < argv.length; i++) {
  const k = argv[i];
  if (k === "--link") { opts.link = true; continue; }
  if (!k.startsWith("--") || !argv[i + 1]) throw Error("Argumento inválido: " + k);
  opts[k.slice(2)] = argv[++i];
}
if (!opts.out) throw Error("--out é obrigatório");
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {cwd: here, encoding: "utf8"}).trim();
const manifest = JSON.parse(await readFile(join(here, "../data/continent-272.manifest.json"), "utf8"));
const mirrorCommit = opts["mirror-commit"] ?? MIRROR_COMMIT;
const out = resolve(opts.out);
const sha256 = b => createHash("sha256").update(b).digest("hex");
const blobSha = b => createHash("sha1").update("blob " + b.byteLength + "\0").update(b).digest("hex");

function gitBlob(ref, path) {
  const r = spawnSync("git", ["cat-file", "blob", ref + ":" + path], {cwd: repoRoot, maxBuffer: 1 << 30});
  if (r.status !== 0) return null;
  return r.stdout;
}
function verify(tile, bytes) {
  const s = tile.source, problems = [];
  if (bytes.byteLength !== s.bytes) problems.push("bytes " + bytes.byteLength + " ≠ " + s.bytes);
  if (s.gitBlobSha1 && blobSha(bytes) !== s.gitBlobSha1) problems.push("SHA-1 de blob divergente");
  const h = sha256(bytes);
  if (s.sha256 && h !== s.sha256) problems.push("SHA-256 divergente");
  if (bytes.byteLength < 12 || bytes.readUInt32LE(0) !== 0x46546c67) problems.push("cabeçalho glTF ausente");
  return {ok: problems.length === 0, problems, sha256: h};
}
const rootFor = tile => tile.source.repository === "carioca1111/wildhaven" ? "old-root" : "new-root";
const remoteFor = tile => tile.source.repository === "carioca1111/wildhaven" ? opts["original-remote"] : opts["legacy-remote"];

await mkdir(out, {recursive: true});
const items = [];
const around = opts.around ? new Set([opts.around, ...manifest.edges.filter(e => e.includes(opts.around)).flat()]) : null;
if (around && !manifest.tiles.some(t => t.id === opts.around)) throw Error("--around: hex desconhecido " + opts.around);
const selected = around ? manifest.tiles.filter(t => around.has(t.id)) : manifest.tiles;
for (const tile of selected) {
  const dest = join(out, rootFor(tile), tile.source.path);
  const mirrorPath = MIRROR_PREFIX + "/" + tile.id + "/" + basename(tile.source.path);
  const attempts = [];
  let done = null;
  // 1. espelho fixado por commit
  const mirror = gitBlob(mirrorCommit, mirrorPath);
  if (mirror) {
    const v = verify(tile, mirror);
    attempts.push({source: "mirror", ref: MIRROR_REPOSITORY + "@" + mirrorCommit, path: mirrorPath, ...v});
    if (v.ok) done = {bytes: mirror, attempt: attempts.at(-1)};
  } else attempts.push({source: "mirror", ref: MIRROR_REPOSITORY + "@" + mirrorCommit, path: mirrorPath, ok: false, problems: ["objeto ausente no clone"]});
  // 2. origem (somente se o remote e o objeto existirem localmente)
  if (!done && remoteFor(tile)) {
    const origin = gitBlob(tile.source.commit, tile.source.path);
    if (origin) {
      const v = verify(tile, origin);
      attempts.push({source: "origin", ref: tile.source.repository + "@" + tile.source.commit, path: tile.source.path, ...v});
      if (v.ok) done = {bytes: origin, attempt: attempts.at(-1)};
    } else attempts.push({source: "origin", ref: tile.source.repository + "@" + tile.source.commit, ok: false, problems: ["commit/objeto inacessível"]});
  }
  if (!done) {
    items.push({id: tile.id, ok: false, attempts});
    console.error("[fetch] FALHA " + tile.id + ": " + attempts.map(a => a.source + ":" + a.problems.join("/")).join("; "));
    continue;
  }
  await mkdir(dirname(dest), {recursive: true});
  await rm(dest, {force: true});
  const wt = join(repoRoot, mirrorPath);
  let method = "write";
  if (opts.link && done.attempt.source === "mirror") {
    try {
      const st = await stat(wt);
      if (st.size === tile.source.bytes && blobSha(await readFile(wt)) === tile.source.gitBlobSha1) {
        await link(wt, dest); method = "hardlink";
      }
    } catch { /* cai para escrita */ }
  }
  if (method === "write") await writeFile(dest, done.bytes);
  // reverificação do arquivo materializado
  const v2 = verify(tile, await readFile(dest));
  if (!v2.ok) { items.push({id: tile.id, ok: false, attempts, materialized: v2}); continue; }
  items.push({id: tile.id, ok: true, source: done.attempt.source, ref: done.attempt.ref, path: done.attempt.path,
    destination: rootFor(tile) + "/" + tile.source.path, bytes: tile.source.bytes,
    gitBlobSha1: tile.source.gitBlobSha1, sha256: v2.sha256,
    sha256Checked: tile.source.sha256 ? "manifest" : "computed-only", method});
}
const report = {schema: "wildhaven.continental.fetch-report.v1", mirror: {repository: MIRROR_REPOSITORY, commit: mirrorCommit, prefix: MIRROR_PREFIX},
  requested: selected.length, around: opts.around ?? null, ok: items.filter(i => i.ok).length, failed: items.filter(i => !i.ok).length, items};
await writeFile(join(out, "fetch-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log("[fetch] " + report.ok + "/" + report.requested + " GLBs verificados (bytes + SHA-1 blob" + " + SHA-256 quando registrado)");
if (report.failed) process.exitCode = 1;
