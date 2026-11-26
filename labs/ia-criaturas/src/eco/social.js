// Grupos sociais: papéis (líder por dominância, sentinela em rodízio), coesão percebida e reagrupamento.
// O objeto de grupo guarda só papéis e composição — NUNCA informação sobre ameaças (isso só circula por sons e visão).

export function criarGrupo(mundo, especie, membros) {
  const g = { id: `g${++mundo.contadorGrupos}`, especie: especie.id, membros: membros.map((m) => m.id), lider: null, sentinela: null, sentinelaDesde: -1e9, criadoEm: mundo.t, centroCasa: null };
  for (const m of membros) m.grupoId = g.id;
  mundo.grupos.set(g.id, g);
  atualizarPapeis(mundo, g, true);
  return g;
}

const dominancia = (a) => a.massa * (0.5 + a.temperamento.agressividade) * (a.saude.hp / a.saude.hpMax) * (a.juvenil ? 0.2 : 1) + a.idadeAnos * 0.5;

export function atualizarPapeis(mundo, g, forcar = false) {
  const vivos = g.membros.map((id) => mundo.porId.get(id)).filter((m) => m?.vivo);
  g.membros = vivos.map((m) => m.id);
  if (!vivos.length) return;
  const adultos = vivos.filter((m) => !m.juvenil);
  const especie = vivos[0].especie;
  if (especie.social.dominancia && adultos.length) {
    const lider = [...adultos].sort((x, y) => dominancia(y) - dominancia(x) || (x.numero - y.numero))[0];
    if (lider.id !== g.lider) { g.lider = lider.id; if (!forcar) mundo.evento('novo_lider', lider.id, { grupo: g.id }); }
  }
  // Rodízio de sentinela a cada ~40 s entre adultos saudáveis que não são o líder (prefere quem é mais vigilante e já comeu).
  if (especie.social.sentinela && adultos.length >= 2 && (forcar || mundo.t - g.sentinelaDesde > 40)) {
    let candidatos = adultos.filter((m) => m.id !== g.sentinela && m.id !== g.lider && m.fome < 70 && m.saude.hp > m.saude.hpMax * 0.5);
    if (!candidatos.length) candidatos = adultos.filter((m) => m.id !== g.lider);
    if (candidatos.length) {
      const s = [...candidatos].sort((x, y) => y.temperamento.vigilancia - x.temperamento.vigilancia + (x.fome - y.fome) * 0.01 || x.numero - y.numero)[0];
      g.sentinela = s.id; g.sentinelaDesde = mundo.t;
      mundo.evento('sentinela', s.id, { grupo: g.id });
    }
  }
  for (const m of vivos) m.papel = m.juvenil ? 'filhote' : m.id === g.sentinela ? 'sentinela' : m.id === g.lider ? 'lider' : 'membro';
}

// Membros do grupo conhecidos pelo animal (vistos agora ou lembrados há pouco).
export function membrosConhecidos(a, mundo, idadeMax = 15) {
  if (!a.grupoId) return [];
  const out = [];
  for (const [id, m] of a.memoria.criaturas) {
    if (m.grupo === a.grupoId && mundo.t - m.t <= idadeMax) out.push(m);
  }
  return out;
}

export function centro(lista) {
  if (!lista.length) return null;
  let x = 0, y = 0;
  for (const m of lista) { x += m.x; y += m.y; }
  return { x: x / lista.length, y: y / lista.length };
}

// Ponto de coesão: perto do centro conhecido do grupo, mantendo separação mínima.
export function pontoCoesao(a, conhecidos, raio) {
  const c = centro(conhecidos);
  if (!c) return null;
  const dx = a.x - c.x, dy = a.y - c.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < raio) return null;
  return { x: c.x + (dx / (d || 1)) * raio * 0.5, y: c.y + (dy / (d || 1)) * raio * 0.5 };
}
