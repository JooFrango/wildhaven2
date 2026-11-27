// Perfis gráficos da V02. A qualidade gráfica NUNCA altera a simulação autoritativa (servidor Rust):
// só muda o que o cliente desenha. Valores iniciais de engenharia, ajustáveis no menu Sistema.
export type ProfileName = "economico" | "baixo" | "medio" | "alto";
export interface GraphicsSettings {
  profile: ProfileName;
  /** Distância máxima de desenho do mundo detalhado (m). Além disso: horizonte + fog. */
  viewDistance: number;
  /** Erro de tela tolerado na escolha de LOD do relevo (px). Maior = menos triângulos. */
  terrainErrorPx: number;
  /** Multiplicador da densidade de vegetação adensada (as árvores originais permanecem). */
  vegetationDensity: number;
  /** Distância máxima de árvores / plantas pequenas (m). */
  treeDistance: number;
  smallDistance: number;
  shadows: "off" | "baixa" | "media" | "alta";
  fog: "simples" | "altura";
  particles: number; // fração 0..1 do máximo de partículas de clima
  resolutionScale: number; // 0.5..1 (multiplica o pixel ratio)
  maxPixelRatio: number;
  dynamicResolution: boolean;
  antialias: boolean;
  postprocessing: boolean;
  animationQuality: "baixa" | "media" | "alta";
  clouds: boolean;
  /** V03: limite de quadros do Modo Econômico (12, 15 ou 20 FPS). */
  ecoFps: number;
}

export const PROFILES: Record<ProfileName, GraphicsSettings> = {
  economico: { profile: "economico", viewDistance: 0, terrainErrorPx: 8, vegetationDensity: 0, treeDistance: 0, smallDistance: 0, shadows: "off", fog: "simples", particles: 0, resolutionScale: 0.5, maxPixelRatio: 1, dynamicResolution: false, antialias: false, postprocessing: false, animationQuality: "baixa", clouds: false, ecoFps: 15 },
  baixo: { profile: "baixo", viewDistance: 4500, terrainErrorPx: 4, vegetationDensity: 0.45, treeDistance: 1400, smallDistance: 60, shadows: "off", fog: "simples", particles: 0.3, resolutionScale: 0.75, maxPixelRatio: 1, dynamicResolution: true, antialias: false, postprocessing: false, animationQuality: "baixa", clouds: false, ecoFps: 15 },
  medio: { profile: "medio", viewDistance: 7000, terrainErrorPx: 2.5, vegetationDensity: 0.75, treeDistance: 2200, smallDistance: 110, shadows: "media", fog: "altura", particles: 0.6, resolutionScale: 1, maxPixelRatio: 1.5, dynamicResolution: true, antialias: true, postprocessing: false, animationQuality: "media", clouds: true, ecoFps: 15 },
  alto: { profile: "alto", viewDistance: 10000, terrainErrorPx: 1.5, vegetationDensity: 1, treeDistance: 3200, smallDistance: 160, shadows: "alta", fog: "altura", particles: 1, resolutionScale: 1, maxPixelRatio: 2, dynamicResolution: true, antialias: true, postprocessing: true, animationQuality: "alta", clouds: true, ecoFps: 15 },
};

const KEY = "wildhaven.v03.graficos";
export function loadSettings(): GraphicsSettings {
  const q = new URLSearchParams(location.search).get("perfil") as ProfileName | null;
  if (q && PROFILES[q]) return { ...PROFILES[q] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s && PROFILES[s.profile as ProfileName]) return { ...PROFILES[s.profile as ProfileName], ...s };
  } catch { /* armazenamento indisponível: usa o padrão */ }
  return { ...PROFILES.medio };
}
export function saveSettings(s: GraphicsSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem persistência local */ }
}
