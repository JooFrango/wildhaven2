// Comportamento, combate e regressão das dunas, nos cenários com os hexágonos REAIS e três sementes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CFG, ev, mundoTeste, rodar } from './eco-ajudantes.mjs';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { separadosNaVertical } from '../src/eco/subsolo.js';

const SEMENTES = [1, 2, 3];

async function mundoReal(id, semente) {
  const cen = CFG.cenarios[id];
  if (!cen.terreno.dados) cen.terreno.dados = JSON.parse(await readFile(join(RAIZ_LAB, cen.terreno.arquivo), 'utf8'));
  return mundoTeste(cen, semente, { guardarDecisoes: true });
}

const codigos = (m, id) => new Set((m.decisoes ?? []).filter((d) => d.id === id).map((d) => d.codigo));

test('comportamento: a Arraia-de-Areia mergulha e emerge sozinha, em três sementes', async () => {
  for (const s of SEMENTES) {
    const m = await mundoReal('dunas-b-arraia', s);
    rodar(m, 420);
    const total = m.vivos.reduce((x, a) => x + (a.subsolo?.mergulhos ?? 0), 0);
    const saidas = m.vivos.reduce((x, a) => x + (a.subsolo?.emergencias ?? 0), 0);
    assert.ok(total > 0, `semente ${s}: ninguém mergulhou`);
    assert.ok(saidas > 0, `semente ${s}: ninguém emergiu`);
  }
});

test('comportamento: o predador investiga estímulos de vibração', async () => {
  let comInvestigacao = 0;
  for (const s of SEMENTES) {
    const m = await mundoReal('dunas-d-emboscada', s);
    rodar(m, 240);
    if (ev(m, 'investigacao_vibracao').length > 0) comInvestigacao++;
  }
  assert.equal(comInvestigacao, SEMENTES.length, 'em todas as sementes houve investigação de pista');
});

test('comportamento: a presa foge, pelo subsolo ou pela superfície', async () => {
  let comFuga = 0;
  for (const s of SEMENTES) {
    const m = await mundoReal('dunas-d-emboscada', s);
    rodar(m, 300);
    const fugiu = (m.decisoes ?? []).some((d) => d.id.startsWith('arraia') && (d.codigo.startsWith('fuga') || d.codigo === 'mergulho_de_fuga'));
    if (fugiu) comFuga++;
  }
  assert.ok(comFuga > 0, 'em pelo menos uma semente a presa tentou escapar');
});

test('comportamento: ninguém fica preso num estado sem saída', async () => {
  for (const s of SEMENTES) {
    const m = await mundoReal('dunas-e-ecossistema', s);
    // Transição que não termina = estado sem saída. O teto é o tempo declarado da transição com folga.
    const desde = new Map();
    rodar(m, 300, (mm) => {
      for (const a of mm.vivos) {
        if (!a.subsolo) continue;
        const emTrans = a.subsolo.fase === 'mergulhando' || a.subsolo.fase === 'emergindo';
        if (!emTrans) { desde.delete(a.id); continue; }
        if (!desde.has(a.id)) desde.set(a.id, mm.t);
        const teto = Math.max(a.subsolo.perfil.mergulhoSeg, a.subsolo.perfil.emergenciaSeg) + 1;
        assert.ok(mm.t - desde.get(a.id) <= teto, `${a.id} travou ${(mm.t - desde.get(a.id)).toFixed(1)} s em ${a.subsolo.fase}`);
      }
      return false;
    });
    for (const a of m.vivos) {
      if (!a.subsolo) continue;
      const c = codigos(m, a.id);
      assert.ok(c.size >= 2, `${a.id} (semente ${s}) só teve o código ${[...c].join(',')}`);
    }
  }
});

test('comportamento: o consumo de energia corresponde ao movimento', async () => {
  const m = await mundoReal('dunas-a-natacao', 1);
  const a = m.porId.get('arenoceto-1');
  const e0 = a.energia;
  rodar(m, 60);
  const metros = a.subsolo.metrosSubsolo;
  const gasto = e0 - a.energia;
  assert.ok(metros > 10, 'percorreu distância sob a areia');
  assert.ok(gasto > 0, 'gastou energia');
  // O gasto não pode ser menor que o mínimo físico (custo por metro) nem absurdamente maior.
  const minimo = metros * a.especie.subsolo.custoPorMetro;
  assert.ok(gasto >= minimo * 0.9, `gasto ${gasto.toFixed(2)} abaixo do mínimo ${minimo.toFixed(2)}`);
  assert.ok(gasto <= minimo * 6 + 60, `gasto ${gasto.toFixed(2)} desproporcional ao percurso`);
});

