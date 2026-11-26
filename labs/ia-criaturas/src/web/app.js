// Página do laboratório. Usa exatamente o mesmo núcleo (src/core) do simulador sem interface.
// A velocidade só muda quantos passos fixos rodam por quadro — nunca o dt — então a trilha é idêntica.
import { carregarConfig } from '../core/carregar.js';
import { criarMundo, hashTrilha, passo } from '../core/mundo.js';
import { analisarEncontro, impressaoDigital } from '../core/simulacao.js';
import { fatorVisibilidade } from '../core/percepcao.js';
import { desenhar } from './desenho.js';

const $ = (id) => document.getElementById(id);
const el = {
  cenario: $('cenario'), descricao: $('descricao-cenario'), semente: $('semente'), aleatoria: $('aleatoria'),
  tocar: $('tocar'), passo: $('passo'), reiniciar: $('reiniciar'), velocidade: $('velocidade'),
  percepcao: $('ver-percepcao'), memoria: $('ver-memoria'), contatos: $('ver-contatos'), rastro: $('ver-rastro'), destino: $('ver-destino'),
  status: $('status'), captura: $('captura'), copiarLink: $('copiar-link'),
  tela: $('tela'), inspetor: $('inspetor'), eventos: $('eventos'),
};
const ctx = el.tela.getContext('2d');

