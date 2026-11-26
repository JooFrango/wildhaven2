// Hunter Lab integration only: the ecological kernel still resolves health, defense and each hit once.
import {perfilGolpe} from '../../ia-criaturas/src/eco/combate.js';
import {atan2,cos,sen} from '../../ia-criaturas/src/core/matematica.js';
import {normalizarAngulo} from '../../ia-criaturas/src/core/geometria.js';
import {fatorMobilidade} from '../../ia-criaturas/src/eco/saude.js';
import {contatoTrajetoria,aparoNoIntervalo} from './trajetoria-arma.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const HITSTOP_APARO=.10;   // blade held at the point of contact; the recovery resumes from there
// Steel met steel: the swing stops where the blades touched, and BOTH Hunters react from that one event.
function registrarAparo(m,a,b,aparo,g){
 const heavy=g.ataque.peso==='pesado',hp=Math.max(1,b.saude.hpMax);
 const intensidade=clamp(.14+(g.ataque.dano/hp)*2.2+(heavy?.18:0),.1,.85);
 const linha=a.direcao,recuo=(heavy?.9:.55)*Math.min(1.4,a.massa/Math.max(1,b.massa));
 const action=a.hunter.action;
 if(action&&Math.abs(action.start-g.inicio)<.001){action.aparo={t:aparo.t,ate:aparo.t+HITSTOP_APARO};action.end+=HITSTOP_APARO;}
 // The attacker is thrown back along its own line; the defender gives a little ground and burns the energy.
 if(fatorMobilidade(a)>.1&&!a.agarradoPor)a.impulso={vx:-cos(linha)*recuo,vy:-sen(linha)*recuo,ate:m.t+.16,tipo:'aparo_lamina'};
 a.hunter.reacaoImpacto={t:m.t,intensidade,lado:aparo.fracaoAtacante>.5?1:-1,tipo:'aparo'};
 const absorve=clamp(b.especie.bloqueioMax,.1,.85);
 b.energia=Math.max(0,b.energia-Math.max(1.5,g.ataque.dano*(1-absorve)*.35));
 if(fatorMobilidade(b)>.1&&!b.agarradoPor)b.impulso={vx:cos(linha)*recuo*.35,vy:sen(linha)*recuo*.35,ate:m.t+.12,tipo:'aparo_lamina'};
 b.hunter.reacaoImpacto={t:m.t,intensidade:intensidade*.7,lado:aparo.fracaoDefensor>.5?1:-1,tipo:'bloqueio'};
 // A successful parry is what earns the riposte window; the attacker is the one out of position now.
 const mente=b.hunter.jogador;if(mente){mente.counterPrimed=true;mente.counterUntil=Math.max(mente.counterUntil??0,m.t+.75);mente.chain=0;}
 // Heavy blows still rock the guard: a parried greatsword leaves the defender briefly off balance.
 if(heavy&&intensidade>.5)b.saude.desequilibradoAte=Math.max(b.saude.desequilibradoAte,m.t+.18);
 m.aparoLamina={id:a.id,defensor:b.id,ponto:aparo.ponto,t:aparo.t,gap:aparo.gap,intensidade,pesado:heavy};
}
export function acaoFisica(a,g){
 const current=a.hunter?.action,start=g.inicio;
 if(current&&Math.abs(current.start-start)<.001)return current;
 const pg=perfilGolpe(a,g.ataque),arma=a.hunter.equipamento.arma,prefix={lanca:'spear',espada:'sword',montante:'greatsword',maos:'unarmed'}[arma]??'unarmed';
 return{name:prefix+'_'+(g.ataque.peso==='pesado'?'heavy':'light'),start,impact:g.impacto,end:g.impacto+Math.max(.25,g.ataque.recargaSeg),reach:pg.alcance,aimHeight:pg.altura,heading:a.direcao};
}
function restaurar(m){if(!m.defesaTemporaria)return;const {a,protecao,defesa,esquiva}=m.defesaTemporaria;Object.assign(a.especie.combate,{protecao,defesa,esquiva});delete m.defesaTemporaria;}
export function instalarImpactos(m){
 if(m.impactosInstalados)return;m.impactosInstalados=true;
 const evento=m.evento;
 m.evento=(tipo,id,dados={})=>{
  // A parried swing is not a miss: it was stopped by the other blade, at a point both Hunters share.
  const ap=m.aparoLamina;
  if(tipo==='golpe_errou'&&ap?.id===id&&dados.motivo==='geometria_solida'){
   delete m.aparoLamina;delete m.falhaTrajetoria;
   evento('impacto_arma',id,{alvo:ap.defensor,x:ap.ponto.x,y:ap.ponto.y,z:ap.ponto.z,intensidade:ap.intensidade,tipoDano:'corte',pesado:ap.pesado,bloqueado:true,aparo:'lamina',dano:0,folga:+ap.gap.toFixed(4)});
   const parado=evento('golpe_interrompido',id,{alvo:ap.defensor,ataque:dados.ataque,motivo:'aparo_lamina',t:+ap.t.toFixed(3),x:+ap.ponto.x.toFixed(3),y:+ap.ponto.y.toFixed(3),z:+ap.ponto.z.toFixed(3)});
   restaurar(m);return parado;
  }
  const reason=m.falhaTrajetoria;if(tipo==='golpe_errou'&&reason?.id===id&&dados.motivo==='geometria_solida'){dados={...dados,motivo:reason.motivo,folgaTrajetoria:reason.distancia};delete m.falhaTrajetoria;}
  const r=evento(tipo,id,dados);
  if(['ferimento','esquiva','golpe_errou','golpe_interrompido'].includes(tipo))restaurar(m);
  return r;
 };
 const linha=m.linhaGolpePrecisa;
 m.linhaGolpePrecisa=(a,b,height)=>{
  restaurar(m);const g=m.golpesDoPasso?.get(a.id);
  if(linha&&!linha(a,b,height))return false;
  if(a.hunter&&g&&m.opcoes.trajetoriaArma!==false){
   const action=acaoFisica(a,g);
   // Blade before body: the whole swing is swept against the defender's guard, because steel stopped
   // halfway never reaches flesh. The pose was built from the defender's read, so a bad read finds nothing.
   const guarda=b.hunter?.guarda;
   if(guarda&&b.hunter.blockUntil>=m.t-m.dt&&m.opcoes.aparoLamina!==false){
    const aparo=aparoNoIntervalo(a,b,action,guarda,m.t,{de:Math.max(action.start,guarda.start)});
    if(aparo.hit){registrarAparo(m,a,b,aparo,g);a.hunter.ultimoContato={hit:false,aparo:true,point:aparo.ponto,inicio:g.inicio,alvo:b.id};
     m.falhaTrajetoria={id:a.id,motivo:'aparo_lamina',distancia:aparo.gap};return false;}
   }
   const contact=contatoTrajetoria(a,b,action,m.t,{geometry:m.geometriaHunter,fromTime:Math.max(action.start,m.t-m.dt)});
   a.hunter.ultimoContato={...contact,inicio:g.inicio,alvo:b.id};
   if(!contact.hit){m.falhaTrajetoria={id:a.id,motivo:'trajetoria_nao_alcanca',distancia:Number.isFinite(contact.distance)?contact.distance:null};return false;}
  }
  if(b.hunter?.postura==='defesa'){
   const h=b.hunter,angle=Math.abs(normalizarAngulo(atan2(a.y-b.y,a.x-b.x)-b.direcao));
   if(angle>1.15||b.energia<2){const cb=b.especie.combate;m.defesaTemporaria={a:b,protecao:cb.protecao,defesa:cb.defesa,esquiva:cb.esquiva};Object.assign(cb,{protecao:{...h.base.protecao},defesa:h.base.defesa,esquiva:h.base.esquiva});}
  }
  return true;
 };
}
export function prepararImpactos(m){
 restaurar(m);m.golpesDoPasso=new Map(m.vivos.filter(a=>a.golpe).map(a=>[a.id,a.golpe]));
}
export function finalizarImpactos(m,events){
 restaurar(m);
 for(const e of events){if(e.tipo!=='ferimento')continue;const a=m.porId.get(e.atacante)??m.mortos.get(e.atacante),b=m.porId.get(e.id)??m.mortos.get(e.id);if(!a||!b)continue;
  const g=m.golpesDoPasso?.get(a.id),heavy=g?.ataque?.peso==='pesado',contact=a.hunter?.ultimoContato;
  const defended=b.hunter?.postura==='defesa'&&b.hunter.blockUntil>=e.t&&Math.abs(normalizarAngulo(atan2(a.y-b.y,a.x-b.x)-b.direcao))<1.15;
  const amount=Math.max(0,e.dano??0),severity=amount/Math.max(1,b.saude.hpMax),intensity=clamp(.12+severity*3+(heavy?.18:0),.1,.9),direction=atan2(b.y-a.y,b.x-a.x),side=normalizarAngulo(direction-b.direcao)>=0?1:-1;
  if(defended){b.energia=Math.max(0,b.energia-Math.max(2,((g?.ataque.dano??amount)-amount)*.22));}
  const massRatio=Math.min(1.4,a.massa/Math.max(1,b.massa)),speed=(heavy?1.15:.35)*massRatio*(defended?.45:1)*clamp(intensity+.2,.2,1);
  if(!b.agarradoPor&&b.vivo&&fatorMobilidade(b)>.1)b.impulso={vx:cos(direction)*speed,vy:sen(direction)*speed,ate:m.t+(heavy?.20:.10),tipo:'impacto_arma'};
  if(heavy&&severity>.055&&!defended)b.saude.desequilibradoAte=Math.max(b.saude.desequilibradoAte,m.t+.25+intensity*.30);
  if(b.hunter)b.hunter.reacaoImpacto={t:m.t,intensidade:intensity,lado:side,tipo:defended?'bloqueio':heavy?'pesado':'leve'};
  const p=contact?.hit&&contact.alvo===b.id?contact.point:{x:b.x,y:b.y,z:b.z+b.especie.corpo.alturaM*.6};
  m.evento('impacto_arma',a.id,{alvo:b.id,x:p.x,y:p.y,z:p.z,intensidade:intensity,tipoDano:g?.ataque.tipoDano??'contusao',pesado:!!heavy,bloqueado:!!defended,regiao:e.regiao,dano:amount});
 }
 delete m.golpesDoPasso;delete m.falhaTrajetoria;
}
