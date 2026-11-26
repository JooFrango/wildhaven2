// V7 — voo e bandos. Tudo medido no passo normal da simulação; nenhum teste posiciona o animal no ar "à mão"
// depois do início (só a ordem de voo vem da bancada, quando o teste isola a física).
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cenarioTeste, mundoTeste, rodar, ev } from './eco-ajudantes.mjs';
import { altura } from '../src/eco/terreno.js';
import { fatorAsas, localDePouso, noAr, podeDecolar } from '../src/eco/voo.js';

const CAMPO = { largura: 400, profundidade: 300, amplitude: 1, capim: 20 };
const ordem = (destino, extra = {}) => () => ({ estado: 'voando', codigo: 'teste', motivo: 'bancada', alvo: null, destino, ritmo: 'andar', voar: true, ...extra });

function umVoador({ terreno = {}, x = 60, y = 150, semente = 1, energia = 95, extra = {}, especie = 'carniroca' } = {}) {
  const m = mundoTeste(cenarioTeste('v7-voo', [{ especie, individuos: [{ id: 'ave', x, y, direcaoGraus: 0, energia, fome: 10, sede: 10, ...extra }] }], { ...CAMPO, ...terreno }), semente);
  return { m, a: m.porId.get('ave') };
}
// Roda registrando a trajetória 3D e conferindo, a cada passo, o que nunca pode acontecer.
function voar(m, a, ate, parar = () => false) {
  const cfg = a.especie.voo;
  let ant = { x: a.x, y: a.y, z: a.z }, maxPasso = 0, minAlt = Infinity, fases = new Set();
  const fim = rodar(m, ate, () => {
    const d = Math.hypot(a.x - ant.x, a.y - ant.y, a.z - ant.z);
    maxPasso = Math.max(maxPasso, d);
    assert.ok(d <= (cfg.velMax + cfg.descidaMax * 1.5) * m.dt + 0.05, `teletransporte: ${d.toFixed(2)} m em um passo (t=${m.t})`);
    assert.ok(a.voo.alt >= -1e-6, `atravessou o terreno: altitude ${a.voo.alt.toFixed(2)} (t=${m.t})`);
    assert.ok(Math.abs(a.z - (altura(m.terreno, a.x, a.y) + a.voo.alt)) < 1e-6, 'z não bate com terreno + altitude');
    if (a.voo.fase === 'voando') minAlt = Math.min(minAlt, a.voo.alt);
    fases.add(a.voo.fase);
    ant = { x: a.x, y: a.y, z: a.z };
    return parar();
  });
  return { fim, maxPasso, minAlt, fases };
}

test('voo: decolagem, subida e cruzeiro são deslocamento 3D real, sem salto de posição', () => {
  const { m, a } = umVoador();
  assert.equal(a.voo.fase, 'solo');
  a.comandoTeste = ordem({ x: 340, y: 150 }, { altitude: 22 });
  const r = voar(m, a, 25);
  assert.deepEqual([...r.fases].filter((f) => f !== 'solo'), ['decolando', 'voando']);
  assert.equal(ev(m, 'decolagem', 'ave').length, 1);
  assert.ok(a.voo.altMax > 18, `altitude máxima ${a.voo.altMax.toFixed(1)} m`);
  assert.ok(a.voo.metros > 150, `voou ${a.voo.metros.toFixed(0)} m`);
  assert.ok(a.velocidade >= a.especie.voo.velMin, 'no ar não fica abaixo da velocidade mínima');
  console.log(`    altitude máx ${a.voo.altMax.toFixed(1)} m, ${a.voo.metros.toFixed(0)} m voados, maior passo ${r.maxPasso.toFixed(2)} m`);
});

