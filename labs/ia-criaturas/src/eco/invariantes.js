// Invariantes do núcleo compartilhado (IA Base V1). Nada aqui corrige estado: só acusa. Serve para os
// testes integrados e para qualquer execução longa falhar no PASSO em que a regra quebrou, em vez de só
// no fim. O que cada verificação NÃO mede está escrito ao lado dela.
import { altura } from './terreno.js';

const finito = (v) => typeof v === 'number' && Number.isFinite(v);

// Retorna uma lista de violações (vazia = tudo certo). Cada item diz o tick, o animal e a regra.
export function verificarInvariantes(mundo, { tolZ = 3 } = {}) {
  const f = [];
  const onde = (a) => `${a.id} t=${mundo.t.toFixed(1)}`;
  const t = mundo.terreno;

  // 1. Coordenadas válidas e dentro do mapa. Não mede colisão entre corpos.
  for (const a of mundo.animais) {
    if (!finito(a.x) || !finito(a.y) || !finito(a.z) || !finito(a.direcao) || !finito(a.velocidade))
      f.push(`${onde(a)}: coordenada ou velocidade inválida (${a.x}, ${a.y}, ${a.z}, dir ${a.direcao}, v ${a.velocidade})`);
    else if (a.vivo && (a.x < 0 || a.y < 0 || a.x > t.largura || a.y > t.profundidade))
      f.push(`${onde(a)}: fora do mapa (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`);
  }

  // 2. HP e necessidades numericamente sãos. HP pode ser negativo no passo da morte, nunca NaN.
  for (const a of mundo.animais) {
    const s = a.saude;
    if (!finito(s.hp) || !finito(s.hpMax) || s.hpMax <= 0) f.push(`${onde(a)}: HP inválido (${s.hp}/${s.hpMax})`);
    else if (a.vivo && s.hp > s.hpMax + 1e-6) f.push(`${onde(a)}: HP acima do máximo (${s.hp.toFixed(2)}/${s.hpMax.toFixed(2)})`);
    for (const k of ['fome', 'sede', 'energia']) if (!finito(a[k])) f.push(`${onde(a)}: ${k} inválida (${a[k]})`);
  }

  // 2b. Território e casa: o renderizador desenha esses círculos. Um raio ausente vira NaN no buffer de
  // posições e só aparece como erro do three.js, longe da causa.
  for (const a of mundo.animais) for (const k of ['territorio', 'casa']) {
    const c = a[k];
    if (c && !(finito(c.x) && finito(c.y) && finito(c.raio)))
      f.push(`${onde(a)}: ${k} com valor inválido (x ${c.x}, y ${c.y}, raio ${c.raio})`);
  }

  // 3. Identidade: ninguém duplicado, vivos e mortos coerentes com os índices.
  const vistos = new Set();
  for (const a of mundo.animais) {
    if (vistos.has(a.id)) f.push(`identidade duplicada: ${a.id}`);
    vistos.add(a.id);
  }
  for (const a of mundo.vivos) {
    if (!a) { f.push('vivos contém entrada nula'); continue; }
    if (!a.vivo) f.push(`${onde(a)}: morto na lista de vivos`);
    if (mundo.porId.get(a.id) !== a) f.push(`${onde(a)}: índice porId aponta para outro objeto`);
  }
  for (const a of mundo.animais) if (!a.vivo && mundo.porId.has(a.id)) f.push(`${onde(a)}: morto ainda indexado em porId`);

  // 4. Matéria da carcaça: nunca criada, nunca negativa. Não mede a velocidade do apodrecimento.
  for (const c of mundo.carcacas ?? []) {
    const animais = Object.values(c.consumo ?? {}).reduce((s, v) => s + v, 0);
    const saidas = animais + (c.consumoInsetos ?? 0) + (c.perdaDecomposicao ?? 0);
    if (!finito(c.carne) || c.carne < -1e-6) f.push(`carcaça ${c.id}: carne inválida (${c.carne})`);
    if (c.carne > c.carneInicial + 1e-6) f.push(`carcaça ${c.id}: carne acima da inicial (${c.carne} > ${c.carneInicial})`);
    if (saidas > c.carneInicial + 1e-3) f.push(`carcaça ${c.id}: saídas ${saidas.toFixed(3)} kg > massa inicial ${c.carneInicial} kg`);
  }

  // 5. Recursos do terreno: vegetação dentro do próprio teto; nada consumido de célula vazia.
  for (let k = 0; k < t.vegetacao.length; k++) {
    if (!finito(t.vegetacao[k]) || t.vegetacao[k] < -1e-3 || t.vegetacao[k] > t.vegetacaoMax[k] + 1e-3) {
      f.push(`terreno: vegetação inválida na célula ${k} (${t.vegetacao[k]} / teto ${t.vegetacaoMax[k]})`);
      break; // uma só basta; o resto é ruído
    }
  }
  for (const c of mundo.cupinzeiros ?? []) {
    if (!finito(c.populacao) || c.populacao < -1e-6 || c.populacao > c.populacaoMax + 1e-6)
      f.push(`cupinzeiro ${c.id}: população inválida (${c.populacao}/${c.populacaoMax})`);
  }

  // 6. Transição física impossível: estado de meio sem a capacidade declarada, ou corpo fora do meio.
  //    Tolerância de ${tolZ} m em z cobre o salto do bote e a rampa de pouso; não substitui o teste de
  //    penetração no terreno de cada controlador.
  for (const a of mundo.vivos) {
    if (a.voo && !a.especie.voo) f.push(`${onde(a)}: estado de voo sem ficha de voo`);
    if (a.subsolo && !a.especie.subsolo) f.push(`${onde(a)}: estado de subsolo sem ficha de subsolo`);
    if (a.serpente && !a.especie.serpente) f.push(`${onde(a)}: estado de serpente sem ficha de serpente`);
    if (a.camuflagem && !a.especie.camuflagemAtiva) f.push(`${onde(a)}: estado de camuflagem sem ficha`);
    if (a.veneno && !a.especie.veneno) f.push(`${onde(a)}: reserva de veneno sem ficha`);
    if (a.subsolo && a.subsolo.prof > (a.subsolo.perfil?.profundidadeMaxM ?? 0) + 1e-3)
      f.push(`${onde(a)}: profundidade ${a.subsolo.prof.toFixed(2)} m acima do limite da espécie`);
    const noAr = (a.voo?.alt ?? 0) > 0.2, enterrado = (a.subsolo?.prof ?? 0) > 0.05;
    if (!noAr && !enterrado && finito(a.z) && Math.abs(a.z - altura(t, a.x, a.y)) > tolZ)
      f.push(`${onde(a)}: corpo a ${(a.z - altura(t, a.x, a.y)).toFixed(2)} m da superfície sem voar nem escavar`);
  }

  // 7. Reação sem percepção: o próprio mundo já registra; aqui só repassamos como violação.
  for (const x of mundo.metricas?.falhas ?? []) f.push(`falha registrada: ${x.tipo} ${x.id} t=${x.t.toFixed(1)}`);

  return f;
}
