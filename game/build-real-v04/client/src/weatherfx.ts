// Partículas de clima (chuva, neve/nevasca, areia) em uma caixa que acompanha a câmera:
// 1 draw call (Points), deslocamento todo na GPU, quantidade limitada pelo perfil (LOD de partículas).
// Água com ondulação procedural barata (sem reflexo planar: reflexo simplificado pelo brilho do sol).
import * as THREE from "three";
import { ATMOS, patchMaterial } from "./atmosphere";

const MAX = 24000;
export class WeatherFx {
  readonly points: THREE.Points;
  private u = { uKind: { value: 0 }, uIntensity: { value: 0 }, uTime: ATMOS.uTime, uWind: ATMOS.uWind, uCam: { value: new THREE.Vector3() }, uSize: { value: 1 }, uColor: { value: new THREE.Color(0xaec4d8) } };
  constructor() {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(MAX * 3), r = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) { p[i * 3] = Math.random() * 80 - 40; p[i * 3 + 1] = Math.random() * 40; p[i * 3 + 2] = Math.random() * 80 - 40; r[i] = Math.random(); }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("aRand", new THREE.BufferAttribute(r, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: `attribute float aRand; uniform float uKind; uniform float uTime; uniform vec2 uWind; uniform vec3 uCam; uniform float uSize; varying float vA;
        void main(){
          float fall = uKind < 0.5 ? 14.0 : uKind < 1.5 ? 1.6 : 0.4;   // chuva / neve / areia (m/s)
          float side = uKind > 1.5 ? 9.0 : 2.0;
          vec3 p = position;
          p.y = mod(p.y - uTime * fall * (0.8 + aRand * 0.4), 40.0);
          p.xz += uWind * uTime * side * (0.7 + aRand * 0.6) + (uKind > 0.5 ? vec2(sin(uTime + aRand * 30.0), cos(uTime * 0.7 + aRand * 20.0)) * 0.6 : vec2(0.0));
          p.xz = mod(p.xz + 40.0 - mod(uCam.xz, 80.0), 80.0) - 40.0;
          vec3 w = vec3(uCam.x, uCam.y - 12.0, uCam.z) + p;
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(7.0, uSize * (uKind < 0.5 ? 2.0 : uKind < 1.5 ? 3.5 : 2.5) * (60.0 / -mv.z));
          vA = clamp(1.0 - length(p.xz) / 40.0, 0.0, 1.0);
        }`,
      fragmentShader: `uniform float uKind; uniform vec3 uColor; varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a = uKind < 0.5 ? smoothstep(0.08, 0.0, abs(c.x)) * smoothstep(0.5, 0.1, abs(c.y)) : smoothstep(0.5, 0.15, length(c));
          gl_FragColor = vec4(uColor, a * vA * (uKind < 0.5 ? 0.55 : 0.85));
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false; this.points.name = "particulas-clima"; this.points.renderOrder = 5;
  }
  update(camPos: THREE.Vector3, kind: string, intensity: number, budget: number) {
    const k = kind === "chuva" || kind === "tempestade" ? 0 : kind === "neve" || kind === "nevasca" ? 1 : kind === "areia" ? 2 : -1;
    const n = k < 0 ? 0 : Math.floor(MAX * budget * Math.min(1, intensity * (kind === "tempestade" || kind === "nevasca" ? 1 : 0.6)));
    this.points.visible = n > 0;
    this.points.geometry.setDrawRange(0, n);
    this.u.uKind.value = Math.max(0, k); this.u.uIntensity.value = intensity; this.u.uCam.value.copy(camPos);
    this.u.uColor.value.set(k === 2 ? 0xd6a868 : k === 1 ? 0xf4f8ff : 0xaec4d8);
  }
}

export function waterMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x2c6f86, roughness: 0.12, metalness: 0.0, transparent: false });
  patchMaterial(m);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev.call(m, shader, r);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;").replace("#include <fog_vertex>", "#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos; uniform float uTime;")
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          vec2 q = vWPos.xz * 0.18;
          float a = sin(q.x * 1.7 + uTime * 1.1) + sin(q.y * 2.3 - uTime * 0.9) + sin((q.x + q.y) * 3.1 + uTime * 1.7) * 0.5;
          float b = cos(q.x * 2.1 - uTime * 1.3) + cos(q.y * 1.5 + uTime * 0.8) + cos((q.x - q.y) * 2.7 - uTime * 1.4) * 0.5;
          normal = normalize(normal + (viewMatrix * vec4(a * 0.05, 0.0, b * 0.05, 0.0)).xyz);
        }`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        { float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal) * -1.0, 0.0, 1.0), 4.0); totalEmissiveRadiance += vec3(0.10, 0.17, 0.20) * fres; }`);
  };
  m.customProgramCacheKey = () => "wh-agua";
  return m;
}
