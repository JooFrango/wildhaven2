// IA de combate avançada do Varrisco: percepção real → decisão → eventos físicos.
// Só ativa na espécie com combate.iaAvancada=true. Nenhum dado oculto do adversário,
// RNG novo, dano por animação, segunda simulação ou dependência de Three.js.
import { atan2, cos, sen, hipot } from '../core/matematica.js';
import { normalizarAngulo } from '../core/geometria.js';
import { fatorMobilidade } from './saude.js';
import { perfilMobilidade, segmentoLivre } from './terreno.js';

export const habilitada = a => a?.especie?.combate?.iaAvancada === true && !a.hunter &&
  !a.subsolo && !a.voo && !a.serpente;

const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
const memoriaVazia = () => ({vistas:0,preparos:0,preparosCurtos:0,ataquesRecebidos:0,
  acertamos:0,erramos:0,esquivou:0,esquivamos:0,esquivasFalharam:0,feintProvocou:0,
  ultimoSinal:null,inicioPreparo:null,ultimoAtaqueVisto:-1000,ultimaVisao:0,
  prevX:null,prevY:null,prevDirecao:null,preferenciaLado:0});

function estado(a) {
  if (!a.taticaAvancada) a.taticaAvancada = {
    padroes:{},seq:0,acao:null,visual:null,ultimoFeint:-100,ultimaEsquiva:-100,
    ultimaProtecao:-100,combo:null,queda:null,agarrando:null,alvo:null
  };
  return a.taticaAvancada;
}

export function padraoAdversario(a, id, t=0) {
  const s=estado(a);
  if (!s.padroes[id]) {
    // Estado compacto: somente oito adversários recentes, determinístico por idade/id.
    const keys=Object.keys(s.padroes);
    if(keys.length>=8){
      const older=keys.sort((x,y)=>s.padroes[x].ultimaVisao-s.padroes[y].ultimaVisao||x.localeCompare(y))[0];
      delete s.padroes[older];
    }
    s.padroes[id]=memoriaVazia();
  }
  const p=s.padroes[id];p.ultimaVisao=Math.max(t,p.ultimaVisao);
  return p;
}

export function ferimentosTaticos(a) {
  const ret={cabeca:0,pernas:0,bracos:0,cauda:0,tronco:0,dor:a.saude.dor||0,
    mobilidade:fatorMobilidade(a)};
  for(const f of a.saude.ferimentos){
    const key=f.regiao==='cabeca'?'cabeca':f.regiao==='pernas'?'pernas':
      f.regiao==='bracos'?'bracos':f.regiao==='cauda'?'cauda':'tronco';
    ret[key]=Math.max(ret[key],(f.gravidade||0)+(f.fratura ? .35 : 0)+(f.muscular||0)*.4);
  }
  return ret;
}

export function observarAdversario(a, c, mundo) {
  if(!habilitada(a)||c.via!=='visao')return null;
  const p=padraoAdversario(a,c.id,mundo.t);
  const old=p.ultimoSinal;
  if(c.signal==='preparo' && old!=='preparo'){
    p.preparos=Math.min(200,p.preparos+1);
    p.inicioPreparo=mundo.t;
    p.ultimoAtaqueVisto=mundo.t;
    if(p.preparos%3===0)mundo.evento?.('aprendizado_combate',a.id,{alvo:c.id,preparos:p.preparos,esquivas:p.esquivou});
  }
  if(old==='preparo'&&c.signal!=='preparo'&&p.inicioPreparo!==null){
    // Não sabe se era finta; infere 'preparo curto' unicamente da observação.
    const dur=mundo.t-p.inicioPreparo;
    if(dur<.68)p.preparosCurtos=Math.min(200,p.preparosCurtos+1);
    p.inicioPreparo=null;
  }
  if(p.prevX!==null&&c.signal==='recuperacao'&&old==='preparo'){
    const line=atan2(c.y-a.y,c.x-a.x);
    const lateral=-(c.x-p.prevX)*sen(line)+(c.y-p.prevY)*cos(line);
    if(Math.abs(lateral)>.12)p.preferenciaLado=clamp(p.preferenciaLado+Math.sign(lateral),-6,6);
  }
  p.prevX=c.x;p.prevY=c.y;p.prevDirecao=c.direcao;
  p.ultimoSinal=c.signal;
  p.vistas=Math.min(5000,p.vistas+1);
  // Memória temporal limitada: nenhuma informação de contato ausente é inventada.
  const s=estado(a);
  for(const id of Object.keys(s.padroes))if(id!==c.id&&mundo.t-s.padroes[id].ultimaVisao>90)delete s.padroes[id];
  return p;
}

