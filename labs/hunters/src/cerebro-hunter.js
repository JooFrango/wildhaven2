// Decisão do Hunter. Devolve uma intenção no mesmo formato do cérebro animal e é instalada no gancho
// `comandoTeste` do núcleo, então estados físicos (caído, agarrado, atordoado) continuam vindo do núcleo e
// nenhuma decisão humana consegue ignorá-los.
//
// Regra dura de informação: o que entra na decisão vem de `a.contatos` (percepção deste passo) e de
// `a.memoria.criaturas`. Posição, velocidade, porte estimado e "está ferido" são do contato, não do objeto do
// rival. Duas coisas são lidas do rival porque são visíveis de fato: a que equipe ele pertence (aliado se
// reconhece) e se ele está com um golpe em preparo — que é justamente o movimento de corpo que `preparoSeg`
// modela. Nada de vida, energia ou intenção oculta.
import { atan2, cos, hipot, sen } from '../../ia-criaturas/src/core/matematica.js';
import { normalizarAngulo } from '../../ia-criaturas/src/core/geometria.js';
import { abrirConflito, escolherAtaque, iniciarAtaque, perfilGolpe } from '../../ia-criaturas/src/eco/combate.js';
import {decidirComoJogador,observarMovimento,ataqueManualPve2,marcarAtaqueManualPve2,rolarManualPve2} from './combate-jogador.js';
import {pve2Ligado} from './trajetoria-arma.js';
import {planejarTatica} from '../../ia-criaturas/src/eco/tatica.js';
import { fatorMobilidade } from '../../ia-criaturas/src/eco/saude.js';
import { aplicarPostura, atualizarSituacao, fatorBracos, foraDeCombate } from './hunter.js';

const intencao = (estado, codigo, motivo, extra = {}) =>
  ({ estado, codigo, motivo, alvo: null, destino: null, ritmo: 'parado', acao: null, olharPara: null, ...extra });

const alvoDe = (c) => ({ tipo: 'criatura', id: c.id, x: c.x, y: c.y });

// Vida própria em fração: o Hunter sente a própria condição, não a do rival.
const vigor = (a) => a.saude.hp / a.saude.hpMax;

// Limiar de desistência: coragem e orgulho seguram o Hunter na luta; cautela o tira dela mais cedo.
function limiarRecuo(a) {
  const p = a.hunter.personalidade;
  return Math.max(0.12, 0.5 - p.agressividade * 0.2 + p.cautela * 0.2 - a.temperamento.coragem * 0.15);
}

// O `mover` do ecossistema aponta o corpo para onde ele ANDA e não usa `olharPara` (só o núcleo simples usa).
// Num quadrúpede dá no mesmo; num duelo não: o Hunter atacava virado 81° para o lado do adversário e o golpe
// nunca alcançava. Aqui o corpo vira para o alvo dentro da taxa de giro da ficha, antes da fase de ação.
// Quando a intenção tem destino, o `mover` reassume o rumo pelo deslocamento — como deve ser.
function virarPara(a, p, dt) {
  if (!p) return;
  const quer = atan2(p.y - a.y, p.x - a.x);
  const giro = (a.especie.movimento.giroGrausSeg * Math.PI) / 180 * dt;
  const dif = normalizarAngulo(quer - a.direcao);
  a.direcao = normalizarAngulo(a.direcao + Math.max(-giro, Math.min(giro, dif)));
}

export function decidirHunter(a, mundo) {
  const i = decidir(a, mundo);
  if(!i.orientacaoCombate)virarPara(a, i.olharPara, mundo.dt);
  return i;
}

