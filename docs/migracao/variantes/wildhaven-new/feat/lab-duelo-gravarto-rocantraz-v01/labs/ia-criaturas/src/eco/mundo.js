// Mundo do ecossistema V2: muitos animais, grupos, carcaças, água, vegetação, clima, fogo e três níveis de simulação.
// Ordem determinística em cada passo; todo sorteio vem de RNGs com estado serializável.
import { Rng, derivarSemente, rngDerivado } from './rng.js';
import { sortearIndividuo, massaMedia } from './especies.js';
import { criarSaude, atualizarSaudePasso, contagio } from './saude.js';
import { atualizarVeneno, estadoVeneno, morreuDeVeneno } from './veneno.js';
import { atualizarCamuflagem, estadoCamuflagem } from './camuflagem.js';
import { estadoVoo, moverVoo } from './voo.js';
import { atualizarClimaAdverso, custoClimatico, encerrarClima, iniciarClima } from './clima.js';
import { abrirCupinzeiro, atualizarCupinzeiros, comerCupins, instalarCupinzeiros, perceberCupinzeiros } from './cupins.js';
import { atualizarCarcacasV7, materiaLocalKg } from './carcaca.js';
import { estadoSerpente, moverSerpente } from './serpente.js';
import { avancarEngolir } from './engolir.js';
import { alcances, perceber, perceberCarcacas, atualizarMemoria } from './percepcao.js';
import { avaliarFugasDisputa, decidir } from './cerebro.js';
import { mover, resolverSobreposicoes } from './locomocao.js';
import { atualizarAgarroes, resolverGolpe, adaptarIntencaoTatica } from './combate.js';
import { recuperarQuedaAvancada, finalizarAgarraoAvancado } from './combate-avancado.js';
import { criarGrupo, atualizarPapeis } from './social.js';
import { atualizarRelacoes, registrarVinculos, vincularFamilia, vincularParceiros } from './relacoes.js';
import { processarDia, iniciarGestacao } from './vida.js';
import { gerarTerrenoProcedural, desserializarTerreno, indice, centro, altura, marcarDisco } from './terreno.js';
import { atribuirNiveis, passoNivel2, passoNivel3, integrarNecessidades } from './niveis.js';
import { construirGrade, vizinhos } from './grade.js';
import { estadoInicial as estadoSubsolo, moverSubsolo, naSuperficie, separadosNaVertical, submerso } from './subsolo.js';
import { consolidar, emitirDoMovimento, instalarVibracoes, perceberVibracoes } from './vibracoes.js';
import { volumeAreia } from './areia.js';

const FNV = 16777619;

export function criarMundoEco(config, cenario, semente, opcoes = {}) {
  const rngMundo = rngDerivado(semente, `mundo:${cenario.id}`);
  const terreno = cenario.terreno.tipo === 'derivado'
    ? desserializarTerreno(cenario.terreno.dados)
    : gerarTerrenoProcedural(rngDerivado(semente, 'terreno'), cenario.terreno);
  const rel = cenario.relogio ?? {};
  const mundo = {
    cenario, cenarioId: cenario.id, semente: semente >>> 0, config,
    terreno, dt: cenario.dt ?? 0.1, t: 0, tick: 0,
    relogio: { segundosPorDia: rel.segundosPorDia ?? 600, diasPorAno: rel.diasPorAno ?? 365, dia: (rel.diaInicial ?? 10) + (rel.horaInicial ?? 7) / 24, hora: rel.horaInicial ?? 7, estacao: 'chuvosa', chovendo: false, diaInteiro: rel.diaInicial ?? 10 },
    animais: [], vivos: [], porId: new Map(), mortos: new Map(), grupos: new Map(), carcacas: [], conflitos: [], marcas: [], dispersos: [],
    sons: [], sonsAnteriores: [], fogo: new Map(), pontosAgua: [],
    eventos: [], ledger: new Set(), perseguicoes: [], perseguicoesAtivas: new Map(),
    contadorEventos: 0, contadorConflitos: 0, contadorGrupos: 0, contadorAnimais: 0, contadorCarcacas: 0,
    hash: 2166136261, decisoes: opcoes.guardarDecisoes ? [] : null,
    opcoes: { eventosDetalhados: opcoes.eventosDetalhados ?? true, observacao: cenario.observacao ?? null, tatica: true, ...opcoes },
    rng: rngMundo, doencas: Object.fromEntries((config.doencas ?? []).map((d) => [d.id, d])),
    metricas: novasMetricas(), acumNivel2: 0, ultimaHoraN3: null, custo: { n1: 0, n2: 0, n3: 0, passosN1: 0, passosN2: 0, passosN3: 0 },
  };
  instalarApi(mundo);
  // Pequenos vertebrados (roedores, lagartos, aves de chão): estoque agregado em kg por hectare, só para dietas que os incluem.
  const ha = (terreno.largura * terreno.profundidade) / 10000;
  const mfHa = cenario.microfauna?.kgPorHa ?? 6;
  mundo.microfauna = { kg: mfHa * ha, max: mfHa * ha, regenDia: cenario.microfauna?.regenDia ?? 0.06, consumidoKg: 0 };
  atualizarClima(mundo, true);
  mundo.pontosAgua = calcularPontosAgua(terreno);
  // Populações iniciais.
  for (const pop of cenario.populacoes ?? []) {
    const especie = config.especies[pop.especie];
    if (!especie) throw new Error(`Espécie desconhecida no cenário: ${pop.especie}`);
    for (const gdef of pop.grupos ?? []) {
      const membros = [];
      const rngG = rngDerivado(semente, `grupo:${pop.especie}:${gdef.x}:${gdef.y}`);
      for (let i = 0; i < gdef.adultos; i++) membros.push(mundo.criarAnimal(especie, { x: gdef.x + rngG.entre(-gdef.raio, gdef.raio), y: gdef.y + rngG.entre(-gdef.raio, gdef.raio), idadeDias: Math.round(rngG.entre(especie.vida.maturidadeAnos * 1.2, especie.vida.expectativaAnos * 0.6) * 365), sexo: i % 3 === 0 ? 'M' : 'F', fome: gdef.fome, sede: gdef.sede, ...(gdef.atributos ?? {}) }));
      const maes = membros.filter((m) => m.sexo === 'F');
      for (let i = 0; i < (gdef.filhotes ?? 0) && maes.length; i++) {
        const mae = maes[i % maes.length];
        membros.push(mundo.criarAnimal(especie, { x: mae.x + rngG.entre(-1.5, 1.5), y: mae.y + rngG.entre(-1.5, 1.5), idadeDias: Math.round(rngG.entre(30, 120)), maeId: mae.id, pais: [mae, membros.find((m) => m.sexo === 'M') ?? mae], sexo: rngG.chance(0.5) ? 'F' : 'M' }));
        mae.filhos.push(membros[membros.length - 1].id);
      }
      if (especie.social.tipo === 'bando' && membros.length > 1) { const g = criarGrupo(mundo, especie, membros); g.centroCasa = { x: gdef.x, y: gdef.y }; }
      for (const m of membros) m.casa = { x: gdef.x, y: gdef.y, raio: gdef.raioCasa ?? 70 };
    }
    for (const idef of pop.individuos ?? []) {
      const a = mundo.criarAnimal(especie, { idadeDias: Math.round((idef.idadeAnos ?? especie.vida.maturidadeAnos * 2) * 365), ...idef });
      // area de vida: por padrao em volta do ponto inicial; idef.casa permite centra-la em outro lugar.
      a.casa = { x: idef.casa?.x ?? idef.x, y: idef.casa?.y ?? idef.y, raio: idef.casa?.raio ?? idef.raioCasa ?? 80 };
      if (especie.social.territorial) a.territorio = { x: idef.territorio?.x ?? idef.x, y: idef.territorio?.y ?? idef.y, raio: idef.territorio?.raio ?? especie.social.raioTerritorioM };
    }
  }
  // Pares de caça declarados no cenário (só espécies com caça cooperativa).
  for (const [x, y] of cenario.pares ?? []) {
    const a = mundo.porId.get(x), b = mundo.porId.get(y);
    if (a?.especie.social.cacaCooperativa && b?.especie.social.cacaCooperativa) { a.parId = y; b.parId = x; }
  }
  // Caso índice de doença (nunca espontânea).
  if (cenario.casoIndice) { const a = mundo.porId.get(cenario.casoIndice.id); if (a) a.saude.doencas.push({ id: cenario.casoIndice.doenca, dias: 0, intensidade: 0.1, origem: 'indice' }); }
  // Conhecimento prévio de água na área de vida.
  for (const a of mundo.vivos) conhecerAgua(mundo, a, 500);
  instalarVibracoes(mundo);
  // V7: recursos e clima experimentais. Sem declaração no cenário, ficam vazios/inertes.
  instalarCupinzeiros(mundo);
  mundo.climaAtivo = null; mundo.climaEvento = null;
  mundo.iniciarClima = (tipo, opcoes) => iniciarClima(mundo, tipo, opcoes);
  mundo.encerrarClima = () => encerrarClima(mundo);
  // Volume de areia na criação do mundo, não no primeiro passo: a derivação custa dezenas de ms numa
  // grade grande e, feita sob demanda, virava um engasgo no meio da simulação (medido: 62 ms).
  if (terreno.areia) volumeAreia(terreno);
  registrarVinculos(mundo);
  atribuirNiveis(mundo);
  return mundo;
}

