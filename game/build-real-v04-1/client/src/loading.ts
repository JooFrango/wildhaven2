// V03 — Integração das telas de carregamento ORIGINAIS (Codex, aprovadas): `build real/loading-screen/v02/`,
// servidas sem cópia nem alteração em /carregamento/. A página original roda isolada num <iframe> (seu CSS e
// seu script não tocam o jogo; é Canvas 2D com sprites PNG — nenhum segundo motor 3D). O jogo só chama a API
// pública do protótipo, `WildhavenLoading.setProgress(fração | null, rótulo)`, com o progresso REAL:
// seis etapas de mesmo peso; dentro de cada etapa, a fração medida (bytes, hexes, nós, espécies) ou `null`
// ("Preparando…") quando a etapa não tem medida — nunca porcentagem inventada nem espera artificial.
// O console do simulador da página original é escondido (estilo injetado; arquivo intacto). A animação do
// protótipo já se suspende sozinha com a aba oculta; ao terminar, o iframe é removido (recursos liberados).
const STAGES = ["Inicializando servidor", "Carregando mundo", "Carregando terrenos", "Preparando criaturas", "Sincronizando Hunters", "Preparando interface"];
type Cena = "hunter" | "dunas" | "savana";

/** Montanhas (Hunter × Varrisco), Dunas (barco × Arenoceto) ou Savana (Velsari × Gravarto), pelo bioma de destino. */
export function sceneForBiome(biome: string): Cena | null {
  const b = biome.toLowerCase();
  if (/desert|deserto|duna|areia|arid/.test(b)) return "dunas";
  if (/savan|cerrado|estepe/.test(b)) return "savana";
  if (/mont|floresta|forest|temper|neve|snow|tundra|taiga|alp/.test(b)) return "hunter";
  return null; // bioma sem cena própria: sorteio original do protótipo
}

export class Loading {
  private frame: HTMLIFrameElement | null = null;
  private api: { setProgress: (f: number | null, label: string) => void } | null = null;
  private queued: [number | null, string] | null = null;
  private stageIdx = 0;
  private lastFrac = 0;
  private hideTimer = 0;
  visible = false;
  reason = "";
  constructor(private host: HTMLElement, fixed: string | null) {
    this.show((fixed as Cena) || sceneForBiome(this.lastBiome()), STAGES[0]);
  }
  private lastBiome() { try { return localStorage.getItem("wildhaven.v04.ultimoBioma") ?? ""; } catch { return ""; } }
  remember(biome: string) { try { if (biome) localStorage.setItem("wildhaven.v04.ultimoBioma", biome); } catch { /* sem armazenamento */ } }

  show(cena: Cena | null, label: string) {
    clearTimeout(this.hideTimer);
    if (this.frame) { this.frame.classList.remove("fim"); this.visible = true; this.set(null, label); return; }
    const f = document.createElement("iframe");
    f.id = "tela-carregamento"; f.title = "Carregando Wildhaven";
    f.src = "/carregamento/index.html" + (cena ? `?cena=${cena}` : "");
    f.addEventListener("load", () => {
      const doc = f.contentDocument, win = f.contentWindow as any;
      if (doc) { const st = doc.createElement("style"); st.textContent = ".console{display:none!important}body{overflow:hidden}"; doc.head.append(st); }
      this.api = win?.WildhavenLoading ?? null;
      if (this.api && this.queued) this.api.setProgress(this.queued[0], this.queued[1]);
    });
    this.host.prepend(f);
    this.frame = f; this.visible = true;
    this.set(null, label);
  }
  private set(frac: number | null, label: string) {
    if (this.api) { try { this.api.setProgress(frac, label); } catch { /* fração fora de 0..1: ignora */ } }
    else this.queued = [frac, label];
  }
  /** Etapa `i` (0–5) com fração medida (0..1) ou null (sem medida confiável). */
  stage(i: number, frac: number | null, label: string) {
    this.stageIdx = Math.max(this.stageIdx, i);
    const f = frac === null ? null : Math.min(1, Math.max(this.lastFrac, (i + Math.min(1, Math.max(0, frac))) / STAGES.length));
    if (f !== null) this.lastFrac = f;
    if (this.visible) this.set(f === null ? null : (i === STAGES.length - 1 && frac === 1 ? 1 : Math.min(f, 0.999)), label || STAGES[i]);
    (window as any).__wildhavenCarregamento = { etapa: i, nome: STAGES[i], fracao: f, rotulo: label };
  }
  hide() {
    if (!this.frame) return;
    this.set(1, "Pronto");
    this.frame.classList.add("fim"); this.visible = false;
    const f = this.frame;
    // remove o iframe depois do esmaecimento: o protótipo para e seus recursos são liberados
    this.hideTimer = window.setTimeout(() => { if (!this.visible && this.frame === f) { f.remove(); this.frame = null; this.api = null; this.lastFrac = 0; this.stageIdx = 0; } }, 700);
  }
  error(msg: string) { this.show(null, msg); this.set(null, msg); }
}
