// V02.2: camada de planejamento, perfis, regras condicionais, interrupção/retomada e registro de decisões.
// Cenários reproduzíveis com sementes fixas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { passoJogo, ordenar, definirPerfil, atorDe, todosEventos } from '../src/jogo.js';
import { PERFIS, REGRAS } from '../src/regras.js';
import { novo, recarregar } from './ajuda.mjs';

const ate = (j, t) => { while (j.t < t) passoJogo(j); };
const regrasDe = (j, id) => j.hunters.get(id).decisoes.map((d) => d.regra);

// Cenário de perigo: Caio patrulha a 70 m da toca do Varrisco; os outros três ficam na vila. Semente 1.
function patrulhaPerigosa(perfil, semente = 1) {
  const j = novo(semente);
  ordenar(j, ['arvo', 'brena', 'dara'], { tipo: 'vila' });
  definirPerfil(j, 'caio', perfil);
  ordenar(j, ['caio'], { tipo: 'patrulhar', centro: { x: j.toca.x, y: j.toca.y + 70 }, raio: 40 });
  return j;
}

test('perfis: três perfis, desvio sobre a personalidade individual, atributos físicos intactos', () => {
  const j = novo(1), perfis = new Set();
  for (const [id, e] of j.hunters) {
    const a = atorDe(j, id), d = PERFIS[e.perfil].personalidade; perfis.add(e.perfil);
    for (const k of Object.keys(d)) assert.ok(Math.abs(a.hunter.personalidade[k] - Math.max(0, Math.min(1, e.base[k] + d[k]))) < 1e-9);
  }
  assert.deepEqual([...perfis].sort(), ['agressivo', 'cauteloso', 'equilibrado']);
  const a = atorDe(j, 'caio'), fis = structuredClone(a.atributos), massa = a.massa;
  definirPerfil(j, 'caio', 'agressivo'); definirPerfil(j, 'caio', 'cauteloso');
  assert.deepEqual(a.atributos, fis); assert.equal(a.massa, massa);
  // Dois Hunters no mesmo perfil continuam diferentes (personalidade base própria).
  assert.notDeepEqual(atorDe(j, 'brena').hunter.personalidade, atorDe(j, 'dara').hunter.personalidade);
});

