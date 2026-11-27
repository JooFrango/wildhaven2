// Minimapa continental: 272 hexes coloridos pelo status técnico do relatório N/N.
import type { ContinentSummary, HunterSnap } from "./contracts";

const COLORS: Record<string, string> = {
  "certificado-tecnico": "#2ea043",
  "nao-certificado": "#d29922",
  "excecao-maritima": "#1f6feb",
};

export function drawMinimap(cv: HTMLCanvasElement, c: ContinentSummary, hunters: HunterSnap[]) {
  const g = cv.getContext("2d")!;
  const xs = c.tiles.map(t => t.x), zs = c.tiles.map(t => t.z);
  const minX = Math.min(...xs) - 3000, maxX = Math.max(...xs) + 3000, minZ = Math.min(...zs) - 3000, maxZ = Math.max(...zs) + 3000;
  const s = Math.min(cv.width / (maxX - minX), cv.height / (maxZ - minZ));
  const px = (x: number) => (x - minX) * s, pz = (z: number) => (z - minZ) * s;
  g.clearRect(0, 0, cv.width, cv.height);
  for (const t of c.tiles) {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3; // pointy-top
      const x = px(t.x + Math.sin(a) * c.hexRadius), z = pz(t.z + Math.cos(a) * c.hexRadius);
      k ? g.lineTo(x, z) : g.moveTo(x, z);
    }
    g.closePath();
    g.fillStyle = COLORS[t.status] ?? "#6e7681";
    g.globalAlpha = 0.75; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = "#0d1117"; g.lineWidth = 1; g.stroke();
  }
  for (const h of hunters) {
    g.beginPath(); g.arc(px(h.x), pz(h.z), 6, 0, Math.PI * 2);
    g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = "#f85149"; g.lineWidth = 3; g.stroke();
  }
}
