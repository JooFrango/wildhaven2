// Persistência entre sessões: serializa o mundo inteiro (inclusive estados dos RNGs, ledger e memórias).
// Retomar um mundo salvo e continuar produz exatamente a mesma trilha que nunca ter parado.
import { Rng } from './rng.js';
import { criarMundoEco } from './mundo.js';
import { serializarTerreno, desserializarTerreno } from './terreno.js';

const mapa = (m) => [...m.entries()];
const RNGS = ['rngMente', 'rngPercepcao', 'rngCombate'];
// Mapas que as capacidades da V7 criam sob demanda. Um Map vira `{}` no JSON e a memória se perde em
// silêncio, então cada um é listado aqui em vez de depender do spread.
const MAPAS_MEMORIA = ['cupinzeiros'];
const MAPAS_ANIMAL = ['atencaoTermica'];
// A memória de vibração é um Map cujos valores guardam dois Sets; sem tratar os três, o mundo retomado
// quebra em `consolidar` na primeira pista nova.
const salvarVibracoes = (m) => [...m.entries()].map(([k, v]) => [k, { ...v, tipos: [...v.tipos], candidatos: [...v.candidatos] }]);
const carregarVibracoes = (pares) => new Map(pares.map(([k, v]) => [k, { ...v, tipos: new Set(v.tipos), candidatos: new Set(v.candidatos) }]));

export function salvarMundo(mundo) {
  const animais = mundo.animais.map((a) => {
    const o = { ...a, especie: a.especie.id };
    o.memoria = { criaturas: mapa(a.memoria.criaturas), carcacas: mapa(a.memoria.carcacas), experiencias: mapa(a.memoria.experiencias), sons: a.memoria.sons, recursos: a.memoria.recursos };
    for (const k of MAPAS_MEMORIA) if (a.memoria[k]) o.memoria[k] = mapa(a.memoria[k]);
    if (a.memoria.vibracoes) o.memoria.vibracoes = salvarVibracoes(a.memoria.vibracoes);
    for (const k of MAPAS_ANIMAL) if (a[k]) o[k] = mapa(a[k]);
    o.atencao = mapa(a.atencao); o.cooldownRival = mapa(a.cooldownRival);
    o.jaViu = a.jaViu ? [...a.jaViu] : null;
    o.relacoes = a.relacoes ? mapa(a.relacoes) : null;
    // O corpo da serpente guarda uma referência ao terreno; salvar isso duplicaria o relevo por animal.
    if (a.serpente) o.serpente = { ...a.serpente, terreno: undefined };
    for (const r of RNGS) o[r] = a[r].s;
    return o;
  });
  return JSON.parse(JSON.stringify({
    versao: 3, cenarioId: mundo.cenarioId, semente: mundo.semente, t: mundo.t, tick: mundo.tick, relogio: mundo.relogio,
    terreno: serializarTerreno(mundo.terreno), cinzas: Array.from(mundo.terreno.cinzas),
    animais, vivos: mundo.vivos.map((a) => a.id), grupos: mapa(mundo.grupos), carcacas: mundo.carcacas, conflitos: mundo.conflitos,
    marcas: mundo.marcas, dispersos: mundo.dispersos, sons: mundo.sons, fogo: mapa(mundo.fogo), pontosAgua: mundo.pontosAgua,
    ledger: [...mundo.ledger], perseguicoes: mundo.perseguicoes, perseguicoesAtivas: mapa(mundo.perseguicoesAtivas),
    contadores: { e: mundo.contadorEventos, c: mundo.contadorConflitos, g: mundo.contadorGrupos, a: mundo.contadorAnimais, k: mundo.contadorCarcacas },
    hash: mundo.hash, rng: mundo.rng.s, microfauna: mundo.microfauna, metricas: mundo.metricas, acumNivel2: mundo.acumNivel2, ultimaHoraN3: mundo.ultimaHoraN3,
    climaAtivo: mundo.climaAtivo ?? null, climaEvento: mundo.climaEvento ?? null, cupinzeiros: mundo.cupinzeiros ?? null,
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
  m.climaAtivo = salvo.climaAtivo ?? null; m.climaEvento = salvo.climaEvento ?? null;
  if (salvo.cupinzeiros) m.cupinzeiros = salvo.cupinzeiros;
  m.rng = new Rng(0); m.rng.s = salvo.rng;
  m.contadorEventos = salvo.contadores.e; m.contadorConflitos = salvo.contadores.c; m.contadorGrupos = salvo.contadores.g; m.contadorAnimais = salvo.contadores.a; m.contadorCarcacas = salvo.contadores.k;
  m.animais = salvo.animais.map((o) => {
    const a = { ...o, especie: config.especies[o.especie] };
    a.memoria = { criaturas: new Map(o.memoria.criaturas), carcacas: new Map(o.memoria.carcacas), experiencias: new Map(o.memoria.experiencias), sons: o.memoria.sons, recursos: o.memoria.recursos };
    for (const k of MAPAS_MEMORIA) if (o.memoria[k]) a.memoria[k] = new Map(o.memoria[k]);
    if (o.memoria.vibracoes) a.memoria.vibracoes = carregarVibracoes(o.memoria.vibracoes);
    for (const k of MAPAS_ANIMAL) if (o[k]) a[k] = new Map(o[k]);
    if (a.serpente) a.serpente.terreno = m.terreno;
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