function decidir(a, mundo) {
  const h = a.hunter;
  a.tAtual = mundo.t;
  atualizarSituacao(a, mundo);

  if (foraDeCombate(a)) {
    aplicarPostura(a, 'neutra');
    return intencao(h.situacao === 'rendido' ? 'rendido' : 'incapacitado', h.situacao, h.situacao === 'rendido' ? 'rendeu-se' : 'incapacitado por ferimentos');
  }

  if(h.getUpUntil>mundo.t)return intencao('levantando','levantando','recuperando apoio após a queda');

  // Inimigos percebidos AGORA. Sem contato, não existe alvo — nem posição lembrada serve para atacar.
  const inimigos = a.contatos.filter((c) => {
    if(mundo.opcoes.tatica&&c.via!=='visao')return false;
    if (c.via === 'som') return false;
    const o = mundo.porId.get(c.id);
    if (!o || !o.vivo) return false;
    if (o.hunter) return o.hunter.equipe !== h.equipe && !foraDeCombate(o);
    return h.hostilCriaturas !== false && ameacaCriatura(a, c, o);
  });

  if (!inimigos.length) return semInimigo(a, mundo);

  inimigos.sort((x, y) => x.distancia - y.distancia || (x.id < y.id ? -1 : 1));
  const c = inimigos[0];
  const rival = mundo.porId.get(c.id);
  h.alvoId = c.id;
  const d = c.distancia;
  const alcance = alcanceMaior(a);

  // ---- desistir, recuar, render-se ----
  const exausto = a.energia < 12 || a.folego < 2;
  const mob = fatorMobilidade(a);
  const vida = vigor(a);
  const querSair = vida < limiarRecuo(a) || mob < 0.45 || exausto;
  if (querSair) {
    // Survival changes the next decision, but cannot erase a committed windup or its support phase.
    const action=h.action;
    if(mundo.opcoes.combateJogador!==false&&(a.golpe||(action&&mundo.t<(action.cancelAfter??action.end)))){
      const heading=action?.heading??a.direcao;
      return intencao(a.golpe?'preparando_ataque':'recuperando','sobrevivencia_comprometida','terminando apoio do golpe antes de retirar-se',{
        alvo:alvoDe(c),orientacaoCombate:true,olharPara:{x:a.x+cos(heading)*3,y:a.y+sen(heading)*3},
      });
    }
    h.retiradaDesde??=mundo.t;
    const retiradaFalhou=mundo.t-h.retiradaDesde>12&&vida<limiarRecuo(a);
    const podeFugir = mob > 0.4 && a.energia > 4 && (mundo.opcoes.tatica?a.especie.movimento.corrida*mob>=(c.velocidade??0)*1.2:velocidadeRelativa(a, rival)>=0);
    if ((!podeFugir||retiradaFalhou) && h.modo === 'treino' && vida < limiarRecuo(a)) {
      if (h.situacao !== 'rendido') {
        h.situacao = 'rendido';
        mundo.evento('hunter_rendicao', a.id, { para: c.id, hp: +a.saude.hp.toFixed(1), energia: +a.energia.toFixed(1), motivo: exausto ? 'exaustao' : 'ferimentos' });
      }
      aplicarPostura(a, 'neutra');
      return intencao('rendido', 'rendicao', `rendeu-se a ${c.id}`);
    }
    h.situacao = 'recuando';
    // Perto demais para dar as costas: recua de frente, protegido.
    if (d < alcance * 1.6) {
      aplicarPostura(a, 'defesa');
      return intencao('recuando', 'recuo_protegido', `recuando protegido (vida ${(vida * 100).toFixed(0)}%, energia ${a.energia.toFixed(0)})`, {
        orientacaoCombate:!!mundo.opcoes.tatica, alvo: alvoDe(c), destino: afastar(a, c, 4), ritmo: 'andar', olharPara: { x: c.x, y: c.y },
      });
    }
    aplicarPostura(a, 'neutra');
    return intencao('fugindo', 'fuga', `abandonando o combate (vida ${(vida * 100).toFixed(0)}%)`, {
      alvo: alvoDe(c), destino: afastar(a, c, 30), ritmo: exausto ? 'trote' : 'corrida',
    });
  }
  h.retiradaDesde=null;
  if (h.situacao === 'recuando') h.situacao = 'lutando';
  else h.situacao = 'lutando';

  // ---- controle manual ----
  // Depois da decisão de sobrevivência, de propósito: o jogador comanda um Hunter, não um boneco. Quando o
  // corpo não aguenta mais, quem decide é o Hunter — foi isso que o pedido chamou de preservar a capacidade
  // de tomar decisões de sobrevivência.
  if (h.controle === 'manual') return manual(a, c, rival, d, alcance, mundo);
  if(mundo.opcoes.combateJogador!==false)return decidirComoJogador(a,observarMovimento(c,rival,mundo.t),rival,mundo);
  if(mundo.opcoes.tatica)return combateTatico(a,c,rival,mundo);

  // ---- defesa contra golpe em preparo ----
  // Só na janela final do preparo. Defender durante todo o movimento do adversário parece prudente e é o
  // contrário: contra alguém que ataca sem parar, o Hunter nunca sairia da defesa e nunca revidaria —
  // foi o que o primeiro duelo mostrou (2 ataques contra 9). Um golpe próprio já em preparo também não é
  // abandonado: largar o golpe para defender dá ao adversário um alvo que nunca ataca.
  const golpeRival = c.via === 'visao' && rival.golpe?.alvo === a.id ? rival.golpe : null;
  const janela = golpeRival ? golpeRival.impacto - mundo.t : Infinity;
  if (golpeRival && janela > 0 && janela <= 0.3 && !a.golpe) {
    const p = h.personalidade;
    const podeBloquear = a.especie.bloqueioMax > 0.3 && fatorBracos(a) > 0.5;
    const prefereBloquear = podeBloquear && (p.disciplina >= 0.5 || a.especie.combate.esquiva < 0.45);
    aplicarPostura(a, prefereBloquear ? 'defesa' : 'esquiva');
    // Uma defesa por golpe do adversário, não uma por passo de simulação.
    if (h.ultimaDefesaEm !== golpeRival.inicio) { h.ultimaDefesaEm = golpeRival.inicio; h.bloqueios++; }
    return intencao('defendendo', prefereBloquear ? 'bloqueio' : 'esquiva_preparada', `golpe ${golpeRival.nome} de ${c.id} a ${janela.toFixed(2)} s do impacto`, {
      alvo: alvoDe(c), ritmo: 'parado', olharPara: { x: c.x, y: c.y },
    });
  }

  // ---- atacar ----
  aplicarPostura(a, 'neutra');
  // A cautela do núcleo (`errosSeguidos`) só zera quando um golpe acerta. Para um predador isso é certo — ele
  // desiste da caçada e tenta outra. Num duelo vira armadilha: quatro erros seguidos e o Hunter fica cauteloso
  // demais para qualquer golpe, não acerta nunca mais e a luta trava (medido: 1354 passos parado com a arma
  // pronta). Aqui a cautela também cede com o tempo, como cede num combate real.
  if (a.mente.errosSeguidos > 0 && mundo.t - (h.ultimoAtaqueEm ?? -9) > 1.5) {
    a.mente.errosSeguidos--;
    h.ultimoAtaqueEm = mundo.t;
  }
  if (!a.golpe && d <= alcance + 0.6) {
    const atq = escolherComPeso(a, rival, d, c, mundo);
    if (atq) {
      mirar(a, atq);
      // Atacar uma criatura ABRE um conflito do núcleo. Sem isso o animal leva a lançada e continua pastando:
      // o cérebro animal decide por presa, medo e competidor, e nenhuma ficha declara o Hunter em lista nenhuma.
      // Com o conflito aberto, quem decide lutar ou fugir é o animal, com o temperamento e o porte dele.
      if (!rival.hunter && !rival.conflito && !a.conflito) abrirConflito(mundo, a, rival, 'ataque_hunter', null);
      iniciarAtaque(a, rival, atq, mundo);
      // Custo humano do golpe, somado ao custo-base do núcleo: arma pesada e armadura cansam.
      a.energia = Math.max(0, a.energia - atq.energia * (1 + a.especie.custoEnergiaExtra));
      h.golpesDados++;
      return intencao('atacando', atq.nome, `${atq.nome} em ${c.id} a ${d.toFixed(2)} m`, {
        alvo: alvoDe(c), ritmo: 'parado', olharPara: { x: c.x, y: c.y },
      });
    }
  }

  // ---- aproximar / manter distância ----
  // A distância de luta é a da ARMA, não o encostar dos corpos. Andar até a posição do rival colava os dois a
  // 0,6 m, onde a lâmina passa do corpo e o núcleo rejeita todo golpe: os dois ficavam parados frente a frente.
  // Distância de trabalho da arma, não a ponta dela. O núcleo mede o contato pelo TRECHO final do membro: na
  // ponta do alcance a folga do golpe fica perto de zero e a incerteza do preparo derruba quase toda tentativa
  // (medido: 3 ataques contra 10 do adversário de braço curto). Um pouco mais perto, a lâmina cruza o corpo.
  const ideal = Math.max(alcance - 0.12, (a.especie.corpo.raio + rival.especie.corpo.raio) * 1.15);
  if (d > ideal + 0.3) {
    const ritmo = d > 12 ? (a.energia > 45 ? 'corrida' : 'trote') : a.energia > 25 ? 'trote' : 'andar';
    return intencao('aproximando', 'aproximacao', `fechando para ${ideal.toFixed(2)} m (está a ${d.toFixed(1)} m)`, {
      alvo: alvoDe(c), destino: pontoA(a, c, ideal), ritmo, olharPara: { x: c.x, y: c.y },
    });
  }
  if (d < ideal - 0.25) {
    return intencao('reposicionando', 'abrir_distancia', `perto demais para a arma: abrindo para ${ideal.toFixed(2)} m`, {
      alvo: alvoDe(c), destino: pontoA(a, c, ideal), ritmo: 'andar', olharPara: { x: c.x, y: c.y },
    });
  }
  // Na distância certa, esperando a abertura: fica de frente, parado. Circular aqui (com destino) fazia o
  // `mover` reassumir o rumo pelo deslocamento e tirar o adversário da frente bem na hora de golpear.
  return intencao('medindo', 'espera_recarga', `na distância (${d.toFixed(2)} m), golpe em recarga`, {
    alvo: alvoDe(c), ritmo: 'parado', olharPara: { x: c.x, y: c.y },
  });
}

