// Biblioteca PvP v12: a troca de clipes do duelo. A geometria dos clipes é conferida por
// scripts/validate-hunter-pvp-v09.mjs --v12; aqui só se prova a regra de seleção do renderizador.
import test from 'node:test';
import assert from 'node:assert/strict';
import {remapPvp12} from '../src/animacao-jogador.js';
import {clipePvp12,amostrarArma,usarGuardaFechada} from '../src/trajetoria-arma.js';

const semV12={actions:{combat_guard:{},sword_light:{},combat_block:{}}};
const comV12={actions:{...semV12.actions,pvp12_guard:{},pvp12_sword_horizontal_cut:{},pvp12_sword_block:{},
 pvp12_step_forward:{},pvp12_step_back:{},pvp12_step_left:{},pvp12_step_right:{},
 pvp12_sword_horizontal_reverse_cut:{},pvp12_sword_diagonal_down:{},pvp12_sword_thrust:{}}};

test('sem a biblioteca v12 carregada o PvE segue com os clipes da v05', () => {
 for(const pedido of [{name:'sword_light',time:.1},{name:'combat_block',time:.35},{name:'hunter_walk',time:2,locomotion:true}])
  assert.deepEqual(remapPvp12(semV12,pedido,2),pedido);
});

test('com a biblioteca v12 nenhum clipe da v05 é desenhado no duelo', () => {
 const casos=[
  [{name:'sword_light',time:.1,impact:.29,duration:.67,oneShot:true},'pvp12_sword_horizontal_cut'],
  [{name:'sword_heavy_low',time:.2},'pvp12_sword_diagonal_down'],
  [{name:'sword_light',time:.1,counter:true},'pvp12_sword_thrust'],
  [{name:'sword_light',time:.1,variante:1},'pvp12_sword_horizontal_reverse_cut'],
  [{name:'spear_counter',time:.2},'pvp12_sword_horizontal_cut'],
  [{name:'combat_block',time:.35},'pvp12_sword_block'],
  [{name:'combat_hit_light',time:.1},'pvp12_guard'],
  [{name:'combat_knockdown',time:.4},'pvp12_guard'],
  [{name:'hunter_walk',time:2,locomotion:true},'pvp12_step_forward'],
  [{name:'combat_step_back',time:2,locomotion:true},'pvp12_step_back'],
  [{name:'combat_step_left',time:2,locomotion:true},'pvp12_step_left'],
  [{name:'combat_step_right',time:2,locomotion:true},'pvp12_step_right'],
  [{name:'combat_turn_left',time:2,locomotion:true},'pvp12_step_left'],
  [{name:'guard_sword',time:2},'pvp12_guard'],
 ];
 for(const [pedido,esperado] of casos){
  const saida=remapPvp12(comV12,pedido,2);
  assert.equal(saida.name,esperado,`${pedido.name} virou ${saida.name}`);
  assert.ok(comV12.actions[saida.name],'clipe remapeado não existe no GLB: '+saida.name);
 }
});

test('o reajuste de tempo do ataque sobrevive ao remapeamento', () => {
 // Sem impact/duration o renderizador não consegue esticar o golpe do simulador até o clipe autorado.
 const saida=remapPvp12(comV12,{name:'sword_light',time:.1,impact:.29,duration:.67,oneShot:true},2);
 assert.equal(saida.impact,.29);
 assert.equal(saida.duration,.67);
 assert.equal(saida.oneShot,true);
});

test('o passo mantém a marcação de locomoção e o giro parado não', () => {
 // Sem locomotion o renderizador não sincroniza a passada com a distância andada e o passo patina.
 assert.equal(remapPvp12(comV12,{name:'hunter_walk',time:2,locomotion:true},2).locomotion,true);
 // Girando no lugar não há distância andada: o clipe tem de rodar no relógio, senão congela.
 assert.equal(remapPvp12(comV12,{name:'combat_turn_left',time:2,locomotion:true},2).locomotion,undefined);
});

test('a mesma regra escolhe o golpe para a simulação e para o desenho', () => {
 assert.equal(clipePvp12('sword_light',true,2),'pvp12_sword_thrust');
 assert.equal(clipePvp12('sword_heavy',false,0),'pvp12_sword_diagonal_down');
 assert.equal(clipePvp12('sword_follow',false,0),'pvp12_sword_horizontal_reverse_cut');
 assert.deepEqual([0,1,2,3].map(v=>clipePvp12('sword_light',false,v)),['pvp12_sword_horizontal_cut','pvp12_sword_horizontal_reverse_cut','pvp12_sword_diagonal_down','pvp12_sword_horizontal_cut']);
 assert.equal(clipePvp12('spear_light',false,1),'pvp12_sword_horizontal_cut');
});

test('com a guarda fechada a lâmina simulada segue o golpe autorado e conserva o comprimento', () => {
 usarGuardaFechada(true);
 try{
  const base={start:0,impact:.3,end:.7,reach:1.05};
  const golpes=[{name:'sword_light',variante:0},{name:'sword_light',variante:2},{name:'sword_light',counter:true}];
  const alturas=golpes.map(g=>amostrarArma({...base,...g},base.impact,{arma:'espada',altura:1.75}));
  for(const s of alturas)assert.ok(Math.abs(Math.hypot(...s.tip.map((v,i)=>v-s.grip[i]))-.6375)<.002,'lâmina mudou de comprimento');
  // Golpes diferentes passam por lugares diferentes no contato: a simulação não é um golpe só.
  assert.ok(Math.hypot(...alturas[0].tip.map((v,i)=>v-alturas[1].tip[i]))>.15,'corte e diagonal coincidem no contato');
  // No início do golpe todos estão na mesma guarda: a espada não salta da mão ao começar.
  const g0=golpes.map(g=>amostrarArma({...base,...g},0,{arma:'espada',altura:1.75}).grip);
  for(const g of g0)assert.ok(Math.hypot(...g.map((v,i)=>v-g0[0][i]))<.01,'guarda diferente entre golpes');
 }finally{usarGuardaFechada(false);}
});