const lerJsonWeb = async (rel) => {
  const r = await fetch(rel, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Falha ao carregar ${rel}: HTTP ${r.status}`);
  return r.json();
};

const estado = {
  config: null, mundo: null, rodando: false, velocidade: 1, acumulado: 0, ultimoQuadro: 0,
  selecionado: null, rastros: new Map(), eventosVistos: 0, escala: 1,
};

async function iniciar() {
  try {
    estado.config = await carregarConfig(lerJsonWeb);
  } catch (e) {
    el.status.textContent = `Erro de configuração:\n${e.message}`;
    throw e;
  }
  for (const id of estado.config.ordemCenarios) {
    const o = document.createElement('option');
    o.value = id; o.textContent = estado.config.cenarios[id].nome;
    el.cenario.append(o);
  }
  const q = new URLSearchParams(location.search);
  if (q.get('cenario') && estado.config.cenarios[q.get('cenario')]) el.cenario.value = q.get('cenario');
  if (q.get('semente')) el.semente.value = parseInt(q.get('semente'), 10) || 0;
  if (q.get('velocidade')) el.velocidade.value = q.get('velocidade');
  if (q.get('selecionar')) estado.selecionado = q.get('selecionar');
  for (const [param, chk] of [['percepcao', el.percepcao], ['memoria', el.memoria], ['rastro', el.rastro]]) {
    if (q.has(param)) chk.checked = q.get(param) !== '0';
  }
  estado.velocidade = Number(el.velocidade.value);
  reiniciar();
  if (q.get('tocar') === '1') alternar(true);
  requestAnimationFrame(quadro);
}

function reiniciar() {
  const cen = el.cenario.value, sem = parseInt(el.semente.value, 10) || 0;
  estado.mundo = criarMundo(estado.config, cen, sem);
  estado.rastros = new Map(estado.mundo.criaturas.map((c) => [c.id, [{ x: c.x, y: c.y }]]));
  estado.acumulado = 0; estado.eventosVistos = 0;
  el.eventos.innerHTML = '';
  el.descricao.textContent = estado.config.cenarios[cen].descricao ?? '';
  if (!estado.mundo.criaturas.some((c) => c.id === estado.selecionado)) estado.selecionado = estado.mundo.criaturas[0]?.id ?? null;
  history.replaceState(null, '', `?cenario=${encodeURIComponent(cen)}&semente=${sem}`);
  alternar(false);
  render();
}

function alternar(forcar) {
  estado.rodando = typeof forcar === 'boolean' ? forcar : !estado.rodando;
  if (estado.mundo?.fim) estado.rodando = false;
  el.tocar.textContent = estado.rodando ? '⏸ Pausar' : estado.mundo?.tick ? '▶ Continuar' : '▶ Iniciar';
  estado.ultimoQuadro = performance.now();
}

function avancar(n = 1) {
  for (let i = 0; i < n && !estado.mundo.fim; i++) {
    passo(estado.mundo);
    for (const c of estado.mundo.criaturas) {
      const r = estado.rastros.get(c.id);
      if (estado.mundo.tick % 3 === 0) { r.push({ x: c.x, y: c.y }); if (r.length > 400) r.shift(); }
    }
  }
  if (estado.mundo.fim && estado.rodando) alternar(false);
}

function quadro(agora) {
  if (estado.rodando) {
    const dtReal = Math.min(0.25, (agora - estado.ultimoQuadro) / 1000);
    estado.acumulado += dtReal * estado.velocidade;
    const passos = Math.floor(estado.acumulado / estado.mundo.dt);
    estado.acumulado -= passos * estado.mundo.dt;
    if (passos) avancar(passos);
    render();
  }
  estado.ultimoQuadro = agora;
  requestAnimationFrame(quadro);
}

function render() {
  if (!estado.mundo) return; // ainda carregando a configuração (ex.: resize antes do fetch terminar)
  ajustarCanvas();
  estado.escala = desenhar(ctx, estado.mundo, {
    percepcao: el.percepcao.checked, percepcaoTodos: true, memoria: el.memoria.checked, contatos: el.contatos.checked,
    rastro: el.rastro.checked, destino: el.destino.checked, rastros: estado.rastros, selecionado: estado.selecionado,
  });
  const m = estado.mundo;
  el.status.textContent = [
    `t = ${m.t.toFixed(1)} s / ${m.duracao} s   (passo ${m.tick})`,
    `semente ${m.semente} · ${m.cenarioId}`,
    `hash da trilha: ${hashTrilha(m)}`,
    m.fim ? `FIM: ${m.fim.motivo}\nresultado: ${analisarEncontro(m).resultado}` : estado.rodando ? `rodando a ${estado.velocidade}×` : 'pausado',
    m.falhas.length ? `⚠ falhas: ${m.falhas.map((f) => f.tipo).join(', ')}` : '',
  ].filter(Boolean).join('\n');
  renderInspetor();
  renderEventos();
}

function ajustarCanvas() {
  const { largura, altura } = estado.mundo.terreno;
  const dpr = window.devicePixelRatio || 1;
  const cssW = el.tela.clientWidth || 900;
  const cssH = (cssW * altura) / largura;
  const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
  if (el.tela.width !== w || el.tela.height !== h) { el.tela.width = w; el.tela.height = h; }
}

const CLIPE_POR_ESTADO = { comendo: 'comer', alerta: 'alerta', descansando: 'descansar', atacando: 'ataque', farejando: 'farejar', capturado: 'morte' };

function clipeSugerido(c) {
  const clipes = c.especie.modelo?.clipes ?? {};
  const chave = CLIPE_POR_ESTADO[c.estado] ?? (c.velocidade < 0.2 ? 'parado' : c.velocidade <= c.especie.movimento.andar + 0.05 ? 'andar' : c.velocidade <= c.especie.movimento.trote + 0.05 ? 'trote' : 'corrida');
  return `${chave} → ${clipes[chave] ?? '(sem clipe mapeado)'}`;
}

function renderInspetor() {
  const c = estado.mundo.criaturas.find((x) => x.id === estado.selecionado);
  if (!c) { el.inspetor.innerHTML = '<p class="vazio">Nenhum animal selecionado.</p>'; return; }
  const e = c.especie, t = estado.mundo.t;
  const alvo = c.alvo ? `${c.alvo.tipo}${c.alvo.id ? ` ${c.alvo.id}` : ''} @ (${c.alvo.x.toFixed(1)}, ${c.alvo.y.toFixed(1)})` : '—';
  const contatos = c.contatos.map((k) => `<li>${k.id} por ${k.via} a ${k.distancia.toFixed(1)} m</li>`).join('') || '<li>nenhum</li>';
  const ocultos = c.ocultos.map((o) => `<li>${o.id} a ${o.distancia.toFixed(1)} m — não vê: ${o.motivo.replace(/_/g, ' ')}${o.atencao > 0 ? ` (atenção ${Math.round(o.atencao * 100)}%)` : ''}</li>`).join('');
  const outros = estado.mundo.criaturas.filter((x) => x !== c && x.vivo);
  const visib = outros.map((x) => `${x.id}: ${Math.round(100 * fatorVisibilidade(x, c, estado.mundo.terreno.obstaculos))}%`).join(', ') || '—';
  const memoria = [...c.memoria.criaturas.values()].map((m) => `<li>${m.id}: (${m.x.toFixed(1)}, ${m.y.toFixed(1)}) há ${(t - m.t).toFixed(1)} s via ${m.via}</li>`).join('') || '<li>vazia</li>';
  const ultima = [...estado.mundo.decisoes].reverse().find((d) => d.id === c.id);
  el.inspetor.innerHTML = `
    <div class="ficha-nome"><span class="ponto" style="background:${e.visual?.cor ?? '#ccc'}"></span>${c.id} <small style="font-weight:400;color:var(--suave)">${e.nome}</small></div>
    <span class="estado">${c.vivo ? c.estado : 'capturado'}</span>
    <div class="motivo"><strong>Motivo da última decisão:</strong><br>${escapar(c.motivo)}${ultima ? `<br><small>decidido em t=${ultima.t.toFixed(1)} s · código <code>${ultima.codigo}</code></small>` : ''}</div>
    <dl class="campos">
      <dt>Energia</dt><dd>${c.energia.toFixed(1)} / ${e.necessidades.energiaMax}<div class="barra"><span style="width:${(100 * c.energia) / e.necessidades.energiaMax}%;background:var(--barra-energia)"></span></div></dd>
      <dt>Fome</dt><dd>${c.fome.toFixed(1)} / 100<div class="barra"><span style="width:${c.fome}%;background:var(--barra-fome)"></span></div></dd>
      <dt>Alvo</dt><dd>${alvo}</dd>
      <dt>Velocidade</dt><dd>${c.velocidade.toFixed(2)} m/s (ritmo ${c.intencao?.ritmo ?? '—'})</dd>
      <dt>Posição</dt><dd>(${c.x.toFixed(2)}, ${c.y.toFixed(2)})</dd>
      <dt>Arquétipo</dt><dd>${e.comportamento}</dd>
      <dt>Clipe</dt><dd>${clipeSugerido(c)}</dd>
      <dt>Modelo</dt><dd>${e.modelo?.glb ?? '(não definido)'}</dd>
    </dl>
    <div><strong>Percebe agora</strong></div><ul class="mini">${contatos}</ul>
    ${ocultos ? `<div><strong>No alcance, mas não vê</strong></div><ul class="mini">${ocultos}</ul>` : ''}
    <div><strong>Quão visível está</strong> <small>(para cada observador: camuflagem, imobilidade, capim)</small></div><ul class="mini"><li>${visib}</li></ul>
    <div><strong>Memória (última posição conhecida)</strong></div><ul class="mini">${memoria}</ul>`;
}

function renderEventos() {
  const ev = estado.mundo.eventos;
  for (; estado.eventosVistos < ev.length; estado.eventosVistos++) {
    const e = ev[estado.eventosVistos];
    if (e.tipo === 'contato_perdido') continue;
    const { tick, t, tipo, id, ...resto } = e;
    const li = document.createElement('li');
    li.className = tipo;
    li.innerHTML = `${t.toFixed(1)}s <span class="tipo">${tipo}</span> ${id ?? ''} ${escapar(Object.entries(resto).map(([k, v]) => `${k}=${v}`).join(' '))}`;
    el.eventos.prepend(li);
    while (el.eventos.children.length > 80) el.eventos.lastChild.remove();
  }
}

const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

el.tela.addEventListener('click', (ev) => {
  const r = el.tela.getBoundingClientRect();
  const fx = el.tela.width / r.width;
  const x = ((ev.clientX - r.left) * fx) / estado.escala, y = ((ev.clientY - r.top) * fx) / estado.escala;
  let melhor = null, dm = 2.5;
  for (const c of estado.mundo.criaturas) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < dm) { dm = d; melhor = c; }
  }
  if (melhor) { estado.selecionado = melhor.id; render(); }
});
el.tocar.onclick = () => alternar();
el.passo.onclick = () => { alternar(false); avancar(1); render(); };
el.reiniciar.onclick = reiniciar;
el.cenario.onchange = reiniciar;
el.semente.onchange = reiniciar;
el.aleatoria.onclick = () => { el.semente.value = Math.floor(Math.random() * 100000); reiniciar(); };
el.velocidade.onchange = () => { estado.velocidade = Number(el.velocidade.value); render(); };
for (const chk of [el.percepcao, el.memoria, el.contatos, el.rastro, el.destino]) chk.onchange = render;
el.copiarLink.onclick = async () => { try { await navigator.clipboard.writeText(location.href); el.copiarLink.textContent = '✔ Copiado'; } catch { el.copiarLink.textContent = location.search; } setTimeout(() => (el.copiarLink.textContent = '🔗 Copiar link'), 1500); };
el.captura.onclick = () => salvarCaptura();
document.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return;
  if (ev.code === 'Space') { ev.preventDefault(); alternar(); }
  else if (ev.code === 'ArrowRight') { alternar(false); avancar(1); render(); }
  else if (ev.key === 'r' || ev.key === 'R') reiniciar();
});
window.addEventListener('resize', render);

async function salvarCaptura(nome) {
  render();
  const m = estado.mundo;
  const arquivo = nome ?? `${m.cenarioId}-semente${m.semente}-t${m.t.toFixed(1)}.png`;
  const dados = el.tela.toDataURL('image/png');
  // Servidor do laboratório grava em resultados/capturas; fora dele, baixa o arquivo.
  try {
    const r = await fetch('/__captura', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: arquivo, dados }) });
    if (r.ok) { const j = await r.json(); el.captura.textContent = '✔ Salvo'; setTimeout(() => (el.captura.textContent = '📷 Salvar PNG'), 1500); return j.caminho; }
  } catch { /* sem servidor de captura */ }
  const a = document.createElement('a'); a.href = dados; a.download = arquivo; a.click();
  return arquivo;
}

// API para automação (testes no navegador, outro agente, console).
window.laboratorio = {
  get config() { return estado.config; },
  get mundo() { return estado.mundo; },
  reiniciar(cenario, semente) { if (cenario) el.cenario.value = cenario; if (semente !== undefined) el.semente.value = semente; reiniciar(); },
  avancar(n = 1) { avancar(n); render(); return estado.mundo.t; },
  avancarAte(t) { while (!estado.mundo.fim && estado.mundo.t < t) avancar(1); render(); return estado.mundo.t; },
  rodarAteFim() { while (!estado.mundo.fim) avancar(1); render(); return analisarEncontro(estado.mundo); },
  tocar() { alternar(true); }, pausar() { alternar(false); },
  selecionar(id) { estado.selecionado = id; render(); },
  hash() { return hashTrilha(estado.mundo); },
  resumo() { return analisarEncontro(estado.mundo); },
  decisoes() { return estado.mundo.decisoes; },
  // Mesmo cálculo de `npm run paridade`: os dois devem imprimir o mesmo hash.
  impressaoDigital(sementes = '1-30', cenario) {
    return impressaoDigital(estado.config, sementes, cenario ? cenario.split(',') : estado.config.ordemCenarios);
  },
  salvarCaptura,
};

iniciar();
