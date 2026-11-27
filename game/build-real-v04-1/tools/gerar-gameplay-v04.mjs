// Gera data/gameplay-provisorio-v04.json: as 8 espécies da V02 (valores preservados) + todas as espécies com
// GLB ANIMADO e dados suficientes (ficha em creatures/species e/ou config do laboratório labs/ia-criaturas).
// Fontes por campo (registradas em cada espécie): percepção/locomoção/massa da ficha; subsolo/voo/ataques/saúde
// do laboratório; modo de locomoção também inferido dos clipes do GLB (mesma regra de src/eco/capacidades.js);
// biomas = classes de data/biomas-v04.json cujos habitats batem com os da ficha. Densidade, hp, dano e itens
// seguem as fórmulas PROVISÓRIAS da V02 — tudo marcado `provisorio`. Espécies sem dados ou sem animação vão
// para `pendentes` com o motivo (nunca viram modelo genérico).
//   node tools/gerar-gameplay-v04.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const V04 = path.resolve(HERE, "..");
const v02 = JSON.parse(fs.readFileSync(path.join(V04, "data/gameplay-provisorio-v02.json"), "utf8"));
const BIOMAS = JSON.parse(fs.readFileSync(path.join(V04, "data/biomas-v04.json"), "utf8"));
const LAB = path.join(REPO, "labs/ia-criaturas/config/eco/especies");
const CRE = path.join(REPO, "assets/models/creatures");
const out = structuredClone(v02);
out.versaoDados = "v04"; // schema continua wildhaven.gameplay.provisorio.v1 (campos V04 são aditivos)
out.status = "PROVISÓRIO V04 — 8 espécies da V02 preservadas + espécies derivadas de fichas, laboratório de IA e GLBs; nenhum número é regra aprovada";
out.origemDosValores = { ...v02.origemDosValores, v04: "tools/gerar-gameplay-v04.mjs (fichas + labs/ia-criaturas/config/eco/especies + clipes dos GLBs + data/biomas-v04.json)" };

