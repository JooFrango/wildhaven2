// Gera data/gameplay-provisorio-v02.json a partir da v01 + fichas reais das espécies (creatures/species).
// Tudo o que este script deriva é PROVISÓRIO e fica marcado como tal: percepção e locomoção vêm das
// fichas; hp/dano/itens/densidade são fórmulas provisórias até a decisão do diretor (itens 8 e 14).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const v01 = JSON.parse(fs.readFileSync(path.join(REPO, "game/build-real-v02/data/gameplay-provisorio-v01.json"), "utf8"));
const out = structuredClone(v01);
out.status = "PROVISÓRIO V02 — derivado da v01 + fichas de creatures/species; nenhum número é regra aprovada";
out.origemDosValores = { ...v01.origemDosValores, v02: "tools/gerar-gameplay-v02.mjs (fichas: percepção/locomoção/massa; fórmulas provisórias: hp, dano, itens, densidade)" };

// armadilhas: nomes do diretor (V02): Presa de Ferro e Laço de Raiz
out.armadilhas.tipos = [
  { id: "laco_de_raiz", nome: "Laço de Raiz", imobilizaS: v01.armadilhas.tipos.find(t => t.id === "laco").imobilizaS, massaMaxKg: v01.armadilhas.tipos.find(t => t.id === "laco").massaMaxKg },
  { id: "presa_de_ferro", nome: "Presa de Ferro", imobilizaS: v01.armadilhas.tipos.find(t => t.id === "rede").imobilizaS, massaMaxKg: v01.armadilhas.tipos.find(t => t.id === "rede").massaMaxKg },
];
out.armadilhas.decisao = "item 10 (catálogo de armadilhas) — nomes V02 do diretor; valores herdados da v01 (laco→laco_de_raiz, rede→presa_de_ferro)";

// armas: os clipes reais do Hunter PvE v01 cobrem espada, lança, espadão e desarmado
out.combate.armas = {
  espada: v01.combate.armas.espada,
  lanca: { ataque: 5, bonusPorNivel: 0.45, alcanceM: 2.6, provisorio: true },
  espadao: { ataque: 8.5, bonusPorNivel: 0.6, alcanceM: 2.2, provisorio: true },
};
out.combate.armasNota = "lança e espadão: PROVISÓRIOS (existem clipes spear_*/greatsword_* no hunter_pve_v01); ataque/bonus sem aprovação";

