// Presets portáveis de encontros: cenário (inclusive terreno), semente e seleção com parâmetros.
// Sem acesso ao disco do servidor. O usuário exporta/importa JSON localmente.
export const VERSAO_PRESET = 1;
const LIMITE_MODELOS = 30;
const limpar = (s, max = 100) => String(s ?? '').trim().slice(0, max);

export function criarPreset({ nome, cenario, semente, selecao }) {
  if (!limpar(nome, 80)) throw new Error('Dê um nome ao preset.');
  if (!limpar(cenario, 100)) throw new Error('Cenário inválido.');
  if (!Number.isSafeInteger(Number(semente)) || Number(semente) < 0) throw new Error('Semente inválida.');
  if (!Array.isArray(selecao) || selecao.length > LIMITE_MODELOS) throw new Error('Quantidade de espécies inválida.');
  return {
    versao: VERSAO_PRESET,
    nome: limpar(nome, 80), cenario: limpar(cenario, 100), semente: Number(semente),
    selecao: structuredClone(selecao)
  };
}
export function validarPreset(obj, { cenarios, catalogo }) {
  if (!obj || obj.versao !== VERSAO_PRESET || typeof obj !== 'object') throw new Error('Formato/versão do preset incompatível.');
  const p = criarPreset(obj);
  if (!Object.hasOwn(cenarios, p.cenario)) throw new Error('Cenário do preset indisponível: ' + p.cenario);
  const ids = new Map(catalogo.map((m) => [m.id, m.glb]));
  const usados = new Set();
  for (const x of p.selecao) {
    if (!x || typeof x.id !== 'string' || ids.get(x.id) !== x.glb || usados.has(x.id))
      throw new Error('GLB removido, modificado ou duplicado no preset: ' + (x?.id ?? '?'));
    usados.add(x.id);
    if (!['herbivoro', 'carnivoro'].includes(x.papel)) throw new Error('Papel inválido no preset.');
    if (!['terrestre','subterraneo_areia','voador','aquatico'].includes(x.modo ?? 'terrestre'))
      throw new Error('Perfil de locomoção inválido no preset.');
  }
  return p;
}
export function converterPresets(armazenado) {
  try {
    const a = typeof armazenado === 'string' ? JSON.parse(armazenado) : armazenado;
    if (!Array.isArray(a)) return [];
    return a.filter((p) => p?.versao === VERSAO_PRESET && typeof p.nome === 'string').slice(0, 30);
  } catch { return []; }
}
