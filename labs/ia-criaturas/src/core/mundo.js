// Mundo da simulação: passo fixo, ordem determinística (percepção -> decisão -> ação), eventos, trilha e validação.
// É o MESMO código usado pela página visual e pelo simulador sem interface.
import { COMPORTAMENTOS } from './comportamentos/index.js';
import { distancia, limitar, penetracaoCirculoRetangulo, pontoDentroRetangulo } from './geometria.js';
import { arredondar } from './matematica.js';
import { mover } from './movimento.js';
import { atualizarMemoria, perceberAlimentos, perceberCriaturas } from './percepcao.js';
import { criarRng, hashTexto } from './rng.js';

export function criarMundo(config, cenarioId, semente) {
  const cen = config.cenarios[cenarioId];
  if (!cen) throw new Error(`Cenário desconhecido: ${cenarioId}`);
  const rngRaiz = criarRng(Number(semente) >>> 0).derivar(`cenario:${cenarioId}`);
  const terreno = congelar({
    largura: cen.terreno.largura,
    altura: cen.terreno.altura,
    obstaculos: (cen.obstaculos ?? []).map((o) => ({
      bloqueiaVisao: true, bloqueiaMovimento: true, tipo: 'rocha', ...o,
    })),
  });
  const mundo = {
    cenario: cen, cenarioId, semente: Number(semente) >>> 0,
    tick: 0, t: 0, dt: cen.dt ?? 0.1, duracao: cen.duracaoSeg ?? 120,
    terreno,
    alimentos: (cen.alimentos ?? []).map((f) => ({ tipo: 'vegetacao', regeneracaoPorSeg: 0, ...f, maximo: f.quantidade })),
    criaturas: [], eventos: [], decisoes: [], falhas: [], perseguicoes: [], fim: null,
    metricas: { distanciaMinima: {}, ocultoSeg: {}, ocultoAtivo: {} },
  };
  for (const def of cen.criaturas) {
    const especie = config.especies[def.especie];
    if (!especie) throw new Error(`Espécie desconhecida no cenário ${cenarioId}: ${def.especie}`);
    mundo.criaturas.push(criarCriatura(def, especie, rngRaiz.derivar(`criatura:${def.id}`), terreno));
  }
  return mundo;
}

function criarCriatura(def, especie, rng, terreno) {
  const comportamento = COMPORTAMENTOS[especie.comportamento];
  if (!comportamento) throw new Error(`Comportamento desconhecido: ${especie.comportamento}`);
  const raio = especie.corpo.raio, variacao = def.variacaoPos ?? 0;
  const rngPos = rng.derivar('posicao');
  let x = def.x, y = def.y;
  for (let i = 0; i < 30; i++) {
    x = limitar(def.x + rngPos.entre(-variacao, variacao), raio, terreno.largura - raio);
    y = limitar(def.y + rngPos.entre(-variacao, variacao), raio, terreno.altura - raio);
    if (!terreno.obstaculos.some((o) => o.bloqueiaMovimento && pontoDentroRetangulo({ x, y }, o, raio))) break;
  }
  const direcao = typeof def.direcaoGraus === 'number'
    ? (def.direcaoGraus * Math.PI) / 180 + rngPos.entre(-1, 1) * ((def.variacaoDirecaoGraus ?? 0) * Math.PI) / 180
    : rngPos.entre(-Math.PI, Math.PI);
  const n = especie.necessidades;
  return {
    id: def.id, especie, comportamento,
    x, y, direcao, velocidade: 0,
    energia: def.energia ?? n.energiaMax, fome: def.fome ?? 30,
    estado: 'inicio', codigo: null, motivo: 'início do encontro', alvo: null, intencao: null,
    memoria: { criaturas: new Map(), alimentos: new Map() },
    mente: {}, contatos: [], alimentosVistos: [], emContato: new Set(), atencao: new Map(), ocultos: [],
    rng: rng.derivar('percepcao'), rngMente: rng.derivar('mente'), rngAtaque: rng.derivar('ataque'),
    vivo: true, recargaAtaque: 0, colisoes: 0, waypoint: null,
    patrulha: def.patrulha ?? null, ritmoFixo: def.ritmo ?? null,
    perseguicaoAtiva: null, ultimaChave: null,
  };
}