function instalarApi(mundo) {
  mundo.evento = (tipo, id, dados = {}) => {
    mundo.contadorEventos++;
    const m = mundo.metricas;
    m.eventos[tipo] = (m.eventos[tipo] ?? 0) + 1;
    if (mundo.opcoes.eventosDetalhados || IMPORTANTES.has(tipo)) mundo.eventos.push({ n: mundo.contadorEventos, t: +mundo.t.toFixed(2), dia: mundo.relogio.diaInteiro, tipo, id, ...dados });
    if (mundo.eventos.length > (mundo.opcoes.maxEventos ?? 200000)) mundo.eventos.splice(0, 10000);
  };
  mundo.som = (a, tipo, alcance, extra = {}) => mundo.sons.push({ fonte: a.id, especie: a.especie.id, tipo, x: a.x, y: a.y, alcance, ...extra });
  mundo.criarAnimal = (especie, o) => criarAnimal(mundo, especie, o);
  mundo.matar = (a, causa, por = null) => matar(mundo, a, causa, por);
  mundo.acasalar = (fem, macho) => { if (iniciarGestacao(mundo, fem, macho, mundo.relogio.diaInteiro)) { mundo.metricas.acasalamentos++; vincularParceiros(fem, macho); mundo.evento('acasalamento', fem.id, { macho: macho.id }); } };
  mundo.densidadeLocal = (a) => densidadeLocal(mundo, a);
  mundo.inicioPerseguicao = (a, presaId) => {
    if (mundo.perseguicoesAtivas.has(a.id)) return;
    mundo.perseguicoesAtivas.set(a.id, { predador: a.id, presa: presaId, inicio: mundo.t, disputaDurante: false });
    mundo.evento('perseguicao_inicio', a.id, { presa: presaId });
  };
  mundo.fimPerseguicao = (a, motivo) => {
    const p = mundo.perseguicoesAtivas.get(a.id);
    if (!p) return;
    mundo.perseguicoesAtivas.delete(a.id);
    p.fim = mundo.t; p.duracao = +(p.fim - p.inicio).toFixed(2); p.motivo = motivo;
    const presa = mundo.porId.get(p.presa);
    p.presaSobreviveu = !!presa?.vivo;
    p.presaFerida = !!presa && presa.saude.ferimentos.some((f) => f.origem === a.id);
    mundo.perseguicoes.push(p);
    if (p.disputaDurante && p.presaSobreviveu) { mundo.metricas.escapesDuranteDisputa++; mundo.evento('presa_escapou_durante_disputa', p.presa, { predador: a.id }); }
    mundo.evento('perseguicao_fim', a.id, { presa: p.presa, motivo, duracao: p.duracao });
  };
}

const IMPORTANTES = new Set(['morte', 'nascimento', 'eclosao', 'acasalamento', 'conflito_inicio', 'conflito_fim', 'migracao', 'incendio', 'predacao_n3', 'encontro_n2', 'disputa_n2', 'oportunidade_fuga', 'presa_escapou_durante_disputa', 'dispersao', 'infeccao_ferida', 'doenca_contagio', 'doenca_curada', 'infeccao_curada', 'sequela', 'maturidade', 'gestacao', 'postura_agendada', 'nivel']);

