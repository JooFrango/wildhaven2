// Hunter: humano dentro do ecossistema das criaturas.
//
// Decisão de arquitetura: o Hunter NÃO tem um simulador próprio. Ele entra como uma espécie do laboratório de
// criaturas, então percepção, colisão, cápsulas, alcance de golpe, região atingida, ferimento, sangramento,
// fratura, dor, atordoamento, desequilíbrio, queda e morte vêm todos do núcleo já testado — e os animais o
// percebem como entidade física válida sem nenhuma integração extra. Esta camada acrescenta só o que é humano:
// equipamento, postura, fadiga de combate, rendição e PvP.
//
// Equipamento vira ficha: cada Hunter recebe uma CÓPIA da ficha da espécie com os ataques, a proteção e a
// mobilidade do que está carregando. Nenhum módulo do núcleo precisa saber o que é uma lança.
import { fatorMobilidade, incapacitado } from '../../ia-criaturas/src/eco/saude.js';

export const REGIOES_HUMANAS = ['cabeca', 'pescoco', 'torax', 'abdomen', 'bracos', 'pernas'];

// Personalidade do Hunter (0..1). Não repete o temperamento da espécie: são eixos de decisão de combate.
export const PERSONALIDADE_PADRAO = { agressividade: 0.5, cautela: 0.5, disciplina: 0.5, orgulho: 0.5 };

function clonar(o) {
  if (Array.isArray(o)) return o.map(clonar);
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = clonar(o[k]); return r; }
  return o;
}

// Ficha individual: base + arma + escudo + armadura. O resultado é uma ficha de espécie completa e válida,
// com o mesmo `id`, então tudo que indexa espécie por id continua funcionando.
export function montarFicha(base, equipCfg, equip = {}) {
  const f = clonar(base);
  const arma = equipCfg.armas[equip.arma ?? 'maos'];
  if (!arma) throw new Error(`arma desconhecida: ${equip.arma}`);
  const escudo = equip.escudo ? equipCfg.escudos[equip.escudo] : null;
  if (equip.escudo && !escudo) throw new Error(`escudo desconhecido: ${equip.escudo}`);
  const armadura = equip.armadura ? equipCfg.armaduras[equip.armadura] : null;
  if (equip.armadura && !armadura) throw new Error(`armadura desconhecida: ${equip.armadura}`);
  // A lâmina mantém comprimento físico; escudo cobra mobilidade/energia, não encurta a arma.

  f.combate.ataques = [];
  f.anatomia.ataques = {};
  for (const peso of ['leve', 'pesado']) {
    const d = arma.ataques[peso];
    const nome = `golpe_${d.tipoDano}_${peso}`;
    const alcance = arma.alcanceM;
    f.combate.ataques.push({
      nome, alcance, dano: d.dano, preparoSeg: d.preparoSeg, recargaSeg: d.recargaSeg,
      regioes: [...d.regioes], clipe: `attack_${peso === 'leve' ? 'light' : 'heavy'}`,
      tipoDano: d.tipoDano, energia: d.energia, peso,
    });
    f.anatomia.ataques[nome] = { alcance, tImpacto: d.preparoSeg, duracao: d.preparoSeg * 2, alturaImpacto: d.alturaImpactoM };
  }

  // Golpe curto de mão livre, sempre disponível. Sem ele, quem carrega arma longa fica desarmado de perto: a
  // 0,6 m a lâmina passa do corpo e o núcleo rejeita o golpe — o Hunter recuava em vez de lutar. É também o
  // que acontece de verdade: encostou, usa punho, cotovelo ou o cabo.
  if ((equip.arma ?? 'maos') !== 'maos') {
    const d = equipCfg.armas.maos.ataques.leve;
    const nome = 'golpe_curto';
    f.combate.ataques.push({
      nome, alcance: equipCfg.armas.maos.alcanceM, dano: d.dano * 0.8, preparoSeg: d.preparoSeg, recargaSeg: d.recargaSeg,
      regioes: [...d.regioes], clipe: 'attack_light', tipoDano: d.tipoDano, energia: d.energia, peso: 'leve',
    });
    f.anatomia.ataques[nome] = { alcance: equipCfg.armas.maos.alcanceM, tImpacto: d.preparoSeg, duracao: d.preparoSeg * 2, alturaImpacto: d.alturaImpactoM };
  }

  for (const r of REGIOES_HUMANAS) f.combate.protecao[r] = Math.min(0.9, (armadura?.protecao?.[r] ?? 0));
  // Penalidades somam: uma armadura pesada com escudo é lenta de verdade.
  const penV = (armadura?.penalidadeVelocidade ?? 0) + (escudo?.penalidadeVelocidade ?? 0);
  const penE = (armadura?.penalidadeEsquiva ?? 0) + (escudo?.penalidadeEsquiva ?? 0);
  for (const k of ['andar', 'trote', 'corrida']) f.movimento[k] = +(f.movimento[k] * (1 - penV)).toFixed(3);
  f.movimento.aceleracao = +(f.movimento.aceleracao * (1 - penV)).toFixed(3);
  f.combate.esquiva = +Math.max(0.05, f.combate.esquiva * (1 - penE)).toFixed(4);
  f.pesoCarregadoKg = +((arma.pesoKg ?? 0) + (escudo?.pesoKg ?? 0) + (armadura?.pesoKg ?? 0)).toFixed(2);
  f.custoEnergiaExtra = (armadura?.custoEnergiaExtra ?? 0) + (escudo ? 0.1 : 0);
  // Quanto o bloqueio aproveita: arma que apara + escudo.
  f.bloqueioMax = Math.min(0.85, (arma.bloqueia ?? 0) + (escudo?.bloqueia ?? 0));
  f.equipamento = { arma: equip.arma ?? 'maos', escudo: equip.escudo ?? null, armadura: equip.armadura ?? null };
  return f;
}

