// Atmosfera da V02: céu procedural (sol, lua com fase, estrelas, nuvens, aurora), fog exponencial
// com componente de altura, iluminação por hora do dia, bioma e clima. Tudo é APRESENTAÇÃO:
// o horário e o clima vêm do servidor autoritativo (snapshot.clock / snapshot.game.weather).
import * as THREE from "three";
import type { GraphicsSettings } from "./settings";
// V04.2: cores fixas do ciclo de luz/clima e temporárias do quadro (sem alocação por quadro)
const C_GOLD = new THREE.Color(0xffa060), C_MOONLIGHT = new THREE.Color(0x8fa6d8), C_SAND = new THREE.Color(0xc89a5a), C_RAIN = new THREE.Color(0x7c8a94);
const C_SNOW = new THREE.Color(0xe8eef6), C_DUSK = new THREE.Color(0xffb27a), C_NIGHTFOG = new THREE.Color(0x0a1222), C_CLOUDZ = new THREE.Color(0x5d6670);
const C_NIGHTZ = new THREE.Color(0x02050d), C_GOLDH = new THREE.Color(0xffa36b), C_NIGHTH = new THREE.Color(0x0b1424);
const T_SUN = new THREE.Color(), T_FOG = new THREE.Color(), T_ZEN = new THREE.Color(), T_HOR = new THREE.Color(), T_MOON = new THREE.Vector3();

export const ATMOS = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.6, 0.2) },
  uWindScale: { value: 1 },
  uFogBase: { value: 900 },
  uFogFalloff: { value: 220 },
  uFogHeightMix: { value: 0.65 },
  uFadeFar: { value: 1e9 },
};

/**
 * Injeta, em qualquer material da cena, o fog com componente de altura e (opcional) o vento da
 * vegetação e o fade por dithering (sem transparência = sem overdraw de ordenação).
 */
export function patchMaterial(m: THREE.Material, opts: { wind?: boolean; fade?: boolean; ground?: boolean } = {}) {
  const key = `wh-atm-${opts.wind ? 1 : 0}${opts.fade ? 1 : 0}${opts.ground ? 1 : 0}`;
  if ((m as any).__whPatched === key) return m;
  (m as any).__whPatched = key;
  (m as any).fog = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    Object.assign(shader.uniforms, ATMOS);
    let vs = shader.vertexShader, fs = shader.fragmentShader;
    const decl = "uniform float uTime; uniform vec2 uWind; uniform float uWindScale; uniform float uFadeFar;\nvarying float vFogWorldY;\n" + (opts.fade ? "attribute float aFade; varying float vFade;\n" : "") + (opts.ground ? "varying vec3 vGroundW; varying vec3 vGroundN;\n" : "");
    vs = vs.replace("#include <common>", "#include <common>\n" + decl);
    if (opts.wind) vs = vs.replace("#include <begin_vertex>", `#include <begin_vertex>
      {
        float hgt = max(0.0, position.y);
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float ph = uTime * 1.25 + ip.x * 0.071 + ip.z * 0.053;
        float gust = sin(ph) * 0.5 + 0.5 + 0.35 * sin(ph * 2.7 + 1.3);
        transformed.xz += uWind * gust * hgt * hgt * 0.0022 * uWindScale;
      }`);
    vs = vs.replace("#include <fog_vertex>", `#include <fog_vertex>
      {
        vec4 fwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fwp = instanceMatrix * fwp;
        #endif
        vFogWorldY = (modelMatrix * fwp).y;
        ${opts.fade ? "vFade = aFade;" : ""}
        ${opts.ground ? "vGroundW = (modelMatrix * fwp).xyz; vGroundN = normalize(mat3(modelMatrix) * objectNormal);" : ""}
      }`);
    fs = fs.replace("#include <common>", "#include <common>\nuniform float uFogBase; uniform float uFogFalloff; uniform float uFogHeightMix;\nvarying float vFogWorldY;\n" + (opts.fade ? "varying float vFade;\n" : "") + (opts.ground ? GROUND_FS_DECL : ""));
    if (opts.ground) fs = fs.replace("#include <color_fragment>", "#include <color_fragment>\n" + GROUND_FS);
    if (opts.fade) fs = fs.replace("void main() {", `void main() {
      {
        // dithering ordenado 4×4: fade sem blending
        vec2 p = mod(floor(gl_FragCoord.xy), 4.0);
        float b = mod(p.x * 4.0 + p.y * 7.0, 16.0) / 16.0 + 1.0 / 32.0;
        if (b > vFade) discard;
      }`);
    fs = fs.replace("#include <fog_fragment>", `
      #ifdef USE_FOG
        float hf = exp(-max(0.0, vFogWorldY - uFogBase) / uFogFalloff);
        float dens = fogDensity * mix(1.0, 0.35 + 1.4 * hf, uFogHeightMix);
        float fogFactor = 1.0 - exp(-dens * dens * vFogDepth * vFogDepth);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp(fogFactor, 0.0, 1.0));
      #endif`);
    shader.vertexShader = vs; shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => key;
  m.needsUpdate = true;
  return m;
}