function criarAnimal(mundo, especie, o) {
  const numero = ++mundo.contadorAnimais;
  const id = o.id ?? `${especie.id}-${numero}`;
  const rng = rngDerivado(mundo.semente, `animal:${id}`);
  // Estado inicial pode ser faixa [mín, máx] sorteada pela semente (variação entre encontros).
  const faixa = (v) => (Array.isArray(v) ? rng.entre(v[0], v[1]) : v);
  o = { ...o, fome: faixa(o.fome), sede: faixa(o.sede), energia: faixa(o.energia) };
  const ind = sortearIndividuo(especie, rng, { pais: o.pais ?? null });
  if (o.temperamento) Object.assign(ind.temperamento, o.temperamento);
  if (o.massaKg) ind.massaAdulta = o.massaKg;
  const idadeDias = o.idadeDias ?? 365 * especie.vida.maturidadeAnos * 2;
  const idadeAnos = idadeDias / 365;
  const juvenil = idadeAnos < especie.vida.maturidadeAnos;
  const crescimento = juvenil ? Math.min(1, idadeAnos / especie.vida.crescimentoAnos) : 1;
  const massa = ind.massaAdulta * (juvenil ? 0.15 + 0.85 * crescimento : 1);
  const t = mundo.terreno;
  // Posição inicial válida (fora de rocha/água funda).
  let x = Math.min(t.largura - 1, Math.max(1, o.x)), y = Math.min(t.profundidade - 1, Math.max(1, o.y));
  for (let i = 0; i < 40; i++) {
    const k = indice(t, x, y);
    if (k >= 0 && t.bloqueio[k] === 0 && Math.max(0, t.agua[k] - t.alturas[k]) <= especie.movimento.profundidadeMaxM && t.inclinacao[k] <= especie.movimento.inclinacaoMaxGraus) break;
    x = Math.min(t.largura - 1, Math.max(1, o.x + rng.entre(-6, 6))); y = Math.min(t.profundidade - 1, Math.max(1, o.y + rng.entre(-6, 6)));
  }
  const a = {
    id, numero, especie, sexo: o.sexo ?? (rng.chance(0.5) ? 'F' : 'M'),
    massaAdulta: ind.massaAdulta, massa, atributos: ind.atributos, temperamento: ind.temperamento,
    idadeDias, idadeAnos, juvenil, crescimento, escala: juvenil ? 0.35 + 0.65 * crescimento : 1,
    x, y, z: altura(t, x, y), direcao: o.direcaoGraus != null ? (o.direcaoGraus * Math.PI) / 180 : rng.entre(-Math.PI, Math.PI), velocidade: 0,
    energia: o.energia ?? 90, fome: o.fome ?? 35, sede: o.sede ?? 30, folego: especie.movimento.resistenciaSeg, estresse: 0,
    saude: criarSaude(especie, massa, crescimento), vivo: true, causaMorte: null,
    grupoId: o.grupoId ?? null, papel: juvenil ? 'filhote' : 'solitario', maeId: o.maeId ?? null, paiId: o.paiId ?? null, filhos: [], parId: null,
    gestacao: null, casa: null, territorio: null, diasFome: 0, diasSede: 0,
    memoria: { criaturas: new Map(), carcacas: new Map(), experiencias: new Map(), sons: [], recursos: { agua: [] } },
    atencao: new Map(), contatos: [], ocultos: [], foco: null, conflito: null, cooldownRival: new Map(),
    estado: 'inicio', codigo: null, motivo: 'início', alvo: null, intencao: null, mente: {}, caminho: null, waypoint: null,
    golpe: null, recargas: {}, colisoes: 0, nivel: 1, tempo: mundo.t, ultimaChave: null,
    rngMente: rngDerivado(mundo.semente, `mente:${id}`), rngPercepcao: rngDerivado(mundo.semente, `perc:${id}`), rngCombate: rngDerivado(mundo.semente, `combate:${id}`),
  };
  // Espécies das dunas: estado físico próprio no volume de areia (profundidade, fase, transições).
  if (especie.subsolo) estadoSubsolo(a, mundo, o.profundidadeInicialM ?? 0);
  // V7: capacidades declaradas na ficha; quem não declara não ganha estado nenhum.
  estadoVeneno(a); estadoCamuflagem(a);
  if (especie.voo) estadoVoo(a, mundo, o.altitudeInicialM ?? 0);
  if (especie.serpente) estadoSerpente(a, mundo);
  if (o.resistenciaVeneno != null) a.resistenciaVeneno = o.resistenciaVeneno;
  if (o.ferimentos) for (const f of o.ferimentos) a.saude.ferimentos.push({ id: `ini:${id}:${f.regiao}`, infeccao: 0, desde: 0, sangramento: 0, fratura: false, ...f });
  if (o.hpFracao) a.saude.hp = a.saude.hpMax * o.hpFracao;
  mundo.animais.push(a); mundo.vivos.push(a); mundo.porId.set(id, a);
  if (a.grupoId) { const g = mundo.grupos.get(a.grupoId); if (g && !g.membros.includes(id)) g.membros.push(id); }
  if (mundo.tick > 0) { conhecerAgua(mundo, a, 300); if (a.maeId) vincularFamilia(mundo, a); }
  return a;
}

