// V7 — veneno. Os golpes são resolvidos de verdade (geometria, esquiva); nada aqui força acerto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cenarioTeste, mundoTeste, rodar, ev } from './eco-ajudantes.mjs';
import { iniciarAtaque, resolverGolpe } from '../src/eco/combate.js';
import { fatorMobilidade } from '../src/eco/saude.js';
import { intensidadeVeneno, sintomasVeneno } from '../src/eco/veneno.js';
import { passoEco } from '../src/eco/mundo.js';

// Predador e alvo frente a frente, a `dx` metros. Devolve o resultado de UM golpe resolvido.
function golpe(predEsp, alvoEsp, { dx = 0.9, semente = 1, ataque = 'mordida', alvo = {}, pred = {} } = {}) {
  const m = mundoTeste(cenarioTeste('v7-veneno', [
    { especie: predEsp, individuos: [{ id: 'pred', x: 60, y: 60, direcaoGraus: 0, ...pred }] },
    { especie: alvoEsp, individuos: [{ id: 'alvo', x: 60 + dx, y: 60, direcaoGraus: 0, ...alvo }] },
  ]), semente);
  const p = m.porId.get('pred'), v = m.porId.get('alvo');
  p.x = 60; p.y = 60; v.x = 60 + dx; v.y = 60; p.tAtual = m.t; v.tAtual = m.t;
  if (pred.hpFracao) p.saude.hp = p.saude.hpMax * pred.hpFracao;
  const hp0 = v.saude.hp;
  iniciarAtaque(p, v, p.especie.combate.ataques.find((x) => x.nome === ataque), m);
  m.t = p.golpe.impacto;
  resolverGolpe(p, m);
  return { m, p, v, feriu: v.saude.ferimentos.length > 0, danoGolpe: hp0 - v.saude.hp, inoc: ev(m, 'inoculacao', 'alvo')[0] ?? null };
}
// Só o tempo passa para a vítima (sem IA): isola a fisiologia do veneno.
function fisiologia(m, v, seg, cada = () => {}) {
  const { atualizarVeneno } = venenoMod;
  for (let i = 0; i < seg * 10; i++) { m.t = +(m.t + 0.1).toFixed(6); atualizarVeneno(v, m, 0.1); cada(); if (v.saude.hp <= 0) break; }
}
const venenoMod = await import('../src/eco/veneno.js');
const SEMENTES = Array.from({ length: 20 }, (_, i) => i + 1);

test('veneno: só entra com contato válido — todo golpe que fere inocula, todo golpe que erra não', () => {
  let acertos = 0, erros = 0;
  for (const s of SEMENTES) {
    const r = golpe('boscaranha', 'folhisco', { semente: s });
    if (r.feriu) { acertos++; assert.ok(r.inoc, `s${s}: feriu e não inoculou`); assert.ok(r.v.saude.venenos[0].carga > 0); }
    else { erros++; assert.equal(r.inoc, null, `s${s}: inoculou sem ferir`); assert.equal(r.v.saude.venenos, undefined); }
  }
  assert.ok(acertos > 0, 'nenhum golpe acertou em 20 sementes — a bancada não testa nada');
  // Fora do alcance do membro: erro garantido pela geometria, sem veneno e sem gasto de reserva.
  for (const s of SEMENTES.slice(0, 5)) {
    const r = golpe('boscaranha', 'folhisco', { semente: s, dx: 3 });
    assert.equal(r.feriu, false); assert.equal(r.inoc, null);
    assert.equal(r.p.veneno.reserva, r.p.especie.veneno.reservaMg, 'gastou veneno num golpe que errou');
  }
  console.log(`    acertos ${acertos}/20, erros ${erros}/20 (a 0,9 m)`);
});

function primeiroAcerto(predEsp, alvoEsp, opcoes = {}) {
  for (const s of SEMENTES) { const r = golpe(predEsp, alvoEsp, { ...opcoes, semente: s }); if (r.inoc) return r; }
  assert.fail(`nenhuma inoculação de ${predEsp} em ${alvoEsp} em 20 sementes`);
}

