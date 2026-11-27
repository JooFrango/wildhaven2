// V04.2 — Laboratório ISOLADO WebGL × WebGPU (não faz parte do jogo). Mesma floresta instanciada com os protótipos
// reais de vegetação (/visual/prototypes.glb), mesma câmera, mesma resolução: mede o tempo de quadro de cada
// renderizador por 10 s. Serve para decidir com dados se vale migrar — nada no jogo usa WebGPU.
// Abrir no portátil: http://127.0.0.1:8787/lab/webgpu.html  (resultado em JSON na tela e em window.__resultado)
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const out = document.getElementById("r")!;
const log = (s: string) => { out.textContent += "\n" + s; };
const N = Number(new URLSearchParams(location.search).get("n") ?? 20000);

async function cena() {
  const g = await new GLTFLoader().loadAsync("/visual/prototypes.glb");
  const meshes: THREE.Mesh[] = []; g.scene.traverse(o => { if ((o as THREE.Mesh).isMesh && /L0|L1/.test(o.name)) meshes.push(o as THREE.Mesh); });
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x87a9c8);
  sc.add(new THREE.HemisphereLight(0xbfd8ff, 0x4a5a36, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(300, 500, 200); sc.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f6b35, roughness: 1 })); sc.add(ground);
  const per = Math.ceil(N / Math.max(1, meshes.length)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 0) % 100000) / 100000; };
  for (const src of meshes) {
    const im = new THREE.InstancedMesh(src.geometry, new THREE.MeshStandardMaterial({ vertexColors: !!src.geometry.getAttribute("color"), roughness: 0.9 }), per);
    for (let i = 0; i < per; i++) { p.set((rnd() - 0.5) * 3000, 0, (rnd() - 0.5) * 3000); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28); s.setScalar(0.8 + rnd() * 0.6); im.setMatrixAt(i, m4.compose(p, q, s)); }
    sc.add(im);
  }
  const cam = new THREE.PerspectiveCamera(50, innerWidth / (innerHeight * 0.7), 1, 6000); cam.position.set(0, 120, 900); cam.lookAt(0, 0, 0);
  return { sc, cam, instancias: per * meshes.length };
}

async function medir(nome: string, r: { render: (s: THREE.Scene, c: THREE.Camera) => unknown; setSize: (w: number, h: number, u?: boolean) => void }, sc: THREE.Scene, cam: THREE.Camera) {
  const cv = document.getElementById("c") as HTMLCanvasElement;
  r.setSize(cv.clientWidth, cv.clientHeight, false);
  const iv: number[] = []; let last = 0; const t0 = performance.now();
  await new Promise<void>(res => { const f = (t: number) => { (cam as THREE.PerspectiveCamera).position.x = Math.sin(t / 2000) * 200; cam.lookAt(0, 0, 0); r.render(sc, cam); if (last) iv.push(t - last); last = t; if (t - t0 < 10000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  iv.sort((a, b) => a - b); const q = (x: number) => iv[Math.min(iv.length - 1, Math.floor(iv.length * x))];
  const o = { renderizador: nome, quadros: iv.length, fps: +(1000 * iv.length / iv.reduce((a, b) => a + b, 0)).toFixed(1), p50: q(0.5), p95: q(0.95), p99: q(0.99) };
  log(JSON.stringify(o)); return o;
}

(async () => {
  out.textContent = `Instâncias pedidas: ${N}`;
  const { sc, cam, instancias } = await cena();
  const res: Record<string, unknown> = { instancias, userAgent: navigator.userAgent, webgpuDisponivel: !!(navigator as any).gpu };
  const cv = document.getElementById("c") as HTMLCanvasElement;
  const gl = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  res.webgl = await medir("WebGL", gl, sc, cam);
  gl.dispose(); gl.forceContextLoss();
  if ((navigator as any).gpu) {
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      const cv2 = cv.cloneNode() as HTMLCanvasElement; cv.replaceWith(cv2);
      const wr = new WebGPURenderer({ canvas: cv2, antialias: true }); await wr.init();
      res.webgpu = await medir("WebGPU", wr as any, sc, cam);
    } catch (e) { res.webgpu = "falhou: " + String(e); log(String(res.webgpu)); }
  } else { res.webgpu = "indisponível neste navegador"; log("WebGPU indisponível neste navegador."); }
  (window as any).__resultado = res; log("\n" + JSON.stringify(res, null, 1));
})();