function matar(mundo, a, causa, por) {
  if (!a.vivo || mundo.ledger.has(`morte:${a.id}`)) return;
  mundo.ledger.add(`morte:${a.id}`);
  a.vivo = false; a.causaMorte = causa; a.velocidade = 0; a.estado = 'morto';
  // Mortalidade interrompe conexões de agarrão nas duas direções, mesmo que
  // o animal não volte a executar o passo de contenção (evita estados presos).
  if(a.agarrando){
    const presa=mundo.porId.get(a.agarrando);
    if(presa)presa.agarradoPor=null;
    mundo.evento('soltou',a.id,{alvo:a.agarrando,motivo:'morte_agarrador'});
    a.agarrando=null;
    finalizarAgarraoAvancado(a,mundo,'morte_agarrador');
  }
  if(a.agarradoPor){
    const dono=mundo.porId.get(a.agarradoPor);
    if(dono?.agarrando===a.id){
      dono.agarrando=null;
      mundo.evento('soltou',dono.id,{alvo:a.id,motivo:'presa_morreu'});
      finalizarAgarraoAvancado(dono,mundo,'presa_morreu');
    }
    a.agarradoPor=null;
  }
  mundo.vivos = mundo.vivos.filter((x) => x !== a);
  mundo.porId.delete(a.id); mundo.mortos.set(a.id, a);
  const m = mundo.metricas;
  m.mortes[causa] = (m.mortes[causa] ?? 0) + 1;
  m.mortesPorEspecie[a.especie.id] = (m.mortesPorEspecie[a.especie.id] ?? 0) + 1;
  if (causa === 'predacao') m.predacoes++;
  mundo.evento('morte', a.id, { causa, por, especie: a.especie.id, idadeAnos: +a.idadeAnos.toFixed(2), x: +a.x.toFixed(1), y: +a.y.toFixed(1) });
  // Carcaça (decompositores reciclam ao fim).
  const c = { id: `carc${++mundo.contadorCarcacas}`, especie: a.especie.id, animal: a.id, x: a.x, y: a.y, carneInicial: +(a.massa * 0.55).toFixed(2), carne: +(a.massa * 0.55).toFixed(2), decomposicao: 0, dono: null, donoDesde: null, morteT: mundo.t, consumo: {} };
  if (por && (causa === 'predacao' || causa === 'envenenamento')) { c.dono = por; c.donoDesde = mundo.t; }
  mundo.carcacas.push(c);
  if (por) { const p = mundo.porId.get(por); if (p && mundo.perseguicoesAtivas.get(p.id)?.presa === a.id) mundo.fimPerseguicao(p, 'abate'); if (p?.mente.caca?.id === a.id) p.mente.caca = null; }
  for (const [pid, p] of mundo.perseguicoesAtivas) if (p.presa === a.id && pid !== por) { const pr = mundo.porId.get(pid); if (pr) mundo.fimPerseguicao(pr, 'presa_morreu'); }
  if (a.perseguicaoPropria) mundo.fimPerseguicao(a, 'predador_morreu');
  if (mundo.perseguicoesAtivas.has(a.id)) mundo.fimPerseguicao(a, 'predador_morreu');
  if (a.grupoId) { const g = mundo.grupos.get(a.grupoId); if (g) { g.membros = g.membros.filter((id) => id !== a.id); atualizarPapeis(mundo, g); } }
  if (a.conflito) { const cf = mundo.conflitos.find((x) => x.id === a.conflito.id); if (cf && !cf.resultado) { cf.resultado = { perdedor: a.id, vencedor: a.conflito.rival, motivo: 'morte', faseFinal: cf.fase, duracao: +(mundo.t - cf.inicio).toFixed(1), golpes: cf.golpes, t: mundo.t }; mundo.evento('conflito_fim', a.id, { conflito: cf.id, ...cf.resultado, motivoDisputa: cf.motivo }); const r = mundo.porId.get(a.conflito.rival); if (r) { r.conflito = null; r.foco = null; } } }
}

