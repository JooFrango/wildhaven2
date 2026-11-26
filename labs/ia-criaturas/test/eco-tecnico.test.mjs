import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { hashMundo, passoEco } from '../src/eco/mundo.js';
import { carregarMundo, salvarMundo } from '../src/eco/persistencia.js';
import { buscarCaminho, gerarTerrenoProcedural, indice, perfilMobilidade } from '../src/eco/terreno.js';
import { carregarConfigEco } from '../src/eco/config.js';
import { Rng } from '../src/eco/rng.js';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { CFG, cenarioTeste, ev, mundoTeste, rodar } from './eco-ajudantes.mjs';

const populacao20 = [
  { especie: 'velsari', grupos: [{ x: 60, y: 60, raio: 4, adultos: 7, filhotes: 2, fome: 30 }, { x: 110, y: 80, raio: 4, adultos: 6, fome: 30 }] },
  { especie: 'cromatil', individuos: [{ x: 90, y: 30 }, { x: 30, y: 100 }] },
  { especie: 'tarruco', individuos: [{ x: 130, y: 30 }, { x: 140, y: 100 }] },
  { especie: 'varrisco', individuos: [{ id: 'v1', x: 20, y: 20, sexo: 'M', fome: 70 }, { id: 'v2', x: 150, y: 110, sexo: 'M', fome: 70 }] },
];
const cen20 = () => cenarioTeste('pop20', populacao20, { lago: { x: 85, y: 60, raio: 9, fundo: 2 } });

test('20+ animais ativos no nível 1: sem falhas, custo por indivíduo registrado', () => {
  const m = mundoTeste(cen20(), 1);
  assert.ok(m.vivos.length >= 20, `${m.vivos.length} animais`);
  // Tempo de CPU do próprio processo (os arquivos de teste rodam em paralelo; relógio de parede oscila).
  const ini = process.cpuUsage();
  rodar(m, 60);
  const cpu = process.cpuUsage(ini);
  const ms = (cpu.user + cpu.system) / 1000;
  assert.equal(m.metricas.falhas.length, 0, JSON.stringify(m.metricas.falhas.slice(0, 3)));
  const porAnimalSeg = ms / m.animais.length / 60;
  assert.ok(porAnimalSeg < 5, `custo ${porAnimalSeg.toFixed(3)} ms por animal por segundo simulado`);
  assert.ok(m.custo.passosN1 > 0);
});

test('determinismo: mesma semente → mesma trilha; sementes diferentes → trilhas diferentes', () => {
  const h = (s) => { const m = mundoTeste(cen20(), s); rodar(m, 40); return hashMundo(m); };
  assert.equal(h(3), h(3));
  assert.notEqual(h(3), h(4));
});

test('persistência: salvar, carregar e continuar = nunca ter parado', () => {
  const direto = mundoTeste(cen20(), 5); rodar(direto, 50);
  const parte = mundoTeste(cen20(), 5); rodar(parte, 25);
  const json = JSON.stringify(salvarMundo(parte));
  const cfg = { ...CFG, cenarios: { ...CFG.cenarios, pop20: cen20() } };
  const retomado = carregarMundo(cfg, JSON.parse(json));
  rodar(retomado, 50);
  assert.equal(hashMundo(retomado), hashMundo(direto));
  assert.deepEqual(retomado.vivos.map((a) => [a.id, +a.x.toFixed(6), +a.fome.toFixed(6), a.saude.ferimentos.length]), direto.vivos.map((a) => [a.id, +a.x.toFixed(6), +a.fome.toFixed(6), a.saude.ferimentos.length]));
});

test('níveis de simulação: foco móvel, sem eventos duplicados nem tempo integrado duas vezes', () => {
  const cen = cenarioTeste('niv', populacao20, { largura: 240, profundidade: 160, lago: { x: 85, y: 60, raio: 9, fundo: 2 } }, { relogio: { segundosPorDia: 120, diaInicial: 20, horaInicial: 8 } });
  const m = mundoTeste(cen, 6, { observacao: { x: 20, y: 20, raioN1: 50, raioN2: 110 }, eventosDetalhados: false });
  for (let i = 0; i < 12; i++) { m.opcoes.observacao.x = 20 + i * 18; m.opcoes.observacao.y = 20 + (i % 3) * 50; rodar(m, (i + 1) * 60); }
  const niveis = new Set(ev(m, 'nivel').map((e) => e.para));
  assert.ok(niveis.size >= 2, 'houve trocas de nível');
  const mortes = ev(m, 'morte').map((e) => e.id);
  assert.equal(new Set(mortes).size, mortes.length, 'ninguém morre duas vezes');
  const nasc = [...ev(m, 'nascimento'), ...ev(m, 'eclosao')].map((e) => e.id);
  assert.equal(new Set(nasc).size, nasc.length, 'ninguém nasce duas vezes');
  for (const a of m.vivos) assert.ok(a.tempo <= m.t + 1e-9, 'necessidades nunca integradas além do relógio');
  // Cada dia de cada animal processado uma vez.
  const dias = [...m.ledger].filter((k) => k.startsWith('dia:'));
  assert.equal(new Set(dias).size, dias.length);
});

