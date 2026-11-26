// Decisão de quem voa (V7). As necessidades continuam vindo do cérebro terrestre (`terrestre()`): este módulo
// decide só o MEIO — ficar no chão, decolar, seguir o bando, fugir pelo ar, pousar — a partir do que o animal
// percebe. Bando: regras locais por indivíduo (coesão, separação, alinhamento) sobre os vizinhos que ele vê;
// não existe entidade "bando" comandando posições.
import { atan2, cos, hipot, sen } from '../core/matematica.js';
import { localDePouso, noAr, podeDecolar } from './voo.js';
import { pedeAbrigo } from './clima.js';

const f1 = (v) => Number(v).toFixed(1);
// Necessidades que não justificam largar o bando: só deslocamento sem urgência.
const SEM_URGENCIA = new Set(['patrulhando', 'vagando', 'explorando', 'descansando', 'seguindo_grupo']);

export function decidirVoo(a, mundo, terrestre) {
  const v = a.voo, cfg = a.especie.voo, e = a.especie, t = mundo.t;
  const ameaca = a.contatos.filter((k) => k.especie && e.teme.includes(k.especie) && k.via !== 'som').sort((x, y) => x.distancia - y.distancia)[0];
  const vizinhos = a.contatos.filter((k) => k.via === 'visao' && k.especie === e.id);
  const noArViz = vizinhos.filter((k) => k.noAr);
  const voando = noAr(a);

  // ---- Ameaça: fuga pelo ar. Cada indivíduo escolhe o próprio desvio e a própria altitude (dispersão).
  if (ameaca && ameaca.distancia < cfg.distanciaFugaM && !(ameaca.noAr === false && v.alt > 12)) {
    const m = (a.mente.fugaVoo ??= { lado: a.rngMente.entre(-0.9, 0.9), alt: a.rngMente.entre(0.6, 1.5), desde: t });
    a.mente.fugiuEm = t;
    if (!voando && !podeDecolar(a, mundo).ok) return terrestre();
    const ang = atan2(a.y - ameaca.y, a.x - ameaca.x) + m.lado;
    if (!voando) mundo.som(a, 'alarme', 40, { sobre: ameaca.id });
    return { estado: 'fugindo_voo', codigo: 'fuga_aerea', motivo: `foge pelo ar de ${ameaca.especie} a ${f1(ameaca.distancia)} m`, alvo: { tipo: 'criatura', id: ameaca.id, x: ameaca.x, y: ameaca.y },
      destino: { x: a.x + cos(ang) * 60, y: a.y + sen(ang) * 60 }, ritmo: 'corrida', voar: true, altitude: cfg.altitudeCruzeiroM * m.alt };
  }
  if (a.mente.fugaVoo && t - (a.mente.fugiuEm ?? 0) > 6) a.mente.fugaVoo = null;

  // ---- Contágio: vizinho que decola em fuga leva junto quem está no chão (alarme visual, não telepatia).
  const alarme = a.contatos.find((k) => k.via === 'som' && k.som === 'alarme' && k.especie === e.id);
  if (!voando && (alarme || noArViz.some((k) => k.comportamento === 'fugindo' && k.distancia < 30)) && podeDecolar(a, mundo).ok) {
    const fonte = alarme ?? noArViz[0];
    const lado = (a.mente.fugaVoo ??= { lado: a.rngMente.entre(-0.9, 0.9), alt: a.rngMente.entre(0.6, 1.5), desde: t }).lado;
    a.mente.fugiuEm = t;
    const ang = atan2(a.y - fonte.y, a.x - fonte.x) + Math.PI * 0 + lado;
    return { estado: 'fugindo_voo', codigo: 'contagio_decolagem', motivo: 'vizinho deu alarme; decola', alvo: null, destino: { x: a.x + cos(ang) * 50, y: a.y + sen(ang) * 50 }, ritmo: 'corrida', voar: true, altitude: cfg.altitudeCruzeiroM * a.mente.fugaVoo.alt };
  }

  const base = terrestre();
  // Clima que cega e tira sustentação: quem está no ar desce; quem está no chão não decola por rotina.
  if (pedeAbrigo(mundo)) {
    if (!voando) return base;
    const p = localDePouso(mundo, a);
    if (!a.mente.pousouPorClima) { a.mente.pousouPorClima = true; mundo.evento('pouso_por_clima', a.id, { clima: mundo.climaAtivo.tipo, alt: +v.alt.toFixed(1) }); }
    if (p) return { estado: 'pousando', codigo: 'clima', motivo: `${mundo.climaAtivo.nome}: desce para se abrigar`, alvo: null, destino: p, ritmo: 'andar', voar: true, pousar: true };
  } else a.mente.pousouPorClima = false;
  // Estados físicos e de combate do núcleo passam direto.
  if (!voando && (base.acao || !base.destino)) return base;

  // ---- No chão com destino: voa se for longe o bastante e tiver energia; perto, anda.
  if (!voando) {
    const d = hipot(base.destino.x - a.x, base.destino.y - a.y);
    if (d < cfg.distanciaVoarM || a.energia < cfg.energiaMinDecolar + 10 || !podeDecolar(a, mundo).ok) return base;
    return { ...base, voar: true, altitude: cfg.altitudeCruzeiroM };
  }

  // ---- No ar.
  if (a.energia < cfg.energiaPousar) {
    const p = localDePouso(mundo, base.destino ?? a);
    if (p) return { estado: 'pousando', codigo: 'cansado', motivo: `energia ${f1(a.energia)}; pousa para descansar`, alvo: null, destino: p, ritmo: 'andar', voar: true, pousar: true };
  }
  const urgente = !SEM_URGENCIA.has(base.estado);
  if (base.destino && (urgente || !cfg.bando || !noArViz.length)) {
    const d = hipot(base.destino.x - a.x, base.destino.y - a.y);
    // Perto do destino: escolhe onde tocar o chão e desce.
    if (d < 25 + v.alt * 3) {
      const p = localDePouso(mundo, base.destino);
      if (p) return { ...base, estado: 'pousando', destino: p, voar: true, pousar: true, motivo: `${base.motivo}; aproxima para pousar` };
    }
    return { ...base, estado: urgente ? base.estado : 'voando', voar: true, altitude: cfg.altitudeCruzeiroM };
  }
  if (!base.destino && !noArViz.length) {
    // Quer agir aqui (comer, beber, descansar) e não há bando para seguir: pousa onde está.
    const p = localDePouso(mundo, a);
    if (p) return { ...base, estado: 'pousando', destino: p, voar: true, pousar: true };
  }

  // ---- Bando: três regras locais sobre os vizinhos vistos no ar.
  const b = cfg.bando ?? { raioM: 40, separacaoM: 5, coesao: 1, alinhamento: 1, separacao: 1.5 };
  let cx = 0, cy = 0, ax = 0, ay = 0, sx = 0, sy = 0, altMedia = 0, n = 0, empurraAlt = 0, muitoPerto = false;
  for (const k of noArViz) {
    if (k.distancia > b.raioM) continue;
    n++; cx += k.x; cy += k.y; ax += k.vx ?? 0; ay += k.vy ?? 0; altMedia += k.alt ?? v.alt;
    const dz = v.alt - (k.alt ?? v.alt), d3 = Math.sqrt(k.distancia * k.distancia + dz * dz) || 0.01;
    if (d3 < b.separacaoM) { const w = (b.separacaoM - d3) / d3; sx += (a.x - k.x) * w; sy += (a.y - k.y) * w; empurraAlt += (dz >= 0 ? 1 : -1) * (b.separacaoM - d3); }
    if (d3 < b.separacaoM * 0.5) muitoPerto = true;
  }
  // Vizinho a menos de meia distância de separação: evitar o choque vem antes de manter o bando.
  if (muitoPerto) { const ns = hipot(sx, sy) || 1; return { estado: 'voando_em_bando', codigo: 'separacao', motivo: 'vizinho perto demais; abre espaço', alvo: null, destino: { x: a.x + (sx / ns) * 40, y: a.y + (sy / ns) * 40 }, ritmo: 'andar', voar: true, altitude: Math.max(6, v.alt + empurraAlt) }; }
  if (!n) return { ...base, estado: 'voando', voar: true, altitude: cfg.altitudeCruzeiroM };
  cx = cx / n - a.x; cy = cy / n - a.y;
  const nc = hipot(cx, cy) || 1, na = hipot(ax, ay) || 1;
  let dx = (cx / nc) * b.coesao * Math.min(1, nc / b.separacaoM) + (ax / na) * b.alinhamento + sx * b.separacao;
  let dy = (cy / nc) * b.coesao * Math.min(1, nc / b.separacaoM) + (ay / na) * b.alinhamento + sy * b.separacao;
  // O destino individual (patrulha) ainda puxa de leve: o bando vai a algum lugar e cada um continua um indivíduo.
  if (base.destino) { const gx = base.destino.x - a.x, gy = base.destino.y - a.y, ng = hipot(gx, gy) || 1; dx += (gx / ng) * 0.35; dy += (gy / ng) * 0.35; }
  const nd = hipot(dx, dy) || 1;
  return { estado: 'voando_em_bando', codigo: 'bando', motivo: `em bando com ${n} (centro a ${f1(nc)} m)`, alvo: null, destino: { x: a.x + (dx / nd) * 40, y: a.y + (dy / nd) * 40 }, ritmo: 'andar', voar: true,
    altitude: Math.max(6, altMedia / n + empurraAlt) };
}
