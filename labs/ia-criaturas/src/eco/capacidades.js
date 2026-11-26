// Contrato de habilidades e planos de movimento. Não implementa física subterrânea/voo.
// Padrão seguro: simulação real apenas na superfície; outros meios exigem controlador próprio.
export const MODOS_LOCOMOCAO = Object.freeze(['terrestre', 'subterraneo_areia', 'voador', 'aquatico']);
export const HABILIDADES = Object.freeze(['escavar', 'nadar_areia', 'voar', 'detectar_vibracoes', 'nadar_agua']);
const exigencias = {
  terrestre: [],
  subterraneo_areia: ['nadar_areia'],
  voador: ['voar'],
  aquatico: ['nadar_agua']
};
const meio = { terrestre: 'solo', subterraneo_areia: 'areia_solida', voador: 'ar', aquatico: 'agua' };

export function inferirModoLocomocao(clipes = []) {
  const nomes = new Set(clipes.map((x) => String(typeof x === 'string' ? x : x.name).toLowerCase()));
  if (nomes.has('swim_sand') || nomes.has('glide_shallow')) return 'subterraneo_areia';
  if (nomes.has('fly') && !nomes.has('walk')) return 'voador';
  if (nomes.has('swim') && !nomes.has('walk')) return 'aquatico';
  return 'terrestre';
}

export function normalizarCapacidades({ modo = 'terrestre', habilidades = [], permitirProxySuperficie = false } = {}) {
  if (!MODOS_LOCOMOCAO.includes(modo)) throw new Error('Perfil de locomoção inválido: ' + modo);
  if (!Array.isArray(habilidades) || habilidades.some((x) => !HABILIDADES.includes(x)))
    throw new Error('Habilidade desconhecida; registre primeiro o contrato da habilidade.');
  const lista = [...new Set(habilidades)];
  for (const h of exigencias[modo]) if (!lista.includes(h)) lista.push(h);
  return {
    modo, meio: meio[modo], habilidades: lista,
    implementado: modo === 'terrestre',
    // O proxy está sempre explicitamente identificado; nunca passa por natação/voo real.
    simulacao: modo === 'terrestre' ? 'terrestre' : permitirProxySuperficie ? 'proxy_superficie' : 'indisponivel'
  };
}
export function validarSuporteLocomocao(perfil) {
  if (perfil?.simulacao === 'indisponivel')
    throw new Error('A locomoção '+perfil.modo+' ainda não tem controlador físico. Ative conscientemente o proxy de superfície para testar apenas necessidades/encontros, ou aguarde o controlador.');
  return perfil?.simulacao ?? 'terrestre';
}
export function separarMeiosFisicos(perfil) {
  // Guard para futuros algoritmos: areia atravessável não é volume de água.
  return {
    solo: perfil.meio === 'solo' || perfil.simulacao === 'proxy_superficie',
    agua: perfil.meio === 'agua',
    areia: perfil.meio === 'areia_solida',
    ar: perfil.meio === 'ar'
  };
}
