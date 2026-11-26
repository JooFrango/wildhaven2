// Protótipo de arena: Gravarto (GLB real v02) contra Rocantraz (GLB real otimizado v05).
// O Gravarto ainda não possui ficha ecológica oficial no catálogo. Esta ficha provisória
// existe SOMENTE dentro do laboratório; não alterar a Alpha nem o índice de espécies.
// O comportamento avançado v05 é compartilhado, mas os clipes visuais A–F completos
// ainda NÃO existem nesses dois GLBs. Fallbacks abaixo são explicitamente provisórios.
export function prepararPredadoresLaboratorio(cfg) {
  const base = cfg.especies.rocantraz;
  if (!base) throw new Error('Rocantraz ausente no catálogo da IA');
  const gravarto = structuredClone(base);
  Object.assign(gravarto, {
    id: 'gravarto',
    nome: 'Gravarto',
    ficha: null,
    _fonteFicha: 'Protótipo somente no laboratório: assets/models/creatures/gravarto/v02/README.md. Valores físicos provisórios, NÃO ficha aprovada.',
    corpo: { massaKg: [850, 1450], comprimentoM: 6.8, alturaM: 1.7, raio: 1.15 },
    movimento: { ...base.movimento, andar: 1.4, trote: 3.1, corrida: 7.2, aceleracao: 4.2,
      giroGrausSeg: 115, fatorCurvaFechada: .55, resistenciaSeg: 13, inclinacaoMaxGraus: 34, profundidadeMaxM: .9 },
    dieta: { vegetacao: [], presas: ['varrisco'], carnica: true },
    teme: [],
    competidores: ['rocantraz'],
    temperamento: { agressividade: [.83, .09], coragem: [.83, .09], medo: [.14, .07], vigilancia: [.56, .1] },
    social: { tipo: 'solitario', tamanho: [1, 1], territorial: true, raioTerritorioM: 300 },
    combate: {
      protecao: { cabeca: .35, pescoco: .3, tronco: .42, flanco: .35, pernas: .26, cauda: .33 },
      resistenciaDor: .65, equilibrio: .78, forcaMordida: 1.1, agarrar: true,
      forca: .83, defesa: .58, esquiva: .17, iaAvancada: true,
      ataques: [
        { nome:'mordida', alcance:2.25, dano:52, preparoSeg:.52, recargaSeg:1.85,
          regioes:['pescoco','tronco','pernas'], clipe:'bite' },
        // Alcance NEGATIVO = parte traseira do corpo; não permitir que a cauda acerte pela boca.
        { nome:'golpe_cauda', alcance:-2.7, dano:43, preparoSeg:.65, recargaSeg:2.6,
          regioes:['pernas','flanco','tronco'], clipe:'tail_sweep' },
      ],
      exibicao: 'threaten',
    },
    saude: { ...base.saude, max:510, resistencia:1.35, sangramentoBase:.45 },
    modelo: {
      glb:'assets/models/creatures/gravarto/v02/gravarto-v02-animated-LOD0.glb',
      frente:'+X', medidaReferencia:'comprimento',
      clipes: {
        parado:'idle', andar:'walk', trote:'trot', corrida:'short_sprint',
        espreita:'stalk', girarEsq:'turn_left', girarDir:'turn_right',
        alerta:'alert', farejar:'sniff', mordida:'bite', golpe_cauda:'tail_sweep',
        exibicao:'threaten', comer:'feed', beber:'drink', descansar:'rest',
        ferido:'hurt', morte:'death',
        // Substitutos VISUAIS, não são clipes especializados de finta/esquiva/agarrão.
        finta:'threaten', esquivaEsq:'turn_left', esquivaDir:'turn_right',
        agarrar:'bite', segurar:'bite', soltar:'threaten',
        feridoCabeca:'hurt', feridoPerna:'hurt',
      },
      limitacoes:['Somente 17 clipes; animações v05 específicas ainda não produzidas.',
        'A física de agarrão e esquiva é do núcleo, não do GLB.',
        'Revisão artística pendente; todos os parâmetros desta ficha são experimentais.'],
    },
    balanceamento: { status:'provisorio-laboratorio', provisorios:['todas as estatísticas'] },
  });
  gravarto.vida = { ...base.vida, expectativaAnos:24, maturidadeAnos:5, gestacaoDias:145 };
  cfg.especies.gravarto = gravarto;
  // Ativa a mesma IA v05 na bancada para o segundo carnívoro; não muda o JSON original.
  base.combate.iaAvancada = true;
  base.modelo.clipes = { ...base.modelo.clipes,
    finta:'roar', esquivaEsq:'defend', esquivaDir:'defend',
    agarrar:'bite', segurar:'bite', soltar:'roar', feridoCabeca:'defend', feridoPerna:'defend' };
  return { gravarto, rocantraz:base };
}

export function populacaoDueloPredadores() {
  const individuo = (especie,id,x,y,direcaoGraus,temperamento,extras={}) => ({
    especie, individuos:[{id,x,y,direcaoGraus,sexo:'M',fome:82,energia:100,temperamento,...extras}],
  });
  return [
    individuo('gravarto','v',47,50,0,{agressividade:.93,coragem:.92,medo:.06},{massaKg:1400}),
    // Um Rocantraz jovem ainda tem ~5 m de comprimento; o adulto (~4 t) afasta
    // o Gravarto ANTES da luta. Mantém o julgamento ecológico de vantagem real.
    individuo('rocantraz','rival',54.5,50,180,{agressividade:.91,coragem:.94,medo:.04},
      {idadeAnos:3,massaKg:3200}),
  ];
}