// ---------------------------------------------------------------- passo
export function passoEco(mundo) {
  const dt = mundo.dt;
  mundo.t = Math.round((mundo.t + dt) * 1e6) / 1e6;
  mundo.tick++;
  avancarRelogio(mundo, dt);
  if (mundo.climaEvento || mundo.cenario.clima?.eventos) atualizarClimaAdverso(mundo);
  if (mundo.tick % 10 === 0) atribuirNiveis(mundo);
  mundo.sonsAnteriores = mundo.sons; mundo.sons = [];
  // Vibrações: percebidas no passo seguinte ao que as produziu, como os sons.
  mundo.vibracoesAnteriores = mundo.vibracoes; mundo.vibracoes = [];
  const n1 = mundo.vivos.filter((a) => a.nivel === 1);
  const ativos = mundo.vivos.filter((a) => a.nivel !== 3);
  // Grades espaciais do passo: percepção varre `ativos`, separação e sobreposição varrem `n1`. Devolvem
  // índices em ordem crescente, então o resultado é o mesmo da varredura completa (ver grade.js).
  mundo.gradeAtivos = construirGrade(ativos);
  mundo.gradeN1 = construirGrade(n1);
  mundo.idsAtivos = new Set(ativos.map((a) => a.id));
  // Maiores corpos vivos: o raio de consulta precisa caber o maior vizinho possível, não a média.
  let maxR = 0, maxC = 0, maxV = 0;
  for (const a of n1) {
    const r = a.especie.corpo.raio * a.escala, c = a.especie.corpo.comprimentoM * a.escala;
    if (r > maxR) maxR = r; if (c > maxC) maxC = c;
    if (a.especie.movimento.corrida > maxV) maxV = a.especie.movimento.corrida;
  }
  mundo.maxRaioCorpo = maxR; mundo.maxComprimentoCorpo = maxC;
  // A grade é montada antes do movimento e consultada durante/depois dele: a margem cobre quem andou no
  // passo. Sem ela, um vizinho que se aproximou ficaria de fora da consulta e o resultado mudaria.
  mundo.margemPasso = maxV * dt * 2;
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  // 1. Percepção (estado do início do passo).
  for (const a of n1) {
    a.contatos = perceber(a, mundo, ativos, dt);
    // Vibrações do substrato: sentido à parte, que complementa visão/audição/olfato e não os substitui.
    if (a.especie.percepcao?.vibracao) {
      a.vibracoesSentidas = perceberVibracoes(a, mundo);
      consolidar(a, a.vibracoesSentidas, mundo);
      a.totalVibracoes = (a.totalVibracoes ?? 0) + a.vibracoesSentidas.length;
      for (const v of a.vibracoesSentidas) a.contatos.push(v);
    }
    atualizarMemoria(a, a.contatos.filter((k) => k.via !== 'vibracao' && k.via !== 'termico'), a.especie.papel === 'carnivoro' ? perceberCarcacas(a, mundo) : [], mundo.t);
    descobrirAgua(mundo, a);
    if (a.especie.dieta.cupins && mundo.cupinzeiros.length) {
      const mem = (a.memoria.cupinzeiros ??= new Map());
      for (const c of perceberCupinzeiros(a, mundo, alcances(a, mundo.relogio.hora, mundo.climaAtivo))) {
        if (!mem.has(c.id)) mundo.evento('cupinzeiro_achado', a.id, { cupinzeiro: c.id, via: c.via, distancia: +c.distancia.toFixed(1) });
        mem.set(c.id, { ...c, t: mundo.t, vazio: mem.get(c.id)?.vazio ?? false });
      }
    }
    atualizarRelacoes(a, mundo);
    for (const k of a.contatos) if (k.via === 'visao' && !a.jaViu?.has(k.id)) { (a.jaViu ??= new Set()).add(k.id); }
  }
  // 2. Decisão.
  for (const a of n1) {
    if (!a.vivo) continue;
    const fogo = fogoProximo(mundo, a);
    // comandoTeste: só a bancada de testes (laboratorio-varrisco) usa; devolve uma intenção ou null (= IA normal).
    // Estados físicos (caído, agarrado, atordoado) sempre vêm do núcleo, nunca do comando.
    const fisico = a.agarradoPor || a.saude.caidoAte > mundo.t || a.saude.atordoadoAte > mundo.t;
    if(mundo.opcoes.tatica&&!a.hunter&&!a.subsolo&&!a.voo&&!a.serpente&&(a.especie.papel==='carnivoro'||a.conflito)){(a.tatica??={}).deferAttack=true;}
    let i = fogo ? { estado: 'fugindo_fogo', codigo: 'fogo', motivo: `fogo a ${fogo.d.toFixed(0)} m`, alvo: null, destino: { x: a.x + (a.x - fogo.x) * 2, y: a.y + (a.y - fogo.y) * 2 }, ritmo: 'corrida' } : ((!fisico && a.comandoTeste?.(a, mundo)) || decidir(a, mundo));
    if(a.tatica)a.tatica.deferAttack=false;
    if(!fisico&&!fogo&&!a.comandoTeste){
      const levantar=recuperarQuedaAvancada(a,mundo);
      if(levantar)i=levantar;
      else if(mundo.opcoes.tatica)i=adaptarIntencaoTatica(a,i,mundo);
    }
    registrarDecisao(mundo, a, normalizar(i));
  }
  avaliarFugasDisputa(mundo);
  // 3. Ação.
  mundo.listaN1 = n1;
  for (const a of n1) {
    if (!a.vivo) continue;
    // Meio físico: areia (volume próprio) ou solo. Um animal submerso nunca passa pelo controlador terrestre.
    a.climaLocomocao = mundo.climaAtivo?.locomocao ?? 1;
    if (a.subsolo && !naSuperficie(a)) moverSubsolo(a, a.intencao, mundo, dt);
    // Ar: controlador próprio. No chão, sem ordem de decolar, devolve false e vale a locomoção terrestre.
    else if (a.voo && moverVoo(a, a.intencao, mundo, dt)) { /* movimento resolvido no ar */ }
    // Corpo longo: a cabeça anda pelo controlador terrestre e o corpo segue o rastro dela.
    else if (a.serpente) moverSerpente(a, a.intencao, mundo, dt);
    else { mover(a, a.intencao, mundo, dt); if (a.subsolo) moverSubsolo(a, a.intencao, mundo, dt); }
    emitirDoMovimento(mundo, a, dt);
    for (const k of Object.keys(a.recargas)) a.recargas[k] = Math.max(0, a.recargas[k] - dt);
    resolverGolpe(a, mundo);
    agir(mundo, a, dt);
    atualizarSaudePasso(a, dt);
    atualizarVeneno(a, mundo, dt);
    atualizarCamuflagem(a, mundo, dt);
    if (mundo.climaAtivo || a.especie.resistenciaClimatica) custoClimatico(a, mundo, dt);
    integrarNecessidades(mundo, a, mundo.t);
    if (a.saude.hp <= 0 && a.vivo) mundo.matar(a, causaFerimento(a), a.mente.atingidoPor?.id ?? null);
  }
  atualizarAgarroes(mundo, dt);
  // Todo mundo já andou: a grade do início do passo está velha para a fase de contato.
  mundo.gradeN1 = construirGrade(n1);
  resolverSobreposicoes(mundo, n1);
  medirSobreposicao(mundo, n1, dt);
  // Disputa durante perseguição: marca para a métrica de fugas durante disputas.
  for (const [pid, p] of mundo.perseguicoesAtivas) { const pr = mundo.porId.get(pid); if (pr?.conflito) p.disputaDurante = true; }
  // Contágio entre animais próximos (só quem tem doença).
  for (const a of n1) if (a.vivo && a.saude.doencas.length) for (const b of n1) {
    if (b === a || !b.vivo) continue;
    for (const d of a.saude.doencas) { const cfg = mundo.doencas[d.id]; if (cfg && (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) < cfg.raioContatoM * cfg.raioContatoM && contagio(a, b, cfg, mundo.rng, dt)) { mundo.metricas.contagios++; mundo.evento('doenca_contagio', b.id, { de: a.id, doenca: d.id }); } }
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
  mundo.custo.n1 += t1 - t0; mundo.custo.passosN1 += n1.length;
  // Nível 2 (1 Hz) e nível 3 (por hora ecológica).
  mundo.acumNivel2 += dt;
  // Nível 2 integra o tempo realmente decorrido (com dt > 1 s não perde metade do deslocamento).
  if (mundo.acumNivel2 >= 1 - 1e-9) { const d = Math.max(1, Math.round(mundo.acumNivel2 * 1e6) / 1e6); mundo.acumNivel2 = 0; passoNivel2(mundo, d); }
  const horaAbs = Math.floor(mundo.t / (mundo.relogio.segundosPorDia / 24));
  if (mundo.ultimaHoraN3 === null) mundo.ultimaHoraN3 = horaAbs;
  if (horaAbs > mundo.ultimaHoraN3) { mundo.ultimaHoraN3 = horaAbs; passoNivel3(mundo); }
  // Mundo: carcaças, fogo, grupos.
  if (mundo.cenario.decomposicao) atualizarCarcacasV7(mundo, dt); else atualizarCarcacas(mundo, dt);
  atualizarCupinzeiros(mundo, dt);
  if (mundo.fogo.size) propagarFogo(mundo, dt);
  if (mundo.tick % 50 === 0) for (const g of mundo.grupos.values()) atualizarPapeis(mundo, g);
  mundo.conflitos = mundo.conflitos.filter((c) => !c.resultado || mundo.t - c.resultado.t < 30);
  return true;
}

// Corpos sobrepostos (centros a menos de 60% da soma dos raios) — métrica, não correção.
function medirSobreposicao(mundo, lista, dt) {
  const g = mundo.gradeN1?.lista === lista ? mundo.gradeN1 : null;
  const perto = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (!a.vivo) continue;
    // Raio de consulta: o maior par possível de raios de corpo. Os índices vêm em ordem crescente, então
    // a sequência de pares é a mesma do laço i<j completo.
    const alcance = (a.especie.corpo.raio * a.escala + mundo.maxRaioCorpo) * 0.6 + (mundo.margemPasso ?? 0);
    const cand = g ? vizinhos(g, a.x, a.y, alcance, perto) : null;
    const n = cand ? cand.length : lista.length;
    for (let c = 0; c < n; c++) {
      const j = cand ? cand[c] : c;
      if (j <= i) continue;
      const b = lista[j];
      if (!b.vivo) continue;
      if (separadosNaVertical(a, b)) continue;
      const r = (a.especie.corpo.raio * a.escala + b.especie.corpo.raio * b.escala) * 0.6;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < r * r) mundo.metricas.sobreposicoes += dt;
    }
  }
}

