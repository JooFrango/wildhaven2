// HUD técnica provisória (a HUD ilustrada de referência não está no repositório):
// Hunters clicáveis com vida/estado, ficha (habilidades 1–20, sem nível geral) e inventário,
// Bestiário (único lugar onde aparece o Conhecimento de Monstros) com mapinha e botão Caçar,
// diálogo de caçada (seleção, a pé/carroça, custo) e ordem Explorar. Só ordens — sem mover Hunter.
import type { ContinentSummary, HunterFull, PageSnap, SnapshotFull } from "./contracts";

type Gameplay = { economia: { carroca: { base: number; porKm: number } }; carrocas: { capacidade: number } };
const ATIVIDADE: Record<string, string> = {
  na_vila: "na vila", patrulhando: "explorando", embarcado: "na carroça", conduzindo: "conduzindo a carroça", viajando: "viajando a pé",
  procurando: "procurando pegadas", rastreando: "seguindo rastro", aproximando: "aproximando-se", armando_armadilha: "armando armadilha",
  aguardando: "aguardando na armadilha", combatendo: "combatendo", caido: "CAÍDO", morto: "MORTO", carregado: "sendo carregado",
  retornando_ao_acampamento: "voltando ao acampamento", descansando: "descansando", voltando_vila: "voltando à vila", socorrendo: "em resgate",
};