// Detalhe de solo procedural (barato, sem textura extra): variação de cor em 3 escalas, terra exposta em
// encosta e pedra em rampa forte. Multiplica a cor original (vértice/textura) do GLB — não a substitui.
const GROUND_FS_DECL = `varying vec3 vGroundW; varying vec3 vGroundN;
float gh(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
`;
const GROUND_FS = `{
  vec2 q = vGroundW.xz;
  float n = gn(q * 0.45) * 0.5 + gn(q * 0.11) * 0.3 + gn(q * 1.7) * 0.2;
  // malha sem NORMAL (flatShading): a normal da face vem das derivadas da posição, como na iluminação
  #ifdef FLAT_SHADED
    vec3 gN = normalize(cross(dFdx(vGroundW), dFdy(vGroundW))); if (gN.y < 0.0) gN = -gN;
  #else
    vec3 gN = vGroundN;
  #endif
  float slope = 1.0 - clamp(gN.y, 0.0, 1.0);
  vec3 tint = mix(vec3(0.86, 0.92, 0.78), vec3(1.10, 1.06, 0.92), n);
  diffuseColor.rgb *= tint;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.80, 0.66) + vec3(0.03, 0.02, 0.0), smoothstep(0.18, 0.4, slope) * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.33, 0.31) * (0.8 + 0.4 * n), smoothstep(0.42, 0.62, slope) * 0.85);
}`;

// ----------------------------------------------------------------- paletas por bioma
export interface Palette { fog: THREE.Color; density: number; base: number; falloff: number; sky: THREE.Color; ground: THREE.Color; sunTint: THREE.Color; zenith: THREE.Color; horizon: THREE.Color }
const P = (fog: number, density: number, falloff: number, sky: number, ground: number, sunTint: number, zenith: number, horizon: number): Omit<Palette, "base"> => ({
  fog: new THREE.Color(fog), density, falloff, sky: new THREE.Color(sky), ground: new THREE.Color(ground), sunTint: new THREE.Color(sunTint), zenith: new THREE.Color(zenith), horizon: new THREE.Color(horizon),
});
// [PROPOSTO] paletas iniciais derivadas da direção de arte descrita pelo diretor (V02):
const PALETTES: Record<string, Omit<Palette, "base">> = {
  temperado: P(0xa9c4cf, 0.00030, 260, 0xbfd9f2, 0x4a5a36, 0xfff1d6, 0x3f78c0, 0xc8dce6),
  floresta: P(0x9fbfb4, 0.00036, 230, 0xb7d4e6, 0x3e5230, 0xfff0d0, 0x3a72b8, 0xbcd6d6),
  montanha: P(0x9fb6d2, 0.00026, 420, 0xb8cff0, 0x52564c, 0xfff4e2, 0x3566b2, 0xc4d4ea),
  selva: P(0x93b19a, 0.00052, 180, 0xb6d8c8, 0x2f4a26, 0xfff0c0, 0x4a86b6, 0xb8d4c0),
  pantano: P(0x8aa293, 0.00060, 90, 0xa9c4b8, 0x2e3a28, 0xf3e6c0, 0x5a7f98, 0xa8bcb0),
  savana: P(0xdcc59a, 0.00030, 300, 0xe8d8b6, 0x6a5532, 0xffe2b0, 0x5b8ccc, 0xe6d6b4),
  deserto: P(0xe2c494, 0.00034, 340, 0xf0dcb8, 0x7a5a36, 0xffdca8, 0x5f93cf, 0xead2a8),
  neve: P(0xd2e0ee, 0.00040, 320, 0xe4eef8, 0x8a96a4, 0xf4f8ff, 0x5a86c4, 0xdce8f2),
  costa: P(0xb4d0dc, 0.00030, 200, 0xc8e2f2, 0x5a6448, 0xfff2da, 0x3c7cc4, 0xcfe4ee),
};
export function paletteKey(biome: string) {
  const b = biome.toLowerCase();
  if (/swamp|p[âa]ntano/.test(b)) return "pantano";
  if (/jungle|selva/.test(b)) return "selva";
  if (/snow|ice|glacial|neve|gelo/.test(b)) return "neve";
  if (/savanna|savana/.test(b)) return "savana";
  if (/dune|desert|erg|duna|arenito|mesas|c[âa]nion|o[áa]sis|arco|ossada|maci[çc]o/.test(b)) return "deserto";
  if (/praia|fal[ée]sia|coast|costa/.test(b)) return "costa";
  if (/mountain|montanha/.test(b)) return "montanha";
  if (/forest|floresta/.test(b)) return "floresta";
  return "temperado";
}