export function marcarVisual(a,nome,mundo,duracao) {
  if(!habilitada(a))return;
  const s=estado(a);
  s.visual={id:++s.seq,nome,at:mundo.t,ate:mundo.t+duracao};
}

// O perfil do ataque continua físico. Esta função só rejeita opções incompatíveis
// com o estado real do corpo (sem introduzir um ataque imaginário).
export function ataquePermitido(a,x) {
  if(!habilitada(a))return true;
  const f=ferimentosTaticos(a);
  if((f.pernas>.27||f.cauda>.35||f.mobilidade<.60)&&/bote|investida/.test(x.nome))return false;
  if(f.cabeca>.38&&/mordida/.test(x.nome))return false;
  if(f.bracos>.38&&/garra/.test(x.nome))return false;
  return a.energia>9 && a.saude.caidoAte<=(a.tAtual??0);
}

// Ataques curtos tornam-se mais valiosos quando o próprio atacante aprendeu
// que o rival costuma evitar ataques longos. Sem leitura de HP, velocidade
// oculta ou histórico de outros observadores.
export function notaAtaqueAprendida(a,alvo,ataque,preparo) {
  const base=ataque.dano/Math.max(.15,ataque.recargaSeg);
  if(!habilitada(a))return base;
  const p=a.taticaAvancada?.padroes?.[alvo.id];
  if(!p||p.acertamos+p.erramos<2)return base;
  const total=Math.max(1,p.acertamos+p.erramos);
  const evasao=p.esquivou/total,erro=p.erramos/total;
  const risco=clamp(preparo/.75,0,1.8);
  return base * (1-(evasao*.38+erro*.23)*risco);
}

export function preferenciaCombo(a,c,mundo) {
  if(!habilitada(a))return null;
  const s=estado(a), combo=s.combo;
  if(!combo)return null;
  if(combo.alvo!==c.id||mundo.t>combo.ate||a.energia<19||
     a.saude.dor>.65||a.saude.caidoAte>mundo.t){s.combo=null;return null;}
  if(c.via!=='visao')return null;
  return combo.proximo;
}

function podePassar(a,mundo,destino){
  const t=mundo.terreno;
  if(!t||!Number.isFinite(destino.x)||!Number.isFinite(destino.y))return false;
  const radius=a.especie.corpo.raio*a.escala;
  return segmentoLivre(t,perfilMobilidade(t,a.especie.movimento),a,destino,radius,.08)
    &&(!mundo.sondagemTatica||mundo.sondagemTatica(a,destino));
}
function mirar(c) {return {tipo:'criatura',id:c.id,x:c.x,y:c.y};}
function parada(a,c,estado,codigo,motivo,destino=null,ritmo='parado'){
  return {estado,codigo,motivo,alvo:mirar(c),destino,ritmo,olharPara:{x:c.x,y:c.y},
    velMax:destino?a.especie.movimento.andar*.85:0};
}
function destinoRecuo(a,c,mundo,metros){
  let dx=a.x-c.x,dy=a.y-c.y;
  const n=hipot(dx,dy)||1;dx/=n;dy/=n;
  const side=a.numero%2?1:-1;
  for(const angle of [0,side*.35,-side*.35,side*.65,-side*.65]){
    const xx=dx*cos(angle)-dy*sen(angle),yy=dx*sen(angle)+dy*cos(angle);
    const target={x:a.x+xx*metros,y:a.y+yy*metros};
    if(podePassar(a,mundo,target))return target;
  }
  return null;
}

