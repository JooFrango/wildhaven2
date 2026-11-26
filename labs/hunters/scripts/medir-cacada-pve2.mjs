#!/usr/bin/env node
// Caçada PvE (jogador-espada: Hunter de espada contra o Varrisco real), sem renderizador. Compara o PvE v01 aprovado
// com o modo experimental do rig v13 (pve2), mesmas sementes e mesmo tempo.
//   node scripts/medir-cacada-pve2.mjs [--modo pve1|pve2] [--sementes 7,17,23] [--segundos 120]
// Mede, para o Hunter: golpes iniciados, golpes que feriram, golpes que erraram, esquivas, distância ao Varrisco
// (média e fração do tempo com os corpos sobrepostos) e o desfecho.
//   --monstro (exige pve2): Varrisco da linha MH (?mh=1). Acrescenta, para o Varrisco: ataques por minuto,
// golpes por tipo, acertos, dano causado, janelas de punição abertas/punidas, raiva, cansaço, rugidos, quedas,
// vacilos e quantas vezes cedeu no conflito ecológico.
import {readFile} from 'node:fs/promises';
import {carregarHunterLab} from '../src/node-hunters.mjs';
import {criarMundoHunters, passoHunters} from '../src/mundo-hunters.js';
import {usarPve1, usarPve2} from '../src/trajetoria-arma.js';
import {usarMonstro} from '../src/monstro-varrisco.js';
import {capsula} from '../../ia-criaturas/src/eco/combate.js';

const arg = (k, d) => {const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d;};
const modo = arg('modo', 'pve2'), sementes = String(arg('sementes', '7,17,23')).split(',').map(Number), segundos = Number(arg('segundos', 120));
const monstro = process.argv.includes('--monstro') && modo === 'pve2';
const LAB = await carregarHunterLab(), lj = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const CEN = (await lj('../config/cenarios.json')).find((c) => c.id === 'jogador-espada');
const NAV = await lj('../../hunters-codex/assets/terrain-nav.json'), GEO = await lj('../../hunters-codex/assets/terrain-geometry.json');
usarPve1(true); usarPve2(modo === 'pve2'); usarMonstro(monstro);

// Métricas do Varrisco (valem com e sem --monstro, para comparar).
function medirVarrisco(m, v, h) {
  const E = m.eventos, de = (tipo, f = () => true) => E.filter((e) => e.tipo === tipo && f(e));
  const ataques = de('ataque_inicio', (e) => e.id === v.id), acertos = de('ferimento', (e) => e.atacante === v.id && e.id === h.id);
  const porTipo = {}; for (const e of ataques) porTipo[e.ataque] = (porTipo[e.ataque] ?? 0) + 1;
  const golpesHunter = de('ferimento', (e) => e.atacante === h.id && e.id === v.id);
  const janelas = de('monstro_golpe', (e) => e.id === v.id).map((e) => e.janela).concat(de('monstro_queda', (e) => e.id === v.id).map((e) => [e.t, e.ate]));
  const punidas = janelas.filter(([a, b]) => golpesHunter.some((g) => g.t >= a && g.t <= b + .05)).length;
  const inicio = de('monstro_aggro', (e) => e.id === v.id)[0]?.t ?? E.find((e) => e.id === v.id && /tatica_estado|conflito_inicio/.test(e.tipo))?.t ?? 0;
  const minutos = Math.max(1 / 60, (m.t - inicio) / 60);
  return {ataques: ataques.length, ataquesPorMin: +(ataques.length / minutos).toFixed(1), tipos: Object.keys(porTipo).length, porTipo,
    acertos: acertos.length, errou: de('golpe_errou', (e) => e.id === v.id).length, danoCausado: +acertos.reduce((s, e) => s + e.dano, 0).toFixed(0),
    janelas: janelas.length, janelasPunidas: punidas, rugidos: de('monstro_rugido', (e) => e.id === v.id).length,
    raivas: de('monstro_raiva', (e) => e.id === v.id).length, cansacos: de('monstro_cansado', (e) => e.id === v.id).length,
    quedas: de('monstro_queda', (e) => e.id === v.id).length, vacilos: de('monstro_vacilo', (e) => e.id === v.id).length,
    cedeu: de('conflito_fim', (e) => e.id === v.id && e.motivo === 'cedeu').length,
    hunterForaEm: de('hunter_rendicao', (e) => e.id === h.id).concat(de('hunter_incapacitado', (e) => e.id === h.id))[0]?.t ?? null, hunterHpPct: +(100 * h.saude.hp / h.saude.hpMax).toFixed(0), hpFinalPct: +(100 * Math.max(0, v.saude.hp) / v.saude.hpMax).toFixed(0)};
}

// Folga entre as cápsulas do corpo (negativa = sobreposição), no plano.
function folga(a, b) {
  const A = capsula(a), B = capsula(b), passos = 8;
  let min = Infinity;
  for (let i = 0; i <= passos; i++) for (let j = 0; j <= passos; j++) {
    const u = -A.meio + 2 * A.meio * i / passos, v = -B.meio + 2 * B.meio * j / passos;
    const d = Math.hypot(A.cx + A.ux * u - B.cx - B.ux * v, A.cy + A.uy * u - B.cy - B.uy * v) - A.r - B.r;
    min = Math.min(min, d);
  }
  return min;
}

const total = [];
for (const semente of sementes) {
  const cen = structuredClone(CEN); cen.terreno.dados = NAV; cen.geometriaPrecisa = GEO;
  const m = criarMundoHunters({...LAB.cfg, cenarios: {...LAB.cfg.cenarios, [cen.id]: cen}}, cen, semente, {fichaHunter: LAB.fichaHunter, equipamentos: LAB.equipamentos});
  const h = m.hunters[0], v0 = m.animais.find((x) => x.especie.id === 'varrisco');
  let n = 0, somaDist = 0, sobreposto = 0, perto = 0;
  while (m.t < segundos && !m.resultado) {
    passoHunters(m);
    const v = m.animais.find((x) => x.especie.id === 'varrisco' && x.vivo);
    if (v && h.vivo) {const f = folga(h, v); n++; somaDist += f; if (f < 0) sobreposto++; if (f < 0.15) perto++;}
  }
  const ev = (tipo, filtro = () => true) => m.eventos.filter((e) => e.tipo === tipo && filtro(e)).length;
  total.push({semente, segundos: +m.t.toFixed(1), desfecho: m.resultado?.motivo ?? null,
    golpes: ev('ataque_inicio', (e) => e.id === h.id), feriu: ev('ferimento', (e) => e.atacante === h.id),
    errou: ev('golpe_errou', (e) => e.id === h.id), esquivas: ev('hunter_esquiva_tatica', (e) => e.id === h.id),
    ferido: ev('ferimento', (e) => e.id === h.id),
    folgaMediaM: +(somaDist / Math.max(1, n)).toFixed(2), tempoSobrepostoPct: +(100 * sobreposto / Math.max(1, n)).toFixed(1),
    tempoColadoPct: +(100 * perto / Math.max(1, n)).toFixed(1), varrisco: medirVarrisco(m, v0, h)});
}
console.log(JSON.stringify({modo, monstro, cenario: 'jogador-espada', total}, null, 1));
