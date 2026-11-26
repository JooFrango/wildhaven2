// Canonical blade path in the Hunter frame: +Z forward, +X left, Y up.
// Shared by exported skeletal authoring, renderer and simulation narrow phase.
import {cos,sen,atan2} from '../../ia-criaturas/src/core/matematica.js';
import {capsula} from '../../ia-criaturas/src/eco/combate.js';
import TRAJETORIAS_PVP12 from './trajetorias-pvp12.js';
import TRAJETORIAS_PVE1 from './trajetorias-pve1.js';
import TRAJETORIAS_PVE2 from './trajetorias-pve2.js';
const TRAJETORIAS={...TRAJETORIAS_PVP12,...TRAJETORIAS_PVE1,...TRAJETORIAS_PVE2};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},lerp=(a,b,u)=>a+(b-a)*u;
// Guarda fechada do PvP v12: ligada pelo laboratório quando a biblioteca v12 está carregada. Desligada,
// a trajetória da arma é a de sempre — o PvE e os clipes da v05 não veem diferença nenhuma.
let guardaFechada=false;
export function usarGuardaFechada(ligada){guardaFechada=!!ligada;}
export const guardaFechadaLigada=()=>guardaFechada;
// PvE v01 (contrato hunter-pve-v01): interruptor próprio, ligado pelo laboratório com ?pve1=1 e pelos testes. Ligado, o
// tempo do golpe de espada e a lâmina vêm de trajetorias-pve1.js (mesma fonte do renderizador); desligado, nada muda.
let pve1=false;
export function usarPve1(ligada){pve1=!!ligada;}
export const pve1Ligado=()=>pve1;
// Mesma regra de remapPve1: pesado e continuação final -> corte pesado; o resto -> corte leve.
export const clipePve1=nome=>/heavy|finish/.test(nome??'')?'pve1_c_sword_heavy':'pve1_c_sword_light';
export const trajetoriaPve1=clipe=>TRAJETORIAS_PVE1[clipe];
// PvE v02 (contrato hunter-pve-v02, rig v13, lotes 1 e 2): interruptor próprio, ligado pelo laboratório com
// ?pve1=1&pve2=1 e pelos testes. Ligado, o tempo e a lâmina dos golpes de espada vêm de trajetorias-pve2.js.
// Ele implica o PvE v01 ligado, porque o caminho de código (tempo do clipe, janelas, esquiva) é o mesmo.
let pve2=false;
export function usarPve2(ligada){pve2=!!ligada;if(pve2)pve1=true;}
export const pve2Ligado=()=>pve2;
export const trajetoriaPve=clipe=>TRAJETORIAS[clipe];
export const CARGA_PVE2='pve2_c_sword_charge_loop';
const COMBO_PVE2=['pve2_c_sword_combo_1','pve2_c_sword_combo_2','pve2_c_sword_combo_3'];
// Pesado = carga + liberação. O golpe leve segue a posição na cadeia: combo 1 -> 2 -> 3 -> 1.
// Giro do corpo no golpe PvE v02. No contato autorado, a lâmina do rig v13 passa 0,5–0,8 m à DIREITA da linha do corpo
// (o braço abre o arco para o lado; no PvE v01 eram 0,06–0,13 m). Sem correção o golpe ia para o lado do alvo e errava.
// O corpo gira para pôr esse ponto da lâmina na linha da frente; a mesma rotação vale para a lâmina simulada e para
// o corpo desenhado, então contato e imagem continuam sendo o mesmo golpe. A animação não muda.
const giros=new Map();
export function giroContatoPve(clipe){
 if(giros.has(clipe))return giros.get(clipe);
 const t=TRAJETORIAS[clipe];let g=0;
 if(t?.frames&&t.impact!=null){
  const f=t.frames[Math.round(t.impact*t.fps)],n=Math.hypot(f[3],f[4],f[5])||1,L=.64/1.75*.6;   // 60% da lâmina, como a leitura do defensor
  g=Math.atan2(-(f[0]+f[3]/n*L),f[2]+f[5]/n*L);
 }
 giros.set(clipe,g);return g;
}
// Quanto do giro vale no instante t: entra até o início da janela ativa e sai durante a recuperação, em rampa suave.
export function giroAcao(action,t){
 if(!pve2||!/^pve2_c_/.test(action?.clip??'')||!(t>=action.start&&t<=action.end))return 0;
 const tab=TRAJETORIAS[action.clip],c=action.clipeInicio??action.start,ph=tab.phases,de=Math.max(action.start,c-.25);
 const entra=smooth((t-de)/Math.max(.05,c+ph.activeStart-de)),sai=1-smooth((t-c-ph.recovery)/Math.max(.05,tab.duration-ph.recovery));
 return giroContatoPve(action.clip)*Math.min(entra,sai);
}
export const clipePve2=(nome,indice=0)=>/heavy|pesado/.test(nome??'')?'pve2_c_sword_charge_release':COMBO_PVE2[((indice|0)%3+3)%3];
// Janela de interrupção aberta `decorrido` segundos depois do início da ação, para `para` (dodge, block, light, heavy).
export function interrupcaoAberta(clipe,decorrido,para){
 const tab=TRAJETORIAS[clipe];return !!tab&&!!tab.interrupts&&tab.interrupts.some(w=>decorrido>=w.from-1e-9&&decorrido<=w.to+1e-9&&(w.into.includes(para)||w.into.includes('any')));
}
// Qual golpe autorado da biblioteca v12 cada ataque da simulação usa. Fonte única: o renderizador também
// escolhe o clipe por aqui, então o corpo desenhado e a lâmina simulada nunca são golpes diferentes.
export function clipePvp12(nome,contra,variante=0){
 if(!/^sword_/.test(nome??''))return 'pvp12_sword_horizontal_cut';
 // Contra-ataque = estocada; pesado = diagonal descendente; continuação = reverso. O golpe leve alterna os três
 // cortes pela contagem de golpes do Hunter, como o Kenshi alterna animações de ataque: a IA decide QUANDO
 // e com que tempo golpear, e a variante só escolhe qual golpe autorado executa essa decisão.
 const LEVES=['pvp12_sword_horizontal_cut','pvp12_sword_horizontal_reverse_cut','pvp12_sword_diagonal_down'];
 const pedido=contra?'pvp12_sword_thrust':/heavy/.test(nome)?'pvp12_sword_diagonal_down':/follow|finish/.test(nome)?'pvp12_sword_horizontal_reverse_cut':LEVES[((variante|0)%3+3)%3];
 // Golpe ainda não autorado: cai no corte horizontal, que existe desde a primeira entrega.
 return TRAJETORIAS_PVP12[pedido]?pedido:'pvp12_sword_horizontal_cut';
}
// Punho e direção autorados no instante da fase do golpe, com o mesmo reajuste de tempo do renderizador.
function laminaAutorada(clipe,fase,h){
 const tab=TRAJETORIAS[clipe];if(!tab)return null;
 const impacto=tab.impact??tab.duration*.5;   // clipe em laço (carga) não tem contato autorado
 const f=clamp(fase,0,2),t=f<=1?f*impacto:impacto+(f-1)*(tab.duration-impacto);
 const x=Math.min(tab.frames.length-1.000001,Math.max(0,t*tab.fps)),i=Math.floor(x),u=x-i,a=tab.frames[i],b=tab.frames[i+1];
 const v=a.map((q,k)=>lerp(q,b[k],u)),n=Math.hypot(v[3],v[4],v[5])||1;
 // Clipe PvE: a janela ativa é a das fases autoradas, não a janela de fase abstrata do núcleo.
 const ph=tab.phases,ativa=ph?.activeStart!=null?t>=ph.activeStart&&t<=ph.activeEnd:undefined;
 return{grip:[v[0]*h,v[1]*h,v[2]*h],dir:[v[3]/n,v[4]/n,v[5]/n],ativa};
}
export function armaLocal(arma,{fase,altura=1.75,alcance=1.05,alturaAlvo=altura*.67,pesado=false,indice=0,bloqueio=null,clipe=null}){
 const prep=clamp(fase),recovery=clamp(fase-1),strike=smooth((prep-.55)/.45),h=altura;
 const spear=arma==='lanca'||arma==='spear',unarmed=arma==='maos'||arma==='unarmed',great=arma==='montante'||arma==='greatsword';
 const target=clamp(alturaAlvo,h*.18,h*.98),baseGripY=clamp(target+h*.12,h*.43,h*.77);
 const reach=Math.max(h*.30,alcance),length=Math.max(h*.16,reach-h*.235);
 let grip,tip,autorada=null;
 // Parry: the blade is placed so it CROSSES the read line of attack, instead of a canned guard pose. The
 // interception point and the tilt come from the defender's reading, so a wrong read misses the blade.
 if(bloqueio&&!unarmed){
  // The guard lives in the frontal plane, in front of the chest: the incoming arc has to pass through it.
  const ponto=[0,clamp(bloqueio.altura??h*.62,h*.30,h*.95),h*.26];
  const inclinacao=(bloqueio.inclinacao??0)+Math.PI/2;          // ~90° to the incoming blade
  let dir=[cos(inclinacao),sen(inclinacao),0];                  // X across the body, Y up, no forward lean
  if(dir[1]<0)dir=[-dir[0],-dir[1],0];                          // tip up, hand below: the natural one-hand guard
  const bruto=[ponto[0]-dir[0]*length*.35,ponto[1]-dir[1]*length*.35,ponto[2]];
  // The hand must be where the arm can hold it: the grip is pulled inside the sword shoulder's reach.
  // shortcut: ombro fixo, sem agachar — numa linha baixa a guarda fica até ~25 cm curta e o corte passa;
  // trocar por um alvo de quadril/joelho quando houver clipe de guarda baixa no GLB.
  const ombro=[-h*.115,h*.82,h*.06],alcanceBraco=h*.30;
  const ao=[bruto[0]-ombro[0],bruto[1]-ombro[1],bruto[2]-ombro[2]],dist=Math.hypot(...ao)||1;
  const gripB=dist>alcanceBraco?ombro.map((o,i)=>o+ao[i]/dist*alcanceBraco):bruto;
  gripB[2]=Math.max(gripB[2],h*.12);
  // The blade keeps the tilt that crosses the attack; it is the span, not the tip, that covers the line.
  const tipB=dir.map((v,i)=>gripB[i]+v*length);
  // Raise the guard from the neutral pose instead of snapping the arm into place.
  const u=smooth(bloqueio.subida??1),base=armaLocal(arma,{fase:0,altura,alcance,alturaAlvo,indice});
  return{grip:base.grip.map((v,i)=>lerp(v,gripB[i],u)),tip:base.tip.map((v,i)=>lerp(v,tipB[i],u)),
   active:true,parry:true,radius:spear?.035:great?.075:.05};
 }
 if(spear||unarmed){
  const thrust=fase<=1?strike:1-smooth(recovery),z=lerp(h*.08,h*.235,thrust),x=unarmed&&indice%2?h*.10:-h*.09*(1-thrust);
  const y=lerp(h*.68,baseGripY,thrust);grip=[x,y,z];
  const dy=clamp(target-y,-length*.80,length*.80),dz=Math.sqrt(Math.max(.01,length*length-dy*dy));tip=[x*.2,y+dy,z+dz];
 }else{
  const reverse=indice%2?-1:1,yaw=reverse*(fase<=1?lerp(-1.15,0,strike):lerp(0,.90,smooth(recovery)));
  const overhead=great?(fase<=1?lerp(.95,0,strike):lerp(0,-.35,smooth(recovery))):0;
  const lift=great&&fase<1?(1-strike)*h*.10:0;
  grip=[reverse*lerp(-h*.17,0,fase<=1?strike:1-recovery),baseGripY+lift,h*(great&&fase<1?lerp(.10,.235,strike):.235)];
  const dy=clamp(target-grip[1]+sen(overhead)*length,-length*.85,length*.95),flat=Math.sqrt(Math.max(.01,length*length-dy*dy));
  tip=[grip[0]+sen(yaw)*flat,grip[1]+dy,grip[2]+cos(yaw)*flat];
  // PvP v12 (guarda fechada ligada): a espada de uma mão segue o golpe AUTORADO no GLB, quadro a quadro,
  // lido de trajetorias-pvp12.js. Antes eram duas descrições do mesmo golpe, e divergiam até 0,56 m: a mão
  // desenhada era arrastada até o punho simulado. Agora desenho e contato são o mesmo golpe por construção.
  // Inclui a guarda: no quadro 0 todo golpe está na guarda autorada, então a espada não sai da mão.
  const nomeClipe=pve1?(/^pve[12]_/.test(clipe??'')?clipe:pve2?'pve2_c_sword_combo_1':'pve1_c_sword_light'):clipe??'pvp12_sword_horizontal_cut';
  autorada=!great&&(guardaFechada||pve1)&&!bloqueio?laminaAutorada(nomeClipe,fase,h):null;
  if(autorada){grip=autorada.grip;tip=grip.map((v,i)=>v+autorada.dir[i]*length);}
 }
 return{grip,tip,active:autorada?.ativa??(fase>=.82&&fase<=1.16),radius:unarmed?h*.075:spear?.035:great?.075:.05};
}
// Hitstop: a parried swing holds at the instant the blades met, then recovers FROM that pose. Body and
// blade read the same clock, so nothing in the scene freezes except the arm that was actually stopped.
export function tempoAcao(action,t){const ap=action.aparo;if(!ap)return t;return t<=ap.t?t:t<ap.ate?ap.t:t-(ap.ate-ap.t);}
export function amostrarArma(action,tempo,options={}){
 const t=tempoAcao(action,tempo);
 const wind=Math.max(.05,action.impact-action.start),rec=Math.max(.05,action.end-action.impact),fase=t<=action.impact?(t-action.start)/wind:1+(t-action.impact)/rec;
 const name=action.name??'',arma=options.arma??(name.startsWith('spear')?'lanca':name.startsWith('greatsword')?'montante':name.startsWith('unarmed')?'maos':'espada');
 const bloqueio=action.bloqueio?{...action.bloqueio,subida:(t-action.start)/(pve1?.30:.12)}:null;
 const s=armaLocal(arma,{fase,altura:options.altura,alcance:options.alcance??action.reach,alturaAlvo:options.alturaAlvo??action.aimHeight,pesado:/heavy|pesado/.test(name),indice:/follow/.test(name)?1:/finish/.test(name)?2:0,bloqueio,clipe:pve1&&arma==='espada'?(/^pve[12]_/.test(action.clip??'')?action.clip:clipePve1(name)):clipePvp12(name,action.counter,action.variante)});
 const g=giroAcao(action,tempo);   // PvE v02: o corpo gira no golpe; a lâmina gira junto (eixo vertical do corpo)
 if(g){const c=Math.cos(g),n=Math.sin(g),r=p=>[p[0]*c+p[2]*n,p[1],-p[0]*n+p[2]*c];s.grip=r(s.grip);s.tip=r(s.tip);}
 return{...s,fase};
}
export function segmentoMundo(a,sample){const d=a.direcao,c=cos(d),s=sen(d);const world=p=>({x:a.x+p[2]*c+p[0]*s,y:a.y+p[2]*s-p[0]*c,z:a.z+p[1]});return{...sample,grip:world(sample.grip),tip:world(sample.tip)};}
// Rounded longitudinal body with an elliptical vertical cross section.
export function distanciaCorpo(p,alvo){const cap=capsula(alvo),along=clamp((p.x-cap.cx)*cap.ux+(p.y-cap.cy)*cap.uy,-cap.meio,cap.meio),height=alvo.especie.corpo.alturaM*alvo.escala;
 const dx=p.x-(cap.cx+cap.ux*along),dy=p.y-(cap.cy+cap.uy*along),vertical=(p.z-(alvo.z+height*.5))/(height*.5),radial=(dx*dx+dy*dy)/(cap.r*cap.r);
 return (Math.sqrt(radial+vertical*vertical)-1)*Math.min(cap.r,height*.5);
}
// Blade against blade: closest points of the two blade segments (Ericson's clamped segment-segment).
// `begin` skips the grip itself: steel parries steel, a fist on the pommel does not.
export function contatoLaminas(sa,sb,{margem=.02,begin=.08}={}){
 const P=s=>[s.grip.x,s.grip.y,s.grip.z],Dv=s=>[s.tip.x-s.grip.x,s.tip.y-s.grip.y,s.tip.z-s.grip.z];
 const p=P(sa),q=P(sb),u=Dv(sa),v=Dv(sb),w=[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
 const dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
 const a=dot(u,u),b=dot(u,v),c=dot(v,v),d=dot(u,w),e=dot(v,w),D=a*c-b*b;
 let s=D<1e-9?begin:clamp((b*e-c*d)/D,begin,1);
 let t2=clamp((b*s+e)/(c||1),begin,1);
 s=clamp((b*t2-d)/(a||1),begin,1);
 const pa=u.map((x,i)=>p[i]+x*s),pb=v.map((x,i)=>q[i]+x*t2);
 const gap=Math.hypot(pa[0]-pb[0],pa[1]-pb[1],pa[2]-pb[2])-(sa.radius??.05)-(sb.radius??.05);
 return{hit:gap<=margem,gap,ponto:{x:(pa[0]+pb[0])/2,y:(pa[1]+pb[1])/2,z:(pa[2]+pb[2])/2},fracaoAtacante:s,fracaoDefensor:t2};
}
const opcoesArma=a=>({arma:a.hunter.equipamento.arma,altura:a.especie.corpo.alturaM*a.escala});
// Earliest instant in the window where the two blades actually meet. The whole swing is swept, because a
// blade stopped halfway never reaches the body: the deflection happens where the steel met, not at impact.
export function aparoNoIntervalo(a,b,acaoA,acaoB,ate,{de=acaoA.start,margem=.02}={}){
 const dur=Math.max(.01,ate-de),passos=Math.max(4,Math.ceil(dur/.0125));
 let melhor={hit:false,gap:Infinity};
 for(let n=0;n<=passos;n++){
  const t=de+dur*n/passos;
  if(t<acaoB.start||t>acaoB.end)continue;
  const sa=segmentoMundo(a,amostrarArma(acaoA,t,{...opcoesArma(a),alcance:acaoA.reach,alturaAlvo:acaoA.aimHeight}));
  if(!sa.active)continue;
  const sb=segmentoMundo(b,amostrarArma(acaoB,t,{...opcoesArma(b),alcance:acaoB.reach,alturaAlvo:acaoB.aimHeight}));
  if(!sb.active)continue;
  const c=contatoLaminas(sa,sb,{margem});
  if(c.hit)return{...c,t,atacante:sa,defensor:sb};
  if(c.gap<melhor.gap)melhor={...c,t,atacante:sa,defensor:sb};
 }
 return melhor;
}
export function contatoTrajetoria(a,alvo,action,t,{geometry=null,fromTime=t-.05}={}){
 const options={arma:a.hunter.equipamento.arma,altura:a.especie.corpo.alturaM*a.escala,alcance:action.reach,alturaAlvo:action.aimHeight},duration=Math.max(.01,t-fromTime),steps=Math.max(3,Math.ceil(duration/.0125));
 let best={hit:false,distance:Infinity};
 for(let n=0;n<=steps;n++){
  const time=fromTime+duration*n/steps,s=segmentoMundo(a,amostrarArma(action,time,options));if(!s.active)continue;
  if(geometry&&!geometry.line([s.grip.x,s.grip.z,s.grip.y],[s.tip.x,s.tip.z,s.tip.y]))continue;
  const count=Math.max(6,Math.ceil(Math.hypot(s.tip.x-s.grip.x,s.tip.y-s.grip.y,s.tip.z-s.grip.z)/.07));
  // Only the last 30% of a spear is a damaging point; a sword's blade is active along its length.
  const begin=options.arma==='lanca'?.70:options.arma==='maos'?.75:.12;
  for(let i=0;i<=count;i++){const k=begin+(1-begin)*i/count,p={x:lerp(s.grip.x,s.tip.x,k),y:lerp(s.grip.y,s.tip.y,k),z:lerp(s.grip.z,s.tip.z,k)},distance=distanciaCorpo(p,alvo)-s.radius;
   if(distance<best.distance)best={hit:distance<=.04,distance,point:p,time,segment:s};
  }
 }
 return best;
}
