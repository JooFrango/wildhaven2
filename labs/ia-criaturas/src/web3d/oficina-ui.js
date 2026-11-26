// Oficina de criaturas: seleção, diagnósticos e presets no navegador. Apenas sobreposição de IA em memória.
import { criarPreset, validarPreset, converterPresets } from '../eco/presets.js';
import { HABILIDADES } from '../eco/capacidades.js';

const $ = (id) => document.getElementById(id);
const CHAVE = 'wildhaven:oficina-ia:v1';
const CHAVE_PRESETS = 'wildhaven:oficina-ia:presets:v1';
const CAMPOS = ['nome', 'papel', 'quantidade', 'frente', 'massa', 'comprimento', 'altura', 'velocidade', 'fome', 'sede', 'vida', 'alcance', 'modo'];
const NUMEROS = new Set(['quantidade', 'massa', 'comprimento', 'altura', 'velocidade', 'fome', 'sede', 'vida', 'alcance']);

function buscarLocal(chave, padrao = '[]') {
  try { return localStorage.getItem(chave) ?? padrao; } catch { return padrao; }
}
function gravarLocal(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch { return false; }
}
function modeloPadrao(modelo) {
  const clipes = new Set(modelo.animacoesDeclaradas ?? []);
  return {
    id: modelo.id, glb: modelo.glb, nome: modelo.nome,
    papel: 'herbivoro', quantidade: 2, frente: '+X',
    massa: modelo.massaSugerida ?? 25, comprimento: 2, altura: 1,
    velocidade: 6, fome: 55, sede: 70, vida: 100, alcance: 40,
    modo: modelo.modoSugerido ?? 'terrestre',
    habilidades: [
      ...(clipes.has('burrow') || clipes.has('sand_dig') ? ['escavar'] : []),
      ...(clipes.has('swim_sand') ? ['nadar_areia'] : []),
      ...(clipes.has('fly') ? ['voar'] : [])
    ],
    permitirProxySuperficie: false, presas: [], predadoresPodemCacar: false
  };
}

