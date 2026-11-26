// Oficina experimental: adapta fichas de catálogo ao contrato atual do motor, sem alterar arquivos oficiais.
// Não implementa habilidades de voo, natação subterrânea ou alimentação por cupins; apenas IA terrestre base.
import { normalizarCapacidades, validarSuporteLocomocao } from './capacidades.js';
import { cos, sen } from '../core/matematica.js';
const LIMITES = {
  massa: [0.1, 200000], comprimento: [0.15, 120], altura: [0.1, 50],
  velocidade: [0.2, 35], fome: [0, 300], sede: [0, 300],
  vida: [1, 3000], alcance: [2, 600], quantidade: [1, 30]
};
export function limitarNumero(campo, valor, padrao) {
  const n = Number(valor), [a, b] = LIMITES[campo];
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : padrao;
}
const ANIM = {
  parado: ['idle', 'stand', 'rest'], andar: ['walk', 'swim_sand', 'glide_shallow'],
  trote: ['trot', 'run', 'swim_sand'], corrida: ['run', 'sprint', 'swim_fast', 'flee'],
  fuga: ['flee', 'evade', 'swim_fast', 'run'],
  comer: ['feed', 'graze', 'filter_feed', 'scavenge'],
  beber: ['drink', 'feed'], alerta: ['alert', 'lookout', 'threat_display'],
  vigiar: ['lookout', 'alert'], descansar: ['rest', 'idle'],
  farejar: ['sniff', 'scent', 'inspect'],
  mordida: ['bite', 'attack', 'charge'], ataque: ['attack', 'bite', 'charge'],
  ferido: ['hurt', 'alert'], morte: ['death', 'die'],
  girarDir: ['turn_right'], girarEsq: ['turn_left'],
  exibicao: ['threat_display', 'crest_display']
};
export function mapearClipes(nomes) {
  const mapa = new Map((nomes || []).map((x) => [String(x).toLowerCase(), x]));
  const out = {};
  for (const [chave, candidatos] of Object.entries(ANIM)) {
    const achado = candidatos.find((x) => mapa.has(x));
    if (achado) out[chave] = mapa.get(achado);
  }
  if (!out.parado && nomes?.length) out.parado = nomes[0];
  return out;
}
export function criarFichaExperimental(modelo, entrada, baseHerbivoro, baseCarnivoro) {
  if (!entrada || !entrada.id || !entrada.glb || !entrada.glb.startsWith('assets/models/creatures/') || !entrada.glb.endsWith('.glb'))
    throw new Error('Modelo fora do catálogo das criaturas.');
  const papel = entrada.papel === 'carnivoro' ? 'carnivoro' : 'herbivoro';
  const base = papel === 'carnivoro' ? baseCarnivoro : baseHerbivoro;
  const e = structuredClone(base);
  e.id = entrada.id; e.nome = entrada.nome || modelo.nome || modelo.arquivo || entrada.id;
  e.ficha = 'experimento: ' + modelo.glb;
  e.papel = papel;
  const massa = limitarNumero('massa', entrada.massa, modelo.massaSugerida ?? 25);
  e.corpo.massaKg = [+(massa * 0.85).toFixed(3), +(massa * 1.15).toFixed(3)];
  e.corpo.comprimentoM = limitarNumero('comprimento', entrada.comprimento, 2);
  e.corpo.alturaM = limitarNumero('altura', entrada.altura, 1);
  e.corpo.raio = Math.max(0.1, Math.min(e.corpo.comprimentoM * 0.3, 3));
  e.movimento.corrida = limitarNumero('velocidade', entrada.velocidade, 5);
  e.movimento.andar = Math.max(0.15, e.movimento.corrida * 0.24);
  e.movimento.trote = Math.max(e.movimento.andar, e.movimento.corrida * 0.57);
  e.necessidades.fomePorDia = limitarNumero('fome', entrada.fome, 55);
  e.necessidades.sedePorDia = limitarNumero('sede', entrada.sede, 70);
  e.percepcao.visao.alcance = limitarNumero('alcance', entrada.alcance, 40);
  e.saude.max = limitarNumero('vida', entrada.vida, 100);
  e.modelo.glb = modelo.glb;
  e.modelo.frente = ['+X', '-X', '+Z', '-Z'].includes(entrada.frente) ? entrada.frente : '+X';
  e.modelo.clipes = mapearClipes(modelo.animacoesDeclaradas);
  e.capacidades = normalizarCapacidades({
    modo: entrada.modo ?? 'terrestre',
    habilidades: entrada.habilidades ?? [],
    permitirProxySuperficie: entrada.permitirProxySuperficie === true
  });
  // Não fingir física 3D: proxy de superfície é opt-in, marcado na ficha e no painel.
  e.perfilLocomocao = { ...e.capacidades, simulador: e.capacidades.simulacao };
  validarSuporteLocomocao(e.perfilLocomocao);
  // Preservar reprodutibilidade: sem alterações diretas nos templates; taxas e anatomia são provisórias.
  e.modelo.limitacoes = [e.capacidades.simulacao === 'proxy_superficie' ? 'PROXY terrestre: habilidade especial não é simulada.' : 'Ficha adaptada para simulação terrestre experimental.'];
  e.balanceamento = { status: 'experimental', origem: 'oficina-laboratorio', idCatalogo: modelo.id };
  if (papel === 'carnivoro') {
    e.dieta.presas = Array.isArray(entrada.presas) ? [...new Set(entrada.presas.filter((x) => typeof x === 'string'))] : [];
  } else {
    e.dieta.presas = [];
    e.teme = [];
  }
  return e;
}
export function criarExperimento(config, cenario, selecao, catalogo) {
  const especies = structuredClone(config.especies);
  const populacoes = [...cenario.populacoes];
  const modelos = new Map(catalogo.map((x) => [x.id, x]));
  const usados = new Set(Object.keys(especies));
  const novos = [];
  const largura = cenario.terreno.dados?.largura ?? cenario.terreno.largura ?? 240;
  const profundidade = cenario.terreno.dados?.profundidade ?? cenario.terreno.profundidade ?? 220;
  for (const [i, item] of selecao.entries()) {
    const modelo = modelos.get(item.id);
    if (!modelo || modelo.glb !== item.glb || usados.has(item.id)) throw new Error('Item inválido ou duplicado no catálogo.');
    const ficha = criarFichaExperimental(modelo, item, especies.velsari, especies.varrisco);
    usados.add(ficha.id);
    especies[ficha.id] = ficha;
    novos.push({ ficha, entrada: item });
    const angulo = i * 2.399963229728653;
    const raio = Math.min(22, largura * 0.12, profundidade * 0.12);
    const x = Math.max(5, Math.min(largura - 5, largura * 0.52 + raio * cos(angulo)));
    const y = Math.max(5, Math.min(profundidade - 5, profundidade * 0.52 + raio * sen(angulo)));
    const quantidade = Math.round(limitarNumero('quantidade', item.quantidade, 2));
    // Herbívoros com vários indivíduos devem formar um grupo real para a IA social do núcleo.
    // Carnívoros permanecem indivíduos para não presumir caça cooperativa em espécies sem ficha.
    if (ficha.papel === 'herbivoro' && quantidade > 1) {
      populacoes.push({ especie: ficha.id, grupos: [{ x, y, raio: 4, adultos: quantidade, filhotes: 0, raioCasa: 60, fome: 45, sede: 35 }] });
    } else {
      populacoes.push({
        especie: ficha.id,
        individuos: Array.from({ length: quantidade }, (_, j) => ({
          id: ficha.id + '-' + (j + 1),
          x: Math.max(2, Math.min(largura - 2, x + (j % 4) * 2.2)),
          y: Math.max(2, Math.min(profundidade - 2, y + Math.floor(j / 4) * 2.2)),
          fome: 45, sede: 35
        }))
      });
    }
  }
  for (const { ficha, entrada } of novos) {
    if (ficha.papel === 'carnivoro') {
      ficha.dieta.presas = ficha.dieta.presas.filter((id) => id !== ficha.id && especies[id]);
      for (const id of ficha.dieta.presas) {
        const alvo = especies[id]; alvo.teme ??= [];
        if (!alvo.teme.includes(ficha.id)) alvo.teme.push(ficha.id);
      }
    } else if (entrada.predadoresPodemCacar) {
      for (const outro of Object.values(especies)) {
        if (outro.papel !== 'carnivoro') continue;
        outro.dieta.presas ??= [];
        if (!outro.dieta.presas.includes(ficha.id)) outro.dieta.presas.push(ficha.id);
        ficha.teme.push(outro.id);
      }
    }
  }
  return {
    config: { ...config, especies },
    cenario: { ...cenario, populacoes }
  };
}
