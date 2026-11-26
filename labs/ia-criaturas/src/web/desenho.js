// Desenho do terreno em canvas 2D (vista de cima). Só lê o mundo; não altera nada da simulação.
import { alcancesEfetivos } from '../core/percepcao.js';

const COR = {
  grade: 'rgba(255,255,255,0.05)', rocha: '#6f6a60', rochaBorda: '#4b4740',
  moita: 'rgba(70,130,60,0.55)', alimento: '#a6d36b', texto: '#f2f1ea', textoSuave: 'rgba(242,241,234,0.7)',
  visao: 'rgba(255,255,255,0.07)', visaoBorda: 'rgba(255,255,255,0.25)', audicao: 'rgba(160,200,255,0.45)',
  memoria: '#ffd166', selecao: '#ffffff', contatoVisao: 'rgba(255,255,255,0.75)', contatoAudicao: 'rgba(160,200,255,0.8)',
  destino: 'rgba(255,255,255,0.45)',
};

export function desenhar(ctx, mundo, opcoes) {
  const { largura, altura } = mundo.terreno;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const esc = Math.min(W / largura, H / altura);
  const px = (v) => v * esc;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = mundo.cenario.terreno.cor ?? '#2f3b2a';
  ctx.fillRect(0, 0, px(largura), px(altura));

  // Grade de 5 m.
  ctx.strokeStyle = COR.grade; ctx.lineWidth = 1;
  for (let x = 0; x <= largura; x += 5) linha(ctx, px(x), 0, px(x), px(altura));
  for (let y = 0; y <= altura; y += 5) linha(ctx, 0, px(y), px(largura), px(y));

  // Alimento.
  for (const f of mundo.alimentos) {
    const frac = f.maximo ? f.quantidade / f.maximo : 0;
    ctx.globalAlpha = 0.25 + 0.6 * frac;
    circulo(ctx, px(f.x), px(f.y), px(f.raio), COR.alimento);
    ctx.globalAlpha = 1;
    texto(ctx, `${f.id} ${Math.round(f.quantidade)}`, px(f.x), px(f.y) + px(f.raio) + 12, COR.textoSuave, 11);
  }

  // Obstáculos.
  for (const o of mundo.terreno.obstaculos) {
    if (o.bloqueiaMovimento) {
      ctx.fillStyle = COR.rocha; ctx.strokeStyle = COR.rochaBorda; ctx.lineWidth = 2;
      ctx.fillRect(px(o.x), px(o.y), px(o.w), px(o.h)); ctx.strokeRect(px(o.x), px(o.y), px(o.w), px(o.h));
    } else if (!o.bloqueiaVisao && o.ocultacao) {
      // Capim alto: oculta parcialmente; desenhado com hachura vertical.
      ctx.fillStyle = 'rgba(150,170,60,0.28)'; ctx.fillRect(px(o.x), px(o.y), px(o.w), px(o.h));
      ctx.strokeStyle = 'rgba(190,210,90,0.35)'; ctx.lineWidth = 1;
      for (let x = o.x + 0.5; x < o.x + o.w; x += 1) linha(ctx, px(x), px(o.y), px(x), px(o.y + o.h));
      ctx.setLineDash([4, 4]); ctx.strokeRect(px(o.x), px(o.y), px(o.w), px(o.h)); ctx.setLineDash([]);
    } else {
      ctx.fillStyle = COR.moita; ctx.fillRect(px(o.x), px(o.y), px(o.w), px(o.h));
      ctx.strokeStyle = 'rgba(30,70,25,0.7)'; ctx.setLineDash([4, 4]); ctx.strokeRect(px(o.x), px(o.y), px(o.w), px(o.h)); ctx.setLineDash([]);
    }
    const rot = o.ocultacao && !o.bloqueiaVisao ? `${o.id ?? o.tipo} (oculta ${Math.round(o.ocultacao * 100)}%)` : o.id ?? o.tipo;
    texto(ctx, rot, px(o.x + o.w / 2), o.h * esc > 40 ? px(o.y) + 15 : px(o.y + o.h / 2) + 4, COR.texto, 11);
  }

  // Rastro.
  if (opcoes.rastro) {
    for (const c of mundo.criaturas) {
      const r = opcoes.rastros.get(c.id) ?? [];
      ctx.strokeStyle = c.especie.visual?.cor ?? '#fff'; ctx.globalAlpha = 0.45; ctx.lineWidth = 2;
      ctx.beginPath();
      r.forEach((p, i) => (i ? ctx.lineTo(px(p.x), px(p.y)) : ctx.moveTo(px(p.x), px(p.y))));
      ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // Percepção.
  if (opcoes.percepcao) {
    for (const c of mundo.criaturas) {
      if (!c.vivo) continue;
      if (opcoes.selecionado && opcoes.selecionado !== c.id && !opcoes.percepcaoTodos) continue;
      const a = alcancesEfetivos(c);
      ctx.fillStyle = COR.visao; ctx.strokeStyle = COR.visaoBorda; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px(c.x), px(c.y));
      ctx.arc(px(c.x), px(c.y), px(a.visao), c.direcao - a.angulo / 2, c.direcao + a.angulo / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (a.proximo > 0) { ctx.beginPath(); ctx.arc(px(c.x), px(c.y), px(a.proximo), 0, Math.PI * 2); ctx.stroke(); }
      if (a.audicao > 0) {
        ctx.strokeStyle = COR.audicao; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.arc(px(c.x), px(c.y), px(a.audicao), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  // Contatos atuais.
  if (opcoes.contatos) {
    for (const c of mundo.criaturas) {
      if (!c.vivo) continue;
      for (const k of c.contatos) {
        ctx.strokeStyle = k.via === 'visao' ? COR.contatoVisao : COR.contatoAudicao;
        ctx.lineWidth = 1.5; if (k.via !== 'visao') ctx.setLineDash([2, 4]);
        linha(ctx, px(c.x), px(c.y), px(k.x), px(k.y)); ctx.setLineDash([]);
      }
    }
  }

  // Memória: última posição conhecida das outras criaturas (destaque para o predador).
  if (opcoes.memoria) {
    for (const c of mundo.criaturas) {
      for (const m of c.memoria.criaturas.values()) {
        const emContato = c.contatos.some((k) => k.id === m.id && k.via === 'visao');
        if (emContato) continue;
        const idade = mundo.t - m.t;
        const cor = c.especie.visual?.cor ?? COR.memoria;
        ctx.strokeStyle = cor; ctx.lineWidth = 2.5;
        const x = px(m.x), y = px(m.y), r = 7;
        linha(ctx, x - r, y - r, x + r, y + r); linha(ctx, x - r, y + r, x + r, y - r);
        ctx.setLineDash([2, 4]); ctx.lineWidth = 1; linha(ctx, px(c.x), px(c.y), x, y); ctx.setLineDash([]);
        texto(ctx, `${c.id}: viu ${m.id} há ${idade.toFixed(1)}s`, x, y - 11, cor, 11);
      }
    }
  }

  // Destino / waypoint.
  if (opcoes.destino) {
    for (const c of mundo.criaturas) {
      if (!c.vivo || !c.intencao?.destino) continue;
      ctx.strokeStyle = COR.destino; ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
      const w = c.waypoint ?? c.intencao.destino;
      linha(ctx, px(c.x), px(c.y), px(w.x), px(w.y));
      if (w !== c.intencao.destino) linha(ctx, px(w.x), px(w.y), px(c.intencao.destino.x), px(c.intencao.destino.y));
      ctx.setLineDash([]);
      circulo(ctx, px(c.intencao.destino.x), px(c.intencao.destino.y), 3, COR.destino);
    }
  }

  // Criaturas.
  for (const c of mundo.criaturas) {
    const cor = c.especie.visual?.cor ?? '#ddd';
    const r = Math.max(6, px(c.especie.corpo.raio));
    if (opcoes.selecionado === c.id) {
      ctx.strokeStyle = COR.selecao; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px(c.x), px(c.y), r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = c.vivo ? 1 : 0.45;
    circulo(ctx, px(c.x), px(c.y), r, cor);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    linha(ctx, px(c.x), px(c.y), px(c.x) + Math.cos(c.direcao) * (r + 6), px(c.y) + Math.sin(c.direcao) * (r + 6));
    texto(ctx, c.especie.visual?.rotulo ?? c.id[0].toUpperCase(), px(c.x), px(c.y) + 4, '#111', 11, true);
    ctx.globalAlpha = 1;
    texto(ctx, c.vivo ? c.estado : 'capturado', px(c.x), px(c.y) - r - 6, COR.texto, 12, true);
    // Suspeita: atenção acumulada sobre algo ainda não reconhecido (arco amarelo ao redor + "?").
    let suspeita = 0;
    for (const v of c.atencao?.values() ?? []) if (v < 1 && v > suspeita) suspeita = v;
    if (c.vivo && suspeita > 0.05) {
      ctx.strokeStyle = COR.memoria; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px(c.x), px(c.y), r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * suspeita); ctx.stroke();
      texto(ctx, '?', px(c.x) + r + 12, px(c.y) - r - 2, COR.memoria, 14, true);
    }
    // Barra de energia.
    const bw = 26, bx = px(c.x) - bw / 2, by = px(c.y) + r + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = '#e2b53b'; ctx.fillRect(bx, by, (bw * c.energia) / c.especie.necessidades.energiaMax, 4);
  }

  // Rótulo (para capturas se explicarem sozinhas).
  ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
  const rotulo = `${mundo.cenarioId} · semente ${mundo.semente} · t=${mundo.t.toFixed(1)} s`;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(4, px(altura) - 22, ctx.measureText(rotulo).width + 12, 18);
  ctx.fillStyle = COR.texto; ctx.fillText(rotulo, 10, px(altura) - 9);

  // Fim.
  if (mundo.fim) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, px(largura), 30);
    texto(ctx, `Fim: ${mundo.fim.motivo} em t=${mundo.fim.t.toFixed(1)} s`, px(largura) / 2, 20, COR.texto, 14, true);
  }
  ctx.restore();
  return esc;
}

function linha(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function circulo(ctx, x, y, r, cor) { ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function texto(ctx, t, x, y, cor, tam = 12, negrito = false) {
  ctx.font = `${negrito ? '600 ' : ''}${tam}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(t, x, y); ctx.fillStyle = cor; ctx.fillText(t, x, y);
}
