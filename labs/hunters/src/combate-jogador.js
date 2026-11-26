// Player-like human combat. All planning consumes own state and sanitized visible cues.
import {atan2,cos,sen,hipot} from '../../ia-criaturas/src/core/matematica.js';
import {normalizarAngulo} from '../../ia-criaturas/src/core/geometria.js';
import {perfilMobilidade,segmentoLivre} from '../../ia-criaturas/src/eco/terreno.js';
import {perfilGolpe,iniciarAtaque,abrirConflito,contatoGolpe,capsula} from '../../ia-criaturas/src/eco/combate.js';
import {aplicarPostura,fatorBracos} from './hunter.js';
import {amostrarArma,guardaFechadaLigada,pve1Ligado,clipePve1,trajetoriaPve1,interrupcaoAberta,pve2Ligado,clipePve2,trajetoriaPve,CARGA_PVE2} from './trajetoria-arma.js';
import {fatorMobilidade} from '../../ia-criaturas/src/eco/saude.js';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const ESTILOS=Object.freeze({
 lanca:{clip:'spear',reach:2.1,light:.40,recover:.58,heavy:.78,heavyRecover:1.05,step:.62,chain:3,reserve:15,escape:.28},
 espada:{clip:'sword',reach:1.05,light:.29,recover:.38,heavy:.62,heavyRecover:.80,step:.90,chain:3,reserve:12,escape:.22},
 montante:{clip:'greatsword',reach:1.7,light:.65,recover:.78,heavy:1.15,heavyRecover:1.25,step:.65,chain:2,reserve:22,escape:.45},
 maos:{clip:'unarmed',reach:.75,light:.28,recover:.40,heavy:.52,heavyRecover:.65,step:.80,chain:3,reserve:10,escape:.25}
});
// PvE v01: o tempo da espada é o do clipe (trajetorias-pve1.js), nunca o do núcleo. A IA ajusta janelas e decisões a esse
// tempo; não acelera o clipe. Sem continuação "finish" (só existe no lote 2), a cadeia da espada fica em 2 golpes.
const TEMPO_BLOQUEIO_PVE=.30;   // pose segurada do pve1_b_sword_block
let estiloPve1=null;
// Alcance da lâmina autorada na janela ativa do clipe, em metros de um corpo de 1,75 m.
function alcanceAutorado(t){let m=0;for(let i=0;i<t.frames.length;i++){const q=i/t.fps;if(q<t.phases.activeStart||q>t.phases.activeEnd)continue;const f=t.frames[i],n=Math.hypot(f[3],f[4],f[5])||1;m=Math.max(m,f[2]*1.75+f[5]/n*.64);}return m;}
function estiloEspadaPve1(){
 if(estiloPve1)return estiloPve1;
 const L=trajetoriaPve1('pve1_c_sword_light'),H=trajetoriaPve1('pve1_c_sword_heavy');
 // Alcance de trabalho = o da lâmina autorada na janela ativa (o menor dos dois golpes) menos uma folga de 10 cm.
 return estiloPve1={...ESTILOS.espada,pve:true,light:L.impact,recover:L.duration-L.impact,heavy:H.impact,heavyRecover:H.duration-H.impact,chain:2,reach:Math.min(alcanceAutorado(L),alcanceAutorado(H))-.10};
}
// PvE v02 (rig v13, lote 2): combo de 3 golpes; o pesado é carga em laço mais liberação. Cada golpe leva o tempo do
// SEU clipe, escolhido antes de o ataque começar, então nada é esticado no renderizador.
let estiloPve2=null;
function estiloEspadaPve2(){
 if(estiloPve2)return estiloPve2;
 const C=[1,2,3].map(i=>trajetoriaPve('pve2_c_sword_combo_'+i)),R=trajetoriaPve('pve2_c_sword_charge_release'),carga=trajetoriaPve(CARGA_PVE2).duration;
 return estiloPve2={...ESTILOS.espada,pve:true,pve2:true,light:C[0].impact,recover:C[0].duration-C[0].impact,
  heavy:carga+R.impact,heavyRecover:R.duration-R.impact,carga,chain:3,
  reach:Math.min(...C.map(alcanceAutorado),alcanceAutorado(R))-.10};
}
export function estilo(a){const arma=a.hunter.equipamento.arma;
 if(arma!=='espada')return ESTILOS[arma]??ESTILOS.maos;
 return pve2Ligado()?estiloEspadaPve2():pve1Ligado()?estiloEspadaPve1():ESTILOS.espada;}
