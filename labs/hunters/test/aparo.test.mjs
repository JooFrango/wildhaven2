// Primeira entrega do PvP: ataque no corpo, espada bloqueando espada com contato real e contra-ataque.
// O que estes testes provam é geométrico: quando o golpe é interrompido, as duas lâminas se encontram no
// ponto registrado — não é um temporizador cancelado nem duas animações independentes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {armaLocal,amostrarArma,segmentoMundo,contatoLaminas,aparoNoIntervalo,tempoAcao} from '../src/trajetoria-arma.js';
import {apararComLamina,decidirComoJogador,observarMovimento,temIniciativa} from '../src/combate-jogador.js';
import {acaoFisica} from '../src/impacto-combate.js';
import {rodarCombate,passoHunters,salvarMundoHunters,carregarMundoHunters} from '../src/mundo-hunters.js';
import {LAB,cenarioDuelo,mundoDuelo,doisHunters,ev,hunter} from './ajudantes.mjs';

const ARENA={terreno:{tipo:'procedural',largura:120,profundidade:100,res:1,amplitude:0.4,capim:40},dt:0.05};
const duelo=(semente=7,equipA={arma:'espada'},equipB={arma:'espada'})=>
 mundoDuelo(cenarioDuelo('arena-aparo',doisHunters(equipA,equipB,{dist:3}),ARENA),semente);
const segmento=(x,y,z,tx,ty,tz,radius=.05)=>({grip:{x,y,z},tip:{x:tx,y:ty,z:tz},radius,active:true});
// Distância de um ponto a um segmento: usada para confirmar que o contato está nas DUAS lâminas.
const distPontoSegmento=(p,s)=>{
 const u=[s.tip.x-s.grip.x,s.tip.y-s.grip.y,s.tip.z-s.grip.z],w=[p.x-s.grip.x,p.y-s.grip.y,p.z-s.grip.z];
 const uu=u[0]**2+u[1]**2+u[2]**2,k=Math.max(0,Math.min(1,(w[0]*u[0]+w[1]*u[1]+w[2]*u[2])/(uu||1)));
 return Math.hypot(w[0]-u[0]*k,w[1]-u[1]*k,w[2]-u[2]*k);
};

test('lâmina contra lâmina: cruzadas se encontram, paralelas afastadas não', () => {
 const a=segmento(0,0,1, 0,0,1.9), b=segmento(-.5,0,1.5, .5,0,1.5);   // vertical × horizontal, mesmo plano
 const cruzado=contatoLaminas(a,b);
 assert.ok(cruzado.hit, `cruzadas não registraram contato (folga ${cruzado.gap.toFixed(3)} m)`);
 assert.ok(distPontoSegmento(cruzado.ponto,a)<=.06 && distPontoSegmento(cruzado.ponto,b)<=.06, 'ponto fora de uma das lâminas');
 const paralelo=contatoLaminas(a,segmento(.6,0,1, .6,0,1.9));
 assert.equal(paralelo.hit,false,'lâminas paralelas a 60 cm registraram contato');
 assert.ok(paralelo.gap>.4,`folga paralela irreal: ${paralelo.gap.toFixed(2)} m`);
 // A empunhadura não apara: só o aço depois do punho entra no teste estreito.
 const noPunho=contatoLaminas(segmento(0,0,1, 0,0,1.9),segmento(-.3,0,1.02, .3,0,1.02));
 assert.ok(noPunho.fracaoAtacante>=.08,'contato aceito dentro da empunhadura');
});