function montarSentidos(c, mundo) {
  return {
    t: mundo.t, dt: mundo.dt,
    eu: {
      id: c.id, x: c.x, y: c.y, direcao: c.direcao, velocidade: c.velocidade,
      energia: c.energia, fome: c.fome, estado: c.estado, especie: c.especie,
      patrulha: c.patrulha, ritmoFixo: c.ritmoFixo,
    },
    contatos: c.contatos.map((k) => ({ ...k })),
    memoria: {
      criaturas: [...c.memoria.criaturas.values()].map((m) => ({ ...m })),
      alimentos: [...c.memoria.alimentos.values()].map((m) => ({ ...m })),
    },
    terreno: mundo.terreno,
    rng: c.rngMente,
  };
}

export function passo(mundo) {
  if (mundo.fim) return false;
  const { dt, terreno } = mundo;
  const vivos = mundo.criaturas.filter((c) => c.vivo);

  // 1. Percepção (todos percebem o estado do início do tick).
  for (const c of vivos) {
    c.contatos = perceberCriaturas(c, vivos, terreno.obstaculos, dt);
    c.alimentosVistos = perceberAlimentos(c, mundo.alimentos, terreno.obstaculos);
    atualizarMemoria(c, c.contatos, c.alimentosVistos, mundo.t);
    registrarOcultos(mundo, c, vivos, dt);
    const agora = new Set();
    for (const k of c.contatos) {
      agora.add(k.id);
      if (!c.emContato.has(k.id)) {
        evento(mundo, 'deteccao', c.id, { alvo: k.id, via: k.via, distancia: arred(k.distancia), relevante: relevante(c, k.especie) });
      }
    }
    for (const id of c.emContato) if (!agora.has(id)) evento(mundo, 'contato_perdido', c.id, { alvo: id });
    c.emContato = agora;
  }

  // 2. Decisão (cérebro só recebe sentidos).
  for (const c of vivos) {
    const intencao = normalizarIntencao(c.comportamento.decidir(montarSentidos(c, mundo), c.mente));
    validarIntencao(mundo, c, intencao);
    aplicarTransicao(mundo, c, intencao);
    c.intencao = intencao;
  }

  // 3. Ação e movimento.
  for (const c of vivos) {
    mover(c, c.intencao, terreno, dt);
    atualizarNecessidades(mundo, c, dt);
    if (c.recargaAtaque > 0) c.recargaAtaque = Math.max(0, c.recargaAtaque - dt);
  }
  for (const c of vivos) if (c.intencao.acao === 'atacar' && c.vivo && !mundo.fim) resolverAtaque(mundo, c);

  for (const f of mundo.alimentos) f.quantidade = Math.min(f.maximo, f.quantidade + f.regeneracaoPorSeg * dt);
  mundo.tick++;
  mundo.t = arred(mundo.tick * dt, 6);
  validarInvariantes(mundo);
  if (!mundo.fim && mundo.t >= mundo.duracao) finalizar(mundo, 'tempo_esgotado');
  return !mundo.fim;
}

const relevante = (c, especieId) => (c.especie.relacoes.presas ?? []).includes(especieId) || (c.especie.relacoes.teme ?? []).includes(especieId);

// Furtividade: mede quando um animal relevante (presa/ameaça) estava dentro do alcance nominal de visão
// e mesmo assim NÃO foi visto — e por quê. Episódios viram eventos `despercebido`; o tempo por motivo vai para métricas.
function registrarOcultos(mundo, c, vivos, dt) {
  const m = mundo.metricas;
  for (const outro of vivos) {
    if (outro === c || !relevante(c, outro.especie.id)) continue;
    const d = distancia(c, outro);
    const par = `${c.id}>${outro.id}`;
    if (d < (m.distanciaMinima[par] ?? Infinity)) m.distanciaMinima[par] = arred(d, 3);
    const oculto = c.ocultos.find((o) => o.id === outro.id);
    const estava = m.ocultoAtivo[par];
    if (oculto) {
      m.ocultoSeg[c.id] ??= {};
      m.ocultoSeg[c.id][oculto.motivo] = arred((m.ocultoSeg[c.id][oculto.motivo] ?? 0) + dt, 3);
      if (!estava) {
        m.ocultoAtivo[par] = { inicio: mundo.t, menorDistancia: d };
        evento(mundo, 'despercebido', c.id, { alvo: outro.id, distancia: arred(d), motivo: oculto.motivo });
      } else if (d < estava.menorDistancia) estava.menorDistancia = d;
    } else if (estava) {
      delete m.ocultoAtivo[par];
    }
  }
}