test('voo: relevo no caminho é contornado ou sobrevoado — nunca atravessado', () => {
  // Um morro de 30 m bem no rumo, mais alto que a altitude pedida (12 m).
  const { m, a } = umVoador({ terreno: { rochas: [{ x: 200, y: 150, raio: 22, altura: 30 }] } });
  a.comandoTeste = ordem({ x: 360, y: 150 }, { altitude: 12 });
  const r = voar(m, a, 60, () => a.x > 300);
  assert.equal(r.fim, true, `não chegou ao outro lado (x=${a.x.toFixed(0)})`);
  assert.equal(ev(m, 'queda', 'ave').length + ev(m, 'colisao_paredao', 'ave').length, 0, 'bateu no morro');
  assert.ok(r.minAlt > 1, `folga mínima sobre o terreno ${r.minAlt.toFixed(2)} m`);
  console.log(`    folga mínima ${r.minAlt.toFixed(1)} m, altitude máx ${a.voo.altMax.toFixed(1)} m, desvios ${a.voo.desvios}`);
});

test('voo: não sai do mapa', () => {
  const { m, a } = umVoador({ x: 340, extra: { altitudeInicialM: 20 } });
  a.comandoTeste = ordem({ x: 2000, y: 150 }, { altitude: 20 });
  voar(m, a, 40);
  assert.ok(a.x >= 0 && a.x <= 400 && a.y >= 0 && a.y <= 300, `fora do mapa: ${a.x.toFixed(0)},${a.y.toFixed(0)}`);
  assert.equal(ev(m, 'queda', 'ave').length, 0);
});

test('voo: pouso reduz velocidade, toca o chão no destino e não atravessa a superfície', () => {
  const { m, a } = umVoador({ extra: { altitudeInicialM: 20 } });
  const alvo = { x: 220, y: 160 };
  a.comandoTeste = () => (noAr(a) ? ordem(alvo, { pousar: true })() : null);
  const r = voar(m, a, 80, () => a.voo.fase === 'solo');
  assert.equal(r.fim, true, 'não pousou');
  const p = ev(m, 'pouso', 'ave')[0];
  assert.ok(p, `sem evento de pouso (quedas: ${ev(m, 'queda', 'ave').length})`);
  assert.ok(Math.hypot(p.x - alvo.x, p.y - alvo.y) < 12, `pousou a ${Math.hypot(p.x - alvo.x, p.y - alvo.y).toFixed(1)} m do alvo`);
  assert.ok(Math.abs(p.vz) < 3.5 && p.v <= a.especie.voo.velMin * 1.8, `toque forte: vz ${p.vz}, v ${p.v}`);
  assert.equal(a.voo.alt, 0);
  console.log(`    tocou a ${Math.hypot(p.x - alvo.x, p.y - alvo.y).toFixed(1)} m do alvo, vz ${p.vz} m/s, v ${p.v} m/s`);
});

test('voo: lago não é local de pouso — escolhe a margem', () => {
  const { m } = umVoador({ terreno: { lago: { x: 200, y: 150, raio: 14, fundo: 2 } } });
  const p = localDePouso(m, { x: 200, y: 150 });
  assert.ok(p, 'deveria achar margem');
  assert.ok(Math.hypot(p.x - 200, p.y - 150) > 8, 'escolheu ponto dentro do lago');
});

test('voo: subir batendo asa custa mais que planar; sem energia não decola', () => {
  const sobe = umVoador();
  sobe.a.comandoTeste = ordem({ x: 340, y: 150 }, { altitude: 60 });
  voar(sobe.m, sobe.a, 12);
  const desce = umVoador({ extra: { altitudeInicialM: 60 } });
  desce.a.comandoTeste = ordem({ x: 340, y: 150 }, { altitude: 8 });
  voar(desce.m, desce.a, 8);
  const porSegSobe = sobe.a.voo.energiaGasta / 12, porSegDesce = desce.a.voo.energiaGasta / 8;
  assert.ok(porSegSobe > porSegDesce * 3, `subida ${porSegSobe.toFixed(2)}/s × planeio ${porSegDesce.toFixed(2)}/s`);
  const cansado = umVoador({ energia: 10 });
  cansado.a.comandoTeste = ordem({ x: 340, y: 150 });
  rodar(cansado.m, 5);
  assert.equal(cansado.a.voo.fase, 'solo');
  assert.equal(cansado.a.voo.negado, 'energia_insuficiente');
  console.log(`    energia: subindo ${porSegSobe.toFixed(2)}/s, planando ${porSegDesce.toFixed(2)}/s`);
});