const el = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export class Hud {
  selected: string | null = null;
  private gameplay: Gameplay | null = null;
  private openPage: string | null = null;
  private fichas = new Map<string, any>();
  constructor(private root: HTMLElement, private continent: ContinentSummary, private onSelect: (id: string) => void, private log: (s: string) => void) {
    fetch("/api/v1/gameplay").then(r => r.json()).then(g => (this.gameplay = g)).catch(() => {});
  }

  private async order(body: unknown) {
    const r = await fetch("/api/v1/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ message: "resposta inválida" }));
    this.log((r.ok ? "✔ " : "✖ ") + j.message);
    return r.ok;
  }

  render(s: SnapshotFull) {
    const g = s.game;
    const list = this.root.querySelector("#hunters")!;
    list.innerHTML = "";
    for (const h of s.hunters) {
      const row = el("button", "hrow" + (h.id === this.selected ? " sel" : "") + (h.alive ? "" : " dead"));
      const bar = el("span", "hp"); const fill = el("i"); fill.style.width = `${Math.max(0, (100 * h.hp) / h.hp_max)}%`; bar.append(fill);
      row.append(el("b", "", h.name + (h.role === "socorrista" ? " ✚" : "")), bar, el("small", "", ATIVIDADE[h.activity] ?? h.activity));
      row.onclick = () => { this.selected = h.id; this.onSelect(h.id); };
      list.append(row);
    }
    this.root.querySelector("#money")!.textContent = `Dinheiro: ${g.money.toFixed(0)} · Itens na vila: ${g.village_storage.length}`;
    // ficha + inventário do selecionado
    const sel = s.hunters.find(h => h.id === this.selected) ?? s.hunters[0];
    const ficha = this.root.querySelector("#ficha")!;
    ficha.innerHTML = "";
    if (sel) {
      ficha.append(el("b", "", `${sel.name} — ${ATIVIDADE[sel.activity] ?? sel.activity}`));
      if (sel.last_action) ficha.append(el("div", "muted", "Última decisão: " + sel.last_action));
      const sk = el("div", "skills");
      for (const [k, v] of Object.entries(sel.skills)) sk.append(el("span", "", `${k.replace("_", " ")} ${v.level}`));
      ficha.append(sk);
      const inv = this.root.querySelector("#inventario")!;
      inv.textContent = `Inventário (${sel.name}): ` + (sel.inventory.length ? sel.inventory.join(", ") : "vazio") + ` · arma: ${sel.arma}`;
    }
    this.renderBestiary(s);
  }

  private renderBestiary(s: SnapshotFull) {
    const pages = Object.values(s.game.bestiary.pages);
    const box = this.root.querySelector("#bestiario")!;
    const listEl = box.querySelector(".pages")!;
    listEl.innerHTML = pages.length ? "" : "<i>Nenhuma espécie avistada ainda. Ordene uma exploração.</i>";
    for (const p of pages) {
      const b = el("button", "page" + (p.species === this.openPage ? " sel" : ""), `${p.nome} (${p.avistamentos})`);
      b.onclick = () => { this.openPage = p.species; this.renderBestiary(s); };
      listEl.append(b);
    }
    const det = box.querySelector(".detail")!;
    const p = pages.find(x => x.species === this.openPage);
    det.innerHTML = "";
    if (!p) return;
    if (!this.fichas.has(p.species)) { this.fichas.set(p.species, null); fetch(`/fichas/${p.species}.json`).then(r => r.json()).then(f => this.fichas.set(p.species, f)).catch(() => {}); }
    const f = this.fichas.get(p.species);
    det.append(el("h3", "", p.nome));
    det.append(el("div", "", `Conhecimento de Monstros: ${p.conhecimento} · avistamentos ${p.avistamentos} · abates ${p.abates}`));
    det.append(el("div", "", `Primeiro avistamento: ${p.primeiro_por} (tick ${p.primeiro_avistamento_tick})`));
    det.append(el("div", "", "Itens possíveis: " + p.itens.join(", ")));
    if (f) {
      det.append(el("div", "muted", "Dossiê (ficha): " + [f.category, (f.habitats ?? []).join(", "), (f.diet ?? []).join(", ")].filter(Boolean).join(" · ")));
      if (f.social?.notes) det.append(el("div", "muted", f.social.notes));
    }
    const map = el("canvas") as HTMLCanvasElement; map.width = 220; map.height = 220; map.className = "mapinha";
    det.append(el("div", "", "Habitats (mapinha): " + p.habitats.join(", ")), map);
    this.drawHabitat(map, p);
    const hunt = el("button", "cta", "Caçar");
    hunt.onclick = () => this.huntDialog(s, p);
    det.append(hunt);
  }

  private drawHabitat(cv: HTMLCanvasElement, p: PageSnap) {
    const g = cv.getContext("2d")!;
    const t = this.continent.tiles, xs = t.map(a => a.x), zs = t.map(a => a.z);
    const minX = Math.min(...xs) - 3000, maxX = Math.max(...xs) + 3000, minZ = Math.min(...zs) - 3000, maxZ = Math.max(...zs) + 3000;
    const k = Math.min(cv.width / (maxX - minX), cv.height / (maxZ - minZ));
    for (const a of t) {
      g.fillStyle = p.habitats.includes(a.id) ? "#2ea043" : "#30363d";
      g.fillRect((a.x - minX) * k - 2, (a.z - minZ) * k - 2, 4, 4);
    }
    g.fillStyle = "#f85149";
    for (const [, x, z] of p.pontos) g.fillRect((x - minX) * k - 1.5, (z - minZ) * k - 1.5, 3, 3);
  }

  private huntDialog(s: SnapshotFull, p: PageSnap) {
    const dlg = this.root.querySelector("#dialogo") as HTMLDivElement;
    dlg.innerHTML = "";
    dlg.hidden = false;
    dlg.append(el("h3", "", `Caçar ${p.nome}`));
    const avail = s.hunters.filter(h => h.role === "hunter" && h.alive && h.activity === "na_vila");
    const checks: HTMLInputElement[] = [];
    for (const h of avail) {
      const l = el("label"); const c = el("input") as HTMLInputElement; c.type = "checkbox"; c.value = h.id; checks.push(c);
      l.append(c, document.createTextNode(` ${h.name} (rastreamento ${h.skills.rastreamento?.level ?? 1}, armadilhas ${h.skills.armadilhas?.level ?? 1})`));
      dlg.append(l);
    }
    if (!avail.length) dlg.append(el("div", "muted", "Nenhum Hunter disponível na vila."));
    const tr = el("select") as HTMLSelectElement;
    tr.append(new Option("A pé (sem custo)", "a_pe"));
    for (const w of s.game.wagons) { const o = new Option(`Carroça de ${w.driver}${w.state !== "na_vila" ? " (fora da vila)" : ""}`, w.id); o.disabled = w.state !== "na_vila"; tr.append(o); }
    const cost = el("div", "muted");
    const upd = () => {
      const n = checks.filter(c => c.checked).length;
      const pt = p.pontos[p.pontos.length - 1];
      const km = pt ? Math.hypot(pt[1] - s.game.village[0], pt[2] - s.game.village[1]) / 1000 : 0;
      const cap = this.gameplay?.carrocas.capacidade ?? 6;
      cost.textContent = tr.value === "a_pe" ? `${n} Hunters a pé` : `${n}/${cap} vagas · custo estimado ${this.gameplay ? Math.round(this.gameplay.economia.carroca.base + this.gameplay.economia.carroca.porKm * km) : "?"} (o servidor confirma)`;
    };
    tr.onchange = upd; checks.forEach(c => (c.onchange = upd)); upd();
    const go = el("button", "cta", "Partir");
    go.onclick = async () => {
      const hunters = checks.filter(c => c.checked).map(c => c.value);
      const ok = await this.order({ type: "cacar", species: p.species, hunters, transporte: tr.value === "a_pe" ? "a_pe" : "carroca", carroca: tr.value === "a_pe" ? null : tr.value });
      if (ok) dlg.hidden = true;
    };
    const cancel = el("button", "", "Cancelar"); cancel.onclick = () => (dlg.hidden = true);
    dlg.append(el("div", "", "Transporte: "), tr, cost, go, cancel);
  }

  bindExplore(getSnap: () => SnapshotFull) {
    (this.root.querySelector("#explorar") as HTMLButtonElement).onclick = () => {
      const s = getSnap();
      const sel = s.hunters.find(h => h.id === this.selected && h.activity === "na_vila" && h.role === "hunter");
      const ids = sel ? [sel.id] : s.hunters.filter(h => h.role === "hunter" && h.alive && h.activity === "na_vila").slice(0, 2).map(h => h.id);
      this.order({ type: "explorar", hunters: ids });
    };
    (this.root.querySelector("#recolher") as HTMLButtonElement).onclick = () => {
      const s = getSnap();
      this.order({ type: "recolher", hunters: s.hunters.filter(h => h.activity === "patrulhando").map(h => h.id) });
    };
  }
}

export function eventsText(s: SnapshotFull) {
  return s.game.events.slice(0, 18).map(e => `[${(e.t / 60).toFixed(0)} min] ${e.text}`);
}
export type { HunterFull };
