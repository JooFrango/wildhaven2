// Serpáduna — corpo de 14,13 m: estendido, serpenteando, em curva, em duna, enrolando, e a caça com veneno
// paralisante e engolir inteira. Tudo medido no passo normal da simulação, com o corpo que o renderizador usa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cenarioTeste, mundoTeste, rodar, ev, CFG } from './eco-ajudantes.mjs';
import { medirCorpo, pontosDoCorpo } from '../src/eco/serpente.js';
import { altura } from '../src/eco/terreno.js';
import { intensidadeVeneno } from '../src/eco/veneno.js';
import { podeEngolir } from '../src/eco/engolir.js';

const CAMPO = { largura: 300, profundidade: 300, amplitude: 0, capim: 0 };
const N = 24; // pontos medidos ao longo do corpo

function cena({ terreno = {}, destino = null, semente = 1, x = 40, y = 150, graus = 0, presas = [], duracao = 300 } = {}) {
  const pops = [{ especie: 'serpaduna', individuos: [{ id: 'serp', x, y, direcaoGraus: graus, fome: 20, sede: 10, energia: 95 }] }, ...presas];
  const m = mundoTeste(cenarioTeste('serp', pops, { ...CAMPO, ...terreno }, { duracaoSeg: duracao }), semente);
  const a = m.porId.get('serp');
  if (destino) a.comandoTeste = () => ({ estado: 'vagando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: typeof destino === 'function' ? destino(m, a) : destino, ritmo: 'trote' });
  return { m, a };
}
// Roda conferindo o corpo a cada passo; devolve o pior caso de cada invariante.
function rodarCorpo(m, a, ate, parar = () => false) {
  const comp0 = medirCorpo(a, N).comprimento;
  let snap = null; let tPior = 0, piorVariacao = 0, piorCurv = 0, cruz = 0, piorFolga = Infinity, retMin = Infinity, retMax = -Infinity;
  const trilha = [];
  rodar(m, ate, () => {
    const c = medirCorpo(a, N);
    piorVariacao = Math.max(piorVariacao, Math.abs(c.comprimento - comp0) / comp0);
    if (c.curvMaxGraus > piorCurv) { piorCurv = c.curvMaxGraus; tPior = m.t; snap = { v: a.velocidade, est: a.estado, mot: a.motivo, rastro: a.serpente.rastro.length, s: a.serpente.s, x: a.x, y: a.y }; }
    cruz += c.cruzamentos; piorFolga = Math.min(piorFolga, c.folgaMinima);
    retMin = Math.min(retMin, c.retidao); retMax = Math.max(retMax, c.retidao);
    trilha.push(c.pontos.map((p) => ({ x: p.x, y: p.y })));
    return parar(c);
  });
  return { comp0, snap, tPior, piorVariacao, piorCurv, cruzamentos: cruz, folgaMinima: piorFolga, retMin, retMax, trilha, fim: medirCorpo(a, N) };
}

test('serpáduna: nasce estendida, não enrolada — o defeito da v02 não se repete na simulação', () => {
  const { a } = cena();
  const c = medirCorpo(a, N);
  console.log(`    repouso: ${c.comprimento.toFixed(2)} m · ponta a ponta ${c.pontaAPonta.toFixed(2)} m · retidão ${c.retidao.toFixed(3)} · cruzamentos ${c.cruzamentos}`);
  assert.ok(Math.abs(c.comprimento - 14.13) < 0.4, `comprimento ${c.comprimento.toFixed(2)} m`);
  assert.ok(c.retidao > 0.95, `retidão ${c.retidao.toFixed(3)} — corpo não está estendido`);
  assert.equal(c.cruzamentos, 0);
});

test('serpáduna: em linha reta o corpo ondula, o comprimento se conserva e nada se atravessa', () => {
  const { m, a } = cena({ destino: { x: 260, y: 150 } });
  const r = rodarCorpo(m, a, 60);
  // A onda chega à cauda: a última junta não fica parada enquanto o corpo anda (defeito medido no GLB v03).
  const cauda = r.trilha.map((p) => p[N - 1]);
  const amplitudeCauda = Math.max(...cauda.map((p, i) => (i ? Math.hypot(p.x - cauda[i - 1].x, p.y - cauda[i - 1].y) : 0)));
  const andou = a.x - 40;
  console.log(`    andou ${andou.toFixed(1)} m · variação de comprimento ${(r.piorVariacao * 100).toFixed(2)}% · curvatura máx ${r.piorCurv.toFixed(1)}° · retidão ${r.retMin.toFixed(3)}–${r.retMax.toFixed(3)} · cauda anda ${amplitudeCauda.toFixed(3)} m/passo`);
  assert.ok(andou > 40, `avançou só ${andou.toFixed(1)} m`);
  assert.ok(r.piorVariacao < 0.03, `o corpo esticou/encolheu ${(r.piorVariacao * 100).toFixed(1)}%`);
  assert.equal(r.cruzamentos, 0, 'o corpo atravessou a si mesmo');
  assert.ok(amplitudeCauda > 0.001, 'a cauda ficou parada: o corpo está deslizando rígido');
  // Ondulação real: a retidão oscila (corpo em S), mas o corpo nunca vira uma bola.
  assert.ok(r.retMin < 0.999, 'o corpo foi perfeitamente reto o tempo todo: não ondulou');
  assert.ok(r.retMin > 0.8, `retidão mínima ${r.retMin.toFixed(3)}: curvou demais numa reta`);
});

test('serpáduna: a cauda passa pelo mesmo caminho da cabeça (não desliza de lado)', () => {
  const { m, a } = cena({ destino: { x: 260, y: 150 } });
  const caminhoCabeca = [];
  rodar(m, 60, () => { caminhoCabeca.push({ x: a.x, y: a.y }); return false; });
  // Cada junta do corpo deve estar sobre um ponto por onde a cabeça já passou.
  const p = pontosDoCorpo(a, N);
  const erros = p.map((q) => Math.min(...caminhoCabeca.map((c) => Math.hypot(c.x - q.x, c.y - q.y))));
  const pior = Math.max(...erros);
  console.log(`    maior desvio do corpo em relação ao rastro da cabeça: ${pior.toFixed(2)} m`);
  // A tolerância é a amplitude da onda: a cabeça anda no centro e o corpo escreve a onda em volta.
  assert.ok(pior <= a.especie.serpente.ondaM + 0.35, `corpo a ${pior.toFixed(2)} m do caminho da cabeça`);
});

for (const [nome, graus] of [['90 graus', 90], ['180 graus', 180]]) {
  test(`serpáduna: curva de ${nome} sem esticar, sem atravessar e dentro do limite de curvatura`, () => {
    // Vai para o leste e, aos 25 s, o destino muda para o rumo novo.
    const { m, a } = cena({ destino: (mm) => (mm.t < 25 ? { x: 260, y: 150 } : { x: 150 + 110 * Math.cos((graus * Math.PI) / 180), y: 150 + 110 * Math.sin((graus * Math.PI) / 180) }) });
    const r = rodarCorpo(m, a, 110);
    // Raio mínimo de 4,5 m com juntas medidas a 0,61 m dá ~8°; o limite leva em conta a onda lateral.
    const limite = 30;
    console.log(`    curva ${nome}: variação ${(r.piorVariacao * 100).toFixed(2)}% · curvatura máx ${r.piorCurv.toFixed(1)}° em t=${r.tPior.toFixed(1)}s · folga mínima ${r.folgaMinima.toFixed(2)} m · retidão mínima ${r.retMin.toFixed(3)}`);
    assert.ok(r.piorVariacao < 0.03, `esticou ${(r.piorVariacao * 100).toFixed(1)}%`);
    assert.equal(r.cruzamentos, 0, 'o corpo se atravessou na curva');
    assert.ok(r.piorCurv < limite, `curvatura ${r.piorCurv.toFixed(1)}° por junta acima do limite de ${limite}°`);
    assert.ok(r.retMin < 0.93, `a retidão caiu só para ${r.retMin.toFixed(3)}: o corpo não chegou a curvar`);
  });
}

test('serpáduna: numa duna o corpo acompanha o relevo em vez de atravessar o terreno', () => {
  const { m, a } = cena({ terreno: { amplitude: 6 }, destino: { x: 260, y: 150 } });
  let piorAcima = 0, piorAbaixo = 0;
  rodar(m, 80, () => {
    for (const p of pontosDoCorpo(a, N)) {
      const h = altura(m.terreno, p.x, p.y);
      piorAbaixo = Math.min(piorAbaixo, p.z - h); piorAcima = Math.max(piorAcima, p.z - h);
    }
    return false;
  });
  console.log(`    corpo em relação ao terreno: de ${piorAbaixo.toFixed(2)} m a ${piorAcima.toFixed(2)} m`);
  assert.ok(piorAbaixo > -0.35, `corpo ${piorAbaixo.toFixed(2)} m abaixo do terreno`);
  assert.ok(piorAcima < 0.35, `corpo flutuando ${piorAcima.toFixed(2)} m acima do terreno`);
});

test('serpáduna: enrola e desenrola sem mudar de comprimento', () => {
  const { m, a } = cena();
  // Enrola parada; depois desenrola e segue em frente — é andando que o corpo volta a esticar.
  a.comandoTeste = (x, mm) => (mm.t < 30
    ? { estado: 'descansando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: null, ritmo: 'parado', postura: 'enrolada' }
    : { estado: 'vagando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: { x: 280, y: 150 }, ritmo: 'trote', postura: 'estendida' });
  const r = rodarCorpo(m, a, 110);
  console.log(`    retidão ${r.retMin.toFixed(3)} (enrolada) → ${r.fim.retidao.toFixed(3)} (estendida) · variação de comprimento ${(r.piorVariacao * 100).toFixed(2)}%`);
  assert.ok(r.retMin < 0.5, `não chegou a enrolar (retidão mínima ${r.retMin.toFixed(2)})`);
  assert.ok(r.fim.retidao > 0.9, `não voltou a estender (retidão final ${r.fim.retidao.toFixed(2)})`);
  assert.ok(r.piorVariacao < 0.05, `o corpo mudou de comprimento ${(r.piorVariacao * 100).toFixed(1)}% ao enrolar`);
  assert.equal(ev(m, 'serpente_enrolou', 'serp').length, 1);
  assert.equal(ev(m, 'serpente_desenrolou', 'serp').length, 1);
});

test('serpáduna: espécie sem a capacidade não ganha corpo de serpente', () => {
  const m = mundoTeste(cenarioTeste('sem-serp', [{ especie: 'varrisco', individuos: [{ id: 'v', x: 40, y: 150 }] }], CAMPO), 1);
  assert.equal(m.porId.get('v').serpente, undefined);
});

// ---------------------------------------------------------------- caça
const presa = (especie, id, x, y) => ({ especie, individuos: [{ id, x, y, direcaoGraus: 180, fome: 30, sede: 10, energia: 90 }] });

test('serpáduna: bote, veneno paralisante, espera e engolir inteira', () => {
  let mordeu = 0, paralisou = 0, engoliu = 0, esperou = 0;
  const linhas = [];
  for (let s = 1; s <= 12; s++) {
    const { m, a } = cena({ semente: s, x: 112, y: 150, graus: 0, terreno: { capim: 10, arbustos: [{ x: 112, y: 150, raio: 6, ocultacao: 85, alimento: 30 }] },
      presas: [presa('cromatil', 'presa', 150, 150.8)], duracao: 600 });
    a.fome = 85;
    // A presa atravessa a área da emboscada: é a bancada do bote, não um teste de ecologia. Enquanto não
    // percebe nada, segue em frente; ao perceber a serpente, a IA dela assume e pode fugir.
    const p0 = m.porId.get('presa');
    p0.comandoTeste = (x) => (x.contatos.some((k) => k.id === 'serp') || x.mente.atingidoPor ? null
      : { estado: 'vagando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: { x: 80, y: 150.8 }, ritmo: 'andar' });
    let picoVeneno = 0, viuEspera = 0;
    rodar(m, 600, () => {
      const p = m.porId.get('presa') ?? m.mortos.get('presa');
      if (p) picoVeneno = Math.max(picoVeneno, intensidadeVeneno(p, m.t));
      if (a.estado === 'acompanhando_presa') viuEspera = 1;
      return !!ev(m, 'engolir_fim', 'serp').length;
    });
    const ino = ev(m, 'inoculacao', 'presa').length;
    if (ino) mordeu++;
    if (picoVeneno >= 0.6) paralisou++;
    esperou += viuEspera;
    const fim = ev(m, 'engolir_fim', 'serp')[0];
    if (fim) { engoliu++; linhas.push(`s${s}: ${fim.massaKg} kg, fome → ${fim.fome}`); }
  }
  console.log(`    12 sementes: ${mordeu} inocularam · ${paralisou} paralisaram · ${esperou} esperaram o veneno · ${engoliu} engoliram`);
  for (const l of linhas.slice(0, 3)) console.log(`      ${l}`);
  assert.ok(mordeu > 0, 'nenhuma mordida com veneno em 12 sementes');
  assert.ok(engoliu > 0, `inoculou ${mordeu} vezes e nunca engoliu`);
});

test('serpáduna: não engole o que não cabe, e engolida não vira carcaça', () => {
  const { m, a } = cena({ x: 100, y: 150, presas: [presa('rocantraz', 'grande', 103, 150)] });
  const grande = m.porId.get('grande');
  const cabe = podeEngolir(a, grande);
  console.log(`    Rocantraz de ${grande.massa.toFixed(1)} kg e ${(grande.especie.corpo.alturaM).toFixed(2)} m de altura contra serpente de ${a.massa.toFixed(0)} kg: ${cabe.ok ? 'cabe' : cabe.motivo}`);
  // O limite é anatômico: altura do corpo acima do que a mandíbula abre.
  assert.equal(cabe.ok, false);
  assert.ok(['corpo_largo_demais', 'massa_acima_do_limite'].includes(cabe.motivo), cabe.motivo);
  // Pequena o bastante: engole, e não sobra carcaça para reciclar.
  const { m: m2, a: a2 } = cena({ x: 100, y: 150, presas: [presa('cromatil', 'pequena', 101.5, 150)] });
  const p = m2.porId.get('pequena');
  assert.equal(podeEngolir(a2, p).ok, true);
  p.saude.caidoAte = m2.t + 600; // rendida à mão: este teste é sobre engolir, não sobre caçar
  a2.fome = 90;
  const ok = rodar(m2, 120, () => !!ev(m2, 'engolir_fim', 'serp').length);
  assert.equal(ok, true, `não engoliu (estado ${a2.estado}: ${a2.motivo})`);
  assert.equal(m2.carcacas.filter((c) => c.animal === 'pequena').length, 0, 'engolida deixou carcaça');
  assert.equal((m2.mortos.get('pequena') ?? {}).causaMorte, 'engolida');
  assert.ok(a2.fome < 90, 'engolir não matou a fome');
  assert.ok(a2.mente.digerindoAte > m2.t, 'não entrou em digestão');
});

test('serpáduna: durante a digestão não caça', () => {
  const { m, a } = cena({ x: 100, y: 150, presas: [presa('cromatil', 'p', 140, 150)] });
  a.fome = 95;
  a.mente.digerindoAte = m.t + 60;
  let cacou = false;
  rodar(m, 50, () => { cacou ||= !!a.mente.caca || a.estado === 'perseguindo'; return false; });
  assert.equal(cacou, false, `caçou durante a digestão (estado ${a.estado})`);
  assert.equal(a.estado, 'digerindo');
});
