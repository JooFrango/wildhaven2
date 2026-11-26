// E7: ligação dos 12 clipes do rig v13 ao laboratório. Confere o remapeamento estado -> clipe, o tempo das ações da
// simulação tirado dos metadados reais dos clipes (sem esticar nada) e o deslocamento autorado aplicado UMA vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import TRAJ from '../src/trajetorias-pve2.js';
import { remapPve2, PEGADA } from '../src/animacao-jogador.js';
import { usarPve2, pve2Ligado, clipePve2, interrupcaoAberta } from '../src/trajetoria-arma.js';
import { estilo, planoPve2, podeInterromper, rolarManualPve2, moverEsquivasPve1, marcarAvancoPve2, escalaCorpo,
  ataqueManualPve2, marcarAtaqueManualPve2, folgaCorpo, FOLGA_AVANCO } from '../src/combate-jogador.js';
import { cenarioDuelo, mundoDuelo, doisHunters } from './ajudantes.mjs';
import { passoHunters } from '../src/mundo-hunters.js';

const glb = readFileSync(new URL('../assets/hunter-rig-v13/hunter_rig_v13_blockout.glb', import.meta.url));
const extras = Object.fromEntries(JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12))).animations.map((a) => [a.name, a.extras ?? {}]));
const CLIPES = Object.keys(extras);
// Controlador falso: só precisa das ações do GLB e dos extras, que é o que o remapeamento consulta.
const controlador = () => ({
  actions: Object.fromEntries(CLIPES.map((n) => [n, { getClip: () => ({ duration: extras[n].duration ?? 1 }) }])),
  clipMeta: extras,
});
const agente = (hunter = {}) => ({ hunter: { equipamento: { arma: 'espada' }, ...hunter } });
const duelo = () => {
  const m = mundoDuelo(cenarioDuelo('pve2-lab', doisHunters({ arma: 'espada' }, { arma: 'espada' }, { dist: 3 })), 11);
  return { m, a: m.hunters[0] };
};

test('o interruptor PvE v02 é opt-in e implica o PvE v01', () => {
  usarPve2(false);
  assert.equal(pve2Ligado(), false);
  usarPve2(true);
  assert.equal(pve2Ligado(), true);
});

test('remapPve2 leva cada estado canônico a um clipe do rig v13 e nunca a um clipe v05, pvp12 ou pve1', () => {
  usarPve2(true);
  const o = controlador();
  const r = (name, extra = {}, a) => remapPve2(o, { name, time: 0.2, ...extra }, 1, a);
  assert.equal(r('hunter_walk').name, 'pve2_a_sword_walk');
  assert.equal(r('hunter_walk').locomotion, true);
  assert.equal(r('hunter_jog').name, 'pve2_a_sword_jog');
  assert.equal(r('hunter_run').name, 'pve2_a_sword_run');
  // Passos laterais e para trás ainda não têm clipe: usam a caminhada, com o passo pela distância andada.
  for (const n of ['combat_step_back', 'combat_step_left', 'combat_step_right']) assert.equal(r(n).name, 'pve2_a_sword_walk', n);
  assert.equal(r('combat_dodge', {}, agente({ dodgeLado: 'left' })).name, 'pve2_b_sword_roll_left');
  assert.equal(r('combat_dodge', {}, agente({ dodgeLado: 'right' })).name, 'pve2_b_sword_roll_right');
  // Sem clipe autorado no rig v13 (bloqueio, reação, queda, cambaleio, rendição, giro parado): guarda PvE v02.
  for (const n of ['combat_block', 'combat_hit', 'combat_hit_heavy', 'combat_guard_recoil', 'combat_death',
    'combat_knockdown', 'combat_stagger', 'combat_surrender', 'combat_get_up', 'combat_turn_left', 'combat_turn_right',
    'guard_sword', 'recover_sword']) assert.equal(r(n).name, 'pve2_b_sword_guard', n);
  for (const clipe of CLIPES.filter((n) => n !== 'rig13_stress')) assert.ok(/^pve2_/.test(clipe), clipe);
});

