// HUD e interface da V02. Layout segue a ilustração enviada pelo diretor em 27/11 (direção visual,
// não asset): menu de ordens à esquerda, relógio e velocidade no topo, expedição atual à direita,
// bioma/clima no canto inferior direito, barra inferior com arma, retrato, vida, estado, Hunters e
// itens. Sem minimapa permanente (mapa completo em M). Diagnóstico só no menu do desenvolvedor.
// O jogador só dá ORDENS; nenhum controle move Hunter ou dá golpe.
import type { ContinentSummary, HunterFull, PageSnap, SnapshotFull } from "./contracts";
import { PROFILES, type GraphicsSettings, type ProfileName } from "./settings";
import type { Perf } from "./perf";
import type { StrategyCamera } from "./camera";
import { ICON, itemIcon, weatherIcon } from "./icons";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";

export interface UiDeps {
  continent: ContinentSummary; settings: GraphicsSettings; perf: Perf; camera: StrategyCamera;
  select: (id: string) => void; setEconomic: (on: boolean) => void; applySettings: (s: GraphicsSettings) => void;
  portrait?: () => Promise<string | null>; setVillagePhase?: (n: number) => void; focusVillage?: () => void;
}

const ATIV: Record<string, string> = {
  na_vila: "Na vila", patrulhando: "Explorando", embarcado: "Na carroça", conduzindo: "Conduzindo a carroça", viajando: "Viajando a pé",
  procurando: "Procurando pegadas", rastreando: "Seguindo o rastro", aproximando: "Aproximando-se", armando_armadilha: "Armando armadilha",
  aguardando: "Aguardando na armadilha", combatendo: "Em combate", caido: "CAÍDO", morto: "MORTO", carregado: "Sendo carregado",
  retornando_ao_acampamento: "Voltando ao acampamento", descansando: "Descansando", voltando_vila: "Voltando à vila", socorrendo: "Em resgate",
};
const CLIMA: Record<string, string> = { limpo: "Céu limpo", nublado: "Nublado", chuva: "Chuva", tempestade: "Tempestade", neve: "Neve", nevasca: "Nevasca", areia: "Tempestade de areia" };
const CONHEC: Record<string, string> = { avistado: "Avistado", estudado: "Estudado", dominado: "Dominado" };
const BIOMA_PT: Record<string, string> = {
  "temperate forest": "Floresta Temperada", "forested mountain": "Montanha Florestada", "true tropical jungle": "Selva Tropical", "tropical swamp": "Pântano Tropical",
  erg_dune_desert: "Mar de Dunas", "mountain barrier": "Barreira Montanhosa", mountain_second_row: "Contraforte", glacial: "Geleira", praia: "Praia", falesia: "Falésia",
  dunas: "Dunas Costeiras", arcos: "Arcos Costeiros", "snow-forest": "Floresta Nevada", "temperate golden fantasy savanna": "Savana Dourada", "entirely temperate plains (no transition)": "Planícies Temperadas",
};
const ARMA_PT: Record<string, string> = { espada: "Espada", lanca: "Lança", espadao: "Espadão" };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, (100 * a) / Math.max(1, b))).toFixed(1)}%`;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export class Ui {
  selected = "";
  private root = document.getElementById("ui")!;
  private gameplay: any = null;
  private snap: SnapshotFull | null = null;
  private feed = el("div", "feed");
  private seenEvents = new Set<string>();
  private unread = 0;
  private portraitUrl: string | null = null;
  private rows = new Map<string, HTMLElement>();
  private modal: HTMLElement | null = null;
  private modalKind = "";
  private dev = el("div", "dev painel");
  private devKey = "F3";
  private escala = 1;
  private lastBig = 0;
  private refs: Record<string, HTMLElement> = {};

  constructor(private d: UiDeps) {
    fetch("/api/v1/gameplay").then(r => r.json()).then(g => (this.gameplay = g)).catch(() => {});
    fetch("/api/v1/tempo").then(r => r.json()).then(t => { this.escala = t.escala; this.paintSpeed(); }).catch(() => {});
    try { this.devKey = localStorage.getItem("wildhaven.v03.teclaDev") || "F3"; } catch { /* sem armazenamento */ }
    this.build();
    d.portrait?.().then(u => { this.portraitUrl = u; this.lastBig = 0; }).catch(() => {});
    addEventListener("keydown", e => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      if (e.key === this.devKey || (this.devKey.length === 1 && e.key.toLowerCase() === this.devKey.toLowerCase())) { e.preventDefault(); this.dev.hidden = !this.dev.hidden; }
      else if (e.key === "m" || e.key === "M") this.open("mapa");
      else if (e.key === "b" || e.key === "B") this.open("bestiario");
      else if (e.key === "i" || e.key === "I") this.open("inventario");
      else if (e.key === "Escape") this.close();
      else if (e.key === "Tab") { e.preventDefault(); this.cycle(e.shiftKey ? -1 : 1); }
      else if (/^[1-9]$/.test(e.key) && this.snap) { const h = this.snap.hunters[Number(e.key) - 1]; if (h) this.pick(h.id); }
    });
  }

  // ------------------------------------------------------------ estrutura fixa
  private build() {
    const R = this.root;
    R.innerHTML = "";
    const logo = el("div", "logo", `<span class="garra">${ICON.cacar}</span><b>WILDHAVEN</b><i>Build Real V02</i>`);
    const menu = el("nav", "menu painel");
    const items: [string, string, string][] = [
      ["explorar", "Explorar", "Hunters na vila saem para explorar (autônomos)"], ["cacar", "Caçar", "Abrir o Bestiário e escolher a presa"],
      ["rastrear", "Rastrear", "Rastros descobertos (o rastreamento é autônomo)"], ["armadilhas", "Armadilhas", "Catálogo e armadilhas armadas"],
      ["viajar", "Viajar", "Escolher um hex no mapa e viajar a pé"], ["acampamento", "Acampamento", "Acampamentos montados"],
      ["descansar", "Descansar", "Hunter selecionado volta à vila e descansa"], ["recolher", "Recolher", "Chamar exploradores de volta à vila"],
      ["vila", "Vila", "Vila dos Hunters"], ["bestiario", "Bestiário", "Criaturas avistadas (B)"],
      ["inventario", "Inventário", "Itens do Hunter e da vila (I)"], ["equipamento", "Equipamento", "Trocar arma (na vila)"],
      ["mapa", "Mapa", "Mapa completo do continente (M)"], ["sistema", "Sistema", "Gráficos, Modo Econômico e teclas"],
    ];
    for (const [id, label, tip] of items) {
      const b = el("button", "item", `${ICON[id] ?? ICON.item}<span>${label}</span>`);
      b.title = tip; b.dataset.acao = id;
      b.onclick = () => this.action(id);
      menu.append(b);
    }
    const relogio = el("div", "relogio painel");
    relogio.innerHTML = `<span class="dia"></span><span class="astro"></span><span class="hora"></span><span class="vel"></span><span class="tempo"></span>`;
    const vel = relogio.querySelector(".vel")!;
    for (const e of [1, 5, 10, 50]) { const b = el("button", "", `×${e}`); b.dataset.e = String(e); b.onclick = () => this.setSpeed(e); vel.append(b); }
    const exped = el("div", "expedicao painel");
    const local = el("div", "local painel");
    const barra = el("div", "barra");
    barra.innerHTML = `
      <div class="arma painel"></div>
      <div class="principal painel"><div class="retrato"><img alt=""><span class="num"></span></div>
        <div class="dados"><div class="nome"></div><div class="linha"><span>Vida</span><b class="vida-txt"></b></div><div class="bar vida"><i></i></div>
        <div class="linha"><span>Proficiência</span><b class="prof-txt"></b></div><div class="bar prof"><i></i></div><div class="estado"></div></div></div>
      <div class="hunters painel"></div>
      <div class="slots painel"></div>
      <div class="acoes painel"></div>`;
    const acoes = barra.querySelector(".acoes")!;
    for (const [id, tip] of [["inventario", "Inventário"], ["acampamento", "Acampamento"], ["vila", "Vila"], ["alerta", "Acontecimentos"]] as const) {
      const b = el("button", "hex", ICON[id]); b.title = tip; b.onclick = () => (id === "alerta" ? this.open("eventos") : this.action(id));
      if (id === "alerta") { b.classList.add("alerta"); b.append(el("span", "badge")); }
      acoes.append(b);
    }
    const combate = el("div", "combate painel");
    this.dev.hidden = true;
    R.append(logo, menu, relogio, exped, local, combate, barra, this.feed, this.dev);
    this.refs = { relogio, exped, local, barra, combate, menu };
  }

  // ------------------------------------------------------------ ações / ordens
  private sel(): HunterFull | undefined { return this.snap?.hunters.find(h => h.id === this.selected); }
  private async order(body: unknown) {
    const r = await fetch("/api/v1/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ message: "resposta inválida" }));
    this.toast((r.ok ? "✔ " : "✖ ") + j.message, r.ok ? "ok" : "erro");
    return r.ok;
  }
  private action(id: string) {
    const s = this.snap; if (!s) return;
    const h = this.sel();
    switch (id) {
      case "explorar": {
        const ids = h && h.role === "hunter" && h.activity === "na_vila" ? [h.id] : s.hunters.filter(x => x.role === "hunter" && x.alive && x.activity === "na_vila").slice(0, 2).map(x => x.id);
        if (!ids.length) return this.toast("Nenhum Hunter disponível na vila.", "erro");
        this.order({ type: "explorar", hunters: ids }); return;
      }
      case "recolher": { const ids = s.hunters.filter(x => x.activity === "patrulhando").map(x => x.id); if (!ids.length) return this.toast("Ninguém explorando agora.", "erro"); this.order({ type: "recolher", hunters: ids }); return; }
      case "descansar": { if (!h) return; this.order({ type: "descansar", hunters: [h.id] }); return; }
      case "cacar": this.open("bestiario"); return;
      case "viajar": this.open("mapa"); return;
      case "vila": this.d.focusVillage?.(); this.open("vila"); return;
      default: this.open(id);
    }
  }
  private async setSpeed(e: number) {
    const r = await fetch("/api/v1/tempo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ escala: e }) }).catch(() => null);
    if (r?.ok) { this.escala = e; this.paintSpeed(); this.toast(`Velocidade da simulação ×${e} (o relógio dia/noite é universal)`, "ok"); }
  }
  private paintSpeed() { this.refs.relogio?.querySelectorAll<HTMLButtonElement>(".vel button").forEach(b => b.classList.toggle("on", Number(b.dataset.e) === this.escala)); }
  private pick(id: string) { this.selected = id; this.d.select(id); this.lastBig = 0; }
  private cycle(dir: number) { const hs = this.snap?.hunters.filter(h => h.alive) ?? []; const i = hs.findIndex(h => h.id === this.selected); const n = hs[(i + dir + hs.length) % hs.length]; if (n) this.pick(n.id); }

  log(s: string) { this.toast(s, "info"); }
  toast(s: string, kind = "info") {
    const t = el("div", "nota " + kind); t.textContent = s;
    this.feed.prepend(t);
    while (this.feed.children.length > 6) this.feed.lastChild?.remove();
    setTimeout(() => t.classList.add("some"), 6500);
    setTimeout(() => t.remove(), 7600);
  }

  // ------------------------------------------------------------ quadro
  frame(s: SnapshotFull, now: number) {
    this.snap = s;
    if (!this.selected) this.selected = s.hunters[0]?.id ?? "";
    for (const e of s.game.events.slice(0, 8).reverse()) {
      const k = `${e.tick}:${e.text}`;
      if (this.seenEvents.has(k)) continue;
      this.seenEvents.add(k);
      if (this.seenEvents.size > 1) { this.toast(e.text, e.kind === "abate" || e.kind === "bestiario" ? "bom" : e.kind === "ferimento" || e.kind === "morte" ? "erro" : "info"); this.unread++; }
    }
    if (now - this.lastBig < 250) return;
    this.lastBig = now;
    this.paintClock(s); this.paintExpedition(s); this.paintLocal(s); this.paintBar(s); this.paintCombat(s);
    if (!this.dev.hidden) this.paintDev(s);
    if (this.modal && (this.modalKind === "mapa" || this.modalKind === "inventario" || this.modalKind === "eventos" || this.modalKind === "acampamento" || this.modalKind === "armadilhas" || this.modalKind === "rastrear") && now % 1000 < 260) this.renderModal();
  }

  private paintClock(s: SnapshotFull) {
    const c = s.clock, r = this.refs.relogio;
    // dia 06:00→18:00 em 2 h; noite 18:00→06:00 em 40 min (relógio universal do servidor)
    const frac = c.phase_elapsed_s / (c.phase_elapsed_s + c.phase_remaining_s);
    const hours = c.phase === "day" ? 6 + 12 * frac : (18 + 12 * frac) % 24;
    const hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60);
    r.querySelector(".dia")!.textContent = `Dia ${c.cycle + 1} • Ciclo ${c.cycle}`;
    r.querySelector(".astro")!.innerHTML = c.phase === "day" ? ICON.sol : ICON.lua;
    r.querySelector(".astro")!.className = "astro " + c.phase;
    r.querySelector(".hora")!.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const w = (s.game as any).weather?.[this.selected];
    r.querySelector(".tempo")!.innerHTML = w ? `${weatherIcon(w.kind, c.phase === "night")}` : "";
    (r.querySelector(".tempo") as HTMLElement).title = w ? CLIMA[w.kind] ?? w.kind : "";
  }

  private paintExpedition(s: SnapshotFull) {
    const h = this.sel(), box = this.refs.exped;
    const e = h?.expedition != null ? s.game.expeditions.find(x => x.id === h.expedition) : undefined;
    if (!h) { box.hidden = true; return; }
    box.hidden = false;
    if (!e) {
      box.innerHTML = `<h3>${ICON.acampamento}<span>${h.activity === "patrulhando" ? "Exploração" : h.activity === "viajando" ? "Viagem" : "Sem expedição"}</span></h3><div class="sub">${esc(h.name)} — ${ATIV[h.activity] ?? h.activity}</div>`;
      return;
    }
    const nome = this.gameplay?.especies?.[e.species]?.nome ?? e.species;
    const act = h.activity;
    const order = ["procurando", "rastreando", "aproximando", "combatendo"];
    const stage = e.kills > 0 ? 4 : act === "combatendo" || act === "armando_armadilha" || act === "aguardando" ? 3 : act === "aproximando" ? 2 : act === "rastreando" ? 1 : 0;
    const steps = ["Encontrar pegadas", "Seguir o rastro", "Aproximar-se (furtivo)", "Abater ou capturar", "Retornar à vila"];
    const done = (i: number) => (i < stage || (i === 4 && e.state === "concluida"));
    void order;
    box.innerHTML = `<h3>${ICON.cacar}<span>Expedição Atual</span></h3><div class="sub">${ICON.rastrear}<span>${e.state === "viajando" ? "Viajando até" : "Rastreando"}: ${esc(nome)} — ${e.dest_tile}</span></div>` +
      steps.map((t, i) => `<div class="passo ${done(i) ? "feito" : i === stage ? "atual" : ""}"><span class="cx">${done(i) ? ICON.check : ""}</span>${t}</div>`).join("") +
      `<div class="mini">${e.members.length} Hunters · ${e.transporte === "carroca" ? "carroça " + (e.wagon ?? "") : "a pé"} · abates ${e.kills}${e.rescuer ? " · resgate em curso" : ""}</div>`;
  }

  private paintLocal(s: SnapshotFull) {
    const h = this.sel(); if (!h) return;
    const t = this.d.continent.tiles.find(x => x.id === h.tile_id);
    const w = (s.game as any).weather?.[h.id];
    const dir = w ? ["Norte", "Nordeste", "Leste", "Sudeste", "Sul", "Sudoeste", "Oeste", "Noroeste"][Math.round(((Math.atan2(w.wind[0], -w.wind[1]) * 180) / Math.PI + 360) % 360 / 45) % 8] : "—";
    const forca = w ? Math.hypot(w.wind[0], w.wind[1]) : 0;
    this.refs.local.innerHTML = `<div class="b">${ICON.folha}<b>${esc(BIOMA_PT[t?.biome ?? ""] ?? t?.biome ?? "—")}</b><span>— ${h.tile_id}</span></div>
      <div class="c">${ICON.temp}<span>${w ? Math.round(w.temperatureC) + "°C" : "—"}</span>${ICON.vento}<span>Vento: ${dir} (${forca < 0.7 ? "fraco" : forca < 1.5 ? "moderado" : "forte"})</span></div>
      <div class="c">${w ? weatherIcon(w.kind, s.clock.phase === "night") : ""}<span>${w ? CLIMA[w.kind] ?? w.kind : ""}${w && w.intensity > 0.05 ? ` · ${(w.intensity * 100).toFixed(0)}%` : ""}${w && w.visionFactor < 0.95 ? ` · visão ×${w.visionFactor.toFixed(2)}` : ""}</span></div>`;
  }

  private paintBar(s: SnapshotFull) {
    const h = this.sel(), b = this.refs.barra;
    if (h) {
      b.querySelector(".arma")!.innerHTML = `${ICON[h.arma] ?? ICON.espada}<span>${ARMA_PT[h.arma] ?? h.arma}</span>`;
      const img = b.querySelector(".retrato img") as HTMLImageElement;
      if (this.portraitUrl && img.src !== this.portraitUrl) img.src = this.portraitUrl;
      b.querySelector(".retrato .num")!.textContent = String(s.hunters.indexOf(h) + 1).padStart(2, "0");
      b.querySelector(".retrato")!.className = "retrato " + (h.role === "socorrista" ? "socorrista" : "") + (h.alive ? "" : " morto");
      b.querySelector(".nome")!.innerHTML = `${esc(h.name)}${h.role === "socorrista" ? ` <small>${ICON.cruz} socorrista</small>` : ""}`;
      b.querySelector(".vida-txt")!.textContent = `${Math.max(0, Math.round(h.hp))} / ${Math.round(h.hp_max)}`;
      (b.querySelector(".bar.vida i") as HTMLElement).style.width = pct(h.hp, h.hp_max);
      const sk = h.skills[h.arma];
      b.querySelector(".prof-txt")!.textContent = sk ? `${ARMA_PT[h.arma] ?? h.arma} ${sk.level}/20` : "—";
      (b.querySelector(".bar.prof i") as HTMLElement).style.width = sk ? pct(sk.level, 20) : "0%";
      const cond = [ATIV[h.activity] ?? h.activity, h.crouched ? "agachado" : "", h.hp < h.hp_max * 0.5 && h.alive ? "ferido" : ""].filter(Boolean).join(" · ");
      b.querySelector(".estado")!.innerHTML = `${ICON.rastrear}<span>Estado: ${esc(cond)}</span>`;
      // slots 1–6: itens agregados do inventário do Hunter (não há poções no servidor ainda)
      const counts = new Map<string, number>(); for (const it of h.inventory) counts.set(it, (counts.get(it) ?? 0) + 1);
      const slots = b.querySelector(".slots")!; slots.innerHTML = "";
      const list = [...counts.entries()];
      for (let i = 0; i < 6; i++) {
        const it = list[i];
        const d = el("div", "slot" + (it ? " cheio" : ""), `<span class="n">${i + 1}</span>${it ? itemIcon(it[0]) + `<span class="q">${it[1]}</span>` : ""}`);
        if (it) d.title = it[0];
        slots.append(d);
      }
    }
    const list = b.querySelector(".hunters")!;
    for (const [i, x] of s.hunters.entries()) {
      let r = this.rows.get(x.id);
      if (!r) {
        r = el("button", "hcard", `<img alt=""><span class="n"></span><span class="st"></span><span class="bar"><i></i></span>`);
        const id = x.id; r.onclick = () => this.pick(id); r.title = x.name;
        list.append(r); this.rows.set(x.id, r);
      }
      r.className = "hcard" + (x.id === this.selected ? " sel" : "") + (x.alive ? "" : " morto") + (x.role === "socorrista" ? " socorrista" : "") + (x.activity === "caido" ? " caido" : "");
      const img = r.querySelector("img") as HTMLImageElement; if (this.portraitUrl && img.src !== this.portraitUrl) img.src = this.portraitUrl;
      r.querySelector(".n")!.textContent = String(i + 1).padStart(2, "0");
      r.querySelector(".st")!.innerHTML = x.alive ? (x.role === "socorrista" ? ICON.cruz : x.activity === "combatendo" ? ICON.cacar : x.activity === "na_vila" ? ICON.vila : ICON.rastrear) : ICON.fechar;
      (r.querySelector(".bar i") as HTMLElement).style.width = pct(x.hp, x.hp_max);
    }
    const badge = b.querySelector(".alerta .badge") as HTMLElement; badge.textContent = this.unread ? String(Math.min(99, this.unread)) : ""; badge.hidden = !this.unread;
  }

  /** Lateral esquerda: arma, informações de combate e condições do Hunter selecionado. */
  private paintCombat(s: SnapshotFull) {
    const h = this.sel(), box = this.refs.combate; if (!h) return;
    const k = (n: string) => h.skills[n]?.level ?? 0;
    const alvo = h.target_creature != null ? s.game.creatures.find(c => c.id === h.target_creature) : undefined;
    const nomeAlvo = alvo ? this.gameplay?.especies?.[alvo.species]?.nome ?? alvo.species : null;
    const cond = [h.crouched && "Agachado", h.activity === "caido" && "Caído", !h.alive && "Morto", h.hp < h.hp_max * 0.5 && h.alive && "Ferido", h.activity === "combatendo" && "Em combate", h.activity === "embarcado" && "Na carroça"].filter(Boolean);
    box.innerHTML = `<div class="t">${ICON[h.arma] ?? ICON.espada}<b>${ARMA_PT[h.arma] ?? h.arma}</b><span>nív. ${k(h.arma)}</span></div>
      <div class="g"><span>Desvio</span><b>${k("desvio")}</b><span>Furtividade</span><b>${k("furtividade")}</b><span>Rastreamento</span><b>${k("rastreamento")}</b><span>Armadilhas</span><b>${k("armadilhas")}</b></div>
      ${nomeAlvo ? `<div class="alvo">${ICON.cacar}<span>Alvo: ${esc(nomeAlvo)} ${alvo ? `(${Math.max(0, Math.round(alvo.hp))}/${Math.round(alvo.hp_max)})` : ""}</span></div>` : ""}
      ${h.last_action ? `<div class="acao">${esc(h.last_action)}</div>` : ""}
      <div class="cond">${cond.length ? cond.map(c => `<span>${c}</span>`).join("") : "<span class='ok'>Sem condições</span>"}</div>`;
  }

  // ------------------------------------------------------------ janelas
  open(kind: string) {
    this.close();
    this.modalKind = kind;
    this.modal = el("div", "janela painel " + kind);
    this.root.append(this.modal);
    if (kind === "eventos") this.unread = 0;
    this.renderModal();
  }
  close() { this.modal?.remove(); this.modal = null; this.modalKind = ""; }
  private head(title: string, icon: string) {
    const h = el("div", "topo", `${icon}<h2>${title}</h2>`);
    const x = el("button", "x", ICON.fechar); x.onclick = () => this.close(); h.append(x);
    return h;
  }
  private renderModal() {
    const m = this.modal, s = this.snap; if (!m || !s) return;
    const keepScroll = m.querySelector(".corpo")?.scrollTop ?? 0;
    m.innerHTML = "";
    const body = el("div", "corpo");
    switch (this.modalKind) {
      case "bestiario": m.append(this.head("Bestiário", ICON.bestiario)); this.bestiary(body, s); break;
      case "mapa": m.append(this.head("Mapa do continente", ICON.mapa)); this.map(body, s); break;
      case "inventario": m.append(this.head("Inventário", ICON.inventario)); this.inventory(body, s); break;
      case "equipamento": m.append(this.head("Equipamento", ICON.equipamento)); this.equipment(body, s); break;
      case "sistema": m.append(this.head("Sistema", ICON.sistema)); this.system(body); break;
      case "acampamento": m.append(this.head("Acampamentos", ICON.acampamento)); this.camps(body, s); break;
      case "armadilhas": m.append(this.head("Armadilhas", ICON.armadilhas)); this.traps(body, s); break;
      case "rastrear": m.append(this.head("Rastros", ICON.rastrear)); this.tracks(body, s); break;
      case "vila": m.append(this.head("Vila dos Hunters", ICON.vila)); this.village(body, s); break;
      case "eventos": m.append(this.head("Acontecimentos", ICON.alerta)); body.innerHTML = s.game.events.slice(0, 40).map(e => `<div class="ev ${e.kind}"><b>${e.kind}</b> ${esc(e.text)}</div>`).join(""); break;
    }
    m.append(body);
    body.scrollTop = keepScroll;
  }

  private bestiary(body: HTMLElement, s: SnapshotFull, openSp?: string) {
    const pages = Object.values(s.game.bestiary.pages) as PageSnap[];
    if (!pages.length) { body.innerHTML = `<p class="vazio">Nenhuma criatura avistada ainda. Mande Hunters explorarem: o primeiro avistamento cria a página.</p>`; return; }
    const lista = el("div", "lista"), ficha = el("div", "ficha");
    const show = (p: PageSnap) => {
      lista.querySelectorAll(".pg").forEach(x => x.classList.toggle("sel", (x as HTMLElement).dataset.sp === p.species));
      const sp = this.gameplay?.especies?.[p.species] ?? {};
      const f = sp.ficha ?? {};
      ficha.innerHTML = `<div class="cab"><img class="retrato-criatura" src="${sp.retrato ? "/" + sp.retrato : ""}" alt="Retrato de ${esc(p.nome)}">
        <div><h3>${esc(p.nome)}</h3><div class="papel">${sp.papel === "predador" ? "Predador" : "Presa"} · ${esc(f.porte ?? "porte sem ficha")}</div>
        <div class="conhec ${p.conhecimento}">Conhecimento de Monstros: <b>${CONHEC[p.conhecimento] ?? p.conhecimento}</b></div>
        <div class="num">${p.avistamentos} avistamentos · ${p.abates} abates · 1º por ${esc(p.primeiro_por)}</div></div></div>
        <p class="desc">${esc(descricao(sp, p))}</p>
        <div class="cols"><div><h4>Itens obtíveis</h4>${p.itens.map(i => `<div class="it">${itemIcon(i)}<span>${esc(i)}</span></div>`).join("") || "<i>—</i>"}<div class="prov">itens provisórios (decisão 8)</div></div>
        <div><h4>Biomas de ocorrência</h4>${(sp.biomas ?? p.habitats ?? []).map((b: string) => `<div class="it">${ICON.folha}<span>${esc(BIOMA_PT[b] ?? b)}</span></div>`).join("")}</div></div>
        <h4>Mapa de ocorrência</h4><canvas class="mapinha" width="520" height="360"></canvas>
        <div class="leg"><span class="h"></span>habitat · <span class="p"></span>avistamentos</div>`;
      this.drawMap(ficha.querySelector("canvas")!, s, { habitat: sp.biomas ?? [], points: p.pontos });
      const go = el("button", "cta", `${ICON.cacar}<span>Caçar</span>`); go.onclick = () => this.huntDialog(p, s);
      ficha.querySelector(".cab > div")!.append(go);
    };
    for (const p of pages) {
      const b = el("button", "pg", `<img src="${this.gameplay?.especies?.[p.species]?.retrato ? "/" + this.gameplay.especies[p.species].retrato : ""}" alt=""><span>${esc(p.nome)}</span><small>${CONHEC[p.conhecimento] ?? p.conhecimento}</small>`);
      b.dataset.sp = p.species; b.onclick = () => show(p);
      lista.append(b);
    }
    body.append(lista, ficha);
    show(pages.find(p => p.species === openSp) ?? pages[0]);
  }

  private huntDialog(p: PageSnap, s: SnapshotFull) {
    const g = this.gameplay, cap = g?.carrocas?.capacidade ?? 6;
    const dlg = el("div", "dialogo painel");
    const free = s.hunters.filter(h => h.role === "hunter" && h.alive && h.activity === "na_vila");
    dlg.innerHTML = `<h3>${ICON.cacar} Caçar ${esc(p.nome)}</h3><div class="sel"></div>
      <label>Transporte <select><option value="a_pe">A pé (sem custo)</option>${(g?.carrocas?.lista ?? []).map((w: any) => `<option value="${w.id}">Carroça de ${esc(w.condutor)} (até ${cap})</option>`).join("")}</select></label>
      <div class="custo"></div><div class="bt"></div>`;
    const sel = dlg.querySelector(".sel")!;
    for (const h of free) sel.append(el("label", "", `<input type="checkbox" value="${h.id}" ${free.indexOf(h) < 3 ? "checked" : ""}> ${esc(h.name)} <small>${ARMA_PT[h.arma] ?? h.arma} ${h.skills[h.arma]?.level ?? 0}</small>`));
    if (!free.length) sel.innerHTML = `<p class="vazio">Nenhum Hunter disponível na vila.</p>`;
    const tr = dlg.querySelector("select") as HTMLSelectElement, custo = dlg.querySelector(".custo")!;
    const upd = () => {
      const n = sel.querySelectorAll("input:checked").length, pt = p.pontos[p.pontos.length - 1];
      const km = pt ? Math.hypot(pt[1] - s.game.village[0], pt[2] - s.game.village[1]) / 1000 : 0;
      custo.textContent = tr.value === "a_pe" ? `${n} Hunters a pé` : `${n}/${cap} vagas · custo estimado ${g ? Math.round(g.economia.carroca.base + g.economia.carroca.porKm * km) : "?"} (dinheiro: ${Math.round(s.game.money)}) — valores provisórios`;
    };
    sel.addEventListener("change", upd); tr.onchange = upd; upd();
    const ok = el("button", "cta", "Partir"), no = el("button", "", "Cancelar");
    ok.onclick = async () => {
      const ids = [...sel.querySelectorAll<HTMLInputElement>("input:checked")].map(i => i.value);
      if (await this.order({ type: "cacar", species: p.species, hunters: ids, transporte: tr.value === "a_pe" ? "a_pe" : "carroca", carroca: tr.value === "a_pe" ? null : tr.value })) { dlg.remove(); this.close(); if (ids[0]) this.pick(ids[0]); }
    };
    no.onclick = () => dlg.remove();
    dlg.querySelector(".bt")!.append(ok, no);
    this.root.append(dlg);
  }

  /** Mapa hexagonal do continente: biomas, clima, Hunters, carroças e destinos; clicar num hex = Viajar. */
  private drawMap(cv: HTMLCanvasElement, s: SnapshotFull, opt: { habitat?: string[]; points?: [string, number, number][]; travel?: boolean } = {}) {
    const g = cv.getContext("2d")!, tiles = this.d.continent.tiles;
    const xs = tiles.map(t => t.x), zs = tiles.map(t => t.z);
    const [x0, x1, z0, z1] = [Math.min(...xs) - 3000, Math.max(...xs) + 3000, Math.min(...zs) - 3000, Math.max(...zs) + 3000];
    const k = Math.min(cv.width / (x1 - x0), cv.height / (z1 - z0));
    const P = (x: number, z: number) => [(x - x0) * k + (cv.width - (x1 - x0) * k) / 2, (z - z0) * k + (cv.height - (z1 - z0) * k) / 2];
    g.fillStyle = "#13202a"; g.fillRect(0, 0, cv.width, cv.height);
    const nodes = new Map(((s.game as any).climate_nodes ?? []).map((n: any) => [n[0], n]));
    const col = (b: string) => /swamp/.test(b) ? "#3d5a3a" : /jungle/.test(b) ? "#2f6b34" : /snow|ice|glacial/.test(b) ? "#d6e2ea" : /savanna/.test(b) ? "#b49a4e" : /dune|desert|erg|duna|arco|mesas|torres|oásis|cânion|ossada|maciço/i.test(b) ? "#cfa766" : /praia|fal/.test(b) ? "#a8a07a" : /mountain/.test(b) ? "#6f7b6a" : /forest/.test(b) ? "#4b7a3d" : "#7fa055";
    const r = 2500 * k;
    for (const t of tiles) {
      const [x, y] = P(t.x, t.z);
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath();
      g.fillStyle = col(t.biome); g.fill();
      if (opt.habitat?.length && opt.habitat.includes(t.biome)) { g.fillStyle = "rgba(240,190,80,0.45)"; g.fill(); }
      if (t.status && !/certif/.test(String(t.status))) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fill(); }
      g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 0.6; g.stroke();
      const n: any = nodes.get(t.id);
      if (n && n[1] !== "limpo" && n[1] !== "nublado" && !opt.habitat) { g.fillStyle = n[1] === "areia" ? "rgba(214,150,70,0.55)" : n[1].startsWith("nev") || n[1] === "neve" ? "rgba(255,255,255,0.6)" : "rgba(70,120,200,0.5)"; g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill(); }
    }
    for (const p of opt.points ?? []) { const [x, y] = P(p[1], p[2]); g.fillStyle = "#ff5a3a"; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    const [vx, vy] = P(s.game.village[0], s.game.village[1]);
    g.fillStyle = "#ffd76a"; g.font = "bold 12px Cinzel"; g.fillText("Vila", vx + 6, vy - 6); g.beginPath(); g.arc(vx, vy, 4, 0, Math.PI * 2); g.fill();
    if (!opt.habitat) {
      for (const e of s.game.expeditions) { const t = tiles.find(x => x.id === e.dest_tile); if (!t) continue; const [x, y] = P(t.x, t.z); g.strokeStyle = "#f2c14e"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.7, 0, Math.PI * 2); g.stroke(); }
      for (const w of s.game.wagons) { const [x, y] = P(w.x, w.z); g.fillStyle = "#c98b4b"; g.fillRect(x - 3, y - 3, 6, 6); }
      for (const h of s.hunters) { if (!h.alive) continue; const [x, y] = P(h.x, h.z); g.fillStyle = h.id === this.selected ? "#ffffff" : h.role === "socorrista" ? "#f0883e" : "#7cc8ff"; g.beginPath(); g.arc(x, y, h.id === this.selected ? 4.5 : 3, 0, Math.PI * 2); g.fill(); }
    }
    if (opt.travel) cv.onclick = ev => {
      const rc = cv.getBoundingClientRect(), mx = ((ev.clientX - rc.left) / rc.width) * cv.width, my = ((ev.clientY - rc.top) / rc.height) * cv.height;
      let best: any = null, bd = 1e9; for (const t of tiles) { const [x, y] = P(t.x, t.z); const d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; best = t; } }
      if (best && bd < r * 1.2) this.travelDialog(best, s);
    };
  }

  private map(body: HTMLElement, s: SnapshotFull) {
    const cv = el("canvas", "mapa-grande") as HTMLCanvasElement; cv.width = 1100; cv.height = 760;
    body.append(cv, el("div", "leg", `Clique num hex para <b>Viajar</b> com o Hunter selecionado. ${ICON.chuva} chuva/tempestade · ${ICON.neve} neve · ${ICON.areia} areia · círculo dourado = destino de expedição · hexes escurecidos = sem certificação técnica`));
    this.drawMap(cv, s, { travel: true });
  }
  private travelDialog(t: { id: string; biome: string }, s: SnapshotFull) {
    const h = this.sel(); if (!h) return;
    const dlg = el("div", "dialogo painel", `<h3>${ICON.viajar} Viajar até ${t.id}</h3><p>${esc(BIOMA_PT[t.biome] ?? t.biome)}. ${esc(h.name)} vai a pé pelos portais validados e explora a região ao chegar.</p><div class="bt"></div>`);
    const ok = el("button", "cta", "Viajar"), no = el("button", "", "Cancelar");
    ok.onclick = async () => { if (await this.order({ type: "viajar", hunters: [h.id], tile: t.id })) { dlg.remove(); this.close(); } };
    no.onclick = () => dlg.remove();
    dlg.querySelector(".bt")!.append(ok, no); this.root.append(dlg);
    void s;
  }

  private inventory(body: HTMLElement, s: SnapshotFull) {
    const h = this.sel();
    const group = (a: string[]) => { const m = new Map<string, number>(); for (const i of a) m.set(i, (m.get(i) ?? 0) + 1); return [...m.entries()]; };
    const grid = (a: [string, number][]) => a.length ? `<div class="grade">${a.map(([n, q]) => `<div class="slot cheio" title="${esc(n)}">${itemIcon(n)}<span class="q">${q}</span><small>${esc(n)}</small></div>`).join("")}</div>` : `<p class="vazio">Vazio.</p>`;
    body.innerHTML = `<h4>${h ? esc(h.name) : "—"}</h4>${grid(group(h?.inventory ?? []))}<h4>Armazém da vila</h4>${grid(group(s.game.village_storage))}<p class="prov">Poções, alimentos e utilitários ainda não existem na simulação (pendência registrada); os itens vêm dos abates.</p>`;
  }
  private equipment(body: HTMLElement, s: SnapshotFull) {
    const h = this.sel(); if (!h) return;
    const armas = Object.entries<any>(this.gameplay?.combate?.armas ?? {});
    body.innerHTML = `<p>${esc(h.name)} usa <b>${ARMA_PT[h.arma] ?? h.arma}</b>. A troca só acontece na vila. Lança e espadão são <b>provisórios</b> (há clipes reais no Hunter PvE v01).</p>`;
    const g = el("div", "armas");
    for (const [id, a] of armas) {
      const b = el("button", "arma-op" + (id === h.arma ? " sel" : ""), `${ICON[id] ?? ICON.espada}<b>${ARMA_PT[id] ?? id}</b><small>ataque ${a.ataque} · +${a.bonusPorNivel}/nível${a.provisorio ? " · provisório" : ""}</small><small>nível ${h.skills[id]?.level ?? 0}/20</small>`);
      b.onclick = async () => { if (await this.order({ type: "equipar", hunter: h.id, arma: id })) this.renderModal(); };
      g.append(b);
    }
    body.append(g, el("p", "prov", "Armaduras e acessórios: conceitos existem no workshop, mas não há modelos equipáveis nem regras aprovadas (pendência)."));
    void s;
  }
  private camps(body: HTMLElement, s: SnapshotFull) {
    body.innerHTML = s.game.camps.length ? s.game.camps.map(c => `<div class="linha-c">${ICON.acampamento}<b>Acampamento ${c.id}</b> · ${c.tile} · expedição ${c.expedition} · ${c.storage.length} itens guardados</div>`).join("") : `<p class="vazio">Nenhum acampamento montado. A carroça monta um ao chegar ao destino da caçada.</p>`;
  }
  private traps(body: HTMLElement, s: SnapshotFull) {
    const tipos = this.gameplay?.armadilhas?.tipos ?? [];
    body.innerHTML = `<p>As armadilhas são escolha <b>autônoma</b> dos Hunters (estratégia “armadilha + grito”, ligada ao Conhecimento de Monstros “dominado”).</p>` +
      tipos.map((t: any) => `<div class="linha-c">${ICON.armadilhas}<b>${esc(t.nome ?? t.id)}</b> · imobiliza ${t.imobilizaS[0]}–${t.imobilizaS[1]} s · até ${t.massaMaxKg} kg <small>(provisório)</small></div>`).join("") +
      `<h4>Armadas agora</h4>` + (s.game.traps.length ? s.game.traps.map(t => `<div class="linha-c">${t.armed ? "Armada" : t.caught ? "Disparada (presa)" : "Disparada"} · ${esc(t.kind)} · dono ${esc(t.owner)}</div>`).join("") : `<p class="vazio">Nenhuma.</p>`);
  }
  private tracks(body: HTMLElement, s: SnapshotFull) {
    const by = new Map<string, number>(); for (const f of s.game.tracks) by.set(f.species, (by.get(f.species) ?? 0) + 1);
    body.innerHTML = `<p>Pegadas são invisíveis até um Hunter descobri-las (Rastreamento); depois brilham em azul. Somem ao atravessar água e sob chuva forte.</p>` +
      ([...by.entries()].map(([sp, n]) => `<div class="linha-c">${ICON.rastrear}<b>${esc(this.gameplay?.especies?.[sp]?.nome ?? sp)}</b> · ${n} pegadas descobertas perto dos Hunters</div>`).join("") || `<p class="vazio">Nenhuma pegada descoberta no momento.</p>`);
  }
  private village(body: HTMLElement, s: SnapshotFull) {
    const na = s.hunters.filter(h => h.activity === "na_vila" || h.activity === "descansando");
    body.innerHTML = `<p>${na.length} Hunters na vila · dinheiro ${Math.round(s.game.money)} · ${s.game.village_storage.length} itens no armazém.</p>
      <p>A vila usa os modelos reais de <code>world/hunters-village-v01</code> (forja, salão, armazém, estábulos, treino, casas). As quatro fases de evolução existem; a regra econômica que libera cada fase <b>não está aprovada</b>, então a fase exibida é escolha de apresentação:</p><div class="fases"></div>`;
    const f = body.querySelector(".fases")!;
    for (const n of [1, 2, 3, 4]) { const b = el("button", "", `Fase ${n}`); b.onclick = () => this.d.setVillagePhase?.(n); f.append(b); }
  }

  private system(body: HTMLElement) {
    const st = this.d.settings;
    body.innerHTML = `<h4>Perfil gráfico</h4><div class="perfis"></div><h4>Ajustes individuais</h4><div class="opts"></div>
      <h4>Teclas</h4><label>Menu do desenvolvedor <input class="tecla" value="${esc(this.devKey)}" maxlength="3" size="4"></label>
      <p class="prov">M mapa · B bestiário · I inventário · Tab troca de Hunter · 1–9 seleciona · botão direito/meio gira · roda = zoom · WASD desloca a câmera · F volta a seguir · Q/E giram.</p>
      <p class="prov">A qualidade gráfica nunca altera a simulação: o servidor decide tudo.</p>`;
    const perf = body.querySelector(".perfis")!;
    const names: Record<ProfileName, string> = { economico: "Econômico", baixo: "Baixo", medio: "Médio", alto: "Alto" };
    for (const p of ["economico", "baixo", "medio", "alto"] as ProfileName[]) {
      const b = el("button", st.profile === p ? "on" : "", names[p]);
      b.onclick = () => { const n = { ...PROFILES[p] }; this.d.applySettings(n); if (p !== "economico") this.d.setEconomic(false); this.renderModal(); };
      perf.append(b);
    }
    const opts = body.querySelector(".opts")!;
    const num = (k: keyof GraphicsSettings, label: string, min: number, max: number, step: number) => {
      const l = el("label", "", `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${st[k]}"><b>${st[k]}</b>`);
      const i = l.querySelector("input")!; i.oninput = () => { l.querySelector("b")!.textContent = i.value; this.d.applySettings({ ...st, [k]: Number(i.value) }); };
      opts.append(l);
    };
    const sel = (k: keyof GraphicsSettings, label: string, vals: string[]) => {
      const l = el("label", "", `<span>${label}</span><select>${vals.map(v => `<option ${String(st[k]) === v ? "selected" : ""}>${v}</option>`).join("")}</select>`);
      const s = l.querySelector("select")!; s.onchange = () => this.d.applySettings({ ...st, [k]: s.value === "true" ? true : s.value === "false" ? false : s.value });
      opts.append(l);
    };
    num("viewDistance", "Distância de visão (m)", 2000, 12000, 500);
    num("terrainErrorPx", "Qualidade do terreno (erro px; menor = melhor)", 1, 8, 0.5);
    num("vegetationDensity", "Densidade de vegetação", 0, 1, 0.05);
    num("treeDistance", "Distância das árvores (m)", 400, 4000, 100);
    sel("shadows", "Sombras", ["off", "baixa", "media", "alta"]);
    sel("fog", "Neblina", ["simples", "altura"]);
    num("particles", "Partículas de clima", 0, 1, 0.1);
    num("resolutionScale", "Resolução", 0.5, 1, 0.05);
    sel("dynamicResolution", "Resolução dinâmica", ["true", "false"]);
    sel("postprocessing", "Pós-processamento", ["true", "false"]);
    sel("animationQuality", "Qualidade de animações", ["baixa", "media", "alta"]);
    sel("clouds", "Nuvens", ["true", "false"]);
    const tecla = body.querySelector(".tecla") as HTMLInputElement;
    tecla.onchange = () => { this.devKey = tecla.value || "F3"; try { localStorage.setItem("wildhaven.v03.teclaDev", this.devKey); } catch { /* sem armazenamento */ } };
    const eco = el("button", "cta", "Alternar Modo Econômico (pixel art)"); eco.onclick = () => { this.d.setEconomic(document.querySelector("canvas.pixel")?.hasAttribute("hidden") ?? true); };
    body.append(eco);
  }

  private paintDev(s: SnapshotFull) {
    const p: any = (window as any).__wildhavenPerf ?? {}, c = p.culling ?? {}, w = c.world ?? {}, v = c.veg ?? {}, a = c.actors ?? {}, m: any = (s.game as any).metrics ?? {};
    const f = (x: any, d = 1) => (typeof x === "number" ? x.toFixed(d) : "—");
    this.dev.innerHTML = `<h3>Desenvolvedor <small>(${esc(this.devKey)})</small></h3><table>
      <tr><td>Modo</td><td>${p.mode ?? "—"} · res. ×${f(p.resScale, 2)}</td></tr>
      <tr><td>FPS médio / 1% low</td><td>${f(p.fps)} / ${f(p.low1)}</td></tr>
      <tr><td>Quadro / CPU / GPU</td><td>${f(p.frameMs, 2)} / ${f(p.cpuMs, 2)} / ${p.gpuMs == null ? (p.gpuTimer ? "aguardando" : "indisponível") : f(p.gpuMs, 2)} ms</td></tr>
      <tr><td>Draw calls / triângulos</td><td>${p.drawCalls ?? "—"} / ${p.triangles != null ? (p.triangles / 1000).toFixed(0) + " k" : "—"}</td></tr>
      <tr><td>RAM JS / VRAM estimada</td><td>${f(p.heapMB, 0)} / ${f(p.vramEstMB, 0)} MB</td></tr>
      <tr><td>Geometrias / texturas</td><td>${p.geometries ?? "—"} / ${p.textures ?? "—"}</td></tr>
      <tr><td>Carregamento inicial</td><td>${f(p.loadSeconds, 1)} s</td></tr>
      <tr><td>Hexes / carregando</td><td>${w.tiles ?? "—"} / ${w.loading ?? 0} · horizonte oculto ${w.horizonHidden ?? 0}</td></tr>
      <tr><td>Relevo desenhado</td><td>folhas ${w.leavesDrawn ?? 0} · blocos ${w.blocksDrawn ?? 0} · hex inteiro ${w.tilesAsOne ?? 0}</td></tr>
      <tr><td>Culling relevo</td><td>frustum ${w.frustumCulled ?? 0} · distância ${w.distanceCulled ?? 0} · oclusão ${w.occlusionCulled ?? 0}</td></tr>
      <tr><td>Vegetação</td><td>${v.drawn ?? 0}/${v.candidates ?? 0} inst. · LOD ${(v.perLod ?? []).join("/")} · ${f(v.updateMs, 2)} ms</td></tr>
      <tr><td>Culling vegetação (células)</td><td>frustum ${v.cellsFrustum ?? 0} · distância ${v.cellsDistance ?? 0} · oclusão ${v.cellsOcclusion ?? 0}</td></tr>
      <tr><td>Capim / flores</td><td>${c.grass?.tufts ?? 0} / ${c.grass?.flowers ?? 0} tufos · ${c.grass?.cells ?? 0} células · ${f(c.grass?.ms, 2)} ms</td></tr>
      <tr><td>Atores</td><td>descartados ${a.actorsCulled ?? 0} · mixers ${a.mixersUpdated ?? 0} atualizados / ${a.mixersSkipped ?? 0} adiados · LOD criaturas ${(a.creatureLods ?? []).join("/")}</td></tr>
      <tr><td>Servidor: tick</td><td>${f(m.tick_ms, 2)} ms (máx ${f(m.tick_ms_max, 1)}) · ×${this.escala}</td></tr>
      <tr><td>Criaturas (relevância)</td><td>${m.creatures_total ?? 0}: perto ${m.near ?? 0} · médio ${m.mid ?? 0} · longe ${m.far ?? 0} · congeladas ${m.frozen ?? 0}</td></tr>
      <tr><td>A* por tick</td><td>${m.astar_used ?? 0}/${m.astar_budget ?? 0} · adiados ${m.astar_deferred ?? 0} · predações ${m.prey_kills ?? 0}</td></tr>
      </table><div class="devbt"><span>Clima (simulação inteira, no Hunter):</span></div><div class="devbt fases"><span>Vila:</span></div>`;
    const bt = this.dev.querySelector(".devbt")!;
    for (const k of ["limpo", "chuva", "tempestade", "neve", "nevasca", "areia"]) {
      const b = el("button", "", k); b.onclick = async () => {
        const h = this.sel(); if (!h) return;
        const r = await fetch("/api/v1/dev/clima", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: k, x: h.x, z: h.z }) });
        const j = await r.json(); this.toast(j.message, r.ok ? "ok" : "erro");
      };
      bt.append(b);
    }
    const fz = this.dev.querySelector(".fases")!;
    for (const n of [1, 2, 3, 4]) { const b = el("button", "", `F${n}`); b.onclick = () => this.d.setVillagePhase?.(n); fz.append(b); }
  }
}

function descricao(sp: any, p: PageSnap) {
  const f = sp.ficha ?? {};
  const social: Record<string, string> = { solitary: "solitário", pack: "vive em matilha", small_flock: "anda em pequenos bandos", small_family_group: "vive em pequenos grupos familiares", small_social_group: "vive em pequenos grupos", defensive_herd: "forma manadas defensivas" };
  const parts = [`${p.nome}: ${sp.papel === "predador" ? "predador" : "presa"} ${f.porte ? `(${f.porte})` : ""}`.trim()];
  if (f.social) parts.push(social[f.social] ?? f.social.replace(/_/g, " "));
  if (f.dieta?.length) parts.push("alimenta-se de " + f.dieta.slice(0, 4).map((d: string) => d.replace(/_/g, " ")).join(", "));
  return parts.join("; ") + ". Resumo gerado da ficha da espécie (creatures/species); texto de lore ainda não escrito.";
}