test('voo: asa ferida impede a decolagem e, no ar, obriga a descer', () => {
  const chao = umVoador();
  chao.a.saude.ferimentos.push({ id: 't', regiao: 'flanco', gravidade: 0.3, sangramento: 0, infeccao: 0, muscular: 0 });
  assert.ok(fatorAsas(chao.a) < 0.5);
  assert.equal(podeDecolar(chao.a, chao.m).motivo, 'asa_ferida');
  const ar = umVoador({ extra: { altitudeInicialM: 25 } });
  ar.a.comandoTeste = () => (noAr(ar.a) ? ordem({ x: 340, y: 150 }, { altitude: 25 })() : null);
  rodar(ar.m, 2);
  ar.a.saude.ferimentos.push({ id: 't', regiao: 'flanco', gravidade: 0.35, sangramento: 0, infeccao: 0, muscular: 0 });
  const r = voar(ar.m, ar.a, 40, () => ar.a.voo.fase === 'solo');
  assert.equal(r.fim, true, `continuou no ar com a asa ferida (alt ${ar.a.voo.alt.toFixed(1)})`);
});

test('voo: espécie terrestre não ganha estado de voo', () => {
  const { a } = umVoador({ especie: 'velsari' });
  assert.equal(a.voo, undefined);
});

// ---------------------------------------------------------------- bandos
function bando(n, { semente = 1, noChao = false, ameaca = null, duracao = 120 } = {}) {
  const ind = Array.from({ length: n }, (_, i) => ({ id: `ave${i + 1}`, x: 150 + (i % 5) * 9 + (i * 3) % 7, y: 130 + Math.floor(i / 5) * 9 + (i * 5) % 6, direcaoGraus: (i * 47) % 360, energia: 95, fome: 10, sede: 10, ...(noChao ? {} : { altitudeInicialM: 16 + (i % 4) * 3 }) }));
  const pops = [{ especie: 'carniroca', individuos: ind }];
  if (ameaca) pops.push({ especie: 'varrisco', individuos: [{ id: 'ameaca', ...ameaca, fome: 10, energia: 95 }] });
  const m = mundoTeste(cenarioTeste('v7-bando', pops, CAMPO, { duracaoSeg: duracao }), semente);
  return { m, aves: ind.map((i) => m.porId.get(i.id)) };
}
function medidas(aves) {
  const ar = aves.filter((a) => a.vivo && noAr(a));
  if (ar.length < 2) return null;
  let min = Infinity;
  for (let i = 0; i < ar.length; i++) for (let j = i + 1; j < ar.length; j++) min = Math.min(min, Math.hypot(ar[i].x - ar[j].x, ar[i].y - ar[j].y, ar[i].voo.alt - ar[j].voo.alt));
  const cx = ar.reduce((s, a) => s + a.x, 0) / ar.length, cy = ar.reduce((s, a) => s + a.y, 0) / ar.length;
  const raio = ar.reduce((s, a) => s + Math.hypot(a.x - cx, a.y - cy), 0) / ar.length;
  // Alinhamento: comprimento do vetor médio de direção (1 = todos no mesmo rumo).
  const alinh = Math.hypot(ar.reduce((s, a) => s + Math.cos(a.direcao), 0), ar.reduce((s, a) => s + Math.sin(a.direcao), 0)) / ar.length;
  return { n: ar.length, min, raio, alinh };
}