function normalizarIntencao(i) {
  return {
    estado: i.estado, codigo: i.codigo ?? i.estado, motivo: i.motivo ?? '',
    alvo: i.alvo ?? null, destino: i.destino ?? null, ritmo: i.ritmo ?? 'parado',
    acao: i.acao ?? null, olharPara: i.olharPara ?? null,
  };
}

function aplicarTransicao(mundo, c, i) {
  const antes = c.estado, comp = c.comportamento;
  if (i.estado !== antes) {
    if (comp.estadosFuga.includes(i.estado) && !comp.estadosFuga.includes(antes)) evento(mundo, 'fuga_inicio', c.id, { motivo: i.codigo });
    if (comp.estadosFuga.includes(antes) && !comp.estadosFuga.includes(i.estado)) evento(mundo, 'fuga_fim', c.id, { motivo: i.codigo });
    if (i.estado === 'comendo') evento(mundo, 'comer_inicio', c.id, { alvo: i.alvo?.id });
  }
  if (comp.inicioPerseguicao && i.estado === comp.inicioPerseguicao && !c.perseguicaoAtiva) {
    c.perseguicaoAtiva = { id: c.id, alvo: i.alvo?.id ?? null, inicio: mundo.t };
    evento(mundo, 'perseguicao_inicio', c.id, { alvo: i.alvo?.id });
  }
  if (c.perseguicaoAtiva && !comp.estadosCaca.includes(i.estado)) fecharPerseguicao(mundo, c, i.codigo);
  if (i.codigo.startsWith('desistiu_')) evento(mundo, 'desistencia', c.id, { motivo: i.codigo.replace('desistiu_', '') });

  const chave = `${i.estado}|${i.codigo}|${i.alvo ? i.alvo.id ?? i.alvo.tipo : '-'}`;
  if (chave !== c.ultimaChave) {
    mundo.decisoes.push({ tick: mundo.tick, t: mundo.t, id: c.id, estado: i.estado, codigo: i.codigo, alvo: i.alvo ? i.alvo.id ?? i.alvo.tipo : null, x: arred(c.x, 3), y: arred(c.y, 3), energia: arred(c.energia, 2), motivo: i.motivo });
    c.ultimaChave = chave;
  }
  c.estado = i.estado; c.codigo = i.codigo; c.motivo = i.motivo; c.alvo = i.alvo;
}

function fecharPerseguicao(mundo, c, motivo) {
  const p = c.perseguicaoAtiva;
  p.fim = mundo.t; p.duracao = arred(p.fim - p.inicio, 3); p.motivo = motivo;
  mundo.perseguicoes.push(p);
  evento(mundo, 'perseguicao_fim', c.id, { motivo, duracao: p.duracao });
  c.perseguicaoAtiva = null;
}

function atualizarNecessidades(mundo, c, dt) {
  const n = c.especie.necessidades;
  const frac = c.velocidade / c.especie.movimento.corrida;
  c.energia -= (n.custoBasePorSeg + n.custoCorridaPorSeg * frac * frac) * dt;
  if (c.velocidade < 0.2) c.energia += n.recuperacaoPorSeg * (c.estado === 'descansando' ? 1 : n.fatorRecuperacaoParado ?? 0.5) * dt;
  c.fome += n.fomePorSeg * dt;
  if (c.intencao.acao === 'comer' && c.intencao.alvo) {
    const f = mundo.alimentos.find((a) => a.id === c.intencao.alvo.id);
    if (f && distancia(c, f) <= f.raio + 0.01 && f.quantidade > 0) {
      const q = Math.min(n.comerPorSeg * dt, f.quantidade);
      f.quantidade -= q;
      c.fome -= q * (n.fomePorUnidade ?? 1);
    }
  }
  c.energia = limitar(c.energia, 0, n.energiaMax);
  c.fome = limitar(c.fome, 0, 100);
}

