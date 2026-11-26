// Shared tactical policy. Own condition + visible observations only. No opponent HP, RNG or renderer.
import {atan2,cos,sen,hipot} from '../core/matematica.js';
import {normalizarAngulo} from '../core/geometria.js';
import {perfilMobilidade,segmentoLivre} from './terreno.js';

export function corpoObservavel(a){const r=a.especie.corpo.raio*a.escala,comp=(a.especie.serpente?.capsulaM??a.especie.corpo.comprimentoM)*a.escala;return{r,half:Math.max(0,comp/2-r),center:(a.especie.anatomia?.centro??0)*(a.especie.escalaModelo??1)*a.escala,height:a.especie.corpo.alturaM*a.escala};}
export function sinalCombate(a,t){const action=a.hunter?.action??a.tatica?.action,g=a.hunter?.attack??a.golpe;if(a.saude.caidoAte>t)return'caido';if(a.saude.atordoadoAte>t||a.saude.desequilibradoAte>t)return'desequilibrado';if(g)return'preparo';const av=a.taticaAvancada?.acao;if(av?.tipo==='finta'&&av.ate>t)return t<av.preparoAte?'preparo':'recuperacao';if(av?.tipo==='esquiva'&&av.ate>t)return'recuperacao';if(av?.tipo==='levantar'&&av.ate>t)return'recuperacao';if(action&&t<action.end)return'recuperacao';if(/fugindo|recuando/.test(a.estado))return'fuga';return'guarda';}
export function extensao(c,angle){return c.r+c.half*Math.abs(cos(angle))+c.center*cos(angle);}
export function bandasTaticas(a,c,profile){const line=atan2(c.y-a.y,c.x-a.x),own=corpoObservavel(a),other=c.body??{r:.35,half:0,center:0};const front=extensao(own,normalizarAngulo(a.direcao-line)),near=extensao(other,normalizarAngulo((c.direcao??line+Math.PI)-line-Math.PI));const body=front+near,ideal=Math.max(body+.07,profile.reach*(profile.lunge?.70:1)+near-.12);return{body,ideal,tooClose:Math.max(body+.05,profile.lunge?2.3:ideal-.32),attackMax:profile.lunge?profile.reach+near-.12:ideal+.22,threat:ideal+Math.max(1.0,profile.windup*(a.velocidade+(c.velocidade??0))*.35),observe:ideal+3.5,retreat:ideal+6};}
function free(a,m,p){const mov=a.especie.movimento,profile=perfilMobilidade(m.terreno,mov);return segmentoLivre(m.terreno,profile,a,p,a.especie.corpo.raio*a.escala,.08)&&(!m.sondagemTatica||m.sondagemTatica(a,p));}
function destination(a,c,m,ideal,phase,side){const line=atan2(a.y-c.y,a.x-c.x),human=!!a.hunter||a.especie.anatomiaHumana;const turn=human?.30:.38;const radius=phase==='recuando'?Math.max(ideal,hipot(a.x-c.x,a.y-c.y)+.8):ideal;const offset=/circulando|procurando_abertura/.test(phase)?side*turn:0;const candidates=[offset,offset+side*.18,offset-side*.18,offset+side*.36,offset-side*.36];for(const d of candidates){const p={x:c.x+cos(line+d)*radius,y:c.y+sen(line+d)*radius};if(free(a,m,p))return p;}return null;}
function commit(a,m,phase,reason,destination,look,duration){const s=a.tatica;const changed=s.phase!==phase;if(changed){s.phase=phase;s.since=m.t;s.until=m.t+duration;s.episodes=(s.episodes??0)+1;m.evento?.('tatica_estado',a.id,{phase,reason});}s.destination=destination;s.reason=reason;return{estado:phase,codigo:'tatica_'+phase,motivo:reason,alvo:{tipo:'criatura',id:s.target,x:look.x,y:look.y},destino:destination,ritmo:destination?'andar':'parado',olharPara:{x:look.x,y:look.y},orientacaoCombate:!!a.hunter||!!a.especie.anatomiaHumana,velMax:/circulando/.test(phase)?a.especie.movimento.andar*.65:/recuperando/.test(phase)?.45:a.especie.movimento.andar*.9};}