// Instante em que o clipe do golpe começa dentro da ação: a liberação do pesado só entra depois do laço de carga.
const inicioClipe=action=>action.clipeInicio??action.start;
// Plano de um golpe PvE v02: qual clipe, quanta carga antes dele, preparo e recuperação do próprio clipe.
export function planoPve2(pesado,indice=0){
 const clip=pesado?'pve2_c_sword_charge_release':clipePve2('',indice),tab=trajetoriaPve(clip);
 const carga=pesado?trajetoriaPve(CARGA_PVE2).duration:0;
 return{clip,carga,indice,pesado:!!pesado,windup:carga+tab.impact,recovery:tab.duration-tab.impact};
}
// Deslocamento autorado do golpe (rootMotion do clipe): entra UMA vez, no passo de simulação; o clipe toca em lugar.
export function marcarAvancoPve2(a,action,clip){
 const tab=trajetoriaPve(clip);if(tab?.rootMotion?.mode!=='curve')return;
 const inicio=inicioClipe(action);
 a.hunter.avancoPve={clip,inicio,fim:inicio+tab.duration,dir:a.direcao,escala:escalaCorpo(a),ate:inicio,alvo:a.golpe?.alvo??null};
}
// Ataque no controle manual (teclas J e H): o tempo é o do clipe, e J encadeia o combo 1 -> 2 -> 3.
export function ataqueManualPve2(a,pesado,t){
 if(!pve2Ligado()||a.hunter.equipamento.arma!=='espada')return null;
 // A cadeia do jogador tem contador próprio: quem aperta J três vezes vê os três golpes do combo. A cadeia da IA
 // (menteJogador.chain) zera quando o golpe erra, e essa punição vale para a decisão da IA, não para o teclado.
 const c=a.hunter.comboPve2;
 return planoPve2(!!pesado,c&&t<=c.ate?c.indice:0);
}
export function marcarAtaqueManualPve2(a,plano){
 const action=a.tatica?.action;if(!action||!a.golpe)return;
 Object.assign(action,{impact:a.golpe.impacto,end:a.golpe.impacto+plano.recovery,clip:plano.clip,clipeInicio:action.start+plano.carga});
 a.hunter.action=action;
 // A janela para continuar o combo é a do clipe que acabou de sair, com a mesma folga de 0,60 s do lote 1.
 a.hunter.comboPve2={indice:plano.pesado?0:(plano.indice+1)%3,ate:action.end+.60};
 marcarAvancoPve2(a,action,plano.clip);
}
// Rolamento no controle manual (tecla Espaço): o lado vem das teclas A/D e os 1,3 m saem da curva do clipe.
export function rolarManualPve2(a,m,lado='right'){
 const h=a.hunter,mob=fatorMobilidade(a);
 if(!pve2Ligado()||h.equipamento.arma!=='espada'||a.golpe||mob<.45||m.t<(h.proximaEsquiva??0))return false;
 const clipe='pve2_b_sword_roll_'+lado,tab=trajetoriaPve(clipe),escala=escalaCorpo(a,mob);
 const dir=a.direcao+(lado==='right'?1:-1)*Math.PI/2,fim=Math.abs(tab.rootMotion.distanceM)*escala+.1;
 if(!livre(a,m,{x:a.x+cos(dir)*fim,y:a.y+sen(dir)*fim}))return false;
 a.energia=Math.max(0,a.energia-9);h.dodgeUntil=m.t+tab.duration;h.dodgeStarted=m.t;h.dodgeLado=lado;h.proximaEsquiva=m.t+tab.duration+.4;
 h.esquivaPve={clip:clipe,lado,inicio:m.t,fim:m.t+tab.duration,dir,escala,ate:m.t};
 aplicarPostura(a,'esquiva');m.evento('hunter_rolamento',a.id,{lado,motivo:'manual',duracao:tab.duration});return true;
}
// Interrupção só dentro das janelas declaradas pelo clipe PvE; sem clipe PvE, vale a regra antiga (cancelAfter).
export function podeInterromper(action,t,para){return action.clip&&pve1Ligado()?interrupcaoAberta(action.clip,t-inicioClipe(action),para):t>=action.cancelAfter;}
export function menteJogador(a){return a.hunter.jogador??={memoria:{},chain:0,lastAttack:-99,lastResult:null,goal:null,goalUntil:0,commitUntil:0,lastDefense:-99};}