export function decidirTaticaAvancada(a,c,mundo,bands,context,plan) {
  if(!habilitada(a)||c.via!=='visao'||!bands)return null;
  const s=estado(a), t=mundo.t, p=observarAdversario(a,c,mundo), inj=ferimentosTaticos(a);
  const d=hipot(c.x-a.x,c.y-a.y);
  if(s.alvo!==c.id){s.alvo=c.id;s.ultimaEsquiva=-100;s.ultimoFeint=-100;
    if(s.acao?.tipo!=='levantar')s.acao=null;s.combo=null;}
  const rise=recuperarQuedaAvancada(a,mundo);
  if(rise)return {...rise,alvo:mirar(c),olharPara:{x:c.x,y:c.y}};
  if(s.acao?.ate>t){
    if(s.acao.tipo==='finta'){
      if(s.finta?.alvo===c.id && c.signal==='recuperacao' && !s.finta.reagiu){
        s.finta.reagiu=true;
        p.feintProvocou=Math.min(200,p.feintProvocou+1);
        mundo.evento?.('tatico_finta_funcionou',a.id,{contra:c.id,observacao:'recuperacao_visivel'});
      }
      return parada(a,c,'fintando','finta_sem_hitbox','ameaça visual sem golpe físico');
    }
    if(s.acao.tipo==='esquiva')return parada(a,c,'esquivando','esquiva_tatica','reação à preparação vista');
    if(s.acao.tipo==='levantar')return parada(a,c,'levantando','recuperacao_queda','levantando após queda real');
  }
  if(s.acao&&s.acao.ate<=t)s.acao=null;
  if(a.golpe||a.agarradoPor||a.agarrando||a.saude.caidoAte>t||
     a.saude.atordoadoAte>t)return null;
  const ownAction=a.tatica?.action;
  const locked=ownAction&&ownAction.end>t;
  // Lesões profundas de pernas, cabeça ou cauda mudam a decisão: não apenas a velocidade.
  const lesion=inj.pernas>.28||inj.cabeca>.38||inj.cauda>.43;
  if(lesion && d<bands.threat && (a.saude.hp/a.saude.hpMax<.62||inj.mobilidade<.75)){
    const target=destinoRecuo(a,c,mundo,Math.min(3.2,bands.ideal*.65));
    if(t-s.ultimaProtecao>1.5){
      mundo.evento?.('tatico_protege_ferida',a.id,{alvo:c.id,regiao:inj.pernas>.28?'pernas':inj.cabeca>.38?'cabeca':'cauda'});
      s.ultimaProtecao=t;
      if(!target)marcarVisual(a,inj.pernas>.28?'hurt_leg':'hurt_head',mundo,.9);
    }
    return parada(a,c,'protegendo_ferida','evita_expor_lesao','lesão reduz as opções seguras de combate',target,target?'andar':'parado');
  }
  const preparo=c.signal==='preparo';
  const angle=normalizarAngulo(atan2(a.y-c.y,a.x-c.x)-(c.direcao??0));
  const facing=Math.abs(angle)<1.08;
  const threatRange=Math.min(bands.threat, (c.body?.half??0)+(c.body?.r??.6)+a.especie.corpo.raio*a.escala+3.2);
  // Depois de preparações curtas repetidas, aguarda confirmação visual
  // de persistência do telegráfico (não é imunidade a fintas).
  const suspeitaFintas=p.preparos>=3 && p.preparosCurtos/p.preparos>=.55;
  const preparoConfirmado=!suspeitaFintas ||
    (p.inicioPreparo!==null&&t-p.inicioPreparo>=.18);
  const dodgeReady=preparo&&preparoConfirmado&&facing&&d<=threatRange&&!locked&&
    a.energia>22&&inj.mobilidade>.49&&t-s.ultimaEsquiva>1.0;
  if(dodgeReady){
    const len=clamp(1.15*inj.mobilidade,.56,1.15);
    const v=clamp(4.0*inj.mobilidade,1.6,4.0),dir=atan2(a.y-c.y,a.x-c.x);
    const right={x:-sen(dir),y:cos(dir)};
    const side=a.numero%2?1:-1;
    const choices=[side,-side].map(sign=>{
      const candidate={x:a.x+right.x*sign*len,y:a.y+right.y*sign*len};
      const free=podePassar(a,mundo,candidate);
      const margin=free?Math.min(candidate.x,mundo.terreno.largura-candidate.x,
        candidate.y,mundo.terreno.profundidade-candidate.y):0;
      const bias=sign===-Math.sign(p.preferenciaLado)?0.04:0;
      return {sign,free,score:margin+bias};
    }).filter(x=>x.free).sort((x,y)=>y.score-x.score);
    const chosen=choices[0];
    if(chosen){
      const cost=3.2+inj.dor*3;
      a.energia=Math.max(0,a.energia-cost);
      a.impulso={vx:right.x*chosen.sign*v,vy:right.y*chosen.sign*v,ate:t+.36,tipo:'esquiva_tatica'};
      s.ultimaEsquiva=t;
      s.acao={tipo:'esquiva',ate:t+.48};
      s.defesa={atacante:c.id,ate:t+.9,validada:false};
      const clip=chosen.sign===1?'dodge_left':'dodge_right';
      marcarVisual(a,clip,mundo,.72);
      mundo.evento?.('tatico_esquiva',a.id,{contra:c.id,lado:chosen.sign,distancia:+d.toFixed(2),energia:+cost.toFixed(1)});
      return parada(a,c,'esquivando','esquiva_reativa','desvio lateral guiado pelo preparo observado');
    }
  }
  if(locked)return null;
  // Finta não cria a.golpe, não consome hitbox, nem atribui dano.
  const canFeint=(context==='hunt'||context==='territory')&&
    c.signal==='guarda'&&d>=bands.tooClose-.05&&d<=bands.threat &&
    t-(a.tatica?.started??t)>1.6&&t-s.ultimoFeint>5.2&&a.energia>37&&
    inj.cabeca<.23&&inj.pernas<.23&&
    (plan?.intent?.estado==='circulando'||plan?.intent?.estado==='procurando_abertura'||plan?.intent?.estado==='avaliando')&&
    ((p.esquivou>=1||p.preparos>=2)||t-(a.tatica?.started??t)>4);
  if(canFeint){
    s.ultimoFeint=t;s.acao={tipo:'finta',ate:t+.95,preparoAte:t+.53};
    s.finta={alvo:c.id,esquivaAntes:p.esquivou,inicio:t};
    a.energia=Math.max(0,a.energia-2.4);
    marcarVisual(a,'feint',mundo,.95);
    mundo.evento?.('tatico_finta',a.id,{contra:c.id,semHitbox:true});
    return parada(a,c,'fintando','provocar_reacao','finta sem contato: observar resposta do adversário');
  }
  if(s.finta?.alvo===c.id && t-s.finta.inicio>=.95) {
    // Só marca sucesso se observou recuperação durante a própria finta.
    s.finta=null;
  }
  return null;
}

