// Persistência entre sessões: serializa o mundo inteiro (inclusive estados dos RNGs, ledger e memórias).
// Retomar um mundo salvo e continuar produz exatamente a mesma trilha que nunca ter parado.
import { Rng } from './rng.js';
import { criarMundoEco } from './mundo.js';
import { serializarTerreno, desserializarTerreno } from './terreno.js';

const mapa = (m) => [...m.entries()];
const RNGS = ['rngMente', 'rngPercepcao', 'rngCombate'];

export function salvarMundo(mundo) {
  const animais = mundo.animais.map((a) => {
    const o = { ...a, especie: a.especie.id };
    o.memoria = { criaturas: mapa(a.memoria.criaturas), carcacas: mapa(a.memoria.carcacas), experiencias: mapa(a.memoria.experiencias), sons: a.memoria.sons, recursos: a.memoria.recursos };
    o.atencao = mapa(a.atencao); o.cooldownRival = mapa(a.cooldownRival);
    o.jaViu = a.jaViu ? [...a.jaViu] : null;
    o.relacoes = a.relacoes ? mapa(a.relacoes) : null;
    for (const r of RNGS) o[r] = a[r].s;
    return o;
  });
  return JSON.parse(JSON.stringify({
    versao: 2, cenarioId: mundo.cenarioId, semente: mundo.semente, t: mundo.t, tick: mundo.tick, relogio: mundo.relogio,
    terreno: serializarTerreno(mundo.terreno), cinzas: Array.from(mundo.terreno.cinzas),
    animais, vivos: mundo.vivos.map((a) => a.id), grupos: mapa(mundo.grupos), carcacas: mundo.carcacas, conflitos: mundo.conflitos,
    marcas: mundo.marcas, dispersos: mundo.dispersos, sons: mundo.sons, fogo: mapa(mundo.fogo), pontosAgua: mundo.pontosAgua,
    ledger: [...mundo.ledger], perseguicoes: mundo.perseguicoes, perseguicoesAtivas: mapa(mundo.perseguicoesAtivas),
    contadores: { e: mundo.contadorEventos, c: mundo.contadorConflitos, g: mundo.contadorGrupos, a: mundo.contadorAnimais, k: mundo.contadorCarcacas },
    hash: mundo.hash, rng: mundo.rng.s, microfauna: mundo.microfauna, metricas: mundo.metricas, acumNivel2: mundo.acumNivel2, ultimaHoraN3: mundo.ultimaHoraN3,
    opcoes: { ...mundo.opcoes },
  }));
}

export function carregarMundo(config, salvo) {
  const cenario = config.cenarios[salvo.cenarioId];
  // Cria um mundo "vazio" do mesmo cenário (para instalar a API) e substitui o estado.
  const m = criarMundoEco(config, { ...cenario, populacoes: [] }, salvo.semente, salvo.opcoes);
  m.terreno = desserializarTerreno(salvo.terreno);
  m.terreno.cinzas = Float32Array.from(salvo.cinzas);
  Object.assign(m, { t: salvo.t, tick: salvo.tick, relogio: salvo.relogio, carcacas: salvo.carcacas, conflitos: salvo.conflitos, marcas: salvo.marcas, dispersos: salvo.dispersos, sons: salvo.sons, pontosAgua: salvo.pontosAgua, perseguicoes: salvo.perseguicoes, hash: salvo.hash, microfauna: salvo.microfauna, metricas: salvo.metricas, acumNivel2: salvo.acumNivel2, ultimaHoraN3: salvo.ultimaHoraN3 });
  m.fogo = new Map(salvo.fogo);
  m.ledger = new Set(salvo.ledger);
  m.perseguicoesAtivas = new Map(salvo.perseguicoesAtivas);
  m.grupos = new Map(salvo.grupos);
  m.rng = new Rng(0); m.rng.s = salvo.rng;
  m.contadorEventos = salvo.contadores.e; m.contadorConflitos = salvo.contadores.c; m.contadorGrupos = salvo.contadores.g; m.contadorAnimais = salvo.contadores.a; m.contadorCarcacas = salvo.contadores.k;
  m.animais = salvo.animais.map((o) => {
    const a = { ...o, especie: config.especies[o.especie] };
    a.memoria = { criaturas: new Map(o.memoria.criaturas), carcacas: new Map(o.memoria.carcacas), experiencias: new Map(o.memoria.experiencias), sons: o.memoria.sons, recursos: o.memoria.recursos };
    a.atencao = new Map(o.atencao); a.cooldownRival = new Map(o.cooldownRival);
    a.jaViu = o.jaViu ? new Set(o.jaViu) : undefined;
    a.relacoes = o.relacoes ? new Map(o.relacoes) : undefined;
    for (const r of RNGS) { a[r] = new Rng(0); a[r].s = o[r]; }
    return a;
  });
  const porId = new Map(m.animais.map((a) => [a.id, a]));
  m.vivos = salvo.vivos.map((id) => porId.get(id));
  m.porId = new Map(m.vivos.map((a) => [a.id, a]));
  m.mortos = new Map(m.animais.filter((a) => !a.vivo).map((a) => [a.id, a]));
  m.eventos = [];
  return m;
}
