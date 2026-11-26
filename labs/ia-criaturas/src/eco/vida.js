// Ciclo de vida diário (vale para todos os níveis de simulação): idade, condição, reprodução, nascimentos,
// crescimento, dispersão, morte natural, fome/sede extremas e saúde. Cada (animal, dia) é processado UMA vez
// (ledger `dia:<id>:<n>`), com sorteios chaveados — trocar de nível não duplica nem altera eventos.
import { Rng, derivarSemente } from './rng.js';
import { processarSaudeDia } from './saude.js';

export function processarDia(mundo, a, dia) {
  const chave = `dia:${a.id}:${dia}`;
  if (!a.vivo || mundo.ledger.has(chave)) return;
  mundo.ledger.add(chave);
  const rng = new Rng(derivarSemente(mundo.semente, chave));
  const e = a.especie, v = e.vida;
  a.idadeDias++;
  a.idadeAnos = a.idadeDias / 365;
  // Crescimento de filhotes.
  if (a.juvenil) {
    a.crescimento = Math.min(1, a.idadeAnos / v.crescimentoAnos);
    a.escala = 0.35 + 0.65 * a.crescimento;
    a.massa = a.massaAdulta * (0.15 + 0.85 * a.crescimento);
    if (a.idadeAnos >= v.maturidadeAnos) { a.juvenil = false; a.escala = 1; mundo.evento('maturidade', a.id, {}); dispersar(mundo, a, rng); }
  }
  // Fome/sede extremas.
  if (a.fome >= 99.5) a.diasFome++; else a.diasFome = 0;
  if (a.sede >= 99.5) a.diasSede++; else a.diasSede = 0;
  if (a.diasSede >= 3) return mundo.matar(a, 'sede');
  if (a.diasFome >= (e.papel === 'carnivoro' ? 12 : 7)) return mundo.matar(a, 'fome');
  if (a.fome >= 99.5) a.saude.hp -= a.saude.hpMax * 0.08;
  // Saúde (cicatrização, infecções, doenças).
  for (const ev of processarSaudeDia(a, rng, dia, mundo.doencas)) mundo.evento(ev.tipo, a.id, ev);
  if (a.saude.hp <= 0) return mundo.matar(a, a.saude.doencas.length ? 'doenca' : a.saude.ferimentos.some((f) => f.infeccao > 0) ? 'infeccao' : 'ferimentos');
  // Senescência e morte natural (risco cresce após 80% da expectativa).
  const rel = a.idadeAnos / v.expectativaAnos;
  if (rel > 0.8) {
    const risco = 0.0004 * Math.max(1, (rel - 0.8) * 40) * (rel > 1 ? 1 + (rel - 1) * 30 : 1);
    if (rng.chance(risco)) return mundo.matar(a, 'velhice');
  }
  // Mortalidade juvenil natural (frio, quedas, desnutrição), baixa e maior com condição ruim.
  if (a.juvenil && rng.chance(0.0015 * (1 + a.fome / 50))) return mundo.matar(a, 'mortalidade_juvenil');
  // Reprodução.
  reproducao(mundo, a, dia, rng);
}

function condicao(a) {
  return (1 - a.fome / 100) * 0.4 + (1 - a.sede / 100) * 0.2 + (a.saude.hp / a.saude.hpMax) * 0.4;
}

