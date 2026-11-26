// Percepção: visão (cone + alcance + linha de visão), visão próxima 360° e audição baseada no ruído do movimento.
// A saída daqui (contatos + memória) é a ÚNICA fonte de informação que os cérebros recebem sobre outras criaturas.
import { atan2, cos, sen } from './matematica.js';
import { distancia, normalizarAngulo, segmentoCruzaRetangulo } from './geometria.js';

export function linhaDeVisaoLivre(a, b, obstaculos) {
  for (const o of obstaculos) {
    if (o.bloqueiaVisao && segmentoCruzaRetangulo(a.x, a.y, b.x, b.y, o)) return false;
  }
  return true;
}

// Alcances efetivos com modificadores por estado (ex.: comendo reduz a atenção).
export function alcancesEfetivos(c) {
  const p = c.especie.percepcao;
  const mod = (p.modificadoresPorEstado && p.modificadoresPorEstado[c.estado]) || {};
  return {
    visao: p.visao.alcance * (mod.visao ?? 1),
    angulo: (p.visao.anguloGraus * Math.PI) / 180,
    proximo: p.visao.alcanceProximo ?? 0,
    audicao: p.audicao.alcance * (mod.audicao ?? 1),
  };
}

// Cada obstáculo atravessado multiplica o alcance auditivo por `atenuacaoSom` (padrão: rocha 0.4, moita 0.85).
export function atenuacaoSonora(a, b, obstaculos) {
  let f = 1;
  for (const o of obstaculos) {
    if (segmentoCruzaRetangulo(a.x, a.y, b.x, b.y, o)) f *= o.atenuacaoSom ?? (o.bloqueiaMovimento ? 0.4 : 0.85);
  }
  return f;
}

export function ruidoDe(outro) {
  const vmax = outro.especie.movimento.corrida;
  return vmax > 0 ? Math.min(1, outro.velocidade / vmax) : 0;
}

// Quão visível o alvo está para o observador (0..1): camuflagem da espécie, imobilidade
// e vegetação que oculta sem bloquear (obstáculos com `ocultacao` e bloqueiaVisao=false) na linha entre os dois.
export function fatorVisibilidade(observador, alvo, obstaculos) {
  const f = alvo.especie.furtividade ?? {};
  let v = 1 - (f.camuflagem ?? 0);
  if (alvo.velocidade < 0.2) v *= f.fatorParado ?? 1;
  for (const o of obstaculos) {
    if (!o.bloqueiaVisao && o.ocultacao && segmentoCruzaRetangulo(observador.x, observador.y, alvo.x, alvo.y, o)) v *= 1 - o.ocultacao;
  }
  return v;
}