// Cria o Hunter no mundo. `mundo.criarAnimal` é a API pública do laboratório de criaturas.
export function criarHunter(mundo, ficha, o = {}) {
  const a = mundo.criarAnimal(ficha, {
    id: o.id, x: o.x, y: o.y, direcaoGraus: o.direcaoGraus ?? 0, sexo: 'M',
    idadeDias: Math.round((o.idadeAnos ?? 28) * 365), fome: o.fome ?? 20, sede: o.sede ?? 20, energia: o.energia ?? 100,
    massaKg: o.massaKg, ferimentos: o.ferimentos, hpFracao: o.hpFracao,
  });
  a.casa = { x: a.x, y: a.y, raio: 60 };
  // Hunter acompanhado nunca é rebaixado de nível: trocar de câmera não pode encerrar uma luta (ver niveis.js).
  a.nivelFixo = true;
  a.hunter = {
    nome: o.nome ?? a.id,
    habilidade: Math.max(0,Math.min(1,o.habilidade??.65)),
    equipe: o.equipe ?? a.id,
    controle: o.controle ?? 'ia',
    modo: o.modo ?? 'treino',
    personalidade: { ...PERSONALIDADE_PADRAO, ...(o.personalidade ?? {}) },
    equipamento: ficha.equipamento,
    postura: 'neutra',
    situacao: 'pronto',
    alvoId: null,
    ordem: null,
    golpesDados: 0, golpesRecebidos: 0, bloqueios: 0,
    desde: mundo.t,
    // Valores de referência da ficha equipada: a postura mexe neles e precisa saber ao que voltar.
    base: { esquiva: ficha.combate.esquiva, defesa: ficha.combate.defesa, protecao: { ...ficha.combate.protecao } },
  };
  (mundo.hunters ??= []).push(a);
  a.comandoTeste = null; // instalado por mundo-hunters.js: a decisão é desta camada, não do cérebro animal
  return a;
}

// Braço ferido atrapalha a arma: alcance não muda, mas a força do golpe e a chance de bloquear caem.
export function fatorBracos(a) {
  let f = 1;
  for (const fer of a.saude.ferimentos) if (fer.regiao === 'bracos') f *= fer.fratura ? 0.35 : 1 - fer.gravidade * 0.7;
  return Math.max(0.1, f);
}

// Postura: altera de verdade proteção, esquiva e defesa da ficha individual. Como `ferir()` e `resolverGolpe()`
// leem esses números no instante do impacto, bloquear e esquivar têm efeito mecânico sem tocar no núcleo.
export function aplicarPostura(a, postura) {
  const h = a.hunter, b = h.base, c = a.especie.combate;
  h.postura = postura;
  const bracos = fatorBracos(a);
  if (postura === 'defesa') {
    const bloq = a.especie.bloqueioMax * bracos;
    for (const r of REGIOES_HUMANAS) c.protecao[r] = Math.min(0.95, b.protecao[r] + bloq * (r === 'pernas' ? 0.4 : 1));
    c.esquiva = b.esquiva * 0.45;
    c.defesa = Math.min(0.95, b.defesa + 0.35);
  } else if (postura === 'comprometida') {
    for (const r of REGIOES_HUMANAS) c.protecao[r] = b.protecao[r];
    c.esquiva = 0; c.defesa = b.defesa;
  } else if (postura === 'esquiva') {
    for (const r of REGIOES_HUMANAS) c.protecao[r] = b.protecao[r];
    c.esquiva = Math.min(0.95, b.esquiva * 1.5);
    c.defesa = b.defesa;
  } else {
    for (const r of REGIOES_HUMANAS) c.protecao[r] = b.protecao[r];
    c.esquiva = b.esquiva;
    c.defesa = b.defesa;
  }
}

export const aliado = (a, b) => !!a.hunter && !!b.hunter && a.hunter.equipe === b.hunter.equipe;
export const foraDeCombate = (a) => !a.vivo || a.hunter.situacao === 'rendido' || a.hunter.situacao === 'incapacitado';

// Situação física do Hunter, reavaliada todo passo. `incapacitado` é a regra do núcleo (vida baixa ou
// mobilidade destruída); rendição é decisão humana e entra em cerebro-hunter.js.
export function atualizarSituacao(a, mundo) {
  const h = a.hunter;
  if (!a.vivo) { h.situacao = 'morto'; return; }
  if (h.situacao === 'rendido') return;
  if (incapacitado(a)) {
    if (h.situacao !== 'incapacitado') {
      h.situacao = 'incapacitado';
      mundo.evento('hunter_incapacitado', a.id, { hp: +a.saude.hp.toFixed(1), mobilidade: +fatorMobilidade(a).toFixed(2) });
    }
    return;
  }
  if (h.situacao === 'incapacitado') h.situacao = 'pronto'; // estabilizou (sangramento parou, dor caiu)
}
