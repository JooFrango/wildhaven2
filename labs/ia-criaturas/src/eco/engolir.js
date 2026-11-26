// Engolir a presa inteira (experimental). Só quem declara `engolirInteira { massaMaxFracao, alturaMaxM,
// segundos, saciaPorKg, digestaoSeg }`. O limite é anatômico — massa e altura do corpo da presa —, não uma
// decisão. A presa precisa estar incapacitada: paralisada pelo veneno, caída ou quase morta.
// Engolida não vira carcaça: a biomassa entra no predador e o ciclo da carcaça não tem o que reciclar.
import { intensidadeVeneno } from './veneno.js';
import { incapacitado } from './saude.js';

export function podeEngolir(a, presa) {
  const cfg = a.especie.engolirInteira;
  if (!cfg) return { ok: false, motivo: 'sem_capacidade' };
  if (presa.massa > a.massa * cfg.massaMaxFracao) return { ok: false, motivo: 'massa_acima_do_limite' };
  if (presa.especie.corpo.alturaM * presa.escala > cfg.alturaMaxM) return { ok: false, motivo: 'corpo_largo_demais' };
  return { ok: true };
}

// Rendida o bastante para ser engolida sem luta: parada pela paralisia, caída ou incapacitada.
export function incapacitadoParaEngolir(p, t) {
  if (!p.vivo) return true;
  if (p.saude.caidoAte > t) return true;
  if (incapacitado(p)) return true;
  return intensidadeVeneno(p, t, 'neurotoxico') >= 0.6 && p.velocidade < 0.5;
}

export function avancarEngolir(mundo, a, dt) {
  const cfg = a.especie.engolirInteira;
  const p = mundo.porId.get(a.mente.engolindo) ?? mundo.mortos.get(a.mente.engolindo);
  if (!cfg || !p) { a.mente.engolindo = null; return; }
  a.mente.engolirProgresso = (a.mente.engolirProgresso ?? 0) + dt / cfg.segundos;
  // A presa é arrastada para a boca enquanto desce: não fica parada a dois metros do predador.
  p.x += (a.x - p.x) * Math.min(1, dt * 0.8); p.y += (a.y - p.y) * Math.min(1, dt * 0.8);
  if (a.mente.engolirProgresso < 1) return;
  const kg = p.massa;
  if (p.vivo) mundo.matar(p, 'engolida', a.id);
  // A carcaça criada pela morte some: o corpo está dentro do predador.
  mundo.carcacas = mundo.carcacas.filter((c) => c.animal !== p.id);
  a.fome = Math.max(-80, a.fome - kg * cfg.saciaPorKg);
  a.mente.digerindoAte = mundo.t + cfg.digestaoSeg;
  a.mente.engolindo = null; a.mente.engolirProgresso = 0;
  a.engoliu = (a.engoliu ?? 0) + 1; a.kgEngolidos = (a.kgEngolidos ?? 0) + kg;
  mundo.metricas.engolidas = (mundo.metricas.engolidas ?? 0) + 1;
  mundo.evento('engolir_fim', a.id, { presa: p.id, massaKg: +kg.toFixed(1), fome: +a.fome.toFixed(1), digestaoSeg: cfg.digestaoSeg });
}