// Percepção com reconhecimento gradual: ver algo no limite do alcance efetivo exige olhar por um tempo
// (`visao.tempoReconhecimentoSeg`); perto, o reconhecimento é rápido. A atenção acumulada fica em c.atencao.
// Também registra em c.ocultos os alvos que estavam no alcance de visão "nominal" mas não foram vistos, e por quê.
export function perceberCriaturas(c, criaturas, obstaculos, dt = 0.1) {
  const a = alcancesEfetivos(c);
  const tRec = c.especie.percepcao.visao.tempoReconhecimentoSeg ?? 0;
  const contatos = [];
  c.ocultos = [];
  c.atencao ??= new Map();
  for (const outro of criaturas) {
    if (outro === c || !outro.vivo) continue;
    const d = distancia(c, outro);
    const anterior = c.atencao.get(outro.id) ?? 0;
    if (d > Math.max(a.visao, a.audicao, a.proximo)) { decair(c, outro.id, anterior, tRec, dt); continue; }
    const angulo = atan2(outro.y - c.y, outro.x - c.x);
    const desvio = Math.abs(normalizarAngulo(angulo - c.direcao));
    const emCone = desvio <= a.angulo / 2;
    const los = linhaDeVisaoLivre(c, outro, obstaculos);
    const alcanceEf = a.visao * fatorVisibilidade(c, outro, obstaculos);
    let visto = false;
    if (los && d <= a.proximo) {
      c.atencao.set(outro.id, 1); visto = true;
    } else if (los && emCone && d <= alcanceEf) {
      const ganho = tRec > 0 ? (dt / tRec) * (1 + 2 * (1 - d / alcanceEf)) : 1;
      const at = Math.min(1, anterior + ganho);
      c.atencao.set(outro.id, at);
      visto = at >= 1;
    } else if (los && emCone && anterior >= 1 && d <= alcanceEf * 1.15) {
      visto = true; // histerese: já reconhecido, não perde por oscilar na borda
    } else {
      decair(c, outro.id, anterior, tRec, dt);
    }
    if (visto) {
      contatos.push({
        id: outro.id, especie: outro.especie.id, via: 'visao', distancia: d,
        x: outro.x, y: outro.y, velocidade: outro.velocidade, direcao: outro.direcao,
      });
      continue;
    }
    if (d <= a.visao) {
      const motivo = !los ? 'sem_linha_de_visao' : !emCone ? 'fora_do_cone' : d > alcanceEf ? 'camuflagem_cobertura' : 'reconhecendo';
      c.ocultos.push({ id: outro.id, distancia: d, motivo, atencao: c.atencao.get(outro.id) ?? 0 });
    }
    // Audição: alcance proporcional ao ruído (velocidade relativa à corrida), abafado por obstáculos no caminho.
    const passos = outro.especie.furtividade?.ruidoPassos ?? 1;
    const alcanceOuvido = a.audicao * ruidoDe(outro) * passos * atenuacaoSonora(c, outro, obstaculos);
    if (d <= alcanceOuvido) {
      const erro = (c.especie.percepcao.audicao.erroRelativo ?? 0.15) * d;
      const ang = c.rng.entre(-Math.PI, Math.PI);
      const r = c.rng.entre(0, erro);
      contatos.push({
        id: outro.id, especie: outro.especie.id, via: 'audicao', distancia: d,
        x: outro.x + cos(ang) * r, y: outro.y + sen(ang) * r,
        velocidade: null, direcao: null,
      });
    }
  }
  return contatos;
}

// Sem visão do alvo: a atenção cai (mais devagar do que sobe). Um alvo já reconhecido volta a ser
// reconhecido mais rápido logo depois de sumir.
function decair(c, id, anterior, tRec, dt) {
  if (anterior <= 0) return;
  const base = Math.min(anterior, 0.8);
  const novo = Math.max(0, base - (tRec > 0 ? dt / (tRec * 3) : 1));
  if (novo > 0) c.atencao.set(id, novo); else c.atencao.delete(id);
}

// Alimento: percebido por visão (sem restrição de cone; o animal olha em volta ao procurar) e linha de visão.
export function perceberAlimentos(c, alimentos, obstaculos) {
  const a = alcancesEfetivos(c);
  const vistos = [];
  for (const f of alimentos) {
    const d = distancia(c, f);
    if (d <= a.visao && (d <= f.raio || linhaDeVisaoLivre(c, f, obstaculos))) {
      vistos.push({ id: f.id, tipo: f.tipo, x: f.x, y: f.y, raio: f.raio, quantidade: f.quantidade, distancia: d });
    }
  }
  return vistos;
}

export function atualizarMemoria(c, contatos, alimentosVistos, t) {
  const dur = c.especie.percepcao.memoriaSeg;
  for (const k of contatos) {
    c.memoria.criaturas.set(k.id, { id: k.id, especie: k.especie, x: k.x, y: k.y, t, via: k.via });
  }
  for (const f of alimentosVistos) {
    c.memoria.alimentos.set(f.id, { id: f.id, tipo: f.tipo, x: f.x, y: f.y, raio: f.raio, quantidade: f.quantidade, t });
  }
  for (const [id, m] of c.memoria.criaturas) if (t - m.t > dur) c.memoria.criaturas.delete(id);
  // Alimento é lembrado por mais tempo (local fixo); some quando esgotado for observado.
  for (const [id, m] of c.memoria.alimentos) if (m.quantidade <= 0.5 || t - m.t > dur * 10) c.memoria.alimentos.delete(id);
}