test('cauteloso × agressivo na mesma situação (semente 1): interrompe e retoma × enfrenta e combate', () => {
  const c = patrulhaPerigosa('cauteloso'); ate(c, 250);
  const ag = patrulhaPerigosa('agressivo'); ate(ag, 250);
  const dc = c.hunters.get('caio').decisoes, da = ag.hunters.get('caio').decisoes;
  console.log('cauteloso:', dc.map((d) => `${d.t} ${d.motivo}`)); console.log('agressivo:', da.map((d) => `${d.t} ${d.motivo}`));
  // 5. Interrupção por ameaça, com o motivo real (distância, risco, tolerância do perfil).
  const int = dc.find((d) => d.regra === 'evitar');
  assert.match(int.motivo, /Patrulha interrompida: ameaça superior \(varrisco a \d+ m, risco 0\.\d+ > tolerância 0\.50/);
  // 6. Retomada depois que a ameaça saiu da percepção, sem reiniciar a patrulha.
  const ret = dc.find((d) => d.regra === 'retomar' && d.t > int.t);
  assert.ok(ret && ret.t - int.t >= PERFIS.cauteloso.esperaRetomarSeg - 0.5, 'retomou depois da espera do perfil');
  assert.equal(todosEventos(c).filter((e) => e.tipo === 'ferimento' && e.id === 'caio').length, 0, 'cauteloso evitou o combate');
  // 4. O agressivo, no mesmo ponto, enfrenta: o Varrisco ataca e ele se defende sozinho (sem controle manual).
  assert.ok(da.some((d) => d.regra === 'enfrentar' && /tolerância 1\.80/.test(d.motivo)));
  assert.ok(da.some((d) => d.regra === 'defesa'));
  assert.ok(todosEventos(ag).filter((e) => e.tipo === 'ferimento' && e.id === 'varrisco-real' && e.atacante === 'caio').length >= 3, '10. combate autônomo');
  assert.equal(atorDe(ag, 'caio').hunter.controle, 'ia');
});

test('reprodutível: mesma semente, mesmas decisões nos mesmos instantes', () => {
  const a = patrulhaPerigosa('cauteloso'); ate(a, 250);
  const b = patrulhaPerigosa('cauteloso'); ate(b, 250);
  assert.deepEqual(a.hunters.get('caio').decisoes, b.hunters.get('caio').decisoes);
});

test('3. ferido: equilibrado recua e suspende a missão; agressivo segue; a missão retoma de onde parou', () => {
  const j = novo(4);
  definirPerfil(j, 'arvo', 'equilibrado'); definirPerfil(j, 'brena', 'agressivo');
  ordenar(j, ['arvo', 'brena'], { tipo: 'explorar', hex: 'HV_01' }); ordenar(j, ['caio', 'dara'], { tipo: 'vila' });
  ate(j, 20);
  const missao = j.hunters.get('arvo').atual, inicio = missao.inicio, i0 = missao.i;
  // Fixture: os dois perdem 65% da vida (mesma condição).
  for (const id of ['arvo', 'brena']) { const a = atorDe(j, id); a.saude.hp = a.saude.hpMax * 0.35; }
  ate(j, 25);
  const ea = j.hunters.get('arvo'), eb = j.hunters.get('brena');
  assert.match(ea.decisoes.at(-1).motivo, /Retirada: ferimentos graves \(vida 35% < 40% do perfil equilibrado\)/);
  assert.equal(ea.atual.tipo, 'voltar'); assert.deepEqual(ea.fila.map((t) => t.tipo), ['descansar', 'explorar']);
  assert.equal(eb.atual.tipo, 'explorar', 'agressivo (limite 25%) não recua a 35%');
  ate(j, 60);
  assert.equal(ea.atual.tipo, 'descansar');
  // Fixture de tempo: a cura do núcleo leva ~5 dias de jogo (8%/dia); aqui a vida é posta no limiar do perfil.
  atorDe(j, 'arvo').saude.hp = atorDe(j, 'arvo').saude.hpMax * PERFIS.equilibrado.descansoAte;
  ate(j, 64);
  assert.equal(ea.atual, missao, 'a mesma missão voltou'); assert.equal(ea.atual.inicio, inicio); assert.equal(ea.atual.i, i0);
  assert.match(ea.decisoes.at(-1).motivo, /Missão retomada após recuperação: explorar HV_01/);
});

test('7. mudar o perfil no meio da missão não perde tarefa, fila nem interrupção', () => {
  const j = patrulhaPerigosa('cauteloso');
  ordenar(j, ['caio'], { tipo: 'voltar' }, { fila: true });
  ate(j, 190);
  const e = j.hunters.get('caio'), antes = { atual: e.atual, i: e.atual.i, inicio: e.atual.inicio, fila: e.fila.map((t) => t.tipo), interrupcao: e.interrupcao };
  assert.ok(antes.interrupcao, 'está interrompido pela ameaça');
  definirPerfil(j, 'caio', 'equilibrado');
  passoJogo(j);
  assert.equal(e.atual, antes.atual); assert.equal(e.atual.i, antes.i); assert.equal(e.atual.inicio, antes.inicio);
  assert.deepEqual(e.fila.map((t) => t.tipo), antes.fila);
  assert.ok(e.decisoes.some((d) => /Perfil alterado: Cauteloso → Equilibrado/.test(d.motivo)));
});

test('9. salvar e restaurar mantém perfis, regra ativa, interrupção, decisões e ordens', () => {
  const j = patrulhaPerigosa('cauteloso'); ate(j, 190);
  const { jogo: r } = recarregar(j);
  for (const id of j.hunters.keys()) {
    const a = j.hunters.get(id), b = r.hunters.get(id);
    for (const k of ['perfil', 'regraAtiva', 'base', 'regrasDesligadas']) assert.deepEqual(b[k], a[k], `${id}.${k}`);
    assert.deepEqual(b.decisoes, a.decisoes); assert.deepEqual(b.interrupcao, a.interrupcao);
    assert.equal(b.atual?.tipo, a.atual?.tipo); assert.equal(b.atual?.i, a.atual?.i);
    assert.deepEqual(atorDe(r, id).hunter.personalidade, atorDe(j, id).hunter.personalidade);
  }
  // As duas cópias seguem decidindo igual.
  ate(j, 230); ate(r, 230);
  assert.deepEqual(r.hunters.get('caio').decisoes, j.hunters.get('caio').decisoes);
});

test('11. sem conflito de prioridades: regras desligáveis, defesa fixa, nenhuma oscilação abaixo de 2 s', () => {
  const j = novo(1);
  ordenar(j, ['arvo', 'brena'], { tipo: 'cacar', especie: 'varrisco' });
  ordenar(j, ['caio'], { tipo: 'patrulhar', centro: { x: j.toca.x, y: j.toca.y + 70 }, raio: 40 });
  ordenar(j, ['dara'], { tipo: 'vila' });
  ate(j, 360);
  for (const [id, e] of j.hunters) {
    const continuas = e.decisoes.filter((d) => REGRAS.find((r) => r.id === d.regra)?.continua && d.regra !== 'defesa');
    for (let k = 1; k < continuas.length; k++) assert.ok(continuas[k].t - continuas[k - 1].t >= 2 - 1e-9 || continuas[k].regra === continuas[k - 1].regra, `${id}: troca em menos de 2 s`);
    // Nenhuma regra contínua registrada duas vezes seguidas sem saída (oscilação na borda).
    for (let k = 1; k < e.decisoes.length; k++) assert.ok(!(e.decisoes[k].regra === e.decisoes[k - 1].regra && e.decisoes[k].regra === 'enfrentar' && e.decisoes[k].t - e.decisoes[k - 1].t < 4), `${id}: enfrentar repetido`);
  }
  console.log(Object.fromEntries([...j.hunters].map(([id, e]) => [id, e.decisoes.map((d) => `${d.t} ${d.regra}`)])));
  // Desligar 'evitar' no cauteloso: a decisão cai para a próxima regra válida (enfrentar), sem travar.
  const k = patrulhaPerigosa('cauteloso'); k.hunters.get('caio').regrasDesligadas.evitar = true; ate(k, 200);
  assert.ok(!regrasDe(k, 'caio').includes('evitar')); assert.ok(regrasDe(k, 'caio').includes('enfrentar'));
  // A defesa não pode ser desligada.
  const d = patrulhaPerigosa('agressivo'); d.hunters.get('caio').regrasDesligadas.defesa = true; ate(d, 200);
  assert.ok(regrasDe(d, 'caio').includes('defesa'));
});