test('o combo encadeia 1 -> 2 -> 3 -> 1 e cada golpe toca o clipe que a simulação escolheu', () => {
  usarPve2(true);
  const o = controlador();
  for (const [indice, esperado] of [[0, 1], [1, 2], [2, 3], [3, 1]]) {
    assert.equal(clipePve2('', indice), `pve2_c_sword_combo_${esperado}`);
    const plano = planoPve2(false, indice), tab = TRAJ[plano.clip];
    assert.equal(plano.clip, `pve2_c_sword_combo_${esperado}`);
    assert.equal(plano.carga, 0);
    // Preparo e recuperação são os do próprio clipe: a ação da simulação dura exatamente o clipe (fator 1,00×).
    assert.equal(plano.windup, tab.impact);
    assert.equal(+(plano.windup + plano.recovery).toFixed(6), +tab.duration.toFixed(6));
    const action = { start: 10, clip: plano.clip, clipeInicio: 10 };
    const spec = remapPve2(o, { name: 'sword_light', time: 0.1, impact: plano.windup, duration: tab.duration }, 10.1, { hunter: { action } });
    assert.equal(spec.name, plano.clip);
    assert.equal(spec.impact, tab.impact);
    assert.equal(spec.duration, tab.duration);
  }
});

test('no teclado, três toques em J dão os três golpes do combo, mesmo se o golpe erra', () => {
  usarPve2(true);
  const { m, a } = duelo();
  const bater = (pesado = false) => {
    const plano = ataqueManualPve2(a, pesado, m.t);
    a.golpe = { impacto: m.t + plano.windup };
    (a.tatica ??= {}).action = { name: 'golpe', start: m.t, impact: m.t + plano.windup, end: m.t + plano.windup };
    marcarAtaqueManualPve2(a, plano);
    // Erro do golpe: a cadeia da IA zera (regra do lote anterior), e a do teclado segue.
    a.hunter.jogador = { ...(a.hunter.jogador ?? {}), chain: 0, lastResult: 'miss' };
    m.t = a.hunter.action.end + 0.2;
    return plano.clip;
  };
  assert.equal(bater(), 'pve2_c_sword_combo_1');
  assert.equal(bater(), 'pve2_c_sword_combo_2');
  assert.equal(bater(), 'pve2_c_sword_combo_3');
  assert.equal(bater(), 'pve2_c_sword_combo_1');   // volta ao começo
  // Passada a janela, a cadeia reinicia; e o pesado não avança o combo.
  assert.equal(bater(true), 'pve2_c_sword_charge_release');
  assert.equal(bater(), 'pve2_c_sword_combo_1');
  m.t += 5;
  assert.equal(ataqueManualPve2(a, false, m.t).clip, 'pve2_c_sword_combo_1');
});

test('o pesado é carga em laço mais liberação: o laço roda em tempo real e a liberação não é esticada', () => {
  usarPve2(true);
  const o = controlador(), plano = planoPve2(true, 0), carga = TRAJ.pve2_c_sword_charge_loop.duration, R = TRAJ.pve2_c_sword_charge_release;
  assert.equal(plano.clip, 'pve2_c_sword_charge_release');
  assert.equal(plano.carga, carga);
  assert.equal(plano.windup, carga + R.impact);
  assert.equal(+(plano.windup + plano.recovery).toFixed(6), +(carga + R.duration).toFixed(6));
  const action = { start: 0, clip: plano.clip, clipeInicio: carga };
  const pedido = (time) => remapPve2(o, { name: 'sword_heavy', time, impact: plano.windup, duration: plano.windup + plano.recovery }, time, { hunter: { action } });
  assert.equal(pedido(0.5).name, 'pve2_c_sword_charge_loop');   // ainda carregando
  const solta = pedido(carga + 0.05);
  assert.equal(solta.name, 'pve2_c_sword_charge_release');
  assert.equal(+solta.time.toFixed(6), 0.05);                   // tempo contado do início da liberação
  assert.equal(solta.impact, R.impact);
  assert.equal(solta.duration, R.duration);
});

test('no laboratório, a ação do golpe comandado dura exatamente o clipe (fator 1,00×)', () => {
  usarPve2(true);
  const m = mundoDuelo(cenarioDuelo('pve2-manual', doisHunters({arma: 'espada'}, {arma: 'espada'}, {dist: 1})), 11);
  const [a, b] = m.hunters;
  a.hunter.controle = 'manual'; b.hunter.controle = 'manual';
  const bater = (comando) => {
    a.hunter.comando = comando;
    let r = null;
    for (let i = 0; i < 40; i++) {passoHunters(m);
      const ac = a.hunter.action;
      if (a.golpe && ac && ac.start >= m.t - 0.3) {r = {clip: ac.clip, preparo: +(ac.impact - ac.start).toFixed(4), total: +(ac.end - ac.start).toFixed(4)}; break;}}
    a.hunter.comando = {};
    for (let i = 0; i < 30; i++) {passoHunters(m); if (!a.golpe && !a.recargas.golpe_corte_leve) break;}
    return r;
  };
  for (const esperado of ['pve2_c_sword_combo_1', 'pve2_c_sword_combo_2', 'pve2_c_sword_combo_3']) {
    const r = bater({atacar: true}), tab = TRAJ[esperado];
    assert.equal(r.clip, esperado);
    assert.equal(r.preparo, +tab.impact.toFixed(4));
    assert.equal(r.total, +tab.duration.toFixed(4));
  }
  // Pesado (tecla H): carga em laço mais liberação, com o tempo das duas somado.
  const h = bater({pesado: true}), carga = TRAJ.pve2_c_sword_charge_loop.duration, R = TRAJ.pve2_c_sword_charge_release;
  assert.equal(h.clip, 'pve2_c_sword_charge_release');
  assert.equal(h.preparo, +(carga + R.impact).toFixed(4));
  assert.equal(h.total, +(carga + R.duration).toFixed(4));
});