export function comboPodeAtacar(a,c,mundo,bands) {
  const name=preferenciaCombo(a,c,mundo);
  if(!name||a.golpe||a.tatica?.action?.end>mundo.t)return null;
  const d=hipot(a.x-c.x,a.y-c.y);
  const face=Math.abs(normalizarAngulo(atan2(c.y-a.y,c.x-a.x)-a.direcao));
  if(d>bands.attackMax||d<bands.body*.82||face>.45)return null;
  return name;
}

export function registrarResultadoGolpe(a,alvo,g,mundo,{acertou=false,esquivou=false}={}) {
  if(!habilitada(a)||!alvo)return;
  const p=padraoAdversario(a,alvo.id,mundo.t),s=estado(a);
  if(acertou)p.acertamos=Math.min(200,p.acertamos+1);
  else p.erramos=Math.min(200,p.erramos+1);
  if(esquivou)p.esquivou=Math.min(200,p.esquivou+1);
  if(!acertou){s.combo=null;return;}
  const injuries=ferimentosTaticos(a);
  if(a.energia<=19||injuries.pernas>.3||injuries.cabeca>.32||a.agarrando)return;
  const next=g.nome==='mordida'?'garra_foice':g.nome==='garra_foice'?'mordida':g.nome==='bote'?'mordida':null;
  if(!next)return;
  s.combo={alvo:alvo.id,anterior:g.nome,proximo:next,criado:mundo.t,ate:mundo.t+2.8};
  mundo.evento?.('tatico_combo_abertura',a.id,{contra:alvo.id,anterior:g.nome,proximo:next});
}

export function registrarComboExecutado(a,alvo,nome,mundo){
  if(!habilitada(a))return;
  const s=estado(a);
  if(s.combo?.alvo!==alvo.id||s.combo.proximo!==nome)return;
  mundo.evento?.('tatico_combo_executado',a.id,{contra:alvo.id,anterior:s.combo.anterior,golpe:nome});
  s.combo=null;
}

export function registrarEsquivaEfetiva(vitima,atacante,mundo){
  if(!habilitada(vitima))return false;
  const s=estado(vitima);
  if(!s.defesa||s.defesa.atacante!==atacante.id||s.defesa.validada||mundo.t>s.defesa.ate)return false;
  s.defesa.validada=true;
  const p=padraoAdversario(vitima,atacante.id,mundo.t);
  p.esquivamos=Math.min(200,p.esquivamos+1);
  mundo.evento?.('tatico_esquiva_real',vitima.id,{contra:atacante.id,semDano:true});
  return true;
}

export function registrarFerimentoAvancado(a,fer,mundo){
  if(!habilitada(a)||!fer)return;
  const s=estado(a),reg=fer.regiao;
  if(s.defesa?.atacante===fer.origem && !s.defesa.validada &&
     mundo.t<=s.defesa.ate){
    const p=padraoAdversario(a,fer.origem,mundo.t);
    p.esquivasFalharam=Math.min(200,p.esquivasFalharam+1);
    s.defesa.validada=true;
    mundo.evento?.('tatico_esquiva_falhou',a.id,{contra:fer.origem,regiao:reg});
  }
  const nome=reg==='cabeca'?'hurt_head':reg==='pernas'?'hurt_leg':'stagger';
  marcarVisual(a,nome,mundo,nome==='hurt_leg'?1.12:.9);
  if(reg==='pernas' && fer.fratura) s.combo=null;
  if(fer.origem) {
    const p=padraoAdversario(a,fer.origem,mundo.t);
    p.ataquesRecebidos=Math.min(200,p.ataquesRecebidos+1);
  }
  mundo.evento?.('tatico_reagiu_ferimento',a.id,{regiao:reg,fratura:!!fer.fratura});
}