const NOVAS = {
  silvarano: { papel: "presa", gruposPorHex: 4, raio: 220 },
  cavoru: { papel: "presa", gruposPorHex: 5, raio: 200 },
  torvalho: { papel: "presa", gruposPorHex: 3, raio: 320 },
  tufrilo: { papel: "presa", gruposPorHex: 6, raio: 120 },
  nharuk: { papel: "predador", gruposPorHex: 2, raio: 600 },
  boscaranha: { papel: "predador", gruposPorHex: 3, raio: 140 },
};
const BIOMA = { temperate_forest: ["temperate forest", "forested mountain"], temperate_forest_edge: ["temperate forest", "temperate forest to grassland", "temperate forest -> open plains"], temperate_grassland: ["entirely temperate plains (no transition)", "temperate prairie north of river + golden fantasy savanna south"], tropical_rainforest: ["true tropical jungle"] };
const asset = id => {
  const dirs = [path.join(REPO, "assets/models/creatures", id), path.join(REPO, "labs/ia-criaturas/animacoes/v4", id)];
  const found = [];
  for (const d of dirs) { if (!fs.existsSync(d)) continue; (function w(p) { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); if (e.isDirectory()) w(f); else if (/anim.*\.glb$|animated.*\.glb$/i.test(e.name) && !/LOD[12]/.test(e.name)) found.push(f); } })(d); }
  found.sort((a, b) => (/assets\/models/.test(b) ? 1 : 0) - (/assets\/models/.test(a) ? 1 : 0) || b.localeCompare(a));
  return found[0] ? path.relative(REPO, found[0]) : null;
};
for (const [id, cfg] of Object.entries(NOVAS)) {
  const f = JSON.parse(fs.readFileSync(path.join(REPO, "creatures/species", id + ".json"), "utf8"));
  const massa = ((f.body?.massMinKg ?? 10) + (f.body?.massMaxKg ?? 10)) / 2;
  const v = f.perception?.vision ?? {}, l = f.locomotion ?? {};
  const social = f.social?.type ?? "solitary";
  const grupo = /herd|group|flock|family|colony|bando|manada/i.test(social) ? [2, 4] : /pair/i.test(social) ? [1, 2] : [1, 1];
  const biomas = [...new Set((f.habitats ?? []).flatMap(h => BIOMA[h] ?? []))];
  out.especies[id] = {
    nome: f.name, fonte: `creatures/species/${id}.json (percepção, locomoção e massa da ficha)`, asset: asset(id), aprovacao: f.status ?? "sem status",
    papel: cfg.papel, hp: Math.round(8 + 6 * Math.sqrt(massa)), dano: cfg.papel === "predador" ? Math.round(2 + 1.1 * Math.sqrt(massa)) : 0, massaKg: Math.round(massa),
    provisorio: true, andarMps: l.walkMps ?? 1.2, correrMps: l.sprintMps ?? 4, correrMaxS: l.maxSprintSeconds ?? 8,
    visaoMovimentoM: v.detectMovingTargetM ?? 30, visaoParadoM: v.detectStillTargetM ?? 12, audicaoM: f.perception?.hearing?.detectionRangeM ?? 30,
    alcanceAtaqueM: cfg.papel === "predador" ? Math.max(1.2, Math.min(2.5, (f.body?.heightMaxM ?? 1) * 1.6)) : 1, recargaAtaqueS: 1.6,
    grupo, gruposPorHex: cfg.gruposPorHex,
    itens: [{ id: `pele_${id}`, nome: `Pele de ${f.name}` }, { id: `carne_${id}`, nome: `Carne de ${f.name}` }],
    itensProvisorios: "item 8 (drops canônicos)", biomas, raioForrageioM: cfg.raio,
    pontoCegoTraseiroGraus: v.rearBlindSpotDeg ?? 60,
    densidadeProvisoria: `${cfg.gruposPorHex} grupos por hex (provisório)`,
    dieta: f.diet ?? [],
  };
}
// necessidades e comportamento (V02, provisório): fome/sede/energia, ciclo de descanso, carcaças
out.necessidades = {
  provisorio: true, decisao: "IA de criaturas V02 — sem aprovação de balanceamento",
  fomeCheiaS: 2400, sedeCheiaS: 1500, energiaDuracaoS: 3600, recuperacaoEnergiaS: 700,
  limiarFome: 0.6, limiarSede: 0.65, limiarCansaco: 0.25, buscaAguaRaioM: 260, carcacaDuracaoS: 1500,
  presasDescansamANoite: true, territorioFator: 2.0,
};
out.relevancia = { provisorio: true, pertoM: 450, medioM: 1500, longeM: 4500, passoMedio: 3, passoLonge: 15, orcamentoAstarPorTick: 14 };
out.spawn.raioSimulacaoDetalhadaM = 1500;
out.spawn.foraDoRaio = "V02: níveis de relevância — perto (todo tick), médio (a cada 3), longe (a cada 15, sem rota detalhada); além disso congelado";
out.clima = {
  provisorio: true, fonte: "labs/ia-criaturas/src/eco/clima.js (V7) — fatores por intensidade 1; V08 não existe no repositório",
  fatores: {
    chuva: { visao: 0.55, audicao: 0.55, olfato: 0.5, locomocao: 0.9, deltaTemperaturaC: -4, apagaRastros: true },
    tempestade: { visao: 0.45, audicao: 0.4, olfato: 0.45, locomocao: 0.85, deltaTemperaturaC: -6, apagaRastros: true },
    areia: { visao: 0.15, audicao: 0.5, olfato: 0.6, locomocao: 0.8, deltaTemperaturaC: -2, apagaRastros: true },
    neve: { visao: 0.6, audicao: 0.8, olfato: 0.8, locomocao: 0.85, deltaTemperaturaC: -8, apagaRastros: false },
    nevasca: { visao: 0.3, audicao: 0.7, olfato: 0.7, locomocao: 0.65, deltaTemperaturaC: -14, apagaRastros: true },
  },
  noiteVisao: 0.5, cicloLunarCiclos: 8, frenteIntervaloS: 900, frenteVidaS: [1800, 5400], megatempestadeChance: 0.06, atualizacaoS: 10,
};
// LODs reais (optimized v02/v03 com os mesmos clipes) — o cliente troca por distância/tamanho projetado
const LODS = {
  folhisco: "assets/models/creatures/folhisco/folhisco-optimized-v02-LOD{n}.glb",
  lobrapedra: "assets/models/creatures/lobrapedra/v02/lobrapedra-optimized-v02-LOD{n}.glb",
  silvarano: "assets/models/creatures/silvarano/silvarano-temperate-optimized-v02-LOD{n}.glb",
  cavoru: "assets/models/creatures/cavoru/cavoru-forest-optimized-v02-LOD{n}.glb",
  torvalho: "assets/models/creatures/torvalho/torvalho-optimized-v02-LOD{n}.glb",
  tufrilo: "assets/models/creatures/tufrilo/tufrilo-optimized-v02-LOD{n}.glb",
  nharuk: "assets/models/creatures/nharuk/v02/nharuk-temperate-plains-optimized-v03-LOD{n}.glb",
  boscaranha: "assets/models/creatures/boscaranha/boscaranha-optimized-v02-LOD{n}.glb",
};
for (const [id, pat] of Object.entries(LODS)) {
  const files = [0, 1, 2].map(n => pat.replace("{n}", n));
  for (const f of files) if (!fs.existsSync(path.join(REPO, f))) throw Error("LOD ausente " + f);
  out.especies[id].lods = files;
  out.especies[id].asset = files[0];
}
// Bestiário: retrato (render real publicado) e resumo da ficha (porte, dieta, social, comportamentos, habitats)
const RETRATOS = {
  folhisco: "assets/models/creatures/folhisco/folhisco-optimized-v02-real-3d-three-quarter.png",
  lobrapedra: "assets/models/creatures/lobrapedra/lobrapedra-optimized-v02-real-3d-three-quarter.png",
  silvarano: "assets/models/creatures/silvarano/silvarano-temperate-optimized-v02-real-3d-three-quarter.png",
  cavoru: "assets/models/creatures/cavoru/cavoru-forest-optimized-v02-real-3d-three-quarter.png",
  torvalho: "assets/models/creatures/torvalho/torvalho-optimized-v02-real-3d-three-quarter.png",
  tufrilo: "assets/models/creatures/tufrilo/tufrilo-optimized-v02-real-3d-three-quarter.png",
  nharuk: "assets/models/creatures/nharuk/nharuk-temperate-plains-optimized-v03-real-3d-three-quarter.png",
  boscaranha: "assets/models/creatures/boscaranha/boscaranha-optimized-v02-real-3d-three-quarter.png",
};
for (const [id, sp] of Object.entries(out.especies)) {
  const r = RETRATOS[id]; const rp = r && [path.join(REPO, r), path.join(REPO, r.replace(/\/([^/]+)$/, "/v02/$1"))].find(f => fs.existsSync(f));
  sp.retrato = rp ? path.relative(REPO, rp) : null;
  const f = JSON.parse(fs.readFileSync(path.join(REPO, "creatures/species", id + ".json"), "utf8"));
  sp.ficha = { porte: f.body ? `${f.body.heightMinM ?? "?"}–${f.body.heightMaxM ?? "?"} m · ${f.body.massMinKg ?? "?"}–${f.body.massMaxKg ?? "?"} kg` : null, social: f.social?.type ?? null, dieta: (f.diet ?? []).slice(0, 6), comportamentos: (f.behaviors ?? []).slice(0, 10), habitats: f.habitats ?? [], status: f.status ?? null };
}
fs.writeFileSync(path.join(REPO, "game/build-real-v02/data/gameplay-provisorio-v02.json"), JSON.stringify(out, null, 1));
console.log(Object.entries(out.especies).map(([k, v]) => `${k}: ${v.papel} hp${v.hp} ${v.asset}`).join("\n"));