export interface WeatherView { kind: string; intensity: number; cloud: number; wind: [number, number]; aurora: number; moonPhase: number; temperatureC?: number; visionFactor?: number }
export const CLEAR: WeatherView = { kind: "limpo", intensity: 0, cloud: 0.2, wind: [0.6, 0.2], aurora: 0, moonPhase: 0.5 };

// ----------------------------------------------------------------- céu
const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uSunColor;
uniform float uNight; uniform float uCloud; uniform float uTime; uniform vec2 uWindSky; uniform float uAurora; uniform float uMoonPhase; uniform float uCloudsOn; uniform vec3 uFogColor;
varying vec3 vDir;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(max(up, 0.0), 0.55));
  // sol + halo
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 900.0) * 18.0 + pow(sd, 12.0) * 0.35) * (1.0 - uNight);
  // lua com fase (terminador aproximado)
  float md = dot(d, uMoonDir);
  float disk = smoothstep(0.99955, 0.99975, md);
  vec3 side = normalize(cross(uMoonDir, vec3(0.0,1.0,0.0)) + 1e-4);
  float lit = smoothstep(-0.2, 0.2, dot(normalize(d - uMoonDir * md), side) * cos(uMoonPhase * 6.2831) + (0.5 - abs(uMoonPhase - 0.5)) * 2.0 - 1.0 + 0.0);
  col += vec3(0.85, 0.88, 0.95) * disk * mix(0.08, 1.0, lit) * uNight;
  // estrelas
  if (uNight > 0.01 && up > 0.0) {
    vec2 sp = vec2(atan(d.z, d.x) * 180.0, d.y * 260.0);
    float st = step(0.9975, h21(floor(sp))) * (0.6 + 0.4 * sin(uTime * 3.0 + h21(floor(sp) + 7.0) * 30.0));
    col += vec3(st) * uNight * (1.0 - uCloud) * smoothstep(0.0, 0.25, up);
  }
  // aurora polar
  if (uAurora > 0.01 && up > 0.05) {
    float band = fbm(vec2(atan(d.z, d.x) * 3.0 + uTime * 0.03, up * 4.0 - uTime * 0.02));
    float a = smoothstep(0.45, 0.8, band) * smoothstep(0.05, 0.35, up) * smoothstep(0.9, 0.4, up);
    col += mix(vec3(0.1, 0.9, 0.5), vec3(0.5, 0.2, 0.9), up) * a * uAurora * uNight * 1.4;
  }
  // nuvens (camada plana projetada)
  if (uCloudsOn > 0.5 && up > 0.0) {
    vec2 cp = d.xz / (up + 0.08) * 1.6 + uWindSky * uTime * 0.004;
    float c = fbm(cp);
    float cov = smoothstep(1.0 - uCloud * 0.9 - 0.15, 1.0 - uCloud * 0.9 + 0.25, c);
    vec3 cc = mix(vec3(1.0), vec3(0.55, 0.58, 0.62), uCloud * 0.8) * mix(vec3(1.0), uSunColor, 0.25);
    cc *= mix(1.0, 0.12, uNight);
    col = mix(col, cc, cov * smoothstep(0.0, 0.18, up) * 0.92);
  }
  // perto do horizonte o céu converge para a cor do fog (sem linha dura no fim do mundo)
  col = mix(uFogColor, col, smoothstep(-0.02, 0.16, up));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Atmosphere {
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.4);
  readonly hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a5a36, 0.9);
  readonly fog = new THREE.FogExp2(0xa9c4cf, 0.0003);
  readonly sky: THREE.Mesh;
  private skyU: Record<string, THREE.IUniform>;
  private cur: Palette;
  private target: Palette;
  weather: WeatherView = CLEAR;
  /** 0 = dia pleno, 1 = noite plena. */
  night = 0;
  sunDir = new THREE.Vector3(0.3, 0.8, 0.2);

  constructor(private scene: THREE.Scene, private settings: GraphicsSettings) {
    const base = { ...PALETTES.floresta, base: 900 };
    this.cur = clonePal(base); this.target = clonePal(base);
    scene.fog = this.fog;
    this.skyU = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0.2 }, uTime: ATMOS.uTime, uWindSky: { value: new THREE.Vector2(1, 0) },
      uAurora: { value: 0 }, uMoonPhase: { value: 0.5 }, uCloudsOn: { value: 1 }, uFogColor: { value: new THREE.Color() },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    this.sky.renderOrder = -1000; this.sky.frustumCulled = false; this.sky.name = "ceu";
    scene.add(this.sky, this.hemi, this.sun, this.sun.target);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    this.applyShadows();
  }

  applyShadows() {
    const q = this.settings.shadows;
    this.sun.castShadow = q !== "off";
    const size = q === "alta" ? 2048 : q === "media" ? 1536 : 1024;
    const ext = q === "alta" ? 110 : q === "media" ? 80 : 55; // LOD de sombras: área coberta por qualidade
    this.sun.shadow.mapSize.set(size, size);
    const c = this.sun.shadow.camera; c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 1; c.far = 900; c.updateProjectionMatrix();
    this.sun.shadow.map?.dispose(); (this.sun.shadow as any).map = null;
    this.skyU.uCloudsOn.value = this.settings.clouds ? 1 : 0;
    ATMOS.uFogHeightMix.value = this.settings.fog === "altura" ? 0.65 : 0;
  }

  setBiome(biome: string, groundY: number) {
    const p = PALETTES[paletteKey(biome)];
    this.target = { ...clonePal({ ...p, base: groundY + 40 }) };
  }

  /** clock: fase e tempo decorrido do servidor (dia 7200 s, noite 2400 s). */
  update(dt: number, clock: { phase: string; phase_elapsed_s: number }, focus: THREE.Vector3, camera: THREE.Camera) {
    ATMOS.uTime.value += dt;
    const k = 1 - Math.exp(-dt * 0.6);
    lerpPal(this.cur, this.target, k);
    const w = this.weather;
    // sol: nasce em 0, meio-dia em 0,5, põe em 1 do dia; à noite fica abaixo do horizonte
    const tDay = clock.phase === "day" ? clock.phase_elapsed_s / 7200 : 1 + clock.phase_elapsed_s / 2400;
    const ang = clock.phase === "day" ? tDay * Math.PI : Math.PI + (clock.phase_elapsed_s / 2400) * Math.PI;
    this.sunDir.set(Math.cos(ang), Math.sin(ang) * 0.92, 0.38).normalize();
    const elev = this.sunDir.y;
    const targetNight = THREE.MathUtils.smoothstep(-elev, -0.02, 0.18);
    this.night += (targetNight - this.night) * Math.min(1, dt * 0.8);
    const golden = THREE.MathUtils.smoothstep(0.35 - Math.max(0, elev), 0, 0.35);
    // V04.2: cores constantes e temporárias reaproveitadas (antes ~12 THREE.Color novas por quadro); mesma conta
    const sunCol = T_SUN.set(0xffffff).lerp(C_GOLD, golden * 0.85).multiply(this.cur.sunTint);
    const cloudDim = 1 - 0.55 * w.cloud - 0.25 * w.intensity;
    const moonDir = T_MOON.copy(this.sunDir).negate(); moonDir.y = Math.abs(moonDir.y) * 0.9 + 0.1; moonDir.normalize();
    const lightDir = this.night > 0.5 ? moonDir : this.sunDir;
    this.sun.color.copy(this.night > 0.5 ? C_MOONLIGHT : sunCol);
    const moonLight = 0.08 + 0.22 * (1 - Math.abs(w.moonPhase - 0.5) * 2);
    this.sun.intensity = this.night > 0.5 ? moonLight * (1 - 0.6 * w.cloud) : 2.6 * Math.max(0.05, Math.min(1, elev * 3)) * cloudDim;
    this.sun.position.copy(focus).addScaledVector(lightDir, 400);
    this.sun.target.position.copy(focus);
    // texels estáveis da sombra (evita tremulação ao mover a câmera)
    const step = (this.sun.shadow.camera.right * 2) / this.sun.shadow.mapSize.x;
    this.sun.target.position.x = Math.round(this.sun.target.position.x / step) * step;
    this.sun.target.position.z = Math.round(this.sun.target.position.z / step) * step;
    this.sun.position.copy(this.sun.target.position).addScaledVector(lightDir, 400);
    this.hemi.color.copy(this.cur.sky).multiplyScalar(1 - 0.75 * this.night);
    this.hemi.groundColor.copy(this.cur.ground).multiplyScalar(1 - 0.7 * this.night);
    this.hemi.intensity = (0.95 - 0.25 * w.cloud) * (1 - 0.55 * this.night) + 0.08;
    // fog: bioma × clima × noite (visão reduzida à noite)
    const wf = w.kind === "areia" ? 6 : w.kind === "nevasca" ? 4 : w.kind === "tempestade" ? 2.6 : w.kind === "chuva" || w.kind === "neve" ? 1.8 : w.kind === "nublado" ? 1.2 : 1;
    const dens = this.cur.density * (1 + (wf - 1) * Math.max(0.35, w.intensity)) * (1 + 0.6 * this.night);
    this.fog.density = this.settings.fog === "simples" ? dens * 0.9 : dens;
    const fogCol = T_FOG.copy(this.cur.fog);
    if (w.kind === "areia") fogCol.lerp(C_SAND, 0.7 * w.intensity);
    if (w.kind === "chuva" || w.kind === "tempestade") fogCol.lerp(C_RAIN, 0.6 * w.intensity);
    if (w.kind === "neve" || w.kind === "nevasca") fogCol.lerp(C_SNOW, 0.6 * w.intensity);
    fogCol.lerp(C_DUSK, golden * 0.25 * (1 - this.night));
    fogCol.lerp(C_NIGHTFOG, this.night * 0.92);
    this.fog.color.copy(fogCol);
    ATMOS.uFogBase.value = this.cur.base; ATMOS.uFogFalloff.value = this.cur.falloff;
    ATMOS.uWind.value.set(w.wind[0], w.wind[1]);
    ATMOS.uWindScale.value = 0.6 + Math.hypot(w.wind[0], w.wind[1]) * 0.8 + w.intensity * 1.2;
    // céu
    const z = T_ZEN.copy(this.cur.zenith).lerp(C_CLOUDZ, w.cloud * 0.6).lerp(C_NIGHTZ, this.night);
    const h = T_HOR.copy(this.cur.horizon).lerp(C_GOLDH, golden * 0.55 * (1 - this.night)).lerp(fogCol, 0.35).lerp(C_NIGHTH, this.night * 0.9);
    this.skyU.uZenith.value.copy(z); this.skyU.uHorizon.value.copy(h); this.skyU.uFogColor.value.copy(fogCol);
    this.skyU.uSunDir.value.copy(this.sunDir); this.skyU.uMoonDir.value.copy(moonDir); this.skyU.uSunColor.value.copy(sunCol);
    this.skyU.uNight.value = this.night; this.skyU.uCloud.value = w.cloud; this.skyU.uAurora.value = w.aurora; this.skyU.uMoonPhase.value = w.moonPhase;
    this.skyU.uWindSky.value.set(w.wind[0], w.wind[1]);
    const cam = camera as THREE.PerspectiveCamera;
    this.sky.position.copy(cam.position); this.sky.scale.setScalar(cam.far * 0.95);
  }
}
const clonePal = (p: Palette): Palette => ({ ...p, fog: p.fog.clone(), sky: p.sky.clone(), ground: p.ground.clone(), sunTint: p.sunTint.clone(), zenith: p.zenith.clone(), horizon: p.horizon.clone() });
function lerpPal(a: Palette, b: Palette, k: number) {
  for (const c of ["fog", "sky", "ground", "sunTint", "zenith", "horizon"] as const) a[c].lerp(b[c], k);
  a.density += (b.density - a.density) * k; a.base += (b.base - a.base) * k; a.falloff += (b.falloff - a.falloff) * k;
}