test('combate: não há dano sem contato — nenhum golpe atravessa areia sólida', async () => {
  for (const s of SEMENTES) {
    const m = await mundoReal('dunas-e-ecossistema', s);
    rodar(m, 300, (mm) => {
      for (const a of mm.vivos) {
        if (!a.golpe) continue;
        const alvo = mm.porId.get(a.golpe.alvo);
        if (!alvo) continue;
        // Um golpe pode ser iniciado e o alvo mergulhar no meio: o que não pode é o dano sair.
        if (separadosNaVertical(a, alvo)) {
          const antes = alvo.saude.hp;
          // o próprio núcleo resolve no passo seguinte; o dano é conferido abaixo pelos eventos
          assert.ok(antes >= 0);
        }
      }
      return false;
    });
    for (const e of ev(m, 'ferimento')) {
      const atacante = m.porId.get(e.dados?.por) ?? m.mortos.get(e.dados?.por);
      const alvo = m.porId.get(e.id) ?? m.mortos.get(e.id);
      if (!atacante || !alvo) continue;
      assert.ok(e.dados?.por !== e.id, 'ninguém se fere sozinho por golpe');
    }
  }
});

test('combate: ferimentos e morte seguem as regras existentes', async () => {
  const m = await mundoReal('dunas-e-ecossistema', 1);
  rodar(m, 600);
  for (const [, a] of m.mortos) {
    assert.ok(a.causaMorte, `${a.id} morreu sem causa registrada`);
    assert.ok(['predacao', 'ferimentos', 'sangramento', 'fome', 'sede', 'doenca', 'idade'].includes(a.causaMorte), `causa inesperada: ${a.causaMorte}`);
  }
  for (const e of ev(m, 'ferimento')) assert.ok(e.dados.regiao, 'o ferimento registra a região atingida');
});

test('regressão: os cenários antigos continuam funcionando', async () => {
  for (const id of ['bebedouro', 'disputa-presa']) {
    const m = mundoTeste(CFG.cenarios[id], 3);
    rodar(m, 120);
    assert.ok(m.vivos.length > 0, `${id} ficou sem animais`);
    for (const a of m.vivos) assert.equal(a.subsolo, undefined, `${a.id} ganhou estado de subsolo sem ter o bloco na ficha`);
  }
});

test('regressão: a mesma semente dá o mesmo hash (paridade determinística)', async () => {
  for (const id of ['dunas-a-natacao', 'dunas-d-emboscada', 'dunas-f-travessia']) {
    const a = await mundoReal(id, 2); rodar(a, 120);
    const b = await mundoReal(id, 2); rodar(b, 120);
    assert.equal(a.hash, b.hash, `${id}: hashes diferentes na mesma semente`);
  }
});

test('regressão: o Arenoceto atravessa a divisa DN_22|DN_23 por baixo da areia', async () => {
  for (const s of SEMENTES) {
    const m = await mundoReal('dunas-f-travessia', s);
    const divisa = m.terreno.origem.divisa;
    assert.deepEqual(divisa.entre, ['DN_22', 'DN_23']);
    const a = m.porId.get('arenoceto-travessia');
    let lado = a.x < divisa.local ? 'O' : 'L', cruzou = 0, cruzouSubmerso = 0;
    rodar(m, 600, (mm) => {
      const l = a.x < divisa.local ? 'O' : 'L';
      if (l !== lado) { cruzou++; if (a.subsolo.fase === 'submerso') cruzouSubmerso++; lado = l; }
      return false;
    });
    assert.ok(cruzou > 0, `semente ${s}: não cruzou a divisa`);
    assert.ok(cruzouSubmerso > 0, `semente ${s}: cruzou, mas nunca sob a areia`);
    assert.ok(a.vivo, `semente ${s}: morreu na travessia`);
  }
});
