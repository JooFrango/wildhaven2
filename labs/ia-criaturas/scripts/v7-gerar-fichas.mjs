#!/usr/bin/env node
// Gera as fichas EXPERIMENTAIS da V7 em config/eco/especies a partir de uma ficha-base do laboratório mais
// as diferenças declaradas aqui. As fichas oficiais (creatures/species) não são tocadas; os GLBs só são lidos.
// Tudo o que não vem da ficha oficial fica listado em balanceamento.provisorios.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAIZ_LAB } from '../src/node/carregar-node.js';

const dir = join(RAIZ_LAB, 'config', 'eco', 'especies');
const ler = async (f) => JSON.parse(await readFile(join(dir, f), 'utf8'));
const fundir = (a, b) => {
  if (b === null || typeof b !== 'object' || Array.isArray(b)) return b;
  const o = { ...(a && typeof a === 'object' && !Array.isArray(a) ? a : {}) };
  for (const [k, v] of Object.entries(b)) o[k] = fundir(o[k], v);
  return o;
};
const PROV = ['tudo exceto corpo, dieta e hábitos citados em _fonteFicha'];

const FICHAS = [
  {
    base: 'varrisco.json', id: 'boscaranha', nome: 'Boscaranha',
    d: {
      ficha: 'creatures/species/boscaranha.json', atividade: 'crepuscular',
      _fonteFicha: 'floresta temperada; 12–26 kg; 0,38–0,60 m; solitária, emboscada; presa principal: folhisco; bote curto e golpe de quelíceras; veneno previsto na ficha como "sistema de gameplay futuro"',
      experimental: { v7: true, capacidades: ['veneno', 'taticasDeEmboscada'], nota: 'Espécie real do catálogo; veneno e parâmetros de combate são experimentais do laboratório.' },
      corpo: { massaKg: [12, 26], comprimentoM: 1.5, alturaM: 0.5, raio: 0.55, ectotermico: true },
      movimento: { andar: 0.75, trote: 2.2, corrida: 4.7, aceleracao: 14, giroGrausSeg: 300, resistenciaSeg: 3, inclinacaoMaxGraus: 50 },
      percepcao: { visao: { alcance: 15, anguloGraus: 260, alcanceProximo: 2, tempoReconhecimentoSeg: 0.7 }, audicao: { alcance: 4, erroRelativo: 0.4 }, olfato: { alcance: 8 }, memoriaSeg: 40 },
      furtividade: { camuflagem: 0.35, fatorParado: 0.45, ruidoPassos: 0.3 },
      necessidades: { custoCorridaPorSeg: 9, fomePorDia: 25, sedePorDia: 20, fomeCacar: 30, comerPorSeg: 0.4 },
      dieta: { vegetacao: [], presas: ['folhisco', 'cromatil'], carnica: false, microfauna: true },
      teme: ['varrisco', 'rocantraz'], competidores: ['boscaranha'],
      social: { tipo: 'solitario', tamanho: [1, 1], probabilidadePar: 0, cacaCooperativa: false, territorial: true, raioTerritorioM: 60, marcacao: false },
      combate: {
        protecao: { cabeca: 0.3, pescoco: 0.2, tronco: 0.3, flanco: 0.25, pernas: 0.15, cauda: 0.2 }, forca: 0.35, defesa: 0.3, esquiva: 0.35, agarrar: false, forcaMordida: 0.6,
        ataques: [
          { nome: 'mordida', alcance: 0.9, dano: 5, preparoSeg: 0.3, recargaSeg: 1.2, regioes: ['tronco', 'pernas', 'pescoco', 'flanco'], clipe: 'bite' },
          { nome: 'bote', alcance: 2.2, dano: 4, preparoSeg: 0.45, recargaSeg: 3.5, regioes: ['tronco', 'pescoco'], clipe: 'pounce', exigeSurpresa: true },
        ],
        exibicao: 'threat_display',
      },
      saude: { max: 60 },
      veneno: { tipo: 'neurotoxico', potencia: 1, doseMg: 9, reservaMg: 27, recargaMgPorSeg: 0.01, ataques: ['mordida', 'bote'], meiaVidaSeg: 150, latenciaSeg: 10, esperaSeg: 90, custoEnergiaPorMg: 0.4 },
      resistenciaVeneno: 0.6,
      taticasDeEmboscada: { raioBuscaM: 25, esperaMaxSeg: 120, distanciaDisparoM: 4 },
      modelo: {
        glb: 'assets/models/creatures/boscaranha/boscaranha-optimized-v02-LOD0.glb', frente: '-Z',
        clipes: { parado: 'idle', andar: 'walk', trote: 'scuttle', corrida: 'sprint', espreita: 'stalk', girarEsq: 'turn_left', girarDir: 'turn_right', alerta: 'vigilance', farejar: 'sense_vibrations', mordida: 'bite', bote: 'pounce', comer: 'feed', beber: 'feed', exibicao: 'threat_display', descansar: 'rest', ferido: 'hurt', morte: 'death' },
        limitacoes: ['clipes no lugar (manifesto)', 'sem VFX de teia nem de veneno'],
      },
    },
  },
  {
    base: 'cromatil.json', id: 'folhisco', nome: 'Folhisco',
    d: {
      ficha: 'creatures/species/folhisco.json', atividade: 'diurno',
      _fonteFicha: 'floresta temperada; 2–3 kg; 0,35–0,45 m; bando pequeno (4–9); anda 1,1 m/s, dispara 5 m/s por 6 s; não voa; presa principal da Boscaranha',
      experimental: { v7: true, capacidades: [], nota: 'Espécie real do catálogo usada como presa vulnerável nos cenários de veneno.' },
      corpo: { massaKg: [2, 3], comprimentoM: 0.6, alturaM: 0.4, raio: 0.2 },
      movimento: { andar: 1.1, trote: 2.6, corrida: 5, aceleracao: 14, giroGrausSeg: 420, resistenciaSeg: 6, inclinacaoMaxGraus: 40, escalarRochas: false },
      percepcao: { visao: { alcance: 30, anguloGraus: 300, alcanceProximo: 2, tempoReconhecimentoSeg: 0.5 }, audicao: { alcance: 20, erroRelativo: 0.2 }, olfato: { alcance: 4 }, memoriaSeg: 30 },
      teme: ['boscaranha', 'varrisco', 'rocantraz', 'proto-cacador-camuflado', 'proto-serpente-termica'],
      social: { tipo: 'bando', tamanho: [4, 9], territorial: false, coesaoM: 6, refugio: 'cobertura' },
      memoriaDePerigo: { raioM: 15, seg: 600 },
      combate: { ataques: [{ nome: 'bicada', alcance: 0.4, dano: 1, preparoSeg: 0.2, recargaSeg: 1, regioes: ['cabeca', 'pernas'], clipe: 'peck' }] },
      saude: { max: 22 },
      modelo: {
        glb: 'assets/models/creatures/folhisco/folhisco-optimized-v02-LOD0.glb', frente: '-Z',
        clipes: { parado: 'idle', andar: 'walk', trote: 'run', corrida: 'run', comer: 'peck', beber: 'drink', alerta: 'alert', ameaca: 'alarm_call', recuo: 'hide', descansar: 'preen', ferido: 'hurt', morte: 'death' },
        limitacoes: ['clipes no lugar (manifesto)'],
      },
    },
  },
  {
    base: 'varrisco.json', id: 'proto-cacador-camuflado', nome: 'PROTÓTIPO · Caçador Camuflado',
    d: {
      ficha: null,
      _fonteFicha: 'ESPÉCIE HIPOTÉTICA DE LABORATÓRIO. Não existe no catálogo. Usa o GLB do Varrisco só como corpo de teste.',
      experimental: { v7: true, hipotetica: true, capacidades: ['camuflagemAtiva'], proxyVisual: 'GLB do Varrisco (não é a aparência desta criatura)', nota: 'Serve só para testar camuflagem óptica ativa. Nada aqui altera o Varrisco.' },
      dieta: { presas: ['velsari', 'cromatil', 'tarruco', 'folhisco'] },
      teme: ['rocantraz'], competidores: ['proto-cacador-camuflado'],
      social: { tipo: 'solitario', tamanho: [1, 1], probabilidadePar: 0, cacaCooperativa: false },
      camuflagemAtiva: { reducaoVisual: 0.82, custoPorSeg: 0.55, custoExtraCorridaPorSeg: 1.6, energiaMin: 15, energiaReativar: 35, recargaSeg: 12, transicaoSeg: 1.5 },
    },
  },
  {
    base: 'varrisco.json', id: 'proto-serpente-termica', nome: 'PROTÓTIPO · Serpentino Termossensível',
    d: {
      ficha: null, atividade: 'noturno',
      _fonteFicha: 'ESPÉCIE HIPOTÉTICA DE LABORATÓRIO. Não há serpente no catálogo. Usa o GLB do Gravarto só como corpo de teste (réptil quadrúpede, não serpente).',
      experimental: { v7: true, hipotetica: true, capacidades: ['termorrecepcao', 'veneno', 'taticasDeEmboscada'], proxyVisual: 'GLB do Gravarto (não é uma serpente; não é a aparência desta criatura)', nota: 'Serve só para testar termorrecepção e veneno hemotóxico. Nada aqui altera o Gravarto.' },
      corpo: { massaKg: [28, 45], comprimentoM: 2.6, alturaM: 0.7, raio: 0.5, ectotermico: true },
      movimento: { andar: 0.8, trote: 2.2, corrida: 6.5, aceleracao: 9, giroGrausSeg: 160, resistenciaSeg: 5, inclinacaoMaxGraus: 35 },
      percepcao: {
        visao: { alcance: 14, anguloGraus: 150, alcanceProximo: 1.5, tempoReconhecimentoSeg: 1.2 }, audicao: { alcance: 6, erroRelativo: 0.4 }, olfato: { alcance: 25 }, memoriaSeg: 40,
        termorrecepcao: { alcance: 16, anguloGraus: 130, sensibilidadeC: 2, contrasteRefC: 12, erroRelativo: 0.2, tempoReconhecimentoSeg: 1 },
      },
      furtividade: { camuflagem: 0.4, fatorParado: 0.4, ruidoPassos: 0.35 },
      necessidades: { fomePorDia: 12, sedePorDia: 15, fomeCacar: 30 },
      dieta: { vegetacao: [], presas: ['folhisco', 'cromatil'], carnica: false, microfauna: true },
      teme: ['rocantraz', 'proto-cacador-camuflado'], competidores: ['proto-serpente-termica'],
      social: { tipo: 'solitario', tamanho: [1, 1], probabilidadePar: 0, cacaCooperativa: false, territorial: false, marcacao: false },
      combate: {
        forca: 0.45, defesa: 0.3, esquiva: 0.3, agarrar: false, forcaMordida: 0.8,
        ataques: [{ nome: 'mordida', alcance: 1.6, dano: 8, preparoSeg: 0.25, recargaSeg: 1.8, regioes: ['tronco', 'pernas', 'pescoco', 'flanco'], clipe: 'bite' }],
        exibicao: 'threaten',
      },
      saude: { max: 90 },
      veneno: { tipo: 'hemotoxico', potencia: 1, doseMg: 25, reservaMg: 60, recargaMgPorSeg: 0.01, ataques: ['mordida'], meiaVidaSeg: 200, latenciaSeg: 15, esperaSeg: 120, custoEnergiaPorMg: 0.2 },
      resistenciaVeneno: 0.5,
      taticasDeEmboscada: { raioBuscaM: 20, esperaMaxSeg: 180, distanciaDisparoM: 2.2 },
      modelo: {
        glb: 'assets/models/creatures/gravarto/v02/gravarto-v02-animated-LOD0.glb', frente: '+X',
        clipes: { parado: 'idle', andar: 'walk', trote: 'trot', corrida: 'short_sprint', espreita: 'stalk', girarEsq: 'turn_left', girarDir: 'turn_right', alerta: 'alert', farejar: 'sniff', mordida: 'bite', comer: 'feed', beber: 'drink', exibicao: 'threaten', descansar: 'rest', ferido: 'hurt', morte: 'death' },
        limitacoes: ['PROXY: corpo do Gravarto', 'sem animação de língua/fosseta'],
      },
    },
  },
  {
    base: 'varrisco.json', id: 'carniroca', nome: 'Carniroca',
    d: {
      ficha: 'creatures/species/carniroca.json', atividade: 'diurno',
      _fonteFicha: 'ave carniceira média; floresta/campo temperado e penhascos; dieta: carniça e presa pequena oportunista; busca solitária, vários convergem sobre a carcaça ao ver uma descida ou ouvir chamado; GLB com 6 ossos de asa e clipes takeoff/fly/glide/flap_hard/bank/land. A ficha oficial não traz massa nem velocidades.',
      experimental: { v7: true, capacidades: ['voo', 'comportamentoDeBando', 'necrofagia'], nota: 'Espécie real do catálogo; todos os números de voo são experimentais do laboratório.' },
      corpo: { massaKg: [4, 7], comprimentoM: 1.0, alturaM: 0.7, raio: 0.4 },
      movimento: { andar: 0.6, trote: 1.3, corrida: 2.6, aceleracao: 6, giroGrausSeg: 220, resistenciaSeg: 8, inclinacaoMaxGraus: 35 },
      percepcao: { visao: { alcance: 120, anguloGraus: 250, alcanceProximo: 2, tempoReconhecimentoSeg: 0.6 }, audicao: { alcance: 30, erroRelativo: 0.25 }, olfato: { alcance: 90 }, memoriaSeg: 60 },
      furtividade: { camuflagem: 0.05, fatorParado: 0.9, ruidoPassos: 0.5 },
      necessidades: { custoBasePorSeg: 0.03, custoCorridaPorSeg: 3, recuperacaoPorSeg: 2.2, fomePorDia: 45, sedePorDia: 35, fomeCacar: 101, fomeDesesperada: 101, comerPorSeg: 0.25 },
      dieta: { vegetacao: [], presas: [], carnica: true, microfauna: false },
      teme: ['varrisco', 'rocantraz', 'proto-cacador-camuflado'], competidores: [],
      social: { tipo: 'solitario', tamanho: [1, 1], probabilidadePar: 0, cacaCooperativa: false, territorial: false, marcacao: false },
      combate: {
        forca: 0.2, defesa: 0.15, esquiva: 0.5, agarrar: false, forcaMordida: 0.5,
        ataques: [{ nome: 'bicada', alcance: 0.6, dano: 4, preparoSeg: 0.3, recargaSeg: 1.2, regioes: ['cabeca', 'tronco', 'flanco'], clipe: 'peck_carrion' }],
        exibicao: 'threaten',
      },
      saude: { max: 45 },
      voo: {
        velMin: 6, velCruzeiro: 11, velMax: 17, aceleracao: 5, giroGrausSeg: 75, subidaMax: 3, descidaMax: 6, razaoPlaneio: 12,
        altitudeCruzeiroM: 22, altitudeMaxM: 80, folgaObstaculoM: 4, custoBatidoPorSeg: 1.4, custoPlaneioPorSeg: 0.12,
        decolagemSeg: 1.6, energiaMinDecolar: 25, energiaPousar: 18, distanciaVoarM: 25, distanciaFugaM: 30, pairar: false,
        bando: { raioM: 45, separacaoM: 6, coesao: 1, alinhamento: 1, separacao: 2.4 },
      },
      modelo: {
        glb: 'assets/models/creatures/carniroca/carniroca-optimized-v02-LOD0.glb', frente: '-Z',
        clipes: { parado: 'idle', andar: 'walk', trote: 'hop', corrida: 'hop', alerta: 'scan', farejar: 'scan', bicada: 'peck_carrion', comer: 'tear_meat', beber: 'peck_carrion', exibicao: 'threaten', descansar: 'rest', ferido: 'hurt', morte: 'death',
          decolar: 'takeoff', voar: 'fly', voarForte: 'flap_hard', planar: 'glide', pousar: 'land', curvaEsq: 'bank_left', curvaDir: 'bank_right' },
        limitacoes: ['clipes no lugar (manifesto)', 'sem IK de patas no pouso'],
      },
    },
  },
  {
    base: 'cromatil.json', id: 'pica-termita', nome: 'Pica-Termita de Crista',
    d: {
      ficha: 'creatures/species/pica_termita.json', atividade: 'diurno',
      _fonteFicha: 'especialista em cupins; campo/savana/borda de floresta; 0,9–2,6 kg; 0,65–0,95 m; par territorial; anda 0,67 m/s, corre 2 m/s, voa; 60 cupins por visita; compete com Ferrunco e Dunlíngua',
      experimental: { v7: true, capacidades: ['voo', 'cupinivoria'], nota: 'Espécie real do catálogo. GLB com animação por pivôs (sem SkinnedMesh); só tem clipes fly e land.' },
      corpo: { massaKg: [0.9, 2.6], comprimentoM: 0.9, alturaM: 0.8, raio: 0.3 },
      movimento: { andar: 0.67, trote: 1.3, corrida: 2, aceleracao: 8, giroGrausSeg: 300, resistenciaSeg: 8, inclinacaoMaxGraus: 35, escalarRochas: false },
      percepcao: { visao: { alcance: 60, anguloGraus: 295, alcanceProximo: 2, tempoReconhecimentoSeg: 0.5 }, audicao: { alcance: 20, erroRelativo: 0.25 }, olfato: { alcance: 6 }, memoriaSeg: 90 },
      necessidades: { fomePorDia: 60, sedePorDia: 30, comerPorSeg: 1, fomeProcurar: 35 },
      dieta: { vegetacao: [], presas: [], carnica: false, cupins: { porSeg: 3, alcanceM: 1.2, abre: false } },
      teme: ['varrisco', 'rocantraz', 'boscaranha', 'proto-cacador-camuflado'],
      social: { tipo: 'solitario', tamanho: [1, 1], territorial: true },
      combate: { ataques: [{ nome: 'bicada', alcance: 0.5, dano: 2, preparoSeg: 0.2, recargaSeg: 1, regioes: ['cabeca', 'pernas'], clipe: 'peck' }] },
      saude: { max: 20 },
      voo: {
        velMin: 4, velCruzeiro: 8, velMax: 12, aceleracao: 6, giroGrausSeg: 110, subidaMax: 3, descidaMax: 5, razaoPlaneio: 6,
        altitudeCruzeiroM: 10, altitudeMaxM: 40, folgaObstaculoM: 3, custoBatidoPorSeg: 2.2, custoPlaneioPorSeg: 0.4,
        decolagemSeg: 0.8, energiaMinDecolar: 25, energiaPousar: 20, distanciaVoarM: 18, distanciaFugaM: 20, pairar: false,
      },
      modelo: {
        glb: 'assets/models/creatures/pica-termita/pica-termita-optimized-v03-LOD0.glb', frente: '+Z',
        clipes: { parado: 'idle', andar: 'walk', trote: 'hop', corrida: 'hop', comer: 'feed', beber: 'peck', alerta: 'alert', ameaca: 'crest_display', recuo: 'flee', descansar: 'rest', ferido: 'hurt', morte: 'death',
          inspecionar: 'inspect', decolar: 'fly', voar: 'fly', planar: 'fly', pousar: 'land' },
        limitacoes: ['sem clipe de decolagem nem de planeio: usa fly', 'animação por pivôs'],
      },
    },
  },
  {
    base: 'tarruco.json', id: 'ferrunco', nome: 'Ferrunco',
    d: {
      ficha: 'creatures/species/ferrunco.json', atividade: 'diurno',
      _fonteFicha: 'especialista em cupins; florestas; 140–300 kg; 0,9–1,2 m; solitário; anda 1,5 m/s, corre 4,5 m/s; olfato excepcional; cava; 340 cupins por visita; compete com Dunlíngua e Pica-Termita',
      experimental: { v7: true, capacidades: ['cupinivoria'], nota: 'Espécie real do catálogo. GLB com animação por pivôs (sem SkinnedMesh).' },
      corpo: { massaKg: [140, 300], comprimentoM: 2.6, alturaM: 1.05, raio: 0.8 },
      movimento: { andar: 1.5, trote: 2.8, corrida: 4.5, aceleracao: 4, giroGrausSeg: 120, resistenciaSeg: 20, inclinacaoMaxGraus: 30 },
      percepcao: { visao: { alcance: 30, anguloGraus: 240, alcanceProximo: 2.5, tempoReconhecimentoSeg: 1 }, audicao: { alcance: 25, erroRelativo: 0.3 }, olfato: { alcance: 120 }, memoriaSeg: 120 },
      necessidades: { fomePorDia: 45, sedePorDia: 30, comerPorSeg: 1, fomeProcurar: 35 },
      dieta: { vegetacao: [], presas: [], carnica: false, cupins: { porSeg: 12, alcanceM: 1.8, abre: true } },
      teme: ['rocantraz'],
      social: { tipo: 'solitario', tamanho: [1, 1], territorial: true },
      combate: { forca: 0.7, defesa: 0.6, ataques: [{ nome: 'patada', alcance: 1.2, dano: 14, preparoSeg: 0.5, recargaSeg: 1.8, regioes: ['tronco', 'cabeca', 'pernas'], clipe: 'defend' }] },
      saude: { max: 320 },
      modelo: {
        glb: 'assets/models/creatures/ferrunco/ferrunco-optimized-v03-LOD0.glb', frente: '+Z',
        clipes: { parado: 'idle', andar: 'walk', trote: 'trot', corrida: 'trot', comer: 'feed', beber: 'feed', alerta: 'alert', ameaca: 'defend', recuo: 'flee', descansar: 'rest', ferido: 'hurt', morte: 'death', farejar: 'sniff', inspecionar: 'inspect', cavar: 'dig' },
        limitacoes: ['animação por pivôs'],
      },
    },
  },
];