// Comando do jogador: `h.comando` é escrito pela interface (teclado) e lido aqui. Movimento e ataque são do
// jogador; alcance, contato e consequência continuam sendo do núcleo — não existe acerto por apertar a tecla.
function manual(a, c, rival, d, alcance, mundo) {
  const h = a.hunter, cmd = h.comando ?? {};
  h.situacao = 'lutando';
  // PvE v02: a tecla Espaço faz o rolamento autorado (0,90 s, 1,3 m), com o lado dado por A/D. O deslocamento
  // vem da curva do clipe no passo de simulação, não de um impulso.
  if(cmd.esquivar&&!rolarManualPve2(a,mundo,cmd.esquerda?'left':'right')&&mundo.t>(h.proximaEsquiva??0)&&a.energia>8&&!a.golpe){h.proximaEsquiva=mundo.t+1.4;h.dodgeUntil=mundo.t+.65;a.energia-=8;const ang=atan2(c.y-a.y,c.x-a.x)+Math.PI/2;a.impulso={vx:cos(ang)*2.3,vy:sen(ang)*2.3,ate:mundo.t+.3,tipo:'esquiva'};mundo.evento('esquiva',a.id,{motivo:'manual'});}
  if (cmd.defender) { aplicarPostura(a, 'defesa'); return intencao('defendendo', 'bloqueio_manual', 'bloqueio comandado', { alvo: alvoDe(c), ritmo: 'parado', olharPara: { x: c.x, y: c.y } }); }
  aplicarPostura(a, 'neutra');
  if ((cmd.atacar||cmd.pesado) && !a.golpe && d <= alcance + 0.6) {
    // PvE v02: o golpe comandado leva o tempo do clipe que vai tocar, e J encadeia o combo 1 -> 2 -> 3.
    const plano = ataqueManualPve2(a, cmd.pesado, mundo.t);
    // A escolha do núcleo recusa o golpe pesado neste confronto (preparo longo), e a carga nunca sairia pela tecla H.
    // Comandado, o pesado é do jogador: alcance, contato e consequência continuam sendo do núcleo, e errar é possível.
    const atq = plano?.pesado
      ? (h.todosAtaques ?? a.especie.combate.ataques).find((x) => x.peso === 'pesado' && a.energia >= x.energia)
      : escolherComPeso(a, rival, d, c, mundo);
    if (atq) {
      mirar(a, atq);
      if (plano) {
        // O tempo do golpe mora na anatomia (é de lá que o núcleo tira preparo e duração), como no caminho da IA.
        Object.assign(a.especie.anatomia.ataques[atq.nome], { tImpacto: plano.windup, duracao: plano.windup + plano.recovery });
        Object.assign(atq, { preparoSeg: plano.windup, recargaSeg: plano.recovery, clipe: plano.clip });
      }
      iniciarAtaque(a, rival, atq, mundo);
      if (plano) marcarAtaqueManualPve2(a, plano);
      a.energia = Math.max(0, a.energia - atq.energia * (1 + a.especie.custoEnergiaExtra));
      h.golpesDados++;
      return intencao('atacando', atq.nome, `${atq.nome} comandado em ${c.id}`, { alvo: alvoDe(c), ritmo: 'parado', olharPara: { x: c.x, y: c.y } });
    }
  }
  if (cmd.frente || cmd.tras || cmd.esquerda || cmd.direita) {
    const ang = atan2(c.y - a.y, c.x - a.x);
    const fx = (cmd.frente ? 1 : 0) - (cmd.tras ? 1 : 0), fy = (cmd.direita ? 1 : 0) - (cmd.esquerda ? 1 : 0);
    const destino = { x: a.x + (cos(ang) * fx - sen(ang) * fy) * 3, y: a.y + (sen(ang) * fx + cos(ang) * fy) * 3 };
    // PvE v02: com Shift o jogador corre de fato. Na orientação de combate o teto era a velocidade de andar, e
    // os clipes de trote e corrida do rig v13 nunca apareciam. O corte por desalinhamento continua valendo, então
    // recuar e andar de lado seguem no passo lento. Sem o modo experimental, o teto é o de antes.
    const velMax = cmd.correr && pve2Ligado() ? a.especie.movimento.corrida : undefined;
    return intencao('deslocando', 'manual', 'movimento comandado', { orientacaoCombate:!!mundo.opcoes.tatica, alvo: alvoDe(c), destino, ritmo: cmd.correr ? 'corrida' : 'andar', velMax, olharPara: { x: c.x, y: c.y } });
  }
  return intencao('medindo', 'manual_parado', 'aguardando comando', { alvo: alvoDe(c), ritmo: 'parado', olharPara: { x: c.x, y: c.y } });
}