function reproducao(mundo, a, dia, rng) {
  const e = a.especie, v = e.vida;
  // Parto/eclosão.
  if (a.gestacao && dia >= a.gestacao.fimDia) return nascer(mundo, a, a.gestacao, rng, dia);
  a.mente.receptiva = false;
  if (a.sexo !== 'F' || a.juvenil || a.gestacao || a.idadeAnos < v.maturidadeAnos) return;
  if (mundo.relogio.estacao !== v.estacaoReprodutiva) return;
  // Ainda amamentando/cuidando de filhotes pequenos.
  if (a.filhos.some((id) => { const f = mundo.porId.get(id); return f?.vivo && f.idadeDias < v.desmameDias; })) return;
  // Limite ecológico: condição corporal e densidade local da própria espécie (capacidade de suporte).
  const dens = mundo.densidadeLocal(a);
  const fert = Math.max(0, condicao(a) - 0.45) * 2 * Math.max(0, 1 - dens);
  if (fert <= 0) return;
  a.mente.receptiva = rng.chance(0.25 * fert + 0.05);
  if (!a.mente.receptiva) return;
  // Parceiro: o macho adulto conhecido mais dominante (L1: corte; níveis 2/3: escolha direta).
  const machos = mundo.vivos.filter((m) => m.especie.id === e.id && m.sexo === 'M' && !m.juvenil && m.idadeAnos >= v.maturidadeAnos && Math.abs(m.x - a.x) + Math.abs(m.y - a.y) < 160);
  if (!machos.length) return;
  const melhor = machos.sort((x, y) => y.massa * (y.saude.hp / y.saude.hpMax) - x.massa * (x.saude.hp / x.saude.hpMax) || x.numero - y.numero)[0];
  if (a.nivel === 1 && melhor.nivel === 1) { melhor.mente.parceiraAlvo = a.id; }
  else mundo.acasalar(a, melhor);
}

export function iniciarGestacao(mundo, fem, macho, dia) {
  const chave = `gest:${fem.id}:${dia}`;
  if (mundo.ledger.has(chave) || fem.gestacao) return false;
  mundo.ledger.add(chave);
  const rng = new Rng(derivarSemente(mundo.semente, chave));
  fem.gestacao = { paiId: macho.id, inicioDia: dia, fimDia: dia + Math.round(fem.especie.vida.gestacaoDias * rng.entre(0.95, 1.05)) };
  fem.mente.receptiva = false;
  mundo.evento(fem.especie.vida.ovos ? 'postura_agendada' : 'gestacao', fem.id, { pai: macho.id, previsto: fem.gestacao.fimDia });
  return true;
}

function nascer(mundo, mae, gest, rng, dia) {
  const chave = `nasc:${mae.id}:${gest.inicioDia}`;
  mae.gestacao = null;
  if (mundo.ledger.has(chave)) return;
  mundo.ledger.add(chave);
  const v = mae.especie.vida;
  const cond = condicao(mae);
  let n = rng.inteiro(v.ninhada[0], v.ninhada[1]);
  if (cond < 0.5) n = Math.max(1, n - 1);
  const pai = mundo.porId.get(gest.paiId) ?? mundo.mortos.get(gest.paiId) ?? mae;
  for (let i = 0; i < n; i++) {
    const f = mundo.criarAnimal(mae.especie, { x: mae.x + rng.entre(-1, 1), y: mae.y + rng.entre(-1, 1), idadeDias: 0, pais: [mae, pai], maeId: mae.id, paiId: pai.id, grupoId: mae.grupoId, sexo: rng.chance(0.5) ? 'F' : 'M' });
    f.casa = mae.casa ? { ...mae.casa } : { x: mae.x, y: mae.y, raio: 60 };
    mae.filhos.push(f.id);
    mundo.evento(v.ovos ? 'eclosao' : 'nascimento', f.id, { mae: mae.id, pai: pai.id });
  }
}

// Jovens que amadurecem podem deixar o grupo natal (machos principalmente).
function dispersar(mundo, a, rng) {
  if (!a.grupoId || a.especie.social.tipo !== 'bando') return;
  if (a.sexo === 'M' && rng.chance(0.6)) {
    const g = mundo.grupos.get(a.grupoId);
    if (g) g.membros = g.membros.filter((id) => id !== a.id);
    a.grupoId = null;
    a.casa = { x: a.x + rng.entre(-150, 150), y: a.y + rng.entre(-150, 150), raio: 60 };
    mundo.evento('dispersao', a.id, {});
    mundo.dispersos.push(a.id);
  }
}