// PvP v12: o golpe de espada é o AUTORADO, e ele passa numa altura e numa linha próprias, não na altura de
// mira. O defensor lê a lâmina visível: altura do trecho que corta e o sentido em que ela varre o plano
// frontal (espelhado, porque os dois se encaram). Sem isso a guarda subia para a altura de mira e a lâmina
// passava por cima ou por baixo dela: 0 aparos em três duelos.
function linhaVisivel(o,acao){
 const op={arma:'espada',altura:o.especie.corpo.alturaM*o.escala};
 const ponto=t=>{const s=amostrarArma(acao,t,op);return s.grip.map((v,i)=>v+(s.tip[i]-v)*.6);};
 const a=ponto(acao.impact-.06),b=ponto(acao.impact);
 return{altura:b[1],linha:atan2(b[1]-a[1],-(b[0]-a[0]))};
}
// The observation boundary may inspect animation/body transforms, never opponent health, RNG or intent.
export function observarMovimento(c,o,t){
 if(c.via!=='visao')return {...c};
 const g=o.golpe,action=o.tatica?.action,pg=g?perfilGolpe(o,g.ataque):null;
 const vis=g&&(guardaFechadaLigada()||pve1Ligado())&&o.hunter?.action&&o.hunter.equipamento?.arma==='espada'?linhaVisivel(o,o.hunter.action):null;
 // `height` is the height the blade is visibly travelling at — the same cue a human reads to place the parry.
 const tell=g?{name:g.nome,key:g.nome+':'+g.inicio,kind:/bote|invest|chifr/.test(g.nome)?'investida':/mord/.test(g.nome)?'mordida':'golpe',heading:action?.heading??o.direcao,progress:clamp((t-g.inicio)/Math.max(.15,pg.preparo)),reach:Math.abs(pg.alcance),height:vis?.altura??pg.altura,linha:vis?.linha,human:!!o.especie.anatomiaHumana}:null;
 return {...c,human:!!o.especie.anatomiaHumana,tell};
}
export function aprenderSinais(a,c,t){
 const s=menteJogador(a),skill=clamp(a.hunter.habilidade??.65),key=c.especie??'rival';
 const memory=s.memoria[key]??={moves:{},encounters:0};
 if(s.target!==c.id){s.target=c.id;memory.encounters++;s.observation=null;s.goal=null;s.chain=0;}
 let obs=s.observation;
 if(c.tell&&obs?.key!==c.tell.key){obs=s.observation={key:c.tell.key,name:c.tell.name,kind:c.tell.kind,firstSeen:t,phase:'preparo',heading:c.tell.heading,progress:c.tell.progress};}
 if(obs?.phase==='preparo'&&!c.tell){
  const m=memory.moves[obs.name]??={samples:0,windup:.45,recovery:.75};
  const seen=Math.max(.08,t-obs.firstSeen);m.windup=m.samples?(m.windup*3+seen)/4:seen;m.samples++;obs.phase='recuperacao';obs.recoverStart=t;
 }
 if(obs?.phase==='recuperacao'&&c.signal!=='recuperacao'){
  const m=memory.moves[obs.name];if(m)m.recovery=clamp((m.recovery*2+(t-obs.recoverStart))/3,.2,2.5);obs.phase='concluido';
 }
 const learned=obs&&memory.moves[obs.name],knowledge=clamp(skill+(learned?.samples??0)*.025,0,.95);
 // A move already seen is read while it is still winding up: the delay cannot outlast the wind-up itself,
 // or every defence would be decided after the blade already landed. Skill buys the earlier read.
 const windup=learned?.windup??(c.human?.35:.45);
 const recognitionDelay=Math.min(.10+(1-skill)*.30,windup*(.62-skill*.22));
 const recognized=!!c.tell&&obs&&t-obs.firstSeen>=recognitionDelay;
 // How much of the wind-up is left: what a defence has to fit into, read off the visible progress.
 const restante=Math.max(0,windup*(1-(c.tell?.progress??1)));
 const estimate=learned?.recovery??(c.human?.70:c.tell?.kind==='investida'?1.1:.8);
 let window=0;
 if(c.signal==='preparo')window=.03;
 else if(c.signal==='caido')window=2.2;
 else if(c.signal==='desequilibrado')window=.8;
 else if(c.signal==='recuperacao')window=Math.max(.05,estimate-(t-(obs?.recoverStart??t)));
 else if(c.signal==='fuga')window=.65;
 else{const angle=Math.abs(normalizarAngulo(atan2(a.y-c.y,a.x-c.x)-(c.direcao??0)));window=angle>1.25?.90+knowledge*.75:.58+knowledge*.32;if(!c.human&&angle>2.1&&estilo(a).clip==='greatsword')window+=.65;}
 // Stable novice bias causes genuine premature/late decisions; no per-frame random evasions.
 window+= (1-knowledge)*(((a.numero??1)%2)?.16:-.16);
 const prediction=skill<.35&&!(learned?.samples)&&c.tell?.kind==='investida'?'golpe':c.tell?.kind;
 const view={skill,knowledge,recognized,prediction,window:Math.max(0,window),delay:recognitionDelay,restante,motor:.08+(1-skill)*.08};s.reading=view;return view;
}
export function alvoAnatomico(a,c,goal){
 const b=c.body??{r:.4,half:0,center:0,height:1.5},d=c.direcao??0,side=menteJogador(a).side??((a.numero??1)%2?1:-1),human=c.human;
 const along=goal==='cabeca'?(b.half+b.r)*.82:goal==='pernas'?-(b.half*.35):0;
 const across=goal==='flanco'?b.r*.75*side:0;
 return{x:c.x+cos(d)*(b.center+along)-sen(d)*across,y:c.y+sen(d)*(b.center+along)+cos(d)*across,height:b.height*(goal==='cabeca'?.88:goal==='pernas'?.23:human?.62:.59),goal};
}
function livre(a,m,p){return segmentoLivre(m.terreno,perfilMobilidade(m.terreno,a.especie.movimento),a,p,a.especie.corpo.raio*a.escala,.04)&&(!m.sondagemTatica||m.sondagemTatica(a,p));}
function destinoParte(a,c,m,goal,reach){
 const predicted=c.signal==='fuga'?{...c,x:c.x+(c.vx??0)*.25,y:c.y+(c.vy??0)*.25}:c;
 const p=alvoAnatomico(a,predicted,goal),b=c.body??{r:.4},s=menteJogador(a),side=s.side??((a.numero??1)%2?1:-1);
 const radial=atan2(a.y-p.y,a.x-p.x),desired=goal==='flanco'?(c.direcao??0)+side*Math.PI/2:goal==='cabeca'?(c.direcao??0):radial;
 const angle=radial+clamp(normalizarAngulo(desired-radial),-.4,.4),radius=Math.max(reach-.05,a.especie.corpo.raio+b.r*.4+.14);
 for(const delta of [0,side*.22,-side*.22,side*.42]){const d=angle+delta,q={x:p.x+cos(d)*radius,y:p.y+sen(d)*radius};if(livre(a,m,q))return q;}return null;
}
function intent(a,c,m,state,reason,dest=null){const s=menteJogador(a),point=alvoAnatomico(a,c,s.goal??'flanco');
 if(a.golpe&&a.hunter.action){const heading=a.hunter.action.heading??a.direcao,want=atan2(point.y-a.y,point.x-a.x),locked=heading+clamp(normalizarAngulo(want-heading),-.22,.22);point.x=a.x+cos(locked)*3;point.y=a.y+sen(locked)*3;}
 (a.tatica??={}).enabled=true;a.tatica.lastSeen=m.t;a.tatica.phase=state;a.tatica.reason=reason;
 const pursuit=!!dest&&!c.tell&&hipot(a.x-c.x,a.y-c.y)>estilo(a).reach+(c.body?.half??0)+2.5&&a.energia>30;
 return{estado:state,codigo:'jogador_'+state,motivo:reason,alvo:{tipo:'criatura',id:c.id,x:c.x,y:c.y},destino:dest,olharPara:point,ritmo:dest?(pursuit?'corrida':'andar'):'parado',orientacaoCombate:true,velMax:pursuit?a.especie.movimento.corrida:a.especie.movimento.andar*estilo(a).step};
}
export function ameacaTrajetoria(a,c){
 const tell=c.tell;if(!tell)return false;
 const dx=a.x-c.x,dy=a.y-c.y,h=tell.heading,forward=dx*cos(h)+dy*sen(h),lateral=Math.abs(dx*-sen(h)+dy*cos(h));
 const length=tell.kind==='investida'?Math.max(tell.reach,(c.velocidade??0)*.6+4):tell.reach+(c.body?.half??0);
 return forward>-.3&&forward<length+1.1&&lateral<(tell.kind==='investida'?.7:1.0)+(a.especie.corpo.raio??.26);
}
// PvE v01: tempo que o corpo leva, pela curva do clipe, para sair `dist` metros da linha do golpe (0,47 m = raio do corpo 0,26 +
// tolerância de contato do núcleo 0,15 + folga).
// Folga mínima entre os corpos que o avanço autorado do golpe respeita (metros, entre as cápsulas).
export const FOLGA_AVANCO=.25;
export function folgaCorpo(a,p,alvo){
 const k=capsula(alvo),u=Math.max(-k.meio,Math.min(k.meio,(p.x-k.cx)*k.ux+(p.y-k.cy)*k.uy));
 return Math.hypot(p.x-k.cx-k.ux*u,p.y-k.cy-k.uy*u)-k.r-(a.especie.corpo.raio??.26)*a.escala;
}
export const escalaCorpo=(a,mob=fatorMobilidade(a))=>a.especie.corpo.alturaM*a.escala/1.70*Math.max(.55,mob);
export function tempoSaidaEsquivaPve1(dist=.47,lado='left'){const cv=trajetoriaPve((pve2Ligado()?'pve2_b_sword_roll_':'pve1_b_sword_dodge_')+lado).rootMotion.curve,i=cv.findIndex(v=>Math.abs(v)>=dist);return i<0?Infinity:i/60;}
// Esquiva do lote 1: a IA escolhe o lado (esquerda/direita do corpo), o clipe dura 1,00 s e o corpo segue
// rootMotion.curve (metros nativos a 1,70 m, escalados pela altura do Hunter e pela mobilidade) com colisão de terreno.
function esquivarPve1(a,c,m,s,preferred,angle){
 const h=a.hunter,mob=fatorMobilidade(a);
 if(mob<.45)return false;
 const escala=escalaCorpo(a,mob);
 for(const side of [preferred,-preferred]){
  // Convenção do corpo: +X local = esquerda = direcao − 90°. O lado é relativo ao corpo, que é o que o clipe desenha.
  // PvE v02: a esquiva é o rolamento do lote 2 (1,3 m), no lugar da esquiva de 0,47 m do lote 1.
  const rel=normalizarAngulo(angle+side*Math.PI/2-a.direcao),lado=rel>0?'right':'left',clipe=(pve2Ligado()?'pve2_b_sword_roll_':'pve1_b_sword_dodge_')+lado,tab=trajetoriaPve(clipe);
  const dir=a.direcao+(lado==='right'?1:-1)*Math.PI/2,fim=Math.abs(tab.rootMotion.distanceM)*escala+.1;
  if(s.reading&&c.tell&&s.reading.restante<tempoSaidaEsquivaPve1(.47/escala,lado))return false;   // não dá tempo de sair da linha
  if(!livre(a,m,{x:a.x+cos(dir)*fim,y:a.y+sen(dir)*fim}))continue;
  a.energia-=9;s.lastDefense=m.t;s.side=side;s.commitUntil=m.t+tab.duration;s.destination=null;
  h.dodgeUntil=m.t+tab.duration;h.dodgeStarted=m.t;h.dodgeSide=side;h.dodgeLado=lado;h.proximaEsquiva=m.t+1;
  h.esquivaPve={clip:clipe,lado,inicio:m.t,fim:m.t+tab.duration,dir,escala,ate:m.t};
  s.counterUntil=m.t+.95;aplicarPostura(a,'esquiva');m.evento('hunter_esquiva_tatica',a.id,{alvo:c.id,lado,motivo:'sair_da_trajetoria_e_alcancar_flanco',duracao:tab.duration});return true;
 }return false;
}
// Passo do corpo na esquiva PvE: aplica o trecho da curva do clipe que cabe neste passo. Chamado por passoHunters antes do
// núcleo, de modo que a varredura de geometria sólida e a separação de corpos do núcleo continuam valendo.
// PvE v02 (pedido do diretor, 2026-11-20): o Hunter não cansa na caçada experimental. Energia e fôlego voltam ao máximo
// antes de cada decisão; sem o modo experimental, o cansaço segue como antes (PvP, PvE v01, Alpha).
export function semCansacoPve2(m){
 if(!pve2Ligado())return;
 for(const a of m.hunters){a.energia=a.especie.necessidades.energiaMax;a.folego=a.especie.movimento.resistenciaSeg*(a.atributos?.resistencia??1);}
}
export function moverEsquivasPve1(m){
 if(!pve1Ligado())return;
 for(const a of m.hunters){
  const e=a.hunter.esquivaPve;if(!e)continue;
  const cv=trajetoriaPve(e.clip).rootMotion.curve,f=t=>{const x=Math.min(cv.length-1.000001,Math.max(0,(t-e.inicio)*60)),i=Math.floor(x);return Math.abs(cv[i]+(cv[i+1]-cv[i])*(x-i));};
  const t1=Math.min(e.fim,m.t+m.dt),d=(f(t1)-f(e.ate))*e.escala;
  if(d>0){const p={x:a.x+cos(e.dir)*d,y:a.y+sen(e.dir)*d};if(livre(a,m,p)){a.x=p.x;a.y=p.y;}else e.fim=m.t;}
  e.ate=t1;a.direcaoMovimento=e.dir;
  if(t1>=e.fim-1e-9)a.hunter.esquivaPve=null;
 }
 // PvE v02: o avanço autorado dos golpes (combo 1/2/3 e liberação da carga) segue a mesma regra, no eixo da frente.
 for(const a of m.hunters){
  const e=a.hunter.avancoPve;if(!e)continue;
  const cv=trajetoriaPve(e.clip).rootMotion.curve,f=t=>{const x=Math.min(cv.length-1.000001,Math.max(0,(t-e.inicio)*60)),i=Math.floor(x);return cv[i]+(cv[i+1]-cv[i])*(x-i);};
  const t1=Math.min(e.fim,Math.max(e.ate,m.t+m.dt)),d=(f(t1)-f(e.ate))*e.escala,alvo=e.alvo?m.porId.get(e.alvo):null;
  // O avanço do golpe para antes de encostar no alvo: o passo leva a lâmina, não o corpo para dentro do outro corpo.
  if(d>0){const p={x:a.x+cos(e.dir)*d,y:a.y+sen(e.dir)*d};if(livre(a,m,p)&&!(alvo?.vivo&&folgaCorpo(a,p,alvo)<FOLGA_AVANCO)){a.x=p.x;a.y=p.y;}else e.fim=m.t;}
  e.ate=t1;
  if(t1>=e.fim-1e-9)a.hunter.avancoPve=null;
 }
}
export function esquivarParaFlanco(a,c,m){
 const h=a.hunter,s=menteJogador(a),style=estilo(a);if(a.golpe||a.saude.caidoAte>m.t||a.saude.atordoadoAte>m.t||a.energia<style.reserve+7||m.t-s.lastDefense<.85)return false;
 const angle=c.tell?.heading??c.direcao??0,preferred=s.side??((a.numero??1)%2?1:-1);
 if(style.pve)return esquivarPve1(a,c,m,s,preferred,angle);
 for(const side of [preferred,-preferred]){
  const ang=angle+side*Math.PI/2,p={x:a.x+cos(ang)*1.0,y:a.y+sen(ang)*1.0};if(!livre(a,m,p))continue;
  a.impulso={vx:cos(ang)*3.6,vy:sen(ang)*3.6,ate:m.t+.28,tipo:'esquiva'};
  a.energia-=9;s.lastDefense=m.t;s.side=side;s.commitUntil=m.t+.45;s.destination=null;h.dodgeUntil=m.t+.50;h.dodgeStarted=m.t;h.dodgeSide=side;h.proximaEsquiva=m.t+1;
  s.counterUntil=m.t+.95;aplicarPostura(a,'esquiva');m.evento('hunter_esquiva_tatica',a.id,{alvo:c.id,lado:side,motivo:'sair_da_trajetoria_e_alcancar_flanco'});return true;
 }return false;
}
// Blade parry: the guard is BUILT from the read line of attack (height + tilt), so the steel is taken to
// where the incoming blade actually is. `h.guarda` is a pose, not a timer: the narrow phase decides contact.
export function apararComLamina(a,c,m,reading){
 const h=a.hunter,s=menteJogador(a),style=estilo(a);
 if(h.equipamento.arma==='maos'||!(a.especie.bloqueioMax>0))return false;
 if(a.golpe||fatorBracos(a)<=.45||a.energia<style.reserve+3)return false;
 if(a.saude.caidoAte>m.t||a.saude.atordoadoAte>m.t)return false;
 const altura=c.tell?.height??a.especie.corpo.alturaM*a.escala*.62;
 // A cut arrives across the body, so it is met with the blade upright; a thrust is deflected sideways.
 const inclinacao=c.tell?.linha??(c.tell?.kind==='investida'||/estocada|perfur/.test(c.tell?.name??'')?Math.PI/2:0);
 const duracao=.34+reading.skill*.22;
 h.guarda={name:style.clip+'_block',start:m.t,impact:m.t+(style.pve?TEMPO_BLOQUEIO_PVE:.12),end:m.t+duracao,reach:style.reach,aimHeight:altura,heading:a.direcao,bloqueio:{altura,inclinacao}};
 h.blockUntil=m.t+duracao;s.counterUntil=m.t+duracao+.55;s.lastDefense=m.t;a.energia=Math.max(0,a.energia-3);h.bloqueios++;
 aplicarPostura(a,'defesa');
 m.evento('hunter_guarda_lamina',a.id,{alvo:c.id,altura:+altura.toFixed(2),inclinacao:+inclinacao.toFixed(2),ate:+h.guarda.end.toFixed(2)});
 return true;
}
// Attack slot of a pair: whoever commits first holds it until that action is over, so the other Hunter is
// the one defending. One slot per pair is the 1×1 case of Kenshi's slots; crowd slots are not in scope here.
const chaveIniciativa=(a,c)=>a.id<c.id?a.id+'|'+c.id:c.id+'|'+a.id;
export function temIniciativa(a,c,m){
 const dono=(m.iniciativaCombate??=new Map()).get(chaveIniciativa(a,c));
 return !dono||dono.id===a.id||m.t>=dono.ate;
}
export function tomarIniciativa(a,c,m,ate){(m.iniciativaCombate??=new Map()).set(chaveIniciativa(a,c),{id:a.id,ate});}
export function escolherSequencia(a,c,reading,t){
 const h=a.hunter,s=menteJogador(a),style=estilo(a),ag=h.personalidade.agressividade,skill=reading.skill;
 if(t<(s.exitUntil??0))return null;
 if(t>(s.chainUntil??s.lastAttack+2.0))s.chain=0;
 const maxChain=Math.min(style.chain,ag>.75?3:ag>.4?2:1),reserve=style.reserve+(1-ag)*10;
 const escape=style.escape*(1.2-skill*.3),heavyBudget=style.heavy+style.heavyRecover*.45+escape;
 if(a.energia<reserve+5)return null;
 if(s.chain>=maxChain||s.lastResult==='miss'||s.lastResult==='interrupted')return null;
 // Riposte: open to every armed style now that a parry really stops the blade. Only the spear has its own
 // counter clip; a sword riposte is a fast light cut, which is what the clip remap already plays.
 const counter=style.clip!=='unarmed'&&s.counterPrimed&&t<(s.counterUntil??0);
 // PvE: o pesado compromete o corpo por 2,00 s; com a perna ferida (mobilidade baixa) a IA não o escolhe.
 const heavy=!counter&&reading.window>=heavyBudget&&a.energia>reserve+13&&(style.clip==='greatsword'||s.chain>0||reading.window>1.5)&&(!style.pve||fatorMobilidade(a)>.6);
 let windup=counter&&!style.pve?.26:heavy?style.heavy:style.light*(s.chain&&!style.pve?.88:1),recovery=counter&&!style.pve?.50:heavy?style.heavyRecover:style.recover;
 // PvE v02: o preparo e a recuperação são os do clipe que vai tocar — combo pela posição na cadeia, pesado = carga + liberação.
 const planoPve=style.pve2?planoPve2(heavy,s.chain):null;
 if(planoPve){windup=planoPve.windup;recovery=planoPve.recovery;}
 const riskAllowance=ag>.8?(ag-.8)*.5:0;
 if(reading.window+riskAllowance<windup+escape+recovery*.22)return null;
 return{heavy,index:s.chain,windup,recovery,clipePve:planoPve?.clip,cargaPve:planoPve?.carga??0,clip:style.clip+'_'+(counter?(style.clip==='spear'?'counter':'light'):heavy?'heavy':s.chain===1?'follow':s.chain===2?'finish':'light'),counter,reserve,escape,window:reading.window};
}
export function iniciarGolpeJogador(a,c,rival,m,move){
 const h=a.hunter,s=menteJogador(a),all=h.todosAtaques??a.especie.combate.ataques;
 const source=all.find(x=>x.peso===(move.heavy?'pesado':'leve')&&x.nome!=='golpe_curto');if(!source)return false;
 const aim=alvoAnatomico(a,c,s.goal),attack={...source,preparoSeg:move.windup,recargaSeg:move.recovery,energia:source.energia*(move.heavy?1.05:1),clipe:move.clip,regioes:c.human?[...source.regioes]:[...new Set([...source.regioes,'cabeca','pescoco','tronco','flanco','pernas','cauda'])]};
 if(a.energia<attack.energia+move.reserve)return false;
 const anatomy=a.especie.anatomia.ataques[attack.nome];Object.assign(anatomy,{tImpacto:move.windup,duracao:move.windup+move.recovery,alturaImpacto:aim.height/(a.especie.escalaModelo??1)/a.escala});
 s.requiresPlant=false;
 const pg=perfilGolpe(a,attack),geo=contatoGolpe(a,pg,capsula(rival),attack.nome);
 if(geo.d>.15||Math.abs(normalizarAngulo(atan2(aim.y-a.y,aim.x-a.x)-a.direcao))>.48)return false;
 if(a.velocidade>(move.heavy?.48:a.especie.movimento.andar*.86)){s.requiresPlant=true;return false;}
 if(!rival.hunter&&!rival.conflito&&!a.conflito)abrirConflito(m,a,rival,'ataque_hunter',null);
 iniciarAtaque(a,rival,attack,m);if(!a.golpe)return false;
 a.energia=Math.max(0,a.energia-attack.energia*(1+a.especie.custoEnergiaExtra));h.golpesDados++;
 Object.assign(a.tatica.action,{name:move.clip,impact:a.golpe.impacto,end:a.golpe.impacto+move.recovery,counter:!!move.counter,variante:h.golpesDados%3});
 h.action=a.tatica.action;h.action.goal=s.goal;h.action.aimHeight=aim.height;h.action.cancelAfter=a.golpe.impacto+move.recovery*.65;
 if(estilo(a).pve){const clip=move.clipePve??clipePve1(move.clip),tab=trajetoriaPve(clip);h.action.clip=clip;
  h.action.clipeInicio=h.action.start+(move.cargaPve??0);   // o laço de carga roda antes do clipe de liberação
  // A primeira janela depois do contato em que se pode esquivar ou bloquear marca o fim do compromisso do corpo.
  h.action.cancelAfter=h.action.clipeInicio+Math.min(...tab.interrupts.filter(w=>w.from>=tab.impact&&w.into.some(x=>x==='dodge'||x==='block'||x==='any')).map(w=>w.from),tab.duration);
  if(estilo(a).pve2)marcarAvancoPve2(a,h.action,clip);}
 s.counterPrimed=false;s.lastAttack=m.t;s.chain++;s.chainUntil=h.action.end+.60;s.lastResult=null;s.move=move;s.commitUntil=h.action.end;s.destination=null;
 tomarIniciativa(a,c,m,h.action.end);
 m.evento('hunter_sequencia',a.id,{alvo:c.id,parte:s.goal,indice:move.index,clip:move.clip,contra:!!move.counter,variante:h.golpesDados%3,janela:move.window,preparo:move.windup,recuperacao:move.recovery,habilidade:h.habilidade??.65});return true;
}
// Consume a failed attempt after its physical recovery, rather than leaving a permanent miss latch.
function registrarFalha(a,t,kind){
 const s=menteJogador(a),action=a.hunter.action;
 s.lastResult=kind;s.chain=0;s.failureUntil=Math.max(t+.18,action?.end??t)+(kind==='miss'?.30:.20);
 s.exitUntil=Math.max(s.exitUntil??0,s.failureUntil);s.punishUntil=s.failureUntil;s.destination=null;s.commitUntil=0;
}
export function atualizarRitmo(a,c,m){
 const s=menteJogador(a),distance=hipot(a.x-c.x,a.y-c.y),style=estilo(a);
 if((s.lastResult==='miss'||s.lastResult==='interrupted')&&!s.failureUntil)registrarFalha(a,m.t,s.lastResult);
 if(s.failureUntil&&m.t>=s.failureUntil){s.failureUntil=0;s.punishUntil=0;if(s.lastResult==='miss'||s.lastResult==='interrupted')s.lastResult=null;}
 let progress=s.progress;
 if(!progress||progress.target!==c.id)progress=s.progress={target:c.id,best:distance,since:m.t};
 if(distance<progress.best-.25||distance<style.reach+(c.body?.half??0)+.9||s.regaining){progress.best=distance;progress.since=m.t;}
 if(m.t-progress.since>3.5){
  s.side=-(s.side??1);s.goal='flanco';s.goalUntil=m.t+1.2;s.destination=null;s.commitUntil=0;s.directApproachUntil=m.t+1.2;
  progress.best=distance;progress.since=m.t;
  m.evento('hunter_reavaliacao',a.id,{alvo:c.id,motivo:'aproximacao_sem_progresso',distancia:distance});
 }
 return s;
}
function saidaCurta(a,c,m){
 const s=menteJogador(a),angle=atan2(a.y-c.y,a.x-c.x),side=s.side??1;
 // PvE: contra um monstro mais pesado que o Hunter a saída é mais longa (até +0,5 m), porque o alcance dele passa o da espada.
 const passo=.6+(estilo(a).pve?Math.max(0,Math.min(.5,((c.massaEstimada??a.massa)/a.massa-1)*.4)):0);
 for(const delta of [side*.32,-side*.32,0]){const dir=angle+delta,p={x:a.x+cos(dir)*passo,y:a.y+sen(dir)*passo};if(livre(a,m,p))return p;}
 return null;
}
export function decidirComoJogador(a,c,rival,m){
 const h=a.hunter,s=atualizarRitmo(a,c,m),style=estilo(a),r=aprenderSinais(a,c,m.t);s.lastContact={id:c.id,x:c.x,y:c.y,t:m.t};s.side??=(a.numero??1)%2?1:-1;
 if(!s.goal||m.t>s.goalUntil){s.goal=c.signal==='fuga'?'pernas':r.window>1.3&&r.skill>.5?'cabeca':'flanco';s.goalUntil=m.t+1.4+(1-r.skill)*.8;m.evento('hunter_alvo_anatomico',a.id,{alvo:c.id,parte:s.goal});}
 if(a.golpe){aplicarPostura(a,'comprometida');return intent(a,c,m,'preparando_ataque','golpe comprometido; aguardando contato físico');}
 if(h.dodgeUntil>m.t)return intent(a,c,m,'esquivando','passo evasivo comprometido em direção ao flanco');
 const anticipated=c.tell?{...c,tell:{...c.tell,kind:r.prediction}}:c;
 const danger=r.recognized&&ameacaTrajetoria(a,anticipated),action=h.action;
 if(danger&&s.motorKey!==c.tell.key){s.motorKey=c.tell.key;s.motorReady=m.t+.08+(1-r.skill)*.08;}
 const defenseReady=danger&&(h.equipamento.escudo||m.t>=(s.motorReady??Infinity));
 if(h.guarda&&m.t>h.guarda.end)h.guarda=null;
 // Steel in hand: the guard goes up while the blade still has farther to travel than the arm needs. It is
 // the remaining wind-up that decides, not a fixed reaction timer — a parry started too late never meets.
 // PvE: o bloqueio leva 0,30 s para subir, e investida de monstro se esquiva em vez de ser aparada.
 const podeAparar=danger&&!h.equipamento.escudo&&c.tell?.key!==s.defendedKey&&r.restante>=(style.pve?TEMPO_BLOQUEIO_PVE:r.motor)&&!(style.pve&&r.prediction==='investida');
 if(action&&m.t<action.end){
  // The tail of one's own recovery can be abandoned to meet a blade, exactly as it can to step aside.
  if(podeAparar&&podeInterromper(action,m.t,'block')&&apararComLamina(a,c,m,r)){action.end=m.t;s.chain=0;s.defendedKey=c.tell.key;m.evento('hunter_cancelamento',a.id,{motivo:'aparo_na_janela_de_saida'});return intent(a,c,m,'defendendo','cancelou o final da recuperação para levar a lâmina à linha do golpe');}
  if(defenseReady&&podeInterromper(action,m.t,'dodge')&&esquivarParaFlanco(a,c,m)){action.end=m.t;s.chain=0;m.evento('hunter_cancelamento',a.id,{motivo:'janela_de_saida_pos_impacto'});return intent(a,c,m,'esquivando','cancelou apenas o final da recuperação para escapar');}
  aplicarPostura(a,'comprometida');return intent(a,c,m,'recuperando','recuperação física antes de decidir o próximo golpe');
 }
 if(danger&&c.tell?.key===s.defendedKey&&(h.equipamento.escudo||h.guarda)){h.blockUntil=Math.max(h.blockUntil,m.t+.15);a.energia=Math.max(0,a.energia-.8*m.dt);}
 if(podeAparar&&apararComLamina(a,c,m,r)){
  s.defendedKey=c.tell.key;return intent(a,c,m,'defendendo','levou a lâmina ao encontro da linha do golpe');
 }
 if(defenseReady&&c.tell?.key!==s.defendedKey){
  if(h.equipamento.escudo&&fatorBracos(a)>.5&&a.energia>style.reserve+4){s.defendedKey=c.tell.key;h.blockUntil=m.t+.48;s.counterUntil=m.t+1;s.lastDefense=m.t;a.energia-=3;h.bloqueios++;m.evento('hunter_bloqueio_tatico',a.id,{alvo:c.id});}
  else if(esquivarParaFlanco(a,c,m)){s.defendedKey=c.tell.key;return intent(a,c,m,'esquivando','leu a preparação e saiu da linha do golpe');}
 }
 aplicarPostura(a,h.blockUntil>m.t?'defesa':'neutra');
 if(h.blockUntil>m.t)return intent(a,c,m,'defendendo','guarda orientada para a ameaça observada');
 const far=hipot(a.x-c.x,a.y-c.y)>style.reach+(c.body?.half??0)+3;
 if(a.energia<style.reserve+13)s.regaining=true;if(a.energia>style.reserve+30)s.regaining=false;
 if(s.regaining)return intent(a,c,m,'recuperando','retoma fôlego antes de perseguir; conserva reserva de defesa');
 if(m.t<(s.exitUntil??0)){const exit=saidaCurta(a,c,m);return intent(a,c,m,exit?'recuando':'defendendo','encerra sequência e recupera base antes de voltar a pressionar',exit);}
 // Attack slot of the pair: only one of the two commits at a time, so the other is free to defend. Without
 // it both swing on the same step, stay locked for the whole action, and no blade is ever met.
 const move=temIniciativa(a,c,m)?escolherSequencia(a,c,r,m.t):null;
 if(move&&iniciarGolpeJogador(a,c,rival,m,move))return intent(a,c,m,'preparando_ataque',move.heavy?'abertura comporta golpe pesado e saída':'golpe curto com reserva para saída');
 if(move&&s.requiresPlant)return intent(a,c,m,'avaliando','firma os pés e freia antes de comprometer o golpe');
 if(s.chain&&(s.lastResult==='miss'||s.lastResult==='interrupted'||!move)){
  s.chain=0;s.lastResult=null;s.commitUntil=0;s.exitUntil=m.t+.50;s.goal='flanco';s.goalUntil=m.t+1;
  m.evento('hunter_fim_sequencia',a.id,{motivo:'risco_alcance_energia_ou_reacao'});
 }
 if(m.t<s.commitUntil&&s.destination&&livre(a,m,s.destination)&&hipot(a.x-s.destination.x,a.y-s.destination.y)>.15)return intent(a,c,m,s.phase,s.reason,s.destination);
 const approachGoal=m.t<(s.directApproachUntil??0)?'pernas':s.goal;
 const dest=destinoParte(a,c,m,approachGoal,style.reach),d=hipot(a.x-c.x,a.y-c.y);
 const state=danger?'recuando':d>style.reach+(c.body?.half??0)+1?'aproximando':'circulando';
 s.destination=dest;s.phase=dest?state:'defendendo';s.reason=dest?'procurando '+s.goal+' com espaço para golpear e sair':'sem trajetória segura; mantém guarda';s.commitUntil=m.t+.48+(1-r.skill)*.25;
 return intent(a,c,m,s.phase,s.reason,dest);
}
export function registrarCombateJogador(m,events){
 for(const e of events){
  const defender=e.tipo==='ferimento'?m.porId.get(e.id):null;if(defender?.hunter?.postura==='defesa'&&defender.hunter.blockUntil>=e.t){const s=menteJogador(defender);s.counterPrimed=true;s.counterUntil=m.t+.75;}
  const id=e.tipo==='ferimento'?e.atacante:e.id,a=m.porId.get(id),s=a?.hunter?.jogador;if(!s)continue;
  if(e.tipo==='ferimento'){s.lastResult='hit';s.hits=(s.hits??0)+1;}
  if(e.tipo==='golpe_errou'){registrarFalha(a,m.t,'miss');s.misses=(s.misses??0)+1;}
  if(e.tipo==='golpe_interrompido')registrarFalha(a,m.t,'interrupted');
 }
}