export function planejarTatica(a,c,m,profile,{context='duel',aggression=a.temperamento.agressividade,courage=a.temperamento.coragem}={}){
 const old=a.tatica;const s=a.tatica??={};s.profile=profile;s.enabled=true;s.context=context;
 s.lastSeen=m.t;
 if(s.target!==c.id){s.target=c.id;s.started=m.t;s.phase=null;s.side=(a.numero%2?1:-1);s.until=m.t;s.lastAttack=-Infinity;}
 const d=hipot(a.x-c.x,a.y-c.y),bands=bandasTaticas(a,c,profile);s.bands=bands;
 const action=a.hunter?.action??s.action,pending=a.hunter?.attack??a.golpe;
 const facing=Math.abs(normalizarAngulo(atan2(c.y-a.y,c.x-a.x)-a.direcao));
 const ownWeak=a.saude.hp/a.saude.hpMax<.3||a.energia<15;
 const exposed=['recuperacao','desequilibrado','caido','fuga'].includes(c.signal);
 const ready=!pending&&(!action||m.t>=action.end)&&a.energia>=profile.energy;
 if(pending){const heading=action?.heading??a.direcao,wanted=atan2(c.y-a.y,c.x-a.x),d=normalizarAngulo(wanted-heading),locked=heading+Math.max(-.35,Math.min(.35,d)),look={...c,x:a.x+cos(locked)*3,y:a.y+sen(locked)*3};return{intent:commit(a,m,'preparando_ataque','golpe comprometido; ajuste angular limitado',null,look,.2),attack:false};}
 if(action&&m.t<action.end){const back=(ownWeak||c.signal==='preparo'||s.lastHit===false)&&aggression<.85;const phase=back?'recuando':'recuperando';return{intent:commit(a,m,phase,back?'recuperação sob risco; abrindo distância':'recuperação física; sem novo golpe',back?destination(a,c,m,bands.ideal+.6,phase,s.side):null,c,.3),attack:false};}
 if(d<bands.tooClose&&(d<bands.body+.10||m.t>=s.until)){const p=destination(a,c,m,bands.ideal+.2,'recuando',s.side);return{intent:commit(a,m,p?'recuando':'defendendo',p?'arma/membro sem espaço útil; recuperar alcance':'sem rota segura; protege-se em vez de atravessar o rival',p,c,.65),attack:false};}
 if(d>bands.observe&&context==='hunt'){const intent=commit(a,m,'pressionando','presa em deslocamento; perseguição com frenagem na faixa de golpe',destination(a,c,m,bands.ideal,'aproximando',s.side),c,.4);intent.ritmo='corrida';intent.velMax=a.especie.movimento.corrida;return{intent,attack:false};}
 if(context!=='hunt'&&m.t-s.started<.35+(1-courage)*.4&&d<bands.observe)return{intent:commit(a,m,'avaliando','avaliação visual de alcance e postura',null,c,.35),attack:false};
 if(context==='territory'&&m.t-s.started<1.0&&d<bands.observe)return{intent:commit(a,m,'ameacando','exibição territorial; não implica luta até a morte',null,c,.6),attack:false};
 if(ownWeak&&d<bands.threat){const p=destination(a,c,m,bands.ideal+2,'recuando',s.side);return{intent:commit(a,m,p?'recuando':'defendendo','energia/ferimento próprio limita pressão',p,c,.6),attack:false};}
 const opportunity=exposed||aggression>.8||m.t-(s.lastAttack??s.started)>1.1+(1-aggression)*1.6;
 if(d>=bands.tooClose&&d<=bands.attackMax&&facing<.42&&ready&&opportunity&&(!s.until||m.t>=s.until||exposed))return{intent:commit(a,m,'procurando_abertura','oportunidade visual e contato geométrico a confirmar',null,c,.15),attack:true};
 if(m.t<s.until&&s.destination&&free(a,m,s.destination)&&hipot(a.x-s.destination.x,a.y-s.destination.y)>.18)return{intent:commit(a,m,s.phase,s.reason,s.destination,c,.4),attack:false};
 let phase=d>bands.ideal+.28?'aproximando':exposed&&aggression>.55?'pressionando':'circulando';
 if(d<bands.ideal-.14)phase='recuando';
 let p=destination(a,c,m,bands.ideal,phase,s.side);
 if(!p){s.side=-s.side;p=destination(a,c,m,bands.ideal,phase,s.side);}
 const intent=commit(a,m,p?phase:'defendendo',p?(phase==='circulando'?'mudar ângulo dentro do alcance útil':'ajuste de superfície, velocidade e espaço livre'):'obstáculo impede deslocamento seguro',p,c,.45+(1-aggression)*.35);
 if(context==='hunt'&&d>bands.attackMax+.5){intent.ritmo='corrida';intent.velMax=a.especie.movimento.corrida;}
 return{intent,attack:false};
}