function resolverAtaque(mundo, c) {
  if (c.recargaAtaque > 0) return;
  const atk = c.especie.ataque;
  const alvo = mundo.criaturas.find((x) => x.id === c.intencao.alvo?.id);
  if (!alvo || !alvo.vivo) return;
  const d = distancia(c, alvo);
  c.recargaAtaque = atk.recargaSeg;
  c.energia = Math.max(0, c.energia - (atk.custoEnergia ?? 0));
  if (d > atk.alcance) {
    evento(mundo, 'ataque_fora_alcance', c.id, { alvo: alvo.id, distancia: arred(d, 3) });
    return;
  }
  const acertou = c.rngAtaque.chance(atk.chanceAcerto);
  evento(mundo, 'ataque', c.id, { alvo: alvo.id, distancia: arred(d, 3), acertou });
  if (acertou) {
    alvo.vivo = false; alvo.velocidade = 0; alvo.estado = 'capturado';
    c.fome = Math.max(0, c.fome - (atk.saciedadeCaptura ?? 60));
    evento(mundo, 'captura', c.id, { alvo: alvo.id });
    if (c.perseguicaoAtiva) fecharPerseguicao(mundo, c, 'captura');
    finalizar(mundo, 'captura');
  }
}

function finalizar(mundo, motivo) {
  for (const c of mundo.criaturas) if (c.perseguicaoAtiva) fecharPerseguicao(mundo, c, motivo);
  mundo.fim = { motivo, t: mundo.t };
  evento(mundo, 'fim', null, { motivo });
}

function validarIntencao(mundo, c, i) {
  // Regra central: só reage ao que percebeu (contato atual ou memória).
  if (i.alvo?.tipo === 'criatura' && !c.memoria.criaturas.has(i.alvo.id)) falha(mundo, c, 'reagiu_sem_perceber', `alvo ${i.alvo.id} não está na percepção/memória`);
  if (i.alvo?.tipo === 'alimento' && !c.memoria.alimentos.has(i.alvo.id)) falha(mundo, c, 'alimento_nao_percebido', `alimento ${i.alvo.id} não percebido`);
  if (!i.estado) falha(mundo, c, 'intencao_invalida', 'intenção sem estado');
}

function validarInvariantes(mundo) {
  for (const c of mundo.criaturas) {
    if (![c.x, c.y, c.energia, c.fome, c.direcao, c.velocidade].every(Number.isFinite)) falha(mundo, c, 'valor_invalido', 'NaN/Infinity no estado');
    const r = c.especie.corpo.raio;
    if (c.x < r - 1e-6 || c.y < r - 1e-6 || c.x > mundo.terreno.largura - r + 1e-6 || c.y > mundo.terreno.altura - r + 1e-6) falha(mundo, c, 'fora_do_terreno', `(${c.x}, ${c.y})`);
    for (const o of mundo.terreno.obstaculos) {
      if (!o.bloqueiaMovimento) continue;
      const pen = penetracaoCirculoRetangulo(c, r, o);
      if (pen > 0.02) falha(mundo, c, 'colisao', `penetrou ${arred(pen, 3)} m em ${o.id ?? 'obstaculo'}`);
    }
  }
}

function falha(mundo, c, tipo, detalhe) {
  if (mundo.falhas.length >= 50) return;
  if (mundo.falhas.some((f) => f.id === c.id && f.tipo === tipo)) return;
  mundo.falhas.push({ tick: mundo.tick, t: mundo.t, id: c.id, tipo, detalhe });
}

function evento(mundo, tipo, id, dados = {}) {
  mundo.eventos.push({ tick: mundo.tick, t: mundo.t, tipo, id, ...dados });
}

export function hashTrilha(mundo) {
  const linhas = mundo.decisoes.map((d) => `${d.tick}|${d.id}|${d.estado}|${d.codigo}|${d.alvo}|${d.x}|${d.y}`);
  linhas.push(`fim|${mundo.fim?.motivo}|${mundo.tick}`);
  return hashTexto(linhas.join('\n')).toString(16).padStart(8, '0');
}

export const arred = arredondar;

function congelar(obj) {
  Object.freeze(obj);
  for (const v of Object.values(obj)) if (v && typeof v === 'object' && !Object.isFrozen(v)) congelar(v);
  return obj;
}
export { congelar };
