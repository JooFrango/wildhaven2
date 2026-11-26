// Mundo do Hunter Lab: o mundo do ecossistema com Hunters dentro. Nenhum passo próprio de simulação —
// `passoEco` continua sendo o único relógio, para que Hunter e criatura nunca divirjam de regra.
import { criarMundoEco, passoEco } from '../../ia-criaturas/src/eco/mundo.js';
import { salvarMundo, carregarMundo } from '../../ia-criaturas/src/eco/persistencia.js';
import { verificarInvariantes } from '../../ia-criaturas/src/eco/invariantes.js';
import { criarHunter, foraDeCombate, montarFicha } from './hunter.js';
import {instalarImpactos,prepararImpactos,finalizarImpactos} from './impacto-combate.js';
import {registrarCombateJogador,moverEsquivasPve1,semCansacoPve2} from './combate-jogador.js';
import { Geometry } from '../../hunters-codex/src/geometry.js';
import { aplicarPostura } from './hunter.js';
import { decidirHunter } from './cerebro-hunter.js';
import { instalarMonstro } from './monstro-varrisco.js';

// `cenario.hunters`: lista de { id, nome, equipe, x, y, direcaoGraus, equipamento, personalidade, controle, modo }.
export function criarMundoHunters(cfg, cenario, semente, { fichaHunter, equipamentos, ...opcoes } = {}) {
  const mundo = criarMundoEco(cfg, cenario, semente, {
    // Golpe não atravessa rocha: regra do laboratório de Hunters (ver combate.js).
    bloqueioGolpePorTerreno: true,
    combateJogador: true,
    ...opcoes,
  });
  mundo.hunters = [];
  mundo.hunterRecursos = {fichaHunter,equipamentos};
  mundo.modoCombate = cenario.modoCombate ?? 'treino';
  for (const def of cenario.hunters ?? []) {
    const ficha = montarFicha(fichaHunter, equipamentos, def.equipamento ?? {});
    const a = criarHunter(mundo, ficha, { modo: mundo.modoCombate, ...def });
    a.comandoTeste = decidirHunter;
  }
  instalarRegrasDeTreino(mundo);
  if(cenario.geometriaPrecisa)instalarGeometria(mundo,cenario.geometriaPrecisa);
  instalarImpactos(mundo);
  instalarMonstro(mundo); // linha MH (?mh=1): no-op com o interruptor desligado
  return mundo;
}

// Treino: ninguém morre. Substitui `mundo.matar` (API pública do mundo) só para os Hunters em treino; para
// criaturas e para o modo letal a função original é a que vale.
function instalarRegrasDeTreino(mundo) {
  const matar = mundo.matar;
  mundo.matar = (a, causa, por = null) => {
    if (a.hunter && a.hunter.modo === 'treino') {
      if (a.hunter.situacao !== 'incapacitado') {
        a.hunter.situacao = 'incapacitado';
        mundo.evento('hunter_poupado_treino', a.id, { causa, por, hp: +a.saude.hp.toFixed(1) });
      }
      a.saude.hp = Math.max(a.saude.hp, a.saude.hpMax * 0.05);
      for (const f of a.saude.ferimentos) f.sangramento = 0;
      return;
    }
    return matar(a, causa, por);
  };
}

// Persistência. O formato do ecossistema guarda a espécie pelo `id`, então um Hunter recarregado voltava com a
// ficha BASE: sem arma, sem armadura, sem proteção — ferimentos certos e equipamento perdido. O contrato é
// corrigido aqui, de forma compatível: o estado do ecossistema continua sendo o do núcleo, e esta camada
// acrescenta o que é dela. O que foi resolvido (ferimentos, conflitos, mortes) não é recalculado.
export function salvarMundoHunters(mundo) {
  return {
    versaoHunters: 2,
    comandos: mundo.comandosHunters ?? [], historicoComandos: mundo.historicoComandos ?? [],
    geometriaPrecisa: mundo.geometriaHunter?.data ?? null,
    modoCombate: mundo.modoCombate,
    // O desfecho é um fato já resolvido: recarregar não pode fazer o laboratório julgar a luta de novo.
    resultado: mundo.resultado ?? null,
    semContatoDesde: mundo.semContatoDesde ?? null,
    // Quem tem a vez de atacar no par: sem isso, recarregar libera os dois para golpear no mesmo passo.
    iniciativaCombate: [...(mundo.iniciativaCombate ?? new Map())],
    eco: salvarMundo(mundo),
    hunters: mundo.hunters.map((a) => {
      // `base` e `todosAtaques` apontam para a ficha equipada e são remontados no carregamento. `alturas` é a
      // altura de impacto de cada ataque AGORA — `mirar` sorteia uma por golpe, e um golpe em preparo no
      // instante do save resolveria numa região diferente se ela voltasse ao valor da configuração.
      const { base, todosAtaques, ...resto } = a.hunter;
      return { id: a.id, ...resto, perfisAtaques:structuredClone(a.especie.anatomia.ataques), alturas: Object.fromEntries(Object.entries(a.especie.anatomia.ataques).map(([k, v]) => [k, v.alturaImpacto])) };
    }),
  };
}