test('o estilo da espada no PvE v02 sai dos clipes: cadeia de 3, pesado com carga e alcance da lâmina autorada', () => {
  usarPve2(true);
  const { a } = duelo(), e = estilo(a);
  assert.equal(e.pve2, true);
  assert.equal(e.chain, 3);
  assert.equal(e.light, TRAJ.pve2_c_sword_combo_1.impact);
  assert.equal(e.heavy, TRAJ.pve2_c_sword_charge_loop.duration + TRAJ.pve2_c_sword_charge_release.impact);
  assert.ok(e.reach > 0.6 && e.reach < 1.6, `alcance ${e.reach}`);
  usarPve2(false);
  assert.equal(estilo(a).pve2, undefined);   // sem o interruptor PvE v02, o estilo volta a ser o do lote anterior
  usarPve2(true);
});

test('as janelas de interrupção são as do clipe e contam do início do clipe, não da ação', () => {
  usarPve2(true);
  assert.equal(interrupcaoAberta('pve2_c_sword_combo_1', 0.6, 'combo_2'), true);
  assert.equal(interrupcaoAberta('pve2_c_sword_combo_1', 0.3, 'combo_2'), false);
  assert.equal(interrupcaoAberta('pve2_b_sword_roll_left', 0.7, 'combo_1'), true);
  assert.equal(interrupcaoAberta('pve2_b_sword_roll_left', 0.4, 'combo_1'), false);
  // Pesado: a janela da liberação abre 0,7333 s depois do fim da carga, não depois do início da ação.
  const carga = TRAJ.pve2_c_sword_charge_loop.duration, action = { start: 0, clipeInicio: carga, clip: 'pve2_c_sword_charge_release', cancelAfter: 99 };
  assert.equal(podeInterromper(action, carga + 0.8, 'dodge'), true);
  assert.equal(podeInterromper(action, 0.8, 'dodge'), false);
});

test('o rolamento manual anda os 1,3 m da curva do clipe, uma única vez', () => {
  usarPve2(true);
  const { m, a } = duelo();
  a.direcao = 0;
  const x0 = a.x, y0 = a.y;
  assert.equal(rolarManualPve2(a, m, 'right'), true);
  assert.equal(a.hunter.esquivaPve.clip, 'pve2_b_sword_roll_right');
  const tab = TRAJ.pve2_b_sword_roll_right;
  assert.equal(+(a.hunter.dodgeUntil - m.t).toFixed(6), tab.duration);
  // Passo a passo, como o laboratório faz: o deslocamento vem só da curva, uma vez por quadro.
  for (let n = 0; n < 40 && a.hunter.esquivaPve; n++) { moverEsquivasPve1(m); m.t += m.dt; }
  assert.equal(a.hunter.esquivaPve, null);
  const andou = Math.hypot(a.x - x0, a.y - y0), esperado = Math.abs(tab.rootMotion.distanceM) * escalaCorpo(a);
  assert.ok(Math.abs(andou - esperado) < 0.02, `andou ${andou.toFixed(3)} m, esperado ${esperado.toFixed(3)} m`);
  // Lado: mesma convenção da esquiva do lote 1 — à direita o corpo sai no sentido de direcao + 90°, de lado e não à frente.
  assert.ok(a.y > y0 + 0.5 && Math.abs(a.x - x0) < 0.2, `saiu para o lado certo (${(a.x - x0).toFixed(2)}, ${(a.y - y0).toFixed(2)})`);
  moverEsquivasPve1(m);
  assert.equal(+Math.hypot(a.x - x0, a.y - y0).toFixed(6), +andou.toFixed(6));   // não anda de novo depois do fim
});