test('veneno: dose pequena em animal grande dá sintomas leves; a mesma glândula derruba um animal pequeno', () => {
  // Velsari não é presa da Boscaranha: ela só gasta veneno nele acuada (vida < 60%).
  const grande = primeiroAcerto('boscaranha', 'velsari', { pred: { hpFracao: 0.5 } });
  const pequeno = primeiroAcerto('boscaranha', 'folhisco');
  assert.ok(grande.inoc.carga < pequeno.inoc.carga / 2, `carga grande ${grande.inoc.carga} × pequeno ${pequeno.inoc.carga}`);
  let picoG = 0, picoP = 0, paralisouG = false, paralisouP = false;
  fisiologia(grande.m, grande.v, 120, () => { picoG = Math.max(picoG, intensidadeVeneno(grande.v, grande.m.t)); paralisouG ||= sintomasVeneno(grande.v).includes('paralisia'); });
  fisiologia(pequeno.m, pequeno.v, 120, () => { picoP = Math.max(picoP, intensidadeVeneno(pequeno.v, pequeno.m.t)); paralisouP ||= sintomasVeneno(pequeno.v).includes('paralisia'); });
  assert.equal(paralisouG, false, 'animal grande não deveria paralisar com uma mordida');
  assert.equal(paralisouP, true, `animal pequeno deveria paralisar (pico ${picoP.toFixed(2)})`);
  assert.ok(grande.v.saude.hp > grande.v.saude.hpMax * 0.5, 'animal grande sobrevive com folga');
  console.log(`    pico de intensidade: velsari ${picoG.toFixed(2)}, folhisco ${picoP.toFixed(2)}`);
});

test('veneno: resistência reduz carga e duração, mas não é imunidade', () => {
  const comum = primeiroAcerto('boscaranha', 'folhisco');
  const resistente = primeiroAcerto('boscaranha', 'folhisco', { alvo: { resistenciaVeneno: 0.8 } });
  const cc = comum.v.saude.venenos[0], cr = resistente.v.saude.venenos[0];
  assert.ok(cr.carga > 0, 'resistente não pode ser imune');
  // Mesma região → razão exata de (1 − 0,8); regiões diferentes mudam o peso, então compara normalizado.
  assert.ok(cr.carga < cc.carga * 0.45, `carga resistente ${cr.carga.toFixed(3)} × comum ${cc.carga.toFixed(3)}`);
  assert.ok(cr.meiaVidaSeg < cc.meiaVidaSeg, 'o resistente metaboliza mais rápido');
  assert.equal(resistente.inoc.resistencia, 0.8);
});

test('veneno: sintomas reduzem a mobilidade, expiram e não deixam dano residual', () => {
  const r = primeiroAcerto('boscaranha', 'velsari', { pred: { hpFracao: 0.5 } });
  const v = r.v;
  v.saude.ferimentos = []; // isola o efeito do veneno do ferimento da mordida
  let minMob = 1;
  fisiologia(r.m, v, 60, () => { minMob = Math.min(minMob, fatorMobilidade(v)); });
  assert.ok(minMob < 0.9, `mobilidade mínima ${minMob.toFixed(2)} — o veneno não mudou o movimento`);
  fisiologia(r.m, v, 1500);
  assert.equal(v.saude.venenos.length, 0, 'a carga deveria ter expirado');
  assert.equal(ev(r.m, 'veneno_expirou', 'alvo').length, 1);
  assert.equal(fatorMobilidade(v), 1, 'mobilidade volta ao normal');
  const hp = v.saude.hp;
  fisiologia(r.m, v, 60);
  assert.equal(v.saude.hp, hp, 'veneno expirado continuou causando dano');
});