test('a guarda é construída sobre a linha lida do golpe, com a mão onde o braço alcança', () => {
 const alturas=[.9,1.2,1.55];
 for(const altura of alturas)for(const inclinacao of [0,Math.PI/2]){
  const s=armaLocal('espada',{fase:0,altura:1.75,alcance:1.05,bloqueio:{altura,inclinacao,subida:1}});
  const ponto={x:0,y:altura,z:1.75*.26};
  assert.ok(s.parry&&s.active,'pose de aparo inativa');
  const eixo=s.tip.map((v,i)=>v-s.grip[i]),n=Math.hypot(...eixo);
  // Cruza a linha lida: o eixo da lâmina é perpendicular à direção do golpe, no plano frontal.
  const golpe=[Math.cos(inclinacao),Math.sin(inclinacao),0];
  assert.ok(Math.abs(eixo.reduce((s2,v,i)=>s2+v/n*golpe[i],0))<.02,`guarda paralela ao golpe (inclinação ${inclinacao.toFixed(2)})`);
  assert.ok(Math.abs(eixo[2])<.02,'lâmina da guarda apontando para a frente em vez de cruzar a linha');
  // A lâmina cobre o ponto lido com o corpo dela. O braço é o limite: num golpe baixo a guarda alcança
  // menos, e é por isso que um corte baixo é mais difícil de aparar — quem decide o contato é o teste estreito.
  const lamina={grip:{x:s.grip[0],y:s.grip[1],z:s.grip[2]},tip:{x:s.tip[0],y:s.tip[1],z:s.tip[2]}};
  const folga=distPontoSegmento(ponto,lamina);
  assert.ok(folga<=.26,`guarda longe demais da linha lida (${folga.toFixed(2)} m, altura ${altura}, inclinação ${inclinacao.toFixed(2)})`);
  if(altura===1.2)assert.ok(folga<=.08,`na altura do peito a guarda devia cobrir a linha: ${folga.toFixed(2)} m`);
  // O punho fica dentro do alcance do ombro da espada: é o que o braço consegue segurar de verdade.
  const ombro=[-1.75*.115,1.75*.82,1.75*.06];
  assert.ok(Math.hypot(...s.grip.map((v,i)=>v-ombro[i]))<=1.75*.30+1e-9,`punho fora do alcance do braço: ${s.grip.map(v=>v.toFixed(2))}`);
  const comprimento=Math.hypot(...s.tip.map((v,i)=>v-s.grip[i]));
  assert.ok(Math.abs(comprimento-(1.05-1.75*.235))<.02,`lâmina mudou de comprimento na guarda: ${comprimento.toFixed(3)} m`);
 }
 // Sobe da guarda neutra em 0,12 s em vez de aparecer na posição final: braço não teleporta.
 const acao={name:'sword_block',start:0,impact:.12,end:.5,reach:1.05,aimHeight:1.2,bloqueio:{altura:1.2,inclinacao:0}};
 const inicio=amostrarArma(acao,0,{arma:'espada',altura:1.75}),meio=amostrarArma(acao,.06,{arma:'espada',altura:1.75}),fim=amostrarArma(acao,.12,{arma:'espada',altura:1.75});
 const d=(p,q)=>Math.hypot(...p.tip.map((v,i)=>v-q.tip[i]));
 assert.ok(d(inicio,fim)>.15,'guarda não se move da pose neutra');
 assert.ok(d(meio,fim)>.01&&d(meio,inicio)>.01,'guarda salta direto para a pose final');
});

