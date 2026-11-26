// Vista do Varrisco da linha MH (?mh=1): clipes de estado do GLB v05 que o Animal3D compartilhado não conhece
// (rugido, queda e levantar, vacilo, mancar, cansaço). Só envolve a instância do monstro; o Animal3D e as demais
// criaturas ficam como estão. Os golpes continuam pelo caminho normal (modelo.clipes[golpe.nome]).

// Qual clipe o estado do monstro pede agora: {nome, locomocao, travar} ou null (fica a escolha padrão).
export function clipeMonstro(a, t) {
  const s = a.monstro;
  if (!s || !a.vivo) return null;
  const caidoAte = a.saude.caidoAte ?? 0;
  if (t < caidoAte) return t < caidoAte - 1.5 ? {nome: 'fall', travar: true} : {nome: 'get_up', travar: true};
  if (s.janela?.ataque === 'queda' && t < s.janela.ate + .4) return {nome: 'get_up', travar: true};
  if (s.janela?.ataque === 'vacilo' && t < s.janela.ate) return {nome: 'stagger', travar: true};
  if (a.estado === 'rugindo') return {nome: 'roar', travar: true};
  if (a.estado === 'mancando') return a.velocidade > .15 ? {nome: 'limp', locomocao: true} : {nome: 'hurt_leg', travar: true};
  if (a.estado === 'ofegante' && a.velocidade < .25) return {nome: 'exhausted'};
  return null;
}

export function instalarVisualMonstro(v, {tempo}) {
  v.monstroVisual = true; // window.hunterLab.clipes() passa a relatar o clipe do monstro
  const escolher = v.escolher.bind(v);
  v.escolher = (a, mapa) => {
    const c = clipeMonstro(a, tempo());
    if (!c || !v.clipes.has(c.nome)) return escolher(a, mapa);
    v.travarMonstro = !!c.travar;
    return [c.nome, !!c.locomocao];
  };
  const passo = v.passoSimulacao.bind(v);
  v.passoSimulacao = (a) => {
    const antes = v.atual;
    passo(a);
    // Clipe de estado de uma vez só (rugido, queda): toca até o fim e segura o último quadro, sem repetir.
    if (v.atual !== antes && v.travarMonstro && v.clipes.has(v.nomeAtual) && !v.umaVez) {
      v.atual.setLoop(v.THREE.LoopOnce, 1); v.atual.clampWhenFinished = true;
    }
    v.travarMonstro = false;
  };
}