export function carregarMundoHunters(cfg, salvo, { fichaHunter, equipamentos }) {
  const mundo = carregarMundo(cfg, salvo.eco);
  mundo.hunterRecursos = {fichaHunter,equipamentos};
  mundo.comandosHunters=salvo.comandos??[];mundo.historicoComandos=salvo.historicoComandos??[];
  mundo.modoCombate = salvo.modoCombate;
  mundo.resultado = salvo.resultado ?? null;
  mundo.semContatoDesde = salvo.semContatoDesde ?? null;
  mundo.iniciativaCombate = new Map(salvo.iniciativaCombate ?? []);
  mundo.hunters = [];
  mundo.opcoes.bloqueioGolpePorTerreno = true;
  for (const h of salvo.hunters) {
    const a = mundo.porId.get(h.id) ?? mundo.mortos.get(h.id);
    if (!a) continue;
    const ficha = montarFicha(fichaHunter, equipamentos, h.equipamento);
    a.especie = ficha;
    a.nivelFixo = true;
    for (const [k, v] of Object.entries(h.alturas ?? {})) if (ficha.anatomia.ataques[k]) ficha.anatomia.ataques[k].alturaImpacto = v;
    if(h.perfisAtaques)ficha.anatomia.ataques=structuredClone(h.perfisAtaques);
    const { id, alturas, perfisAtaques, ...estadoHunter } = h;
    a.hunter = { ...estadoHunter, base: { esquiva: ficha.combate.esquiva, defesa: ficha.combate.defesa, protecao: { ...ficha.combate.protecao } } };
    if(a.hunter.action)(a.tatica??={}).action=a.hunter.action;
    a.comandoTeste = decidirHunter;
    if (a.vivo) mundo.hunters.push(a);
  }
  instalarRegrasDeTreino(mundo);
  if(salvo.geometriaPrecisa)instalarGeometria(mundo,salvo.geometriaPrecisa);
  instalarImpactos(mundo);
  return mundo;
}

export function passoHunters(mundo) {
  while(mundo.comandosHunters?.[0]?.tick<=mundo.tick+1)aplicarComando(mundo,mundo.comandosHunters.shift());
  const antes = mundo.eventos.length, pos=new Map(mundo.geometriaHunter?mundo.vivos.map(a=>[a.id,{x:a.x,y:a.y}]):[]);
  for(const a of mundo.hunters){if(foraDeCombate(a))continue;const h=a.hunter;if(a.saude.caidoAte>mundo.t)h.estavaCaido=true;else if(h.estavaCaido){h.estavaCaido=false;h.getUpStarted=mundo.t;h.getUpUntil=mundo.t+.8;}}
  semCansacoPve2(mundo);      // PvE v02: no-op com o interruptor desligado
  moverEsquivasPve1(mundo);   // PvE v01: no-op com o interruptor desligado
  prepararImpactos(mundo);
  passoEco(mundo);
  finalizarImpactos(mundo,mundo.eventos.slice(antes));
  if(mundo.geometriaHunter)for(const a of mundo.vivos){const p=pos.get(a.id);if(!p)continue;const q=mundo.geometriaHunter.sweep(p,a,a.especie.corpo.raio,a.especie.corpo.alturaM);if(q.blocked){a.x=q.x;a.y=q.y;a.velocidade=0;mundo.evento("precise_collision",a.id);}a.z=mundo.geometriaHunter.height(a.x,a.y);}
  // Golpes recebidos: contados pelos eventos do núcleo, não por um gancho paralelo que poderia divergir dele.
  for (let i = antes; i < mundo.eventos.length; i++) {
    const e = mundo.eventos[i];
    if (e.tipo !== 'ferimento') continue;
    const alvo = mundo.porId.get(e.id) ?? mundo.mortos.get(e.id);
    if (alvo?.hunter) alvo.hunter.golpesRecebidos++;
  }
  for(const a of mundo.hunters){const action=a.tatica?.action;if(action&&action.start>(a.hunter.action?.start??-1)){a.hunter.action=action;a.hunter.blockUntil=0;a.hunter.dodgeUntil=Math.min(a.hunter.dodgeUntil??0,mundo.t);action.goal=a.hunter.jogador?.goal??'flanco';action.cancelAfter=action.impact+(action.end-action.impact)*.65;}}
  registrarCombateJogador(mundo,mundo.eventos.slice(antes));
  return resultadoCombate(mundo);
}