// Onde o golpe pega. Com altura de impacto fixa por ataque, a região sai sempre a mesma: no primeiro duelo
// TODOS os golpes caíram na cabeça e o atordoamento decidia a luta sozinho. A altura real varia a cada golpe —
// guarda, passo, terreno, desvio do adversário — e a disciplina do Hunter reduz essa dispersão.
// `rngCombate` é o mesmo RNG que o núcleo usa para esquiva: a variação continua reprodutível pela semente.
function mirar(a, atq) {
  const base = a.hunter.alturaBase ?? (a.hunter.alturaBase = Object.fromEntries(
    Object.entries(a.especie.anatomia.ataques).map(([k, v]) => [k, v.alturaImpacto])));
  const dispersao = 0.3 * (1 - a.hunter.personalidade.disciplina * 0.5) * (2 - fatorBracos(a));
  a.especie.anatomia.ataques[atq.nome].alturaImpacto = base[atq.nome] + a.rngCombate.entre(-dispersao, dispersao);
}

// Pesado quando compensa: energia sobrando e rival exposto (caído, atordoado, desequilibrado ou sem reagir).
// Leve quando o Hunter está cansado ou cauteloso. A escolha geométrica final continua sendo do núcleo.
function escolherComPeso(a, rival, d, contato, mundo) {
  const h = a.hunter, p = h.personalidade;
  const t = mundo.t;
  const exposto = mundo.opcoes.tatica?['recuperacao','caido','desequilibrado'].includes(contato.signal):rival.saude.caidoAte > t || rival.saude.atordoadoAte > t || rival.saude.desequilibradoAte > t;
  const querPesado = (h.controle==='manual'&&h.comando?.pesado) || (exposto || p.agressividade > 0.65) && a.energia > 35 && fatorBracos(a) > 0.6;
  const todos = h.todosAtaques ?? (h.todosAtaques = a.especie.combate.ataques);
  const permitidos = todos.filter((x) => (h.controle==='manual'&&h.comando?.pesado?x.peso==='pesado':querPesado?true:x.peso==='leve') && a.energia >= x.energia);
  if (!permitidos.length) return null;
  a.especie.combate.ataques = permitidos;
  const escolhido = escolherAtaque(a, rival, d, mundo.opcoes.tatica?false:!rival.memoria.criaturas.has(a.id));
  a.especie.combate.ataques = todos;
  return escolhido;
}