for (const f of FICHAS) {
  const base = await ler(f.base);
  const o = fundir(base, { id: f.id, nome: f.nome, ...f.d });
  o.balanceamento = { status: 'experimental_v7', provisorios: PROV, base: f.base };
  await writeFile(join(dir, `${f.id}.json`), JSON.stringify(o, null, 2) + '\n');
  console.log('ficha', f.id, '←', f.base);
}
// Presas do laboratório passam a reconhecer os predadores novos (só acrescenta; cenários antigos não os contêm).
const TEMORES = { cromatil: ['boscaranha', 'proto-serpente-termica', 'proto-cacador-camuflado'], velsari: ['proto-cacador-camuflado'], tarruco: ['proto-cacador-camuflado'] };
for (const [id, novos] of Object.entries(TEMORES)) {
  const arq = join(dir, `${id}.json`);
  const txt = await readFile(arq, 'utf8');
  const o = JSON.parse(txt);
  const falta = novos.filter((n) => !o.teme.includes(n));
  if (!falta.length) continue;
  // Edita só a linha "teme" para não reformatar a ficha inteira.
  const nova = txt.replace(/"teme": \[[^\]]*\]/, `"teme": ${JSON.stringify([...o.teme, ...falta]).replaceAll(',', ', ')}`);
  if (nova === txt) throw new Error(`${id}: linha "teme" não encontrada`);
  await writeFile(arq, nova);
  console.log('teme', id, '+', falta.join(', '));
}
const arqIndice = join(RAIZ_LAB, 'config', 'eco', 'indice.json');
const indice = JSON.parse(await readFile(arqIndice, 'utf8'));
for (const f of FICHAS) if (!indice.especies.includes(`${f.id}.json`)) indice.especies.push(`${f.id}.json`);
await writeFile(arqIndice, JSON.stringify(indice, null, 2) + '\n');
