// Camuflagem óptica ativa (V7, experimental). Reduz SÓ a detecção visual; o corpo continua colidindo, fazendo
// barulho, cheirando, vibrando e emitindo calor. Custa energia por segundo e quebra ao atacar.
// Ficha: especie.camuflagemAtiva { reducaoVisual, custoPorSeg, custoExtraCorridaPorSeg, energiaMin,
// energiaReativar, recargaSeg, transicaoSeg }.
import { sangrando } from './saude.js';

// Estados em que vale a pena pagar: aproximação furtiva e espera. Correr anula o efeito e aumenta o custo.
const ESTADOS_UTEIS = new Set(['espreitando', 'investigando', 'acompanhando_presa', 'emboscado', 'indo_emboscada']);

export function estadoCamuflagem(a) {
  if (a.especie.camuflagemAtiva) a.camuflagem = { ligada: false, intensidade: 0, bloqueadaAte: 0, energiaGasta: 0, ativacoes: 0, forcar: null, motivo: 'desligada' };
}

export function atualizarCamuflagem(a, mundo, dt) {
  const c = a.camuflagem, cfg = a.especie.camuflagemAtiva;
  if (!c) return;
  const t = mundo.t;
  // `forcar` é o controle do laboratório (true/false); null deixa o animal decidir.
  let quer = c.forcar ?? ESTADOS_UTEIS.has(a.estado), motivo = quer ? 'aproximação furtiva' : 'sem uso';
  // Atacar denuncia o corpo: desliga e entra em recarga.
  if (a.golpe && c.ligada) { c.bloqueadaAte = t + cfg.recargaSeg; mundo.evento('camuflagem_quebrou', a.id, { motivo: 'ataque' }); }
  if (t < c.bloqueadaAte) { quer = false; motivo = `recarga ${(c.bloqueadaAte - t).toFixed(0)} s`; }
  // Energia: desliga abaixo do mínimo e só religa acima do limiar de reativação (histerese).
  if (a.energia <= cfg.energiaMin) {
    if (c.ligada) { c.bloqueadaAte = t + cfg.recargaSeg; mundo.evento('camuflagem_quebrou', a.id, { motivo: 'energia' }); }
    quer = false; motivo = 'energia insuficiente';
  } else if (!c.ligada && a.energia < cfg.energiaReativar) { quer = false; motivo = 'poupando energia'; }
  if (quer && !c.ligada) { c.ativacoes++; mundo.evento('camuflagem_ligou', a.id, { energia: +a.energia.toFixed(1) }); }
  c.ligada = quer; c.motivo = motivo;
  const passo = dt / (cfg.transicaoSeg ?? 1.5);
  c.intensidade = Math.max(0, Math.min(1, c.intensidade + (quer ? passo : -passo * 2)));
  if (c.intensidade > 0) {
    const frac = Math.min(1, a.velocidade / a.especie.movimento.corrida);
    const custo = (cfg.custoPorSeg + (cfg.custoExtraCorridaPorSeg ?? 0) * frac) * c.intensidade * dt;
    a.energia = Math.max(0, a.energia - custo); c.energiaGasta += custo;
  }
}

// Fração da visibilidade que sobra (1 = sem efeito). Movimento rápido ondula o contorno; sangue denuncia.
export function fatorVisualCamuflagem(alvo) {
  const c = alvo.camuflagem;
  if (!c || c.intensidade <= 0) return 1;
  const frac = Math.min(1, alvo.velocidade / alvo.especie.movimento.corrida);
  return 1 - alvo.especie.camuflagemAtiva.reducaoVisual * c.intensidade * (1 - 0.75 * frac) * (sangrando(alvo) ? 0.5 : 1);
}