test('veneno: reserva é finita, recarrega devagar e é poupada em quem não é presa nem ameaça', () => {
  const seca = golpe('boscaranha', 'velsari', { semente: primeiroAcerto('boscaranha', 'velsari', { pred: { hpFracao: 0.5 } }).m.semente });
  assert.ok(seca.feriu, 'o golpe deveria ferir');
  assert.equal(seca.inoc, null, 'gastou veneno num animal que não é presa, sem estar acuada');
  assert.equal(ev(seca.m, 'mordida_seca', 'pred')[0].motivo, 'poupou_veneno');
  // Esgota a glândula e confere a mordida seca por reserva.
  const r = primeiroAcerto('boscaranha', 'folhisco');
  assert.ok(r.p.veneno.reserva < r.p.especie.veneno.reservaMg);
  r.p.veneno.reserva = 0.1;
  const antes = r.v.saude.venenos.length;
  venenoMod.inocular(r.p, r.v, 'mordida', r.v.saude.ferimentos[0], r.m);
  assert.equal(r.v.saude.venenos.length, antes, 'inoculou com a glândula vazia');
  fisiologia(r.m, r.p, 100);
  assert.ok(r.p.veneno.reserva > 0.1 && r.p.veneno.reserva <= r.p.especie.veneno.reservaMg, 'reserva recarrega dentro do limite');
});

test('veneno hemotóxico: dose alta em animal pequeno mata e a causa registrada é envenenamento', () => {
  const r = primeiroAcerto('proto-serpente-termica', 'folhisco', { dx: 1.2 });
  assert.equal(r.inoc.veneno, 'hemotoxico');
  assert.ok(r.v.vivo, 'sobreviveu ao golpe em si');
  // Mundo real a partir daqui: a morte tem de sair do passo normal da simulação.
  r.p.x = 20; r.p.y = 20; // afasta o predador: quem mata é o veneno
  rodar(r.m, r.m.t + 400, () => !r.m.porId.has('alvo'));
  const morte = ev(r.m, 'morte', 'alvo')[0];
  assert.ok(morte, `não morreu (hp ${r.v.saude.hp.toFixed(1)}/${r.v.saude.hpMax.toFixed(1)})`);
  assert.equal(morte.causa, 'envenenamento');
  assert.equal(morte.por, 'pred');
});

test('veneno: depois de inocular, o predador acompanha a presa em vez de continuar o combate', () => {
  // Parte de uma mordida real (resistência alta: a presa não cai logo) e solta a IA normal dos dois.
  let acompanhou = 0, casos = 0, atacouCedo = 0;
  for (const s of SEMENTES) {
    const r = golpe('boscaranha', 'cromatil', { semente: s, pred: { fome: 80, energia: 95 }, alvo: { resistenciaVeneno: 0.8 } });
    if (!r.inoc) continue;
    casos++;
    const t0 = r.m.t, espera = r.p.especie.veneno.latenciaSeg * 2;
    let viu = false, cedo = false;
    rodar(r.m, t0 + espera - 1, (mm) => {
      const p = mm.porId.get('pred'), v = mm.porId.get('alvo');
      if (!p || !v) return true;
      if (p.estado === 'acompanhando_presa') viu = true;
      // Enquanto a presa está de pé e à vista, não pode voltar a golpear antes do tempo.
      if (p.golpe && v.saude.caidoAte <= mm.t) cedo = true;
      return false;
    });
    if (viu) acompanhou++;
    if (cedo) atacouCedo++;
  }
  assert.ok(casos >= 5, `só ${casos} inoculações em 20 sementes`);
  assert.ok(acompanhou >= casos * 0.8, `acompanhou em ${acompanhou} de ${casos} casos`);
  assert.equal(atacouCedo, 0, `voltou a golpear antes de o veneno agir em ${atacouCedo} casos`);
  console.log(`    ${casos} inoculações; acompanhou a presa em ${acompanhou}; atacou cedo em ${atacouCedo}`);
});

test('veneno: espécie sem a capacidade não ganha estado nem inocula', () => {
  const r = golpe('varrisco', 'velsari', { dx: 1.2 });
  assert.equal(r.p.veneno, undefined);
  assert.equal(r.inoc, null);
  for (let i = 0; i < 50; i++) passoEco(r.m);
  assert.equal(r.m.metricas.inoculacoes, undefined);
});
