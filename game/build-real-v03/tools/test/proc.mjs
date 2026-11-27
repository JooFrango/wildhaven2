// Processos de UM navegador (árvore a partir do processo raiz, achado pelo diretório de perfil exclusivo).
import fs from "node:fs";
const cmd = p => { try { return fs.readFileSync(`/proc/${p}/cmdline`, "utf8"); } catch { return ""; } };
const stat = p => { try { const s = fs.readFileSync(`/proc/${p}/stat`, "utf8"); const f = s.slice(s.lastIndexOf(")") + 2).split(" "); return { ppid: +f[1], t: +f[11] + +f[12] }; } catch { return null; } };
export const rss = p => { try { return +/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${p}/status`, "utf8"))[1] / 1024; } catch { return 0; } };
export const cpuTicks = pids => pids.reduce((a, p) => a + (stat(p)?.t ?? 0), 0);
export const ticks = p => stat(p)?.t ?? 0;
export function browserTree(profileDir) {
  const all = fs.readdirSync("/proc").filter(d => /^\d+$/.test(d)).map(Number);
  const roots = all.filter(p => cmd(p).includes(profileDir) && !cmd(p).includes("--type="));
  const out = new Set(roots); let grew = true;
  while (grew) { grew = false; for (const p of all) { const s = stat(p); if (s && out.has(s.ppid) && !out.has(p)) { out.add(p); grew = true; } } }
  return [...out];
}
export function uniqueProfile(tag) { const d = `/tmp/claude-0/pw-perfil-${tag}-${process.pid}-${Date.now()}`; fs.mkdirSync(d, { recursive: true }); return d; }