test('2. espada bloqueia espada: as duas lâminas se encontram e o golpe para no ponto de contato', () => {
 const m=duelo(),[a,b]=m.hunters;
 a.z=b.z=0;b.x=a.x+1.0;b.y=a.y;a.direcao=0;b.direcao=Math.PI;
 const contato=observarMovimento({id:b.id,especie:'hunter',via:'visao',x:b.x,y:b.y,z:b.z,direcao:b.direcao,signal:'guarda',body:{r:.26,half:0,center:0,height:1.75}},a,m.t);
 // A atacou: B lê a linha e leva a lâmina até ela.
 const ataque=a.especie.combate.ataques.find(x=>x.peso==='leve'&&x.nome!=='golpe_curto');
 a.golpe={nome:ataque.nome,alvo:b.id,inicio:m.t,impacto:m.t+ataque.preparoSeg,ataque};
 const visto=observarMovimento({id:a.id,especie:'hunter',via:'visao',x:a.x,y:a.y,z:a.z,direcao:a.direcao,signal:'preparo',body:{r:.26,half:0,center:0,height:1.75}},a,m.t);
 assert.ok(visto.tell?.height>0,'a altura visível da lâmina não chegou à leitura do defensor');
 assert.ok(apararComLamina(b,visto,m,{skill:.65}),'defensor com espada não levantou a guarda');
 const acao=acaoFisica(a,a.golpe),guarda=b.hunter.guarda;
 const aparo=aparoNoIntervalo(a,b,acao,guarda,a.golpe.impacto,{de:acao.start});
 assert.ok(aparo.hit,`as lâminas não se encontraram (folga mínima ${aparo.gap.toFixed(3)} m)`);
 // O ponto registrado está sobre as duas lâminas no instante registrado — é o mesmo evento físico.
 const sa=segmentoMundo(a,amostrarArma(acao,aparo.t,{arma:'espada',altura:1.75,alcance:acao.reach,alturaAlvo:acao.aimHeight}));
 const sb=segmentoMundo(b,amostrarArma(guarda,aparo.t,{arma:'espada',altura:1.75,alcance:guarda.reach,alturaAlvo:guarda.aimHeight}));
 assert.ok(distPontoSegmento(aparo.ponto,sa)<=.07,'ponto de contato fora da lâmina do atacante');
 assert.ok(distPontoSegmento(aparo.ponto,sb)<=.07,'ponto de contato fora da lâmina do defensor');
 assert.ok(aparo.t<=a.golpe.impacto+1e-9,'contato registrado depois do impacto no corpo');
 assert.ok(contato.human,'anatomia humana não reconhecida');
});

test('hitstop: o golpe aparado segura a lâmina no ponto de contato e recupera de lá', () => {
 const acao={name:'sword_light',start:0,impact:.4,end:1,reach:1.05,aimHeight:1.1,aparo:{t:.36,ate:.46}};
 assert.equal(tempoAcao(acao,.30),.30);
 assert.equal(tempoAcao(acao,.40),.36);                      // parado no contato
 assert.equal(+tempoAcao(acao,.46).toFixed(5),.36);
 assert.equal(+tempoAcao(acao,.60).toFixed(5),.50);           // retoma de onde parou, sem salto
 const parado=amostrarArma(acao,.42,{arma:'espada',altura:1.75}),contato=amostrarArma(acao,.36,{arma:'espada',altura:1.75});
 assert.deepEqual(parado.tip,contato.tip,'a lâmina continuou andando durante o hitstop');
});

test('duelo 1×1 na arena: ataque acerta o corpo, espada apara espada e o defensor revida', () => {
 const m=duelo();
 const r=rodarCombate(m,120);
 assert.deepEqual(r.violacoes,[],'invariantes violados');
 const aparos=m.eventos.filter(e=>e.tipo==='golpe_interrompido'&&e.motivo==='aparo_lamina');
 const metal=m.eventos.filter(e=>e.tipo==='impacto_arma'&&e.aparo==='lamina');
 // 1. o ataque alcança o corpo
 assert.ok(ev(m,'ferimento').length>0,'nenhum golpe chegou ao corpo');
 // 2. espada contra espada, com contato real
 assert.ok(aparos.length>=3,`aparos insuficientes para avaliar: ${aparos.length}`);
 assert.equal(metal.length,aparos.length,'contato metálico e interrupção não são o mesmo evento');
 for(const e of metal)assert.ok(e.folga<=.02,`contato registrado sem encontro de lâminas: folga ${e.folga} m`);
 for(const e of metal)assert.equal(e.dano,0,'aparo aplicou dano');
 // O golpe aparado não fere no mesmo instante: a lâmina parou antes do corpo.
 for(const e of aparos)assert.equal(m.eventos.some(f=>f.tipo==='ferimento'&&f.atacante===e.id&&Math.abs(f.t-e.t)<1e-9),false,'golpe aparado ainda feriu');
 // Reação física dos dois lados vem do mesmo evento.
 const alturas=metal.map(e=>e.z);
 assert.ok(Math.min(...alturas)>.4&&Math.max(...alturas)<2.2,`contato fora da altura de combate: ${Math.min(...alturas).toFixed(2)}..${Math.max(...alturas).toFixed(2)} m`);
 // 3. contra-ataque depois do bloqueio
 const revides=aparos.filter(e=>m.eventos.some(s=>s.tipo==='hunter_sequencia'&&s.id===e.alvo&&s.t>=e.t&&s.t<=e.t+1.0));
 assert.ok(revides.length>=2,`defensor não revidou depois de aparar (${revides.length} de ${aparos.length})`);
});