const alcanceMaior = (a) => Math.max(...(a.hunter.todosAtaques ?? a.especie.combate.ataques).map((x) => x.alcance));

// Ponto a `dist` metros do rival, na linha que o Hunter já ocupa: fechar a distância sem atravessar o corpo.
function pontoA(a, c, dist) {
  const ang = atan2(a.y - c.y, a.x - c.x);
  return { x: c.x + cos(ang) * dist, y: c.y + sen(ang) * dist };
}

function afastar(a, c, dist) {
  const ang = atan2(a.y - c.y, a.x - c.x);
  return { x: a.x + cos(ang) * dist, y: a.y + sen(ang) * dist };
}


// Velocidade de fuga comparada à do rival: fugir de quem corre mais é pior que recuar protegido.
const velocidadeRelativa = (a, rival) =>
  a.especie.movimento.corrida * fatorMobilidade(a) - rival.especie.movimento.corrida * fatorMobilidade(rival);

function combateTatico(a,c,rival,mundo){
 const h=a.hunter,p=h.personalidade,atqs=h.todosAtaques??a.especie.combate.ataques;
 const best=atqs.filter(x=>x.peso==='leve').map(x=>({x,p:perfilGolpe(a,x)})).sort((x,y)=>y.p.alcance-x.p.alcance)[0];
 if(!best)return intencao('vigiando','sem_arma','sem ataque configurado');
 const s=a.tatica??={};s.enabled=true;
 const plan=planejarTatica(a,c,mundo,{reach:best.p.alcance,windup:best.p.preparo,energy:best.x.energia},{aggression:p.agressividade,courage:a.temperamento.coragem});
 const prep=c.signal==='preparo';if(!prep)h.reacaoDesde=null;else h.reacaoDesde??=mundo.t;
 const reage=prep&&!a.golpe&&mundo.t-h.reacaoDesde>.22+(1-p.disciplina)*.15&&mundo.t>(h.proximaDefesa??0);
 if(reage){h.proximaDefesa=mundo.t+1;h.blockUntil=mundo.t+.45;h.bloqueios++;}
 aplicarPostura(a,h.blockUntil>mundo.t?'defesa':'neutra');
 if(plan.attack){const atq=escolherComPeso(a,rival,c.distancia,c,mundo);if(atq){mirar(a,atq);if(!rival.hunter&&!rival.conflito&&!a.conflito)abrirConflito(mundo,a,rival,'ataque_hunter',null);iniciarAtaque(a,rival,atq,mundo);a.energia=Math.max(0,a.energia-atq.energia*(1+a.especie.custoEnergiaExtra));h.golpesDados++;plan.intent.estado='preparando_ataque';plan.intent.destino=null;plan.intent.ritmo='parado';}}
 return plan.intent;
}