function normalizar(i) {
  return { estado: i.estado, codigo: i.codigo ?? i.estado, motivo: i.motivo ?? '', alvo: i.alvo ?? null, destino: i.destino ?? null, ritmo: i.ritmo ?? 'parado', acao: i.acao ?? null, olharPara: i.olharPara ?? null, velMax: i.velMax ?? null, orientacaoCombate:i.orientacaoCombate??false, subsolo: i.subsolo ?? null, profundidade: i.profundidade ?? null, voar: i.voar ?? false, pousar: i.pousar ?? false, altitude: i.altitude ?? null, postura: i.postura ?? null };
}

function registrarDecisao(mundo, a, i) {
  // Validação: alvo de criatura precisa ter vindo da percepção/memória.
  if (i.alvo?.tipo === 'criatura' && !a.memoria.criaturas.has(i.alvo.id) && !(a.conflito && a.conflito.rival === i.alvo.id && a.memoria.criaturas.has(i.alvo.id))) {
    mundo.metricas.falhas.push({ t: mundo.t, id: a.id, tipo: 'reagiu_sem_perceber', alvo: i.alvo.id });
  }
  const chave = `${i.estado}|${i.codigo}|${i.alvo?.id ?? i.alvo?.tipo ?? '-'}`;
  if (chave !== a.ultimaChave) {
    a.ultimaChave = chave;
    const linha = `${mundo.tick}|${a.id}|${chave}|${Math.round(a.x * 100)}|${Math.round(a.y * 100)}`;
    let h = mundo.hash;
    for (let k = 0; k < linha.length; k++) { h ^= linha.charCodeAt(k); h = Math.imul(h, FNV) >>> 0; }
    mundo.hash = h;
    mundo.decisoes?.push({ t: mundo.t, id: a.id, estado: i.estado, codigo: i.codigo, alvo: i.alvo?.id ?? null, motivo: i.motivo });
    if (mundo.decisoes && mundo.decisoes.length > 100000) mundo.decisoes.splice(0, 10000);
  }
  a.estado = i.estado; a.codigo = i.codigo; a.motivo = i.motivo; a.alvo = i.alvo; a.intencao = i;
}

function causaFerimento(a) {
  if (morreuDeVeneno(a)) return 'envenenamento';
  if ((a.saude.danoClima ?? 0) > a.saude.hpMax * 0.3) return 'clima';
  if (a.saude.ferimentos.some((f) => f.sangramento > 0)) return a.mente.atingidoPor && a.especie.papel === 'herbivoro' ? 'predacao' : 'sangramento';
  return 'ferimentos';
}

// Ações com efeito no mundo (comer, beber, carcaça).
function agir(mundo, a, dt) {
  const i = a.intencao, n = a.especie.necessidades, t = mundo.terreno;
  if (i.acao === 'comer') {
    const k = indice(t, a.x, a.y);
    if (k >= 0 && t.vegetacao[k] > 0) {
      const q = Math.min(n.comerPorSeg * dt * (a.juvenil ? 0.5 : 1), t.vegetacao[k]);
      t.vegetacao[k] -= q; a.fome = Math.max(0, a.fome - q * 1.2);
      mundo.metricas.vegetacaoConsumida += q;
    }
  } else if (i.acao === 'engolir') {
    avancarEngolir(mundo, a, dt);
  } else if (i.acao === 'comer_cupins' || i.acao === 'abrir_cupinzeiro') {
    const c = mundo.cupinzeiros.find((x) => x.id === i.alvo?.id);
    // Só come quem está de fato ao alcance do monte.
    if (c && (c.x - a.x) * (c.x - a.x) + (c.y - a.y) * (c.y - a.y) <= (a.especie.dieta.cupins.alcanceM + 0.5) * (a.especie.dieta.cupins.alcanceM + 0.5)) {
      if (i.acao === 'abrir_cupinzeiro') abrirCupinzeiro(a, c, dt); else comerCupins(a, c, mundo, dt);
    }
  } else if (i.acao === 'beber') {
    a.sede = Math.max(0, a.sede - n.beberPorSeg * dt);
  } else if (i.acao === 'comer_carcaca') {
    const c = mundo.carcacas.find((x) => x.id === i.alvo?.id);
    if (c && c.carne > 0) {
      const kg = Math.min(n.comerPorSeg * dt, c.carne);
      c.carne -= kg; c.consumo[a.id] = (c.consumo[a.id] ?? 0) + kg;
      // Empanturrar: carnívoros guardam reserva (fome negativa até −60) e passam dias sem caçar.
      a.fome = Math.max(-60, a.fome - (kg * 100) / (a.massa * 0.08));
    }
  }
}

function atualizarCarcacas(mundo, dt) {
  const taxa = dt / mundo.relogio.segundosPorDia / 2.5; // ~2,5 dias até decompor por completo
  const t = mundo.terreno;
  for (const c of mundo.carcacas) {
    c.decomposicao = Math.min(1, c.decomposicao + taxa);
    if (c.dono && !mundo.porId.get(c.dono)) c.dono = null;
    if (c.decomposicao >= 1 || c.carne <= 0.05) {
      c.fim = true;
      // Decompositores: nutrientes enriquecem a vegetação local, só com a matéria que ficou aqui.
      const local = materiaLocalKg(c);
      marcarDisco(t, c.x, c.y, 3, (k) => { t.vegetacaoMax[k] = Math.min(150, t.vegetacaoMax[k] + 2 * Math.sqrt(local)); });
      mundo.evento('carcaca_reciclada', null, { carcaca: c.id, consumidaKg: +(c.carneInicial - c.carne).toFixed(1) });
    }
  }
  mundo.carcacas = mundo.carcacas.filter((c) => !c.fim);
}

// ---------------------------------------------------------------- relógio, clima, fogo
function avancarRelogio(mundo, dt) {
  const r = mundo.relogio;
  const diaAntes = r.diaInteiro;
  r.dia += dt / r.segundosPorDia;
  r.diaInteiro = Math.floor(r.dia);
  r.hora = (r.dia - r.diaInteiro) * 24;
  if (r.diaInteiro !== diaAntes) novoDia(mundo);
}

function novoDia(mundo) {
  atualizarClima(mundo, false);
  regenerarVegetacao(mundo);
  const mf = mundo.microfauna;
  if (mf) mf.kg = Math.min(mf.max, mf.kg + mf.regenDia * Math.max(mf.kg, mf.max * 0.1) * (1 - mf.kg / mf.max) * (mundo.relogio.estacao === 'chuvosa' ? 1.5 : 0.6));
  for (const a of [...mundo.vivos]) processarDia(mundo, a, mundo.relogio.diaInteiro);
  avaliarMigracoes(mundo);
  if (mundo.relogio.diaInteiro % 7 === 0) mundo.pontosAgua = calcularPontosAgua(mundo.terreno);
  mundo.metricas.serie.push(retrato(mundo));
}