const walk = d => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
function glbJson(f) {
  try { const b = fs.readFileSync(f); if (b.readUInt32LE(0) !== 0x46546c67) return null; return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")); } catch { return null; }
}
const ver = f => { const m = /(?:^|[-_/])v(\d{1,2})(?:[-_/.]|$)/i.exec(f); return m ? Number(m[1]) : 0; };
/** GLB animado mais recente e seus LODs (mesma pasta/prefixo). */
function assetsOf(id) {
  const files = walk(path.join(CRE, id)).filter(f => f.endsWith(".glb"));
  const anim = files.map(f => ({ f, j: glbJson(f) })).filter(x => x.j?.animations?.length);
  if (!anim.length) return null;
  anim.sort((a, b) => ver(path.relative(CRE, b.f)) - ver(path.relative(CRE, a.f)) || (/LOD0/i.test(b.f) ? 1 : 0) - (/LOD0/i.test(a.f) ? 1 : 0) || b.j.animations.length - a.j.animations.length);
  const best = anim[0];
  const lodOf = n => { const c = best.f.replace(/LOD0/i, "LOD" + n); return c !== best.f && fs.existsSync(c) && glbJson(c)?.animations?.length ? c : null; };
  const lods = [best.f, lodOf(1), lodOf(2)].filter(Boolean).map(f => path.relative(REPO, f).split(path.sep).join("/"));
  const clips = best.j.animations.map(a => a.name);
  const imgs = walk(path.dirname(best.f)).concat(walk(path.join(CRE, id))).filter(f => /\.(png|webp|jpe?g)$/i.test(f));
  const retrato = imgs.find(f => /retrato|portrait/i.test(f)) ?? imgs.find(f => /front|frente|preview|render|beauty|hero/i.test(f) && !/bug|wire|uv/i.test(f)) ?? null;
  const arte = imgs.find(f => /conceit|concept|arte/i.test(f)) ?? null;
  return { lods, clips, ossos: (best.j.skins ?? []).reduce((s, k) => s + k.joints.length, 0), retrato: retrato ? path.relative(REPO, retrato) : null, arte: arte ? path.relative(REPO, arte) : null };
}
/** Mesma regra do laboratório (src/eco/capacidades.js) + campos explícitos do config. */
function locomocao(clips, lab) {
  const n = new Set(clips.map(c => c.toLowerCase()));
  if (lab?.subsolo || n.has("swim_sand") || n.has("glide_shallow")) return "subterraneo_areia";
  if (lab?.voo || ((n.has("fly") || n.has("flying") || n.has("fly_loop")) && !n.has("walk"))) return lab?.voo ? "voador" : "voador";
  if (n.has("swim") && !n.has("walk")) return "aquatico";
  return "terrestre";
}
const classesPorHabitat = habs => Object.entries(BIOMAS.classes).filter(([, c]) => habs.some(h => c.habitats.includes(h))).map(([k]) => k);
const rotulosDe = classes => Object.entries(BIOMAS.rotulos).filter(([, cs]) => cs.some(c => classes.includes(c))).map(([r]) => r);
/** Habitats a partir do README/fonte (espécies só do laboratório): palavras-chave, sempre registradas. */
function habitatsDeTexto(t) {
  const s = t.toLowerCase(), h = [];
  if (/\b(dunas?|dunes?|erg|areia|sand)\b|mar de dunas/.test(s)) h.push("dunes", "desert");
  if (/deserto|desert|cânion|canion|canyon|rochos/.test(s)) h.push("rocky_desert");
  if (/\b(savana|savanna)\b/.test(s)) h.push("savanna");
  if (/floresta temperada|temperate forest/.test(s)) h.push("temperate_forest");
  if (/selva|jungle|tropical/.test(s)) h.push("tropical_forest");
  if (/pântano|pantano|swamp|brejo/.test(s)) h.push("swamp");
  if (/\b(neve|snow|gelo|glacial|ice|tundra)\b/.test(s)) h.push("snow");
  return [...new Set(h)];
}
const especiesV02 = new Set(Object.keys(v02.especies));
const pendentes = [];
const fichas = new Map(fs.readdirSync(path.join(REPO, "creatures/species")).filter(f => f.endsWith(".json") && f !== "schema.json").map(f => { const j = JSON.parse(fs.readFileSync(path.join(REPO, "creatures/species", f), "utf8")); return [j.id ?? f.slice(0, -5), j]; }));
const labs = new Map(fs.readdirSync(LAB).filter(f => f.endsWith(".json")).map(f => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(LAB, f), "utf8"))]));
const dirs = fs.readdirSync(CRE).filter(d => fs.statSync(path.join(CRE, d)).isDirectory());
const PACOTE = /optimization|fauna-v|herbivores|megafauna|reptiles|wildlife|specialists|detritivoros|threejs-source|pilot|^rocantraz-v|^talvero-v|^rambrel_chapadas/;
for (const id of dirs.filter(d => !PACOTE.test(d)).sort()) {
  const key = id.replace(/-/g, "_");
  const f = fichas.get(id) ?? fichas.get(key) ?? null;
  const lab = labs.get(id) ?? null;
  const a = assetsOf(id);
  if (!a) { pendentes.push({ id, motivo: "sem GLB animado publicado (estático ou só fonte)", ficha: !!f, laboratorio: !!lab }); continue; }
  if (!f && !lab) { pendentes.push({ id, motivo: "GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat", clipes: a.clips.length }); continue; }
  const loc = locomocao(a.clips, lab);
  const readme = walk(path.join(CRE, id)).filter(x => /README.*\.md$/i.test(x)).map(x => fs.readFileSync(x, "utf8")).join("\n");
  const habs = f?.habitats ?? habitatsDeTexto(`${lab?._fonteFicha ?? ""} ${readme}`);
  const classes = classesPorHabitat(habs);
  if (!classes.length) { pendentes.push({ id, motivo: `habitats sem classe de bioma: ${JSON.stringify(habs)}` }); continue; }
  const biomas = rotulosDe(classes);
  if (especiesV02.has(key) || especiesV02.has(id)) {
    const e = out.especies[especiesV02.has(key) ? key : id];
    Object.assign(e, { locomocao: loc, classesBioma: classes, lods: e.lods ?? a.lods, clipes: a.clips.length, retrato: e.retrato ?? a.retrato, arteConceitual: a.arte });
    continue; // V02: biomas, números e asset preservados
  }
  // massa: as fichas usam esquemas diferentes (body.massMin/MaxKg, body.adultMassTargetKg, mass [min,max])
  const avg = v => (Array.isArray(v) ? (v[0] + v[v.length - 1]) / 2 : typeof v === "number" ? v : null);
  const massaF = f?.body?.massMinKg != null ? (f.body.massMinKg + (f.body.massMaxKg ?? f.body.massMinKg)) / 2 : avg(f?.body?.adultMassTargetKg) ?? avg(f?.mass) ?? avg(f?.body?.massKg) ?? null;
  const massaL = lab?.corpo?.massaKg ? (lab.corpo.massaKg[0] + lab.corpo.massaKg[1]) / 2 : null;
  const massa = massaF ?? massaL ?? 20;
  const predador = lab ? /carniv|predador/.test(lab.papel ?? "") : /carniv|predator|hunter/.test(String(f?.category ?? "")) || (f?.diet ?? []).some(d => /herbivore|vertebrate|prey|meat|carrion/.test(d));
  const v = f?.perception?.vision ?? {}, l = f?.locomotion ?? {};
  const social = f?.social?.type ?? lab?.social?.tipo ?? "solitary";
  const grupo = lab?.social?.tamanho ? [lab.social.tamanho[0], lab.social.tamanho[1]] : /herd|group|flock|family|colony|bando|manada/i.test(social) ? [2, 4] : /pair/i.test(social) ? [1, 2] : [1, 1];
  const danoLab = Math.max(0, ...(lab?.combate?.ataques ?? []).map(x => x.dano ?? 0));
  const gruposPorHex = predador ? (massa > 400 ? 1 : 2) : massa > 2000 ? 1 : massa > 200 ? 3 : massa > 20 ? 4 : 6;
  out.especies[key] = {
    nome: f?.name ?? lab?.nome ?? id,
    fonte: [f ? `creatures/species/${id}.json` : null, lab ? `labs/ia-criaturas/config/eco/especies/${id}.json` : null].filter(Boolean).join(" + "),
    asset: a.lods[0], lods: a.lods, clipes: a.clips.length, ossos: a.ossos, retrato: a.retrato, arteConceitual: a.arte,
    aprovacao: f?.status ?? lab?.balanceamento?.status ?? "sem status", provisorio: true,
    papel: predador ? "predador" : "presa",
    hp: Math.round(lab?.saude?.max ?? 8 + 6 * Math.sqrt(massa)),
    dano: predador ? Math.round(danoLab ? danoLab / 4 : 2 + 1.1 * Math.sqrt(massa)) : 0,
    massaKg: Math.round(massa),
    andarMps: l.walkMps ?? lab?.movimento?.andar ?? 1.2, correrMps: l.sprintMps ?? lab?.movimento?.corrida ?? 4, correrMaxS: l.maxSprintSeconds ?? lab?.movimento?.resistenciaSeg ?? 8,
    visaoMovimentoM: v.detectMovingTargetM ?? lab?.percepcao?.visao?.alcance ?? 30, visaoParadoM: v.detectStillTargetM ?? Math.round((lab?.percepcao?.visao?.alcance ?? 30) * 0.4), audicaoM: f?.perception?.hearing?.detectionRangeM ?? lab?.percepcao?.audicao?.alcance ?? 30,
    alcanceAtaqueM: predador ? Math.max(1.2, Math.min(4, Math.max(...(lab?.combate?.ataques ?? [{ alcance: (f?.body?.heightMaxM ?? 1) * 1.6 }]).map(x => x.alcance ?? 1.5)))) : 1,
    recargaAtaqueS: 1.6, grupo, gruposPorHex,
    itens: [{ id: `pele_${key}`, nome: `Pele de ${f?.name ?? lab?.nome ?? id}` }, { id: `carne_${key}`, nome: `Carne de ${f?.name ?? lab?.nome ?? id}` }],
    itensProvisorios: "item 8 (drops canônicos)", biomas, classesBioma: classes, habitats: habs,
    raioForrageioM: predador ? 450 : 200, pontoCegoTraseiroGraus: v.rearBlindSpotDeg ?? 60,
    densidadeProvisoria: `${gruposPorHex} grupos por hex (provisório, por massa e papel)`,
    dieta: f?.diet ?? Object.values(lab?.dieta ?? {}).flat().filter(x => typeof x === "string"),
    locomocao: loc, atividade: lab?.atividade ?? f?.activity ?? null,
    subsolo: lab?.subsolo ? { profundidadeMaxM: lab.subsolo.profundidadeMaxM, cruzeiroMps: lab.subsolo.cruzeiro, arranqueMps: lab.subsolo.arranque, mergulhoS: lab.subsolo.mergulhoSeg, emergenciaS: lab.subsolo.emergenciaSeg, vibracaoM: lab.percepcao?.vibracao?.alcance ?? 120 } : null,
    voo: lab?.voo ? { ...lab.voo } : null,
  };
}
out.pendentes = pendentes;
// meios: rótulos de bioma com areia (subsolo das dunas); vem da classificação de data/biomas-v04.json
out.meios = { provisorio: true, areiaRotulos: rotulosDe(["deserto_dunas", "deserto_rochoso", "costa_arenosa"]) };
out.spawn = { ...v02.spawn, nota: "V04: distribuição por classe de bioma (data/biomas-v04.json); terrestres em célula caminhável seca; subterrâneos só em classes de deserto; voadores pousam em célula caminhável" };
fs.writeFileSync(path.join(V04, "data/gameplay-provisorio-v04.json"), JSON.stringify(out, null, 1));
const ids = Object.keys(out.especies);
console.log(JSON.stringify({ especies: ids.length, novas: ids.filter(i => !especiesV02.has(i)).length, porLocomocao: ids.reduce((m, i) => ((m[out.especies[i].locomocao ?? "terrestre"] = (m[out.especies[i].locomocao ?? "terrestre"] ?? 0) + 1), m), {}), pendentes: pendentes.length }));