test('navegação 3D: paredão e água funda bloqueiam; contorna quando há passagem; Cromátil escala rochas', () => {
  const t = gerarTerrenoProcedural(new Rng(1), { largura: 100, profundidade: 80, res: 1, amplitude: 0.2, penhasco: { x: 50, y0: 0, y1: 60, altura: 8 }, lago: { x: 25, y: 65, raio: 8, fundo: 3 }, rochas: [{ x: 75, y: 70, raio: 3, altura: 2 }] });
  const velsari = perfilMobilidade(t, CFG.especies.velsari.movimento);
  const cromatil = perfilMobilidade(t, CFG.especies.cromatil.movimento);
  // Paredão vertical em x = 50 (y 0–60) que ergue um platô a leste: o platô é inalcançável para o Velsari...
  assert.ok(!buscarCaminho(t, velsari, { x: 30, y: 20 }, { x: 70, y: 20 }).completo, 'não sobe o paredão');
  // ...e um destino no nível baixo do outro lado exige contornar a ponta sul do paredão.
  const r = buscarCaminho(t, velsari, { x: 40, y: 20 }, { x: 70, y: 72 });
  assert.ok(r.completo, 'há caminho contornando');
  for (const p of r.pontos) { const k = indice(t, p.x, p.y); assert.equal(velsari.passavel[k], 1); }
  assert.ok(r.pontos.some((p) => p.y > 60 && Math.abs(p.x - 50) < 6), 'passa pela ponta sul do paredão');
  assert.equal(velsari.passavel[indice(t, 25, 65)], 0, 'lago fundo intransponível para Velsari');
  assert.equal(velsari.passavel[indice(t, 75, 70)], 0, 'rocha bloqueia Velsari');
  assert.equal(cromatil.passavel[indice(t, 75, 70)], 1, 'Cromátil escala rochas');
});

test('mundo real: Velsari não atravessa o paredão nem o lago durante a simulação', () => {
  const m = mundoTeste(cenarioTeste('nav', [{ especie: 'velsari', grupos: [{ x: 30, y: 30, raio: 3, adultos: 5, fome: 90, sede: 10 }] }], { largura: 120, profundidade: 90, penhasco: { x: 60, y0: 0, y1: 70, altura: 8 }, lago: { x: 30, y: 70, raio: 9, fundo: 3 }, capim: 5 }), 2);
  const perfil = perfilMobilidade(m.terreno, CFG.especies.velsari.movimento);
  rodar(m, 120, (mm) => { for (const a of mm.vivos) assert.equal(perfil.passavel[indice(mm.terreno, a.x, a.y)], 1, `${a.id} em célula intransponível`); return false; });
});

test('src/eco usa só matemática determinística (sem Math.sin/cos/pow/log/exp/hypot/**)', async () => {
  const proibido = /Math\.(sin|cos|tan|atan2?|asin|acos|hypot|exp|log\w*|pow|cbrt)\b|\*\*/;
  const pasta = join(RAIZ_LAB, 'src', 'eco');
  for (const f of (await readdir(pasta)).filter((x) => x.endsWith('.js'))) {
    (await readFile(join(pasta, f), 'utf8')).split('\n').forEach((l, i) => { if (!l.trim().startsWith('//')) assert.doesNotMatch(l, proibido, `${f}:${i + 1}`); });
  }
});

// Paridade com o navegador: configurações V2 servidas por HTTP == lidas do disco, e o mesmo hash.
let srv, porta;
before(async () => {
  porta = 0; // SO escolhe uma porta livre; evita faixas reservadas no Windows.
  srv = spawn(process.execPath, [join(RAIZ_LAB, 'scripts', 'servidor.mjs'), '--porta', String(porta)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, erro) => { srv.stdout.on('data', (d) => (()=>{const m=String(d).match(/http:\/\/localhost:(\d+)/);if(m){porta=Number(m[1]);ok();}})()); srv.on('exit', (c) => erro(new Error(`servidor saiu (${c})`))); });
});
after(() => srv?.kill());
test('paridade página × CLI (configurações V2 por HTTP)', async () => {
  const web = await carregarConfigEco(async (rel) => (await fetch(`http://127.0.0.1:${porta}/${rel}`)).json());
  assert.deepEqual(web.especies, CFG.especies);
  const { rodarCenario } = await import('../src/eco/analise.js');
  assert.equal(rodarCenario(web, 'bebedouro', 2, { segundos: 30 }).resumo.hash, rodarCenario(CFG, 'bebedouro', 2, { segundos: 30 }).resumo.hash);
});