test('o avanço autorado do golpe entra uma vez pela simulação; o clipe toca em lugar', () => {
  usarPve2(true);
  const { m, a } = duelo();
  a.direcao = 0;
  const x0 = a.x, action = { start: m.t, clipeInicio: m.t };
  marcarAvancoPve2(a, action, 'pve2_c_sword_combo_3');
  for (let n = 0; n < 80 && a.hunter.avancoPve; n++) { moverEsquivasPve1(m); m.t += m.dt; }
  const esperado = TRAJ.pve2_c_sword_combo_3.rootMotion.distanceM * escalaCorpo(a);
  assert.ok(Math.abs(a.x - x0 - esperado) < 0.02, `avançou ${(a.x - x0).toFixed(3)} m, esperado ${esperado.toFixed(3)} m`);
  // A carga em laço não desloca: não há curva para aplicar.
  marcarAvancoPve2(a, action, 'pve2_c_sword_charge_loop');
  assert.equal(a.hunter.avancoPve, null);
});

test('contatos de pé e pegada vêm dos extras do GLB; só a corrida é de pegada reversa', () => {
  for (const n of CLIPES.filter((x) => x !== 'rig13_stress')) {
    const fc = extras[n].footContacts;
    assert.ok(fc?.left?.length && fc?.right?.length, `${n}: contatos de pé autorados`);
  }
  assert.equal(extras.pve2_a_sword_run.bladeCarry.grip, 'reverse');
  for (const n of ['pve2_a_sword_walk', 'pve2_a_sword_jog']) assert.equal(extras[n].bladeCarry.grip, 'normal');
  assert.ok(PEGADA >= 0.2, `a troca de pegada tem rampa de ${PEGADA} s, não um salto de 180° num quadro`);
});

test('no contato, o corpo gira e a lâmina do rig v13 passa na linha da frente, não ao lado', async () => {
  const { giroAcao, giroContatoPve, amostrarArma } = await import('../src/trajetoria-arma.js');
  usarPve2(true);
  for (const clip of ['pve2_c_sword_combo_1', 'pve2_c_sword_combo_2', 'pve2_c_sword_combo_3', 'pve2_c_sword_charge_release']) {
    const tab = TRAJ[clip], carga = /release/.test(clip) ? TRAJ.pve2_c_sword_charge_loop.duration : 0;
    const action = { name: 'sword_light', clip, start: 0, clipeInicio: carga, impact: carga + tab.impact, end: carga + tab.duration, reach: 1.05 };
    assert.ok(Math.abs(giroContatoPve(clip)) > 0.3, `${clip}: o arco autorado sai do lado direito`);
    assert.equal(giroAcao(action, 0), carga ? 0 : giroAcao(action, 0));       // começa sem giro na carga
    assert.equal(giroAcao(action, action.end), 0);                            // termina de frente
    const s = amostrarArma(action, action.impact, { arma: 'espada', altura: 1.75 });
    const n = Math.hypot(...s.tip.map((v, i) => v - s.grip[i])), d = s.tip.map((v, i) => (v - s.grip[i]) / n);
    const p = s.grip.map((v, i) => v + d[i] * 0.64 * 0.6);
    assert.ok(Math.abs(p[0]) < 0.03, `${clip}: lâmina a ${(p[0] * 100).toFixed(1)} cm da linha da frente no contato`);
    assert.ok(p[2] > 0.3, `${clip}: a lâmina está à frente do corpo`);
  }
  usarPve2(false);
  assert.equal(giroAcao({ clip: 'pve2_c_sword_combo_1', start: 0, end: 1 }, 0.3), 0);   // fora do modo experimental, nada gira
  usarPve2(true);
});

test('o avanço do golpe para antes de encostar no alvo', () => {
  usarPve2(true);
  const { m, a } = duelo(), b = m.hunters[1];
  a.direcao = 0; b.x = a.x + 0.9; b.y = a.y;
  a.golpe = { alvo: b.id };
  marcarAvancoPve2(a, { start: m.t, clipeInicio: m.t }, 'pve2_c_sword_charge_release');
  for (let n = 0; n < 80 && a.hunter.avancoPve; n++) { moverEsquivasPve1(m); m.t += m.dt; }
  assert.ok(folgaCorpo(a, a, b) >= FOLGA_AVANCO - 0.05, `folga final ${folgaCorpo(a, a, b).toFixed(2)} m`);
});

test('na caçada experimental o Hunter não cansa; fora dela o cansaço continua', async () => {
  const { semCansacoPve2 } = await import('../src/combate-jogador.js');
  const { m, a } = duelo();
  usarPve2(false);
  a.energia = 20; a.folego = 0;
  semCansacoPve2(m);
  assert.equal(a.energia, 20);
  usarPve2(true);
  semCansacoPve2(m);
  assert.equal(a.energia, a.especie.necessidades.energiaMax);
  assert.ok(a.folego > 0);
});
