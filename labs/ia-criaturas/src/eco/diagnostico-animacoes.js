// Auditoria independente de Three: valida clipes presentes no GLB, durações e compatibilidade básica.
// A existência de clipe NÃO comprova contato, IK, colisões ou natação subterrânea.
const NECESSARIOS = {
  terrestre: [['idle', 'stand', 'rest'], ['walk', 'trot', 'run', 'sprint']],
  subterraneo_areia: [['idle', 'rest'], ['swim_sand', 'glide_shallow'], ['dive', 'burrow'], ['surface', 'emerge']],
  voador: [['idle', 'rest'], ['fly', 'flap'], ['land']],
  aquatico: [['idle', 'rest'], ['swim', 'swim_fast']]
};
export function diagnosticarAnimacoes({ clipes = [], mapa = {}, modo = 'terrestre', perfil = null, velocidade = null, escala = 1 } = {}) {
  const lista = clipes.map((c) => typeof c === 'string' ? { name: c, duration: null, tracks: null } : ({
    name: String(c.name ?? ''), duration: c.duration ?? c.duration_seconds ?? c.duration_s ?? null,
    tracks: c.tracks?.length ?? c.channels ?? null
  }));
  const nomes = new Set(lista.map((c) => c.name));
  const problemas = [];
  const alertas = [];
  for (const g of NECESSARIOS[modo] ?? NECESSARIOS.terrestre) {
    if (!g.some((c) => nomes.has(c))) alertas.push('Nenhum clipe para: ' + g.join('/'));
  }
  if (lista.length === 0) problemas.push('GLB sem clipes de animação.');
  for (const c of lista) {
    if (!c.name) problemas.push('Clipe sem nome.');
    if (c.duration != null && (!Number.isFinite(c.duration) || c.duration <= 0))
      problemas.push('Duração inválida: ' + c.name);
    if (c.tracks === 0) alertas.push('Clipe sem canais animados: ' + c.name);
  }
  for (const [papel, nome] of Object.entries(mapa)) {
    if (nome && !nomes.has(nome)) problemas.push('Mapeamento ' + papel + ' aponta para clipe ausente: ' + nome);
  }
  if (perfil?.clipes && velocidade != null && Number.isFinite(velocidade)) {
    for (const tipo of ['run', 'sprint', 'flee', 'swim_fast']) {
      const v = perfil.clipes[tipo]?.velNatural;
      if (Number.isFinite(v) && v > 0 && escala > 0 && velocidade / (v * escala) > 6)
        alertas.push('Corrida ' + tipo + ': velocidade exigiria timeScale acima de 6 (possível deslizamento).');
    }
  }
  if (modo !== 'terrestre') alertas.push('Perfil ' + modo + ': o controlador físico ainda não está integrado ao laboratório.');
  return {
    modo, total: lista.length,
    encontrados: [...nomes].filter(Boolean),
    problemas: [...new Set(problemas)],
    alertas: [...new Set(alertas)],
    validoEstrutural: problemas.length === 0,
    fisicaEspecialValidada: false
  };
}
