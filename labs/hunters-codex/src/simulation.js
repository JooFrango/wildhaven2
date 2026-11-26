import {criarMundoEco,passoEco} from '../../ia-criaturas/src/eco/mundo.js';
import {salvarMundo,carregarMundo} from '../../ia-criaturas/src/eco/persistencia.js';
import {fatorMobilidade,atualizarSaudePasso} from '../../ia-criaturas/src/eco/saude.js';
import {atualizarVeneno} from '../../ia-criaturas/src/eco/veneno.js';
import {Geometry} from './geometry.js';
import {equip} from './equipment.js';
import {decideHunter} from './ai.js';
import {beginAttack,defend,resolveAttacks,blockedDamage,distance} from './combat.js';
import {stationaryCreatureContact} from './integration.js';
import {routeIntent} from './movement.js';
export const DT=.05;
export class Simulation{
 constructor(data,options={}){
  this.data=data;this.options={seed:17,scenario:'duel',lethal:false,count:2,...options};this.dt=DT;this.geometry=new Geometry(data.geometry);this.commands=[];this.commandLog=[];this.ledger=new Set();this.attackSerial=0;this.profile={ai:0,geometry:0,eco:0,steps:0};
  const species=structuredClone(data.eco.species),template=structuredClone(species.varrisco);
  Object.assign(template,{id:'hunter',nome:'Hunter',papel:'herbivoro',atividade:'diurno',anatomia:null,escalaModelo:1,corpo:{massaKg:[75,75],comprimentoM:.65,alturaM:1.8,raio:.32},movimento:{...template.movimento,andar:2.1,trote:3.6,corrida:6.2,inclinacaoMaxGraus:38,aceleracao:10,giroGrausSeg:360,resistenciaSeg:35},percepcao:{visao:{alcance:32,anguloGraus:220,alcanceProximo:3,tempoReconhecimentoSeg:.15},audicao:{alcance:28,erroRelativo:.25},olfato:{alcance:0},memoriaSeg:20},furtividade:{camuflagem:0,ruidoPassos:1},teme:[],competidores:[],social:{tipo:'solitario',tamanho:[1,1],territorial:false},dieta:{vegetacao:[],presas:[],carnica:false},combate:{forca:.7,defesa:.2,esquiva:0,resistenciaDor:.45,equilibrio:.65,agarrar:false,ataques:[],protecao:{}},saude:{max:120,resistencia:1,sangramentoBase:.7,regenPorDia:0,suscetibilidadeDoenca:0},vida:{...template.vida,expectativaAnos:80,maturidadeAnos:18,crescimentoAnos:18},necessidades:{...template.necessidades,custoBasePorSeg:.02,custoCorridaPorSeg:5,recuperacaoPorSeg:5,fatorRecuperacaoParado:1,fomePorDia:0,sedePorDia:0}});
  species.hunter=template;
  // Lab adapter: hunters become valid ecological prey/threats without editing official species JSONs.
  species.varrisco.dieta.presas.push('hunter');species.cromatil?.teme.push('hunter');
  const c={id:'hunter-codex',dt:DT,terreno:{tipo:'derivado',dados:data.nav},populacoes:[],relogio:{segundosPorDia:3600,horaInicial:10},clima:{chanceChuvaChuvosa:0,chanceChuvaSeca:0}};
  this.config={especies:species,doencas:data.eco.diseases,cenarios:{'hunter-codex':c}};
  this.world=criarMundoEco(this.config,c,this.options.seed,{eventosDetalhados:true,maxEventos:500000,tatica:this.options.tactical??true});this.install();this.populate();
 }
 install(){const m=this.world;m.sondagemTatica=(a,p)=>!this.geometry.sweep(a,p,a.especie.corpo.raio,a.especie.corpo.alturaM).blocked;m.opcoes.observacao=null; // camera is never an ecological level selector
  m.matar=(a,cause,by)=>{if(!a.vivo)return;if(!this.options.lethal){a.saude.hp=Math.max(1,a.saude.hp);this.finish(a,'incapacitado',by);}else this.finish(a,'morte',by,cause);};
  for(const a of m.animais)if(a.hunter)this.bind(a);
 }
 bind(a){a.comandoTeste=()=>{const start=performance.now();const h=a.hunter;let intent;
  // Only idle remote minds are economical; combat, perception, pending attacks and physiology stay fixed-step.
  const active=a.contatos.some(c=>this.enemy(a.id,c.id))||h.attack||h.manual||h.order||a.saude.ferimentos.length;
  if(h.remote&&!active&&h.nextMind>this.world.t)intent=h.lastIntent;
  else{intent=routeIntent(this,a,decideHunter(this,a));h.lastIntent=intent;h.nextMind=this.world.t+.5;}
  this.profile.ai+=performance.now()-start;return intent;};}
 event(type,id,data={}){this.world.evento(type,id,data);}
 enemy(a,b){if(a===b)return false;const x=this.world.porId.get(a),y=this.world.porId.get(b);if(!x||!y||!y.vivo||y.hunter?.outcome)return false;if(x.hunter&&y.hunter)return this.options.scenario==='ffa'||x.hunter.team!==y.hunter.team;return !!x.hunter!==!!y.hunter;}
 addHunter(o={}){const m=this.world,p=this.geometry.spawn(o.x??50,o.y??50);const a=m.criarAnimal(structuredClone(this.config.especies.hunter),{x:p.x,y:p.y,idadeDias:30*365,massaKg:75,energia:100,fome:0,sede:0,id:o.id});a.z=this.geometry.height(a.x,a.y);a.direcao=o.direction??0;a.hunter={name:o.name??`Hunter ${m.contadorAnimais}`,team:o.team??1,weapon:o.weapon??'spear',armor:o.armor??'light',shield:o.shield??false,ai:o.ai??true,manual:false,input:{x:0,y:0},courage:o.courage??.72,aggression:o.aggression??.65,attack:null,recoveryUntil:0,blockUntil:0,dodgeUntil:0,remote:false,outcome:null};equip(a);this.bind(a);return a;}
 addCreature(o={}){const p=this.geometry.spawn(o.x??58,o.y??50,.7),a=this.world.criarAnimal(this.config.especies.varrisco,{x:p.x,y:p.y,id:o.id??'varrisco-test',fome:85,sede:0,idadeDias:6*365});a.casa={x:p.x,y:p.y,raio:45};a.territorio={x:p.x,y:p.y,raio:45};a.direcao=Math.PI;a.z=this.geometry.height(a.x,a.y);return a;}
 populate(){const count=this.options.scenario==='creature'?1:this.options.count;for(let i=0;i<count;i++){const p=this.geometry.spawn(44+(i%2)*5+Math.floor(i/6)*3,45+Math.floor(i/2)*1.7);this.addHunter({id:`hunter-${i+1}`,x:p.x,y:p.y,team:this.options.scenario==='ffa'?i+1:i%2+1,weapon:i%2?'sword':'spear',shield:i%2===1,direction:i%2?Math.PI:0});}if(this.options.scenario==='creature')this.addCreature({x:53,y:45});}
 finish(a,outcome,by=null,cause=null){if(a.hunter?.outcome||a.labOutcome)return;a.labOutcome=outcome;(a.tatica??={}).outcomeTime=this.world.t;if(a.hunter){a.hunter.outcome=outcome;a.hunter.attack=null;}a.golpe=null;a.velocidade=0;a.vivo=false;if(outcome==='morte')a.saude.hp=0;else a.saude.hp=Math.max(1,a.saude.hp);this.world.vivos=this.world.vivos.filter(x=>x!==a);this.event(outcome,a.id,{by,cause});}
 command(type,id,data={},tick=this.world.tick+1){const c={type,id,data:structuredClone(data),tick,seq:this.commandLog.length};if(!Number.isInteger(tick)||tick<=this.world.tick)throw Error('Comando deve ser futuro');this.commands.push(c);this.commandLog.push(c);this.commands.sort((a,b)=>a.tick-b.tick||a.seq-b.seq);}
 apply(c){const a=this.world.porId.get(c.id),h=a?.hunter;if(c.type==='add'){this.addHunter(c.data);return;}if(c.type==='camera')return;if(!h)return;if(c.type==='remove'){this.world.animais=this.world.animais.filter(x=>x!==a);this.world.vivos=this.world.vivos.filter(x=>x!==a);this.world.porId.delete(a.id);return;}if(c.type==='manual'){h.manual=c.data.on;h.order=null;}if(c.type==='input')h.input=c.data;if(c.type==='ai')h.ai=c.data.on;if(c.type==='remote')h.remote=c.data.on;if(c.type==='order')h.order=c.data;if(c.type==='equip'){equip(a,c.data);if(h.attack){this.event('miss',a.id,{attack:h.attack.id,reason:'troca_equipamento'});h.attack=null;h.recoveryUntil=this.world.t+.3;}}if(c.type==='personality'){h.courage=Math.max(0,Math.min(1,c.data.courage));h.aggression=Math.max(0,Math.min(1,c.data.aggression));}if(c.type==='attributes')for(const k of ['forca','velocidade','resistencia','sentidos'])if(Number.isFinite(c.data[k]))a.atributos[k]=Math.max(.5,Math.min(1.5,c.data[k]));if(c.type==='attack')beginAttack(this,a,this.world.porId.get(c.data.target),c.data.heavy,c.data.region??'tronco');if(c.type==='block'||c.type==='dodge')defend(this,a,c.type);if(c.type==='surrender')this.finish(a,'rendicao');if(c.type==='stabilize'&&a.velocidade<.2&&(!a.contatos.some(x=>this.enemy(a.id,x.id)&&distance(a,x)<5))){for(const f of a.saude.ferimentos)f.sangramento=0;this.event('estabilizado',a.id);}}
 step(){const m=this.world,inactiveBefore=new Set(m.animais.filter(a=>!a.vivo).map(a=>a.id));while(this.commands[0]?.tick<=m.tick+1)this.apply(this.commands.shift());const before=new Map(m.vivos.map(a=>[a.id,{x:a.x,y:a.y}]));
  // Guard existing animal attacks with exact geometry and active hunter defenses.
  for(const a of m.vivos)if(a.golpe&&a.golpe.impacto<=m.t+this.dt){const b=m.porId.get(a.golpe.alvo);if(b&&!this.geometry.line([a.x,a.z+1,a.y],[b.x,b.z+.8,b.y])){a.golpe=null;this.event('animal_miss_solid',a.id);}else if(b?.hunter&&!a.golpe.labDefenseApplied){a.golpe={...a.golpe,labDefenseApplied:true,ataque:{...a.golpe.ataque,dano:blockedDamage(this,a,b,a.golpe.ataque.dano)}};}}
  const start=performance.now();passoEco(m);this.profile.eco+=performance.now()-start;
  const geoStart=performance.now();for(const a of m.vivos){const prev=before.get(a.id);if(!prev)continue;const q=this.geometry.sweep(prev,a,a.especie.corpo.raio,a.especie.corpo.alturaM);if(q.blocked){a.x=q.x;a.y=q.y;a.velocidade=0;a.caminho=null;this.event('precise_collision',a.id);}a.z=this.geometry.height(a.x,a.y);}
  this.profile.geometry+=performance.now()-geoStart;resolveAttacks(this);if(!m.opcoes.tatica)stationaryCreatureContact(this);
  for(const a of [...m.vivos]){if(a.hunter&&a.saude.hp<a.saude.hpMax*.15)this.finish(a,this.options.lethal&&a.saude.hp<=0?'morte':'incapacitado');else if(a.saude.hp<=0)m.matar(a,'ferimentos');}
  // Leaving combat is not healing: surrendered/incapacitated bodies retain bleeding and poison.
  for(const a of m.animais)if(inactiveBefore.has(a.id)&&!a.vivo&&a.labOutcome!=='morte'){
   atualizarSaudePasso(a,this.dt);atualizarVeneno(a,m,this.dt);
   if(this.options.lethal&&a.saude.hp<=0){a.labOutcome='morte';if(a.hunter)a.hunter.outcome='morte';a.saude.hp=0;this.event('morte',a.id,{cause:'ferimentos_apos_confronto'});}
   else a.saude.hp=Math.max(1,a.saude.hp);
  }
  this.profile.steps++;this.assert();return this;
 }
 assert(){const ids=new Set();for(const a of this.world.animais){if(ids.has(a.id))throw Error('Duplicate entity');ids.add(a.id);if(![a.x,a.y,a.z,a.saude.hp,a.energia].every(Number.isFinite))throw Error('Invalid state '+a.id);if(a.hunter&&(!a.hunter.weapon||!a.hunter.armor))throw Error('Invalid inventory');}}
 save(){return JSON.stringify({version:1,options:this.options,eco:salvarMundo(this.world),events:this.world.eventos,commands:this.commands,commandLog:this.commandLog,ledger:[...this.ledger],attackSerial:this.attackSerial});}
 static restore(data,text){const saved=JSON.parse(text);if(saved.version!==1||!Array.isArray(saved.eco?.animais)||!Array.isArray(saved.commands))throw Error('Formato de replay não suportado');const sim=new Simulation(data,{...saved.options,count:0});sim.world=carregarMundo(sim.config,saved.eco);sim.world.eventos=saved.events;sim.commands=saved.commands;sim.commandLog=saved.commandLog;sim.ledger=new Set(saved.ledger);sim.attackSerial=saved.attackSerial;
  // The shared persistence restores canonical species; per-hunter equipment remains a private profile.
  for(const a of sim.world.animais)if(a.hunter){a.especie=structuredClone(sim.config.especies.hunter);equip(a);}sim.install();return sim;}
 digest(){return JSON.stringify({tick:this.world.tick,entities:this.world.animais.map(a=>({id:a.id,x:a.x,y:a.y,z:a.z,energy:a.energia,health:a.saude,alive:a.vivo,hunter:a.hunter,rng:[a.rngMente.s,a.rngCombate.s,a.rngPercepcao.s]})),events:this.world.eventos,ledger:[...this.ledger]});}
}