// Resultado: uma equipe vence quando todas as outras estão fora de combate (rendidas, incapacitadas ou mortas).
export function resultadoCombate(mundo) {
  if (mundo.resultado) return mundo.resultado;
  const equipes = new Map();
  for (const a of mundo.hunters) {
    const e = a.hunter.equipe;
    if (!equipes.has(e)) equipes.set(e, []);
    equipes.get(e).push(a);
  }
  if(equipes.size<2){
    const criaturas=mundo.animais.filter(a=>!a.hunter);
    if(!criaturas.length)return null;
    const humanos=mundo.hunters.filter(a=>!foraDeCombate(a));
    const motivo=!humanos.length?'Hunter fora de combate':criaturas.every(a=>!a.vivo)?'criatura derrotada':null;
    if(motivo){mundo.resultado={vencedor:humanos.length?[...equipes.keys()][0]:'criaturas',t:mundo.t,motivo,situacoes:Object.fromEntries(mundo.hunters.map(a=>[a.id,a.hunter.situacao]))};mundo.evento('combate_fim','caca',mundo.resultado);return mundo.resultado;}
    return null;
  }
  const ativas = [...equipes.entries()].filter(([, hs]) => hs.some((a) => !foraDeCombate(a)));
  if (ativas.length > 1) {
    // Retirada mútua: os dois lados romperam o contato e ninguém reencontrou ninguém. É desfecho de combate,
    // não empate por tempo — sem isso o cenário roda até o limite com todo mundo descansando longe.
    const alguemLutou = mundo.metricas.eventos.ferimento > 0 || mundo.metricas.eventos.ataque_inicio > 0;
    const todosSemAlvo = mundo.hunters.every((a) => !a.hunter.alvoId);
    if (!alguemLutou || !todosSemAlvo) { mundo.semContatoDesde = null; return null; }
    mundo.semContatoDesde ??= mundo.t;
    if (mundo.t - mundo.semContatoDesde < 20) return null;
    mundo.resultado = {
      vencedor: null, t: +mundo.t.toFixed(2), motivo: 'retirada mútua: nenhum lado reencontrou o outro',
      situacoes: Object.fromEntries(mundo.hunters.map((a) => [a.id, a.hunter.situacao])),
    };
    mundo.evento('combate_fim', 'retirada', mundo.resultado);
    return mundo.resultado;
  }
  mundo.resultado = {
    vencedor: ativas.length === 1 ? ativas[0][0] : null,
    t: +mundo.t.toFixed(2),
    motivo: ativas.length === 1 ? 'adversários fora de combate' : 'todos fora de combate',
    situacoes: Object.fromEntries(mundo.hunters.map((a) => [a.id, a.hunter.situacao])),
  };
  mundo.evento('combate_fim', ativas[0]?.[0] ?? 'empate', mundo.resultado);
  return mundo.resultado;
}

// Roda até o fim do combate ou até `ate` segundos, conferindo os invariantes a cada `intervalo` segundos.
export function rodarCombate(mundo, ate, { intervalo = 5 } = {}) {
  const violacoes = [];
  let proxima = intervalo;
  while (mundo.t < ate - 1e-9) {
    const r = passoHunters(mundo);
    if (mundo.t >= proxima) { violacoes.push(...verificarInvariantes(mundo)); proxima += intervalo; }
    if (r) break;
  }
  violacoes.push(...verificarInvariantes(mundo));
  return { resultado: mundo.resultado ?? null, violacoes, t: +mundo.t.toFixed(2) };
}