test('attack slot do par: os dois não ficam em preparo ao mesmo tempo', () => {
 const m=duelo(23);
 rodarCombate(m,120);
 const [a,b]=m.hunters;
 assert.ok(ev(m,'ataque_inicio',a.id).length>0&&ev(m,'ataque_inicio',b.id).length>0,'algum Hunter nunca atacou');
 // Reconstrói as janelas de preparo a partir dos eventos e confere que não se sobrepõem.
 const janelas=id=>m.eventos.filter(e=>e.tipo==='ataque_inicio'&&e.id===id).map(e=>[e.t,e.t+e.preparo]);
 const A=janelas(a.id),B=janelas(b.id);
 const sobrepostas=A.filter(([i,f])=>B.some(([j,g])=>i<g&&j<f));
 assert.equal(sobrepostas.length,0,`${sobrepostas.length} preparos simultâneos: ${JSON.stringify(sobrepostas.slice(0,3))}`);
 assert.ok(temIniciativa(a,{id:b.id},{t:1e6}),'iniciativa não é liberada depois da ação');
});

test('o aparo não quebra a reprodutibilidade: mesma semente, mesmo duelo golpe a golpe', () => {
 const rodar=()=>{const m=duelo(17);const r=rodarCombate(m,120);
  return {t:r.t,eventos:m.eventos.length,aparos:m.eventos.filter(e=>e.motivo==='aparo_lamina').length,
   estados:m.hunters.map(h=>[h.id,+h.saude.hp.toFixed(4),+h.x.toFixed(4),+h.y.toFixed(4),h.hunter.bloqueios])};};
 const x=rodar(),y=rodar();
 assert.deepEqual(x,y);
 assert.ok(x.aparos>0,'cenário sem aparo não prova nada sobre reprodutibilidade do aparo');
});

test('salvar e recarregar no meio de uma guarda continua o duelo igual', () => {
 const m=duelo(17);
 const [a]=m.hunters;
 for(let i=0;i<2400&&!m.hunters.some(h=>h.hunter.guarda&&h.hunter.blockUntil>m.t);i++)passoHunters(m);
 const defensor=m.hunters.find(h=>h.hunter.guarda&&h.hunter.blockUntil>m.t);
 assert.ok(defensor,'o duelo não chegou a uma guarda levantada');
 const salvo=JSON.parse(JSON.stringify(salvarMundoHunters(m)));
 assert.ok(salvo.iniciativaCombate.length>0,'a vez de atacar não foi salva');
 const r=carregarMundoHunters({...LAB.cfg,cenarios:{...LAB.cfg.cenarios,'arena-aparo':cenarioDuelo('arena-aparo',doisHunters({arma:'espada'},{arma:'espada'},{dist:3}),ARENA)}},salvo,LAB);
 for(let i=0;i<400;i++){passoHunters(m);passoHunters(r);}
 assert.deepEqual(salvarMundoHunters(r),salvarMundoHunters(m));
 assert.ok(a.hunter.golpesDados>0,'ninguém atacou antes do save');
});

test('sem espada não há aparo de lâmina: punhos continuam saindo da linha', () => {
 const m=duelo(7,{arma:'maos'},{arma:'maos'});
 rodarCombate(m,120);
 assert.equal(m.eventos.filter(e=>e.motivo==='aparo_lamina').length,0,'mãos nuas apararam uma lâmina');
 const b=hunter(m,'hunter-B');
 assert.equal(b.hunter.guarda??null,null,'mãos nuas criaram pose de guarda de espada');
});