for (const n of [1, 3, 10, 20]) {
  test(`bando: ${n} voador(es) — separação, coesão, alinhamento e custo de CPU`, () => {
    const { m, aves } = bando(n);
    let minGlobal = Infinity, somaRaio = 0, somaAlinh = 0, k = 0, colisoes = 0;
    const contato = aves[0].especie.corpo.raio * 2 * 0.9;
    const formas = [];
    const t0 = performance.now();
    rodar(m, 90, () => {
      const q = medidas(aves);
      if (q) {
        // Contato de corpos pelo critério do próprio motor (resolverSobreposicoes): 90% da soma dos raios.
        minGlobal = Math.min(minGlobal, q.min); if (q.min < contato) colisoes++;
        if (m.t > 30) { somaRaio += q.raio; somaAlinh += q.alinh; k++; }
        if (m.tick % 100 === 0) formas.push(Math.hypot(aves[0].x - aves[1].x, aves[0].y - aves[1].y));
      }
      return false;
    });
    const ms = (performance.now() - t0) / m.tick;
    const quedas = aves.reduce((s, a) => s + a.voo.quedas, 0);
    console.log(`    n=${n}: distância mínima ${minGlobal === Infinity ? '—' : minGlobal.toFixed(2)} m, raio médio ${(k ? somaRaio / k : 0).toFixed(1)} m, alinhamento ${(k ? somaAlinh / k : 0).toFixed(2)}, quedas ${quedas}, ${ms.toFixed(3)} ms/passo`);
    assert.equal(quedas, 0, 'houve queda');
    if (n >= 3) {
      assert.equal(colisoes, 0, `${colisoes} passos com dois corpos a menos de ${contato.toFixed(2)} m`);
      const b = aves[0].especie.voo.bando;
      assert.ok(somaRaio / k < b.raioM, `raio médio ${(somaRaio / k).toFixed(1)} m ≥ raio de percepção do bando ${b.raioM} m — não há coesão`);
      assert.ok(somaAlinh / k > 0.5, `alinhamento ${(somaAlinh / k).toFixed(2)}`);
      // Não é um corpo rígido: a distância entre dois indivíduos varia ao longo do tempo.
      const media = formas.reduce((s, v) => s + v, 0) / formas.length;
      const dp = Math.sqrt(formas.reduce((s, v) => s + (v - media) * (v - media), 0) / formas.length);
      assert.ok(dp > 0.3, `distância entre dois indivíduos quase constante (dp ${dp.toFixed(2)} m): formação rígida`);
    }
  });
}

test('bando: ameaça terrestre faz o grupo decolar, dispersar e depois reagrupar', () => {
  const { m, aves } = bando(10, { noChao: true, ameaca: { x: 120, y: 140, direcaoGraus: 0 }, duracao: 200 });
  const amea = m.porId.get('ameaca');
  // A ameaça corre até o bando e depois vai embora: a volta da calma é o que permite reagrupar.
  amea.comandoTeste = () => (m.t < 12 ? { estado: 'perseguindo', codigo: 'teste', motivo: 'bancada', alvo: null, destino: { x: 170, y: 140 }, ritmo: 'corrida' }
    : { estado: 'recuando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: { x: 10, y: 10 }, ritmo: 'corrida' });
  let raioMax = 0, tMax = 0, raioFim = null, noArMax = 0, alts = new Set();
  rodar(m, 200, () => {
    const q = medidas(aves);
    noArMax = Math.max(noArMax, aves.filter(noAr).length);
    if (q) { if (q.raio > raioMax) { raioMax = q.raio; tMax = m.t; } if (m.t > 120) raioFim = q.raio; }
    if (m.t > 10 && m.t < 30) for (const a of aves) if (noAr(a)) alts.add(Math.round(a.voo.alt / 4));
    return false;
  });
  const decolagens = aves.reduce((s, a) => s + a.voo.decolagens, 0), pousos = aves.reduce((s, a) => s + a.voo.pousos, 0), quedas = aves.reduce((s, a) => s + a.voo.quedas, 0);
  console.log(`    no ar ao mesmo tempo ${noArMax}/10, raio máx ${raioMax.toFixed(1)} m (t=${tMax.toFixed(0)} s), raio após 120 s ${raioFim?.toFixed(1) ?? 'todos no chão'}, decolagens ${decolagens}, pousos ${pousos}, quedas ${quedas}`);
  assert.ok(noArMax >= 7, `só ${noArMax} decolaram diante da ameaça`);
  assert.ok(alts.size >= 2, 'todos fugiram na mesma altitude: não houve dispersão vertical');
  assert.ok(raioMax > 12, `raio máximo ${raioMax.toFixed(1)} m: não dispersou`);
  assert.ok(raioFim === null || raioFim < raioMax * 0.8, `não reagrupou: raio ${raioFim?.toFixed(1)} × máximo ${raioMax.toFixed(1)}`);
  assert.equal(quedas, 0);
  assert.ok(aves.every((a) => a.vivo), 'alguma ave morreu');
});