function atualizarClima(mundo, inicial) {
  const r = mundo.relogio, clima = mundo.cenario.clima ?? {};
  const doAno = ((r.diaInteiro % r.diasPorAno) + r.diasPorAno) % r.diasPorAno;
  r.estacao = doAno < r.diasPorAno * (clima.fracaoChuvosa ?? 0.4) ? 'chuvosa' : 'seca';
  if (inicial) return;
  const rng = new Rng(derivarSemente(mundo.semente, `clima:${r.diaInteiro}`));
  r.chovendo = rng.chance(r.estacao === 'chuvosa' ? (clima.chanceChuvaChuvosa ?? 0.5) : (clima.chanceChuvaSeca ?? 0.05));
  // Nível da água sobe com chuva e baixa na seca (evaporação); pode secar completamente.
  const t = mundo.terreno, delta = r.chovendo ? (clima.subidaChuvaM ?? 0.03) : -(clima.evaporacaoM ?? (r.estacao === 'seca' ? 0.006 : 0.002));
  // Nível máximo = transbordo (nível inicial + 0,4 m): a chuva não aprofunda o lago indefinidamente.
  t.aguaMax ??= Float32Array.from(t.agua, (v) => (v > -1e8 ? v + 0.4 : -1e9));
  for (let k = 0; k < t.agua.length; k++) if (t.agua[k] > -1e8) { t.agua[k] = Math.min(t.aguaMax[k], t.agua[k] + delta); if (t.agua[k] < t.alturas[k] - 0.02) t.agua[k] = -1e9; }
  if (delta !== 0) t.perfis.clear();
  // Incêndio: só na seca, raro, em área com muita vegetação.
  if (r.estacao === 'seca' && rng.chance(clima.chanceIncendio ?? 0)) {
    for (let tent = 0; tent < 20; tent++) {
      const k = rng.inteiro(0, t.nx * t.ny - 1);
      if (t.vegetacao[k] > 40 && t.agua[k] < -1e8) { mundo.fogo.set(k, mundo.t + 30); mundo.metricas.incendios++; mundo.evento('incendio', null, { ...centro(t, k) }); break; }
    }
  }
}

function regenerarVegetacao(mundo) {
  const t = mundo.terreno, r = mundo.relogio;
  // Rebrote logístico com piso (raízes e sementes no solo rebrotam mesmo após pastejo intenso).
  const taxa = r.estacao === 'chuvosa' ? 0.3 : 0.06;
  for (let k = 0; k < t.vegetacao.length; k++) {
    const max = t.vegetacaoMax[k] * (t.cinzas[k] > 0 ? 0.5 : 1);
    if (max <= 0) continue;
    const v = t.vegetacao[k];
    t.vegetacao[k] = Math.min(max, v + taxa * Math.max(v, max * 0.2) * (1 - v / max) + (r.chovendo ? 0.5 : 0));
    if (t.cinzas[k] > 0) t.cinzas[k] = Math.max(0, t.cinzas[k] - 1);
  }
}

function propagarFogo(mundo, dt) {
  const t = mundo.terreno;
  if (mundo.tick % 20 !== 0) return;
  const novos = [];
  for (const [k, fim] of mundo.fogo) {
    if (mundo.t >= fim) { mundo.fogo.delete(k); continue; }
    t.vegetacao[k] = Math.max(0, t.vegetacao[k] - 15); t.cinzas[k] = 20;
    const i = k % t.nx, j = Math.floor(k / t.nx);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= t.nx || b >= t.ny) continue;
      const q = b * t.nx + a;
      if (!mundo.fogo.has(q) && t.vegetacao[q] > 25 && t.agua[q] < -1e8 && mundo.rng.chance(0.25)) novos.push(q);
    }
  }
  for (const q of novos) mundo.fogo.set(q, mundo.t + 30);
}

function fogoProximo(mundo, a) {
  if (!mundo.fogo.size) return null;
  const t = mundo.terreno;
  let m = null;
  for (const k of mundo.fogo.keys()) {
    const c = centro(t, k), d = Math.sqrt((c.x - a.x) * (c.x - a.x) + (c.y - a.y) * (c.y - a.y));
    if (d < 35 && (!m || d < m.d)) m = { ...c, d };
  }
  return m;
}

// ---------------------------------------------------------------- água e recursos
function calcularPontosAgua(t) {
  const pts = [], usados = new Set();
  for (let j = 1; j < t.ny - 1; j++) for (let i = 1; i < t.nx - 1; i++) {
    const k = j * t.nx + i;
    const prof = t.agua[k] - t.alturas[k];
    if (prof <= 0.02) continue; // qualquer água junto à margem serve para beber
    // Margem: célula seca vizinha onde o animal fica para beber.
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = (j + dj) * t.nx + (i + di);
      if (t.agua[q] - t.alturas[q] > 0.05 || t.bloqueio[q]) continue;
      const chave = `${Math.floor((i + di) / 6)}:${Math.floor((j + dj) / 6)}`;
      if (usados.has(chave)) continue;
      usados.add(chave);
      const c = centro(t, q), w = centro(t, k);
      pts.push({ id: `agua${pts.length}`, x: c.x, y: c.y, agua: w });
    }
  }
  return pts;
}

function conhecerAgua(mundo, a, raio) {
  a.memoria.recursos.agua = mundo.pontosAgua.filter((p) => (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) < raio * raio).map((p) => ({ ...p }));
}

function descobrirAgua(mundo, a) {
  if (mundo.tick % 20 !== a.numero % 20) return;
  const vis = a.especie.percepcao.visao.alcance;
  const conhecidos = new Set(a.memoria.recursos.agua.map((p) => p.id));
  for (const p of mundo.pontosAgua) if (!conhecidos.has(p.id) && (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) < vis * vis) a.memoria.recursos.agua.push({ ...p });
  // Esquece pontos que secaram quando passa perto e não há mais água.
  a.memoria.recursos.agua = a.memoria.recursos.agua.filter((p) => mundo.pontosAgua.some((q) => q.id === p.id) || (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) > 400);
}