// Estado legível de um Hunter, para a interface e o diagnóstico.
export function estadoHunter(a) {
  const h = a.hunter;
  return {
    id: a.id, nome: h.nome, equipe: h.equipe, situacao: h.situacao, postura: h.postura, controle: h.controle,
    hp: +a.saude.hp.toFixed(1), hpMax: +a.saude.hpMax.toFixed(1), energia: +a.energia.toFixed(1),
    folego: +a.folego.toFixed(1), dor: +a.saude.dor.toFixed(2),
    equipamento: h.equipamento, alvo: h.alvoId,
    estado: a.estado, motivo: a.intencao?.motivo ?? '',
    x: +a.x.toFixed(2), y: +a.y.toFixed(2),
    golpesDados: h.golpesDados, golpesRecebidos: h.golpesRecebidos,
    combateJogador:{habilidade:h.habilidade??.65,parte:h.jogador?.goal??null,sequencia:h.jogador?.chain??0,janela:h.jogador?.reading?.window??0,conhecimento:h.jogador?.reading?.knowledge??0},
    ferimentos: a.saude.ferimentos.map((f) => ({ regiao: f.regiao, gravidade: +f.gravidade.toFixed(3), fratura: f.fratura, sangramento: +f.sangramento.toFixed(3) })),
  };
}

// Commands are tick-stamped, replayable and persisted alongside the ecological state.
export function enfileirarComando(m,tipo,id,dados={},tick=m.tick+1){
 if(!Number.isInteger(tick)||tick<=m.tick)throw Error('Comando deve ocorrer num passo futuro');
 const c={tipo,id,dados:structuredClone(dados),tick,seq:(m.historicoComandos??=[]).length};
 (m.comandosHunters??=[]).push(c);m.historicoComandos.push(structuredClone(c));m.comandosHunters.sort((a,b)=>a.tick-b.tick||a.seq-b.seq);return c;
}
function aplicarComando(m,c){
 const a=m.porId.get(c.id),h=a?.hunter;if(!h)return;const d=c.dados;
 if(c.tipo==='camera')return;
 if(c.tipo==='habilidade'&&Number.isFinite(d.valor))h.habilidade=Math.max(0,Math.min(1,d.valor));
 if(c.tipo==='personalidade')for(const k of ['agressividade','cautela','disciplina'])if(Number.isFinite(d[k]))h.personalidade[k]=Math.max(0,Math.min(1,d[k]));
 if(c.tipo==='atributos')for(const k of ['forca','velocidade','resistencia','sentidos'])if(Number.isFinite(d[k]))a.atributos[k]=Math.max(.5,Math.min(1.5,d[k]));
 if(c.tipo==='equipamento'){
  const {fichaHunter,equipamentos}=m.hunterRecursos;
  for(const [key,group]of [['arma','armas'],['escudo','escudos'],['armadura','armaduras']])if(d[key]&&!equipamentos[group][d[key]])throw Error('Equipamento desconhecido');
  a.especie=montarFicha(fichaHunter,equipamentos,d);h.equipamento=a.especie.equipamento;
  h.base={esquiva:a.especie.combate.esquiva,defesa:a.especie.combate.defesa,protecao:{...a.especie.combate.protecao}};delete h.todosAtaques;delete h.alturaBase;
  if(a.golpe){m.evento('golpe_interrompido',a.id,{motivo:'troca_equipamento'});a.golpe=null;}aplicarPostura(a,'neutra');
 }
 if(c.tipo==='manual'){h.controle=d.on?'manual':'ia';h.comando={};}
 if(c.tipo==='input')h.comando={...h.comando,...d};
 if(c.tipo==='ordem')h.ordem={tipo:'ir',...d};
 if(c.tipo==='rendir'){h.situacao='rendido';(a.tatica??={}).outcomeTime=m.t;a.golpe=null;m.evento('hunter_rendicao',a.id,{motivo:'comando'});}
 if(c.tipo==='estabilizar'&&a.velocidade<.2&&!a.contatos.some(x=>x.distancia<5&&x.via==='visao'&&x.id===h.alvoId)){for(const f of a.saude.ferimentos)f.sangramento=0;m.evento('estabilizado',a.id);}
}
export function instalarGeometria(m,data){m.geometriaHunter=new Geometry(data);m.sondagemTatica=(a,p)=>!m.geometriaHunter.sweep(a,p,a.especie.corpo.raio,a.especie.corpo.alturaM).blocked;m.linhaGolpePrecisa=(a,b,h)=>m.geometriaHunter.line([a.x,a.z+h,a.y],[b.x,b.z+h,b.y]);}