export function criarOficina({ config, onApply, onAudit }) {
  let catalogo = [], lista = [], editando = null, disponivel = false;
  let presets = converterPresets(buscarLocal(CHAVE_PRESETS));
  let auditoriaEmAndamento = false;
  const status = (msg, erro = false) => {
    $('of-status').textContent = msg;
    $('of-status').classList.toggle('erro', erro);
  };
  const atual = () => catalogo.find((m) => m.id === $('of-catalogo').value);
  const lerEditor = (m) => {
    const item = { id: m.id, glb: m.glb };
    for (const c of CAMPOS) {
      const v = $('of-' + c).value;
      item[c] = NUMEROS.has(c) ? Number(v) : v;
    }
    item.habilidades = HABILIDADES.filter((h) => $('of-h-' + h).checked);
    item.permitirProxySuperficie = $('of-proxy').checked;
    item.presas = $('of-presa').value ? [$('of-presa').value] : [];
    item.predadoresPodemCacar = $('of-ser-presa').checked;
    return item;
  };
  const preencherAlvos = (sel = '') => {
    const el = $('of-presa');
    const items = [...Object.values(config.especies), ...lista];
    el.replaceChildren();
    el.add(new Option('Sem alvo definido', ''));
    const usados = new Set();
    for (const x of items) {
      if (usados.has(x.id)) continue;
      usados.add(x.id);
      el.add(new Option(x.nome ?? x.id, x.id));
    }
    el.value = sel;
  };
  function mostrar(item) {
    for (const c of CAMPOS) $('of-' + c).value = item[c] ?? '';
    for (const h of HABILIDADES) $('of-h-' + h).checked = (item.habilidades ?? []).includes(h);
    $('of-proxy').checked = Boolean(item.permitirProxySuperficie);
    $('of-ser-presa').checked = Boolean(item.predadoresPodemCacar);
    preencherAlvos(item.presas?.[0] ?? '');
    $('of-relatorio').textContent = 'Pronto para diagnosticar o GLB real.';
  }
  function renderLista() {
    const el = $('of-selecionada');
    el.replaceChildren();
    for (const item of lista) el.add(new Option(item.nome + ' · ' + item.papel + ' · ' + item.quantidade, item.id));
    if (editando && lista.some((x) => x.id === editando)) el.value = editando;
    else el.selectedIndex = -1;
    preencherAlvos($('of-presa').value);
  }
  function filtrar() {
    const termo = $('of-busca').value.trim().toLocaleLowerCase('pt-BR');
    const encontrados = catalogo.filter((m) =>
      (m.nome + ' ' + m.arquivo + ' ' + m.glb + ' ' + (m.ficha ?? '')).toLocaleLowerCase('pt-BR').includes(termo));
    const el = $('of-catalogo');
    const id = el.value;
    el.replaceChildren();
    for (const m of encontrados.slice(0, 180)) el.add(new Option(m.nome + ' / ' + m.arquivo, m.id));
    if (id && encontrados.some((x) => x.id === id) && ![...el.options].some((x) => x.value === id)) {
      const m = encontrados.find((x) => x.id === id);
      el.add(new Option(m.nome + ' / ' + m.arquivo, m.id));
    }
    if ([...el.options].some((x) => x.value === id)) el.value = id;
    else el.selectedIndex = -1;
    status(catalogo.length + ' GLBs · ' + encontrados.length + ' resultados' +
      (encontrados.length > 180 ? ' (refine a busca)' : ''));
  }
  function renderPresets() {
    const el = $('of-pre-lista');
    const anterior = el.value;
    el.replaceChildren();
    el.add(new Option('Selecione um preset', ''));
    for (let i = 0; i < presets.length; i++) el.add(new Option(presets[i].nome + ' · ' + presets[i].cenario, String(i)));
    if ([...el.options].some((o) => o.value === anterior)) el.value = anterior;
  }
  function selecionar(item) {
    editando = item.id;
    $('of-busca').value = item.glb.split('/').at(-1);
    filtrar();
    // Garante a opção mesmo para catálogos com centenas de versões.
    const el = $('of-catalogo');
    if (![...el.options].some((o) => o.value === item.id)) {
      const m = catalogo.find((x) => x.id === item.id);
      if (m) el.add(new Option(m.nome + ' / ' + m.arquivo, item.id));
    }
    el.value = item.id;
    mostrar(item);
    $('of-selecionada').value = item.id;
  }
  $('of-busca').addEventListener('input', filtrar);
  $('of-catalogo').addEventListener('change', () => {
    const m = atual();
    if (!m) return;
    editando = null;
    $('of-selecionada').selectedIndex = -1;
    mostrar(modeloPadrao(m));
  });
  $('of-selecionada').addEventListener('change', () => {
    const item = lista.find((x) => x.id === $('of-selecionada').value);
    if (item) selecionar(item);
  });
  $('of-salvar').addEventListener('click', () => {
    const m = atual();
    if (!disponivel || !m) return status('Escolha um GLB válido.', true);
    const item = lerEditor(m);
    const i = lista.findIndex((x) => x.id === item.id);
    if (i === -1 && lista.length >= 30) return status('Máximo de 30 espécies por experimento.', true);
    if (i === -1) lista.push(item);
    else lista[i] = item;
    editando = item.id;
    if (!gravarLocal(CHAVE, lista)) status('Não foi possível salvar localmente.', true);
    else status(item.nome + ' salvo. Clique em Aplicar e reiniciar.');
    renderLista();
  });
  $('of-remover').addEventListener('click', () => {
    if (!editando) return;
    lista = lista.filter((x) => x.id !== editando);
    editando = null;
    gravarLocal(CHAVE, lista);
    renderLista();
    status('Espécie removida da seleção. Aplique para atualizar a simulação.');
  });
  $('of-aplicar').addEventListener('click', async () => {
    try {
      if (!disponivel && lista.length) throw new Error('Catálogo indisponível.');
      if (editando && atual()?.id === editando) {
        const item = lerEditor(atual());
        lista = lista.map((x) => x.id === item.id ? item : x);
        gravarLocal(CHAVE, lista);
        renderLista();
      }
      $('of-aplicar').disabled = true;
      await onApply();
      const nProxy = lista.filter((x) => x.modo !== 'terrestre' && x.permitirProxySuperficie).length;
      status('Experimento aplicado: ' + lista.length + ' espécies adicionais.' +
        (nProxy ? ' ATENÇÃO: ' + nProxy + ' em proxy terrestre; não foi simulado nado/voo.' : ''));
    } catch (e) { status('Erro ao aplicar: ' + e.message, true); }
    finally { $('of-aplicar').disabled = false; }
  });
  $('of-auditar').addEventListener('click', async () => {
    const m = atual();
    if (!m || auditoriaEmAndamento) return status('Escolha um GLB antes de diagnosticar.', true);
    auditoriaEmAndamento = true;
    $('of-auditar').disabled = true;
    $('of-relatorio').textContent = 'Lendo clipes do GLB real…';
    try {
      const resultado = await onAudit(m, lerEditor(m));
      $('of-relatorio').textContent = JSON.stringify(resultado, null, 2);
      status(resultado.problemas?.length ? 'Auditoria encontrou problemas no GLB.' : 'Auditoria concluída (não substitui inspeção visual).',
        Boolean(resultado.problemas?.length));
    } catch (e) { $('of-relatorio').textContent = e.stack ?? e.message; status('Auditoria falhou.', true); }
    finally { auditoriaEmAndamento = false; $('of-auditar').disabled = false; }
  });
  const persistirPresets = () => gravarLocal(CHAVE_PRESETS, presets);
  const escolhido = () => {
    const n = $('of-pre-lista').value;
    return n !== '' ? presets[Number(n)] : null;
  };
  const snapshot = () => criarPreset({
    nome: $('of-pre-nome').value, cenario: $('cenario').value,
    semente: Number($('semente').value), selecao: lista
  });
  $('of-pre-salvar').addEventListener('click', () => {
    try {
      const p = snapshot();
      const i = presets.findIndex((x) => x.nome === p.nome);
      if (i < 0 && presets.length >= 30) throw new Error('Máximo de 30 presets.');
      if (i < 0) presets.push(p); else presets[i] = p;
      if (!persistirPresets()) throw new Error('Armazenamento do navegador indisponível.');
      renderPresets();
      $('of-pre-lista').value = String(i < 0 ? presets.length - 1 : i);
      status('Preset salvo: ' + p.nome);
    } catch (e) { status(e.message, true); }
  });
  $('of-pre-carregar').addEventListener('click', () => {
    try {
      const escolhidoPreset = escolhido();
      if (!escolhidoPreset) throw new Error('Selecione um preset.');
      const p = validarPreset(escolhidoPreset, { cenarios: config.cenarios, catalogo });
      lista = p.selecao; editando = null;
      $('cenario').value = p.cenario;
      $('semente').value = p.semente;
      $('of-pre-nome').value = p.nome;
      $('of-busca').value = '';
      gravarLocal(CHAVE, lista);
      filtrar(); renderLista();
      status('Preset carregado. Clique em Aplicar e reiniciar para executar.');
    } catch (e) { status('Falha ao carregar preset: ' + e.message, true); }
  });
  $('of-pre-excluir').addEventListener('click', () => {
    const p = escolhido(); if (!p) return status('Selecione um preset para excluir.', true);
    presets = presets.filter((x) => x !== p);
    persistirPresets(); renderPresets(); $('of-pre-lista').value = '';
    status('Preset excluído do navegador.');
  });
  $('of-pre-exportar').addEventListener('click', () => {
    try {
      const p = escolhido() ?? snapshot();
      const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = 'wildhaven-preset-' + p.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 50) + '.json';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      status('Preset exportado em JSON.');
    } catch (e) { status(e.message, true); }
  });
  $('of-pre-importar').addEventListener('click', () => $('of-pre-arquivo').click());
  $('of-pre-arquivo').addEventListener('change', async () => {
    try {
      const file = $('of-pre-arquivo').files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) throw new Error('Arquivo muito grande (limite 1 MB).');
      const p = validarPreset(JSON.parse(await file.text()), { cenarios: config.cenarios, catalogo });
      const i = presets.findIndex((x) => x.nome === p.nome);
      if (i < 0 && presets.length >= 30) throw new Error('Máximo de 30 presets.');
      if (i < 0) presets.push(p); else presets[i] = p;
      if (!persistirPresets()) throw new Error('Não foi possível persistir o preset.');
      renderPresets(); $('of-pre-lista').value = String(i < 0 ? presets.length - 1 : i);
      status('Preset importado: ' + p.nome + '. Clique em Carregar.');
    } catch (e) { status('Importação recusada: ' + e.message, true); }
    finally { $('of-pre-arquivo').value = ''; }
  });

  async function carregar() {
    try {
      const res = await fetch('/__catalogo', { cache: 'no-store' });
      if (!res.ok) throw new Error('Catálogo indisponível (abra pelo servidor npm run dev)');
      const dados = await res.json();
      if (!Array.isArray(dados.modelos)) throw new Error('Resposta do catálogo inválida.');
      catalogo = dados.modelos; disponivel = true;
      const ids = new Map(catalogo.map((x) => [x.id, x.glb]));
      try {
        const anteriores = JSON.parse(buscarLocal(CHAVE));
        lista = Array.isArray(anteriores) ? anteriores.slice(0, 30).filter((x) => ids.get(x.id) === x.glb) : [];
      } catch { lista = []; }
      renderLista(); filtrar(); renderPresets();
      status(catalogo.length + ' modelos GLB disponíveis. Selecione um para editar e testar.');
    } catch (e) {
      disponivel = false;
      status('Catálogo dinâmico: ' + e.message + '. Cenários originais continuam funcionando.', true);
      for (const id of ['of-salvar','of-aplicar','of-auditar']) $(id).disabled = true;
      renderPresets();
    }
  }
  void carregar();
  return {
    getSelecao: () => structuredClone(lista),
    getCatalogo: () => catalogo,
    disponivel: () => disponivel
  };
}