// Criatura hostil: a que o Hunter já viu atacar, a que o persegue, ou a grande o bastante para ser ameaça.
function ameacaCriatura(a, c, o) {
  if (o.conflito?.rival === a.id || o.golpe?.alvo === a.id) return true;
  if (a.mente.atingidoPor?.id === c.id) return true;
  return (c.massaEstimada ?? (o.especie.corpo.massaKg[0]+o.especie.corpo.massaKg[1])/2) > a.massa * 0.55 && o.especie.papel === 'carnivoro' && c.distancia < 40;
}

// Sem inimigo à vista: recupera fôlego, trata-se e volta ao posto.
function semInimigo(a, mundo) {
  const h = a.hunter;
  h.alvoId = null;
  aplicarPostura(a, 'neutra');
  if (h.ordem?.tipo === 'ir' && hipot(a.x - h.ordem.x, a.y - h.ordem.y) > 1.5) {
    h.situacao = 'deslocando';
    return intencao('deslocando', 'ordem', `ordem: ir a (${h.ordem.x.toFixed(0)}, ${h.ordem.y.toFixed(0)})`, { destino: { x: h.ordem.x, y: h.ordem.y }, ritmo: h.ordem.ritmo ?? 'trote' });
  }
  const pista=h.jogador?.lastContact,mem=pista&&a.memoria.criaturas.get(pista.id),last=mem&&mem.t>pista.t?mem:pista;
  if(mundo.opcoes.combateJogador!==false&&last&&mundo.t-last.t<6&&vigor(a)>.3&&a.energia>15){const d=hipot(last.x-a.x,last.y-a.y);return intencao('investigando','ultima_abertura','procurando o rival na última posição percebida',{destino:d>1.3?{x:last.x,y:last.y}:null,ritmo:'andar',orientacaoCombate:true,olharPara:{x:last.x,y:last.y}});}
  if (a.energia < 70 || a.saude.ferimentos.length) {
    h.situacao = 'recuperando';
    return intencao('descansando', 'recuperar', `recuperando (energia ${a.energia.toFixed(0)}, ${a.saude.ferimentos.length} ferimentos)`);
  }
  h.situacao = 'pronto';
  if (a.casa && hipot(a.x - a.casa.x, a.y - a.casa.y) > a.casa.raio) {
    return intencao('deslocando', 'voltar', 'voltando ao ponto de partida', { destino: { x: a.casa.x, y: a.casa.y }, ritmo: 'andar' });
  }
  return intencao('vigiando', 'vigia', 'sem inimigo à vista');
}