// Recuperar da queda não depende de ver um rival. O cérebro pode estar em
// caça, retirada ou proteção da carcaça; a física ainda exige levantar.
export function recuperarQuedaAvancada(a,mundo) {
  if(!habilitada(a))return null;
  const s=a.taticaAvancada;
  if(!s || a.saude.caidoAte>mundo.t)return null;
  if(s.queda?.precisaLevantar){
    s.queda.precisaLevantar=false;
    s.acao={tipo:'levantar',ate:mundo.t+1.80};
    marcarVisual(a,'get_up',mundo,1.80);
    mundo.evento?.('tatico_levantou',a.id,{contra:s.alvo??null});
  }
  if(s.acao?.tipo==='levantar'&&s.acao.ate>mundo.t)
    return {estado:'levantando',codigo:'recuperacao_queda',motivo:'levanta depois de cair',
      alvo:null,destino:null,ritmo:'parado',velMax:0};
  return null;
}

export function registrarQuedaAvancada(a,mundo){
  if(!habilitada(a))return;
  const s=estado(a);
  s.queda={desde:mundo.t,precisaLevantar:true};
  s.combo=null;
  marcarVisual(a,'fall',mundo,1.32);
}

export function iniciarAgarraoAvancado(a,alvo,mundo){
  if(!habilitada(a))return;
  const s=estado(a);
  s.agarrando={alvo:alvo.id,desde:mundo.t,disputas:0,cansaco:0};
  s.combo=null;
  marcarVisual(a,'grab_start',mundo,1.12);
  mundo.evento?.('tatico_agarrao_inicio',a.id,{contra:alvo.id});
}

function potencia(a) {
  let strength=a.massa * a.especie.combate.forca * a.atributos.forca;
  strength*=1-a.saude.dor*.42;
  strength*=clamp(fatorMobilidade(a),.20,1);
  strength*=.45+.55*clamp(a.energia/100,0,1);
  for(const f of a.saude.ferimentos)strength*=1-clamp((f.muscular||0)*.45,0,.35);
  return Math.max(1,strength);
}

export function confrontoAgarraoAvancado(a,alvo,mundo,dt){
  if(!habilitada(a))return null;
  const s=estado(a),g=s.agarrando;
  if(!g||g.alvo!==alvo.id)return null;
  g.cansaco+=dt;
  const A=potencia(a)*(a.especie.combate.forcaMordida??1),V=potencia(alvo);
  const ratio=V/Math.max(1,A);
  a.energia=Math.max(0,a.energia-dt*(.45+ratio*.95));
  // Energia, força e resistência determinam se é possível manter o agarrão.
  if(a.saude.caidoAte>mundo.t||a.saude.atordoadoAte>mundo.t||a.energia<8||
    g.cansaco>Math.max(1.2,4.8-1.7*ratio)||ratio>1.9)return 'forca_insuficiente_ou_fadiga';
  if(!g.proximaDisputa||mundo.t>=g.proximaDisputa){
    g.proximaDisputa=mundo.t+.6;
    g.disputas++;
    mundo.evento?.('tatico_disputa_agarrao',a.id,{contra:alvo.id,relacaoForca:+ratio.toFixed(2),numero:g.disputas});
    // Sem RNG extra: o sorteio físico habitual de fuga continua no kernel.
  }
  return null;
}

export function chanceEscapeAvancado(a,alvo,base){
  if(!habilitada(a))return base;
  const g=estado(a).agarrando;
  const ratio=potencia(alvo)/Math.max(1,potencia(a)*(a.especie.combate.forcaMordida??1));
  return clamp(base*(.6+ratio*.85)*(1+(g?.cansaco||0)*.18),.01,.85);
}

export function finalizarAgarraoAvancado(a,mundo,motivo){
  if(!habilitada(a))return;
  const s=estado(a);
  if(!s.agarrando)return;
  s.agarrando=null;
  marcarVisual(a,'grab_release',mundo,1.05);
  mundo.evento?.('tatico_agarrao_fim',a.id,{motivo});
}
