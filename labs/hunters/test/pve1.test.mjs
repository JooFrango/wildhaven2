// PvE v01 (contrato hunter-pve-v01): ligação estado canônico -> clipe e coerência GLB / manifesto / trajetória gerada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {remapPve1} from '../src/animacao-jogador.js';
import trajetorias from '../src/trajetorias-pve1.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
const ler=async p=>readFile(new URL(p,import.meta.url));

test('remapPve1 leva cada estado canônico ao clipe PvE do lote 1 e nunca a um clipe v05 ou pvp12',()=>{
 const nomes=Object.keys(trajetorias),o={actions:Object.fromEntries(nomes.map(n=>[n,{getClip:()=>({duration:trajetorias[n].duration})}]))};
 const r=(name,extra={},a)=>remapPve1(o,{name,time:.2,...extra},1,a);
 assert.equal(r('sword_light').name,'pve1_c_sword_light');
 assert.equal(r('sword_heavy_high').name,'pve1_c_sword_heavy');
 assert.equal(r('sword_finish').name,'pve1_c_sword_heavy');
 assert.deepEqual(r('combat_block'),{name:'pve1_b_sword_block',time:.30,oneShot:true});
 assert.equal(r('hunter_run').name,'pve1_a_sword_run');
 assert.equal(r('hunter_run').locomotion,true);
 assert.equal(r('combat_step_back').name,'pve1_b_sword_step_back');
 assert.equal(r('recover_sword').name,'pve1_b_sword_recover');
 // Esquiva: lado pela direção do movimento (mesma convenção dos passos) e tempo esticado à duração do clipe.
 assert.equal(r('combat_dodge',{},{direcao:0,direcaoMovimento:1}).name,'pve1_b_sword_dodge_right');
 const e=r('combat_dodge',{time:.65},{direcao:0,direcaoMovimento:-1});
 assert.equal(e.name,'pve1_b_sword_dodge_left');assert.equal(e.time,trajetorias.pve1_b_sword_dodge_left.duration);
 for(const n of ['combat_hit_heavy','combat_death','combat_stagger','guard_sword','combat_surrender'])
  assert.equal(r(n).name,'pve1_b_sword_guard',n);   // ainda não autorados no lote 1: guarda PvE
});

test('GLB PvE v01: manifesto, trajetória gerada e contrato batem; GLB v12 intocado',async()=>{
 const glb=await ler('../assets/hunter-pve-v01/hunter_pve_v01.glb'),man=JSON.parse(await ler('../assets/hunter-pve-v01/manifest.json'));
 assert.equal(sha(glb),man.sha256);assert.equal(man.contract,'hunter-pve-v01');
 assert.equal(sha(await ler('../assets/hunter-pvp-v12/hunter_pvp_v12.glb')),'b36f7a82b852e0f2cfcda665c2098ae3730c472e03711120b03737f8908d2c25');
 const doc=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12))),pve=doc.animations.filter(a=>a.name.startsWith('pve1_'));
 assert.equal(pve.length,12);assert.deepEqual(pve.map(a=>a.name).sort(),Object.keys(trajetorias).sort());
 for(const a of pve){const t=trajetorias[a.name],d=man.newClips.find(c=>c.name===a.name);
  assert.equal(a.extras.contract,'hunter-pve-v01',a.name);assert.equal(t.duration,d.duration,a.name);
  assert.ok(Number.isInteger(Math.round(t.duration*60))&&Math.abs(t.duration*60-Math.round(t.duration*60))<1e-9,'duração em quadros inteiros: '+a.name);
  if(a.extras.kind==='attack'){assert.equal(t.impact,d.contact,a.name);assert.equal(t.frames.length,Math.round(t.duration*60)+1,a.name);
   assert.ok(t.phases.activeStart<t.impact&&t.impact<t.phases.activeEnd,'contato dentro da janela ativa: '+a.name);}
  if(t.rootMotion.mode==='curve')assert.equal(t.rootMotion.curve.length,Math.round(t.duration*60)+1,a.name);}
});