function densidadeLocal(mundo, a) {
  const e = a.especie, t = mundo.terreno;
  const raio = e.papel === 'carnivoro' ? 300 : 100;
  let n = 0, presas = 0;
  for (const o of mundo.vivos) {
    const d2 = (o.x - a.x) * (o.x - a.x) + (o.y - a.y) * (o.y - a.y);
    if (d2 > raio * raio) continue;
    if (o.especie.id === e.id) n++;
    if (e.dieta.presas.includes(o.especie.id)) presas++;
  }
  if (e.papel === 'carnivoro') return Math.min(1, n / Math.max(0.5, presas / 8));
  let bio = 0;
  for (let dy = -raio; dy <= raio; dy += 10) for (let dx = -raio; dx <= raio; dx += 10) { const k = indice(t, a.x + dx, a.y + dy); if (k >= 0) bio += t.vegetacao[k] * 100; }
  const cap = Math.max(1, bio / (e.necessidades.fomePorDia * 25));
  return Math.min(1, n / cap);
}

// Migração: grupo/indivíduo avalia a área de vida uma vez por dia e muda a "casa" para um lugar melhor conhecido.
// O deslocamento é feito andando (níveis 1/2: caminho A*; nível 3: avanço limitado por hora), nunca por teleporte.
function avaliarMigracoes(mundo) {
  const t = mundo.terreno;
  const avaliados = new Set();
  for (const a of mundo.vivos) {
    if (a.juvenil || !a.casa || a.especie.papel === 'carnivoro') continue;
    const chave = a.grupoId ?? a.id;
    if (avaliados.has(chave)) continue;
    avaliados.add(chave);
    const lider = a.grupoId ? mundo.porId.get(mundo.grupos.get(a.grupoId)?.lider) ?? a : a;
    const q = qualidadeArea(mundo, lider.casa);
    const temAgua = lider.memoria.recursos.agua.some((p) => (p.x - lider.casa.x) * (p.x - lider.casa.x) + (p.y - lider.casa.y) * (p.y - lider.casa.y) < 250 * 250);
    if (q > 0.3 && temAgua) continue;
    // Procura destino entre pontos de água conhecidos com pasto ao redor.
    let melhor = null, nota = q + (temAgua ? 0.3 : 0) + 0.15;
    for (const p of lider.memoria.recursos.agua) {
      const qq = qualidadeArea(mundo, p) + 0.3;
      if (qq > nota) { nota = qq; melhor = p; }
    }
    if (!melhor) {
      // Exploração: direção sorteada (escoteiro) dentro do mapa.
      const rng = new Rng(derivarSemente(mundo.semente, `migr:${chave}:${mundo.relogio.diaInteiro}`));
      melhor = { x: Math.min(t.largura - 10, Math.max(10, lider.casa.x + rng.entre(-200, 200))), y: Math.min(t.profundidade - 10, Math.max(10, lider.casa.y + rng.entre(-200, 200))) };
    }
    const membros = a.grupoId ? mundo.grupos.get(a.grupoId).membros.map((id) => mundo.porId.get(id)).filter(Boolean) : [a];
    for (const m of membros) m.casa = { x: melhor.x, y: melhor.y, raio: m.casa?.raio ?? 70 };
    mundo.metricas.migracoes++;
    mundo.evento('migracao', lider.id, { grupo: a.grupoId, de: { x: +lider.x.toFixed(0), y: +lider.y.toFixed(0) }, para: { x: +melhor.x.toFixed(0), y: +melhor.y.toFixed(0) }, motivo: q <= 0.3 ? 'pasto_escasso' : 'sem_agua' });
  }
}

export function qualidadeArea(mundo, p) {
  const t = mundo.terreno;
  let soma = 0, max = 0;
  for (let dy = -60; dy <= 60; dy += 6) for (let dx = -60; dx <= 60; dx += 6) {
    const k = indice(t, p.x + dx, p.y + dy);
    if (k < 0) continue;
    soma += t.vegetacao[k]; max += Math.max(1, t.vegetacaoMax[k]);
  }
  return max ? soma / max : 0;
}

// ---------------------------------------------------------------- métricas
function novasMetricas() {
  return {
    eventos: {}, mortes: {}, mortesPorEspecie: {}, predacoes: 0, escapesDuranteDisputa: 0, migracoes: 0, incendios: 0, contagios: 0, acasalamentos: 0,
    vegetacaoConsumida: 0, buscasCaminho: 0, falhas: [], serie: [],
    // Locomoção (V3): passos cujo destino imediato era intransponível (inclui deslizes), episódios de
    // animal preso (quer andar e não sai do lugar por 5 s) e tempo com corpos sobrepostos (pares × s).
    contatosObstaculo: 0, presos: 0, sobreposicoes: 0,
    // Fugas durante disputas (V3): tentativas, fugas efetivas (fora da vista dos predadores por 10 s) e recapturas.
    tentativasFuga: 0, fugasEfetivas: 0, recapturas: 0,
  };
}

export function retrato(mundo) {
  const pop = {}, feridos = {}, doentes = {};
  let fome = 0, sede = 0;
  for (const a of mundo.vivos) {
    pop[a.especie.id] = (pop[a.especie.id] ?? 0) + 1;
    if (a.saude.ferimentos.some((f) => f.gravidade > 0.05)) feridos[a.especie.id] = (feridos[a.especie.id] ?? 0) + 1;
    if (a.saude.doencas.length) doentes[a.especie.id] = (doentes[a.especie.id] ?? 0) + 1;
    fome += a.fome; sede += a.sede;
  }
  const t = mundo.terreno;
  let veg = 0, vegMax = 0, agua = 0;
  for (let k = 0; k < t.vegetacao.length; k++) { veg += t.vegetacao[k]; vegMax += t.vegetacaoMax[k]; if (t.agua[k] > t.alturas[k] + 0.05) agua++; }
  const grupos = [...mundo.grupos.values()].filter((g) => g.membros.length);
  return {
    dia: mundo.relogio.diaInteiro, estacao: mundo.relogio.estacao, populacao: pop, feridos, doentes,
    fomeMedia: +(fome / Math.max(1, mundo.vivos.length)).toFixed(1), sedeMedia: +(sede / Math.max(1, mundo.vivos.length)).toFixed(1),
    vegetacao: +(veg / Math.max(1, vegMax)).toFixed(3), celulasAgua: agua, carcacas: mundo.carcacas.length,
    grupos: grupos.length, tamanhoMedioGrupo: grupos.length ? +(grupos.reduce((s, g) => s + g.membros.length, 0) / grupos.length).toFixed(1) : 0,
  };
}

export function hashMundo(mundo) { return mundo.hash.toString(16).padStart(8, '0'); }
export { massaMedia };
