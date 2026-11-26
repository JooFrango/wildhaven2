# Como adicionar uma criatura ao laboratório

Uma criatura nova é **um arquivo JSON e uma linha no índice**. Nenhum módulo da IA muda. Se você precisou
mexer em `src/eco/` para encaixar uma espécie, pare: ou falta uma capacidade declarável, ou a espécie está
pedindo um controlador físico que ainda não existe (veja [PENDENCIAS-IA-FUTURAS.md](PENDENCIAS-IA-FUTURAS.md)).

A prova disso está no repositório: a **Frutavil** (`config/eco/especies/frutavil.json`) entrou inteira por
este caminho, e o teste `IA Base V1: espécie nova entra só pelo contrato` em `test/ia-base-v1.test.mjs`
verifica que ela não ganhou nenhuma capacidade de brinde.

## 1. Antes de escrever a ficha

Meça o GLB real; não chute a orientação nem os clipes.

```bash
node scripts/auditar-glb.mjs <caminho do .glb>
```

A saída dá a **frente anatômica** com a evidência, a extensão do corpo, o número de ossos e a lista de clipes
com duração e velocidade natural. Use exatamente esses nomes de clipe. Se o clipe não existe, não o declare:
registre a falta em `modelo.limitacoes`.

## 2. A ficha

Grave em `config/eco/especies/<id>.json` e acrescente `"<id>.json"` em `config/eco/indice.json`.
O validador (`src/eco/especies.js`) recusa o carregamento se faltar qualquer campo obrigatório, se a espécie
citar presa/predador inexistente ou se `modelo.frente` não for `+X`, `-X`, `+Z` ou `-Z`.

### Identidade
| campo | o que é |
| --- | --- |
| `id` | chave única, minúscula, sem espaço. É o que os cenários usam. |
| `nome` | nome de exibição. |
| `ficha` | caminho da ficha oficial em `creatures/species/`, ou `null` se for hipotética. |
| `papel` | `herbivoro` ou `carnivoro`. |
| `atividade` | `diurno`, `noturno` ou `crepuscular`. |
| `_fonteFicha` | o que veio da ficha oficial, em texto. O que não estiver aqui é provisório. |

### Anatomia — `corpo`
`massaKg: [min, max]`, `comprimentoM`, `alturaM`, `raio` (raio de colisão em metros), `ectotermico` (opcional).
A massa do indivíduo é sorteada na faixa e governa dose de veneno, dano, carcaça e o que pode ser engolido.

### Necessidades — `necessidades`
`fomePorDia`, `sedePorDia`, `comerPorSeg`, `beberPorSeg`, `energiaMax`, `custoBasePorSeg`,
`custoCorridaPorSeg`, `recuperacaoPorSeg`, `limiteExaustao` e os limiares (`fomeProcurar`, `fomeCacar`,
`sedeProcurar`, `fomeDesesperada`). Reprodução fica em `vida`: `maturidadeAnos`, `gestacaoDias`, `ovos`,
`ninhada`, `estacaoReprodutiva`, `desmameDias`, `cuidadoParental`.

### Percepção — `percepcao`
`visao { alcance, anguloGraus, alcanceProximo, tempoReconhecimentoSeg }`, `audicao { alcance, erroRelativo }`,
`olfato { alcance }`, `memoriaSeg` e `modificadoresPorEstado`. Sentidos especializados são **opcionais** e só
existem se declarados: `termorrecepcao { alcance, anguloGraus, sensibilidadeC, contrasteRefC, erroRelativo,
tempoReconhecimentoSeg }`.

### Movimentação — `movimento`
`andar`, `trote`, `corrida` (m/s), `aceleracao`, `giroGrausSeg`, `fatorCurvaFechada`, `resistenciaSeg`,
`inclinacaoMaxGraus`, `nadar`, `profundidadeMaxM`. Terrestre é o padrão e não precisa de nada a mais.
Os outros meios exigem um bloco próprio, e **só existem se o bloco existir**:

| meio | bloco | controlador |
| --- | --- | --- |
| subterrâneo na areia | `subsolo { profundidadeMaxM, ... }` | `src/eco/subsolo.js` + `cerebro-dunas.js` |
| aéreo | `voo { ... }` | `src/eco/voo.js` + `cerebro-voo.js` |
| serpentino | `serpente { comprimentoM, segmentos, ondaM, comprimentoOndaM, raioCurvaturaMinM, capsulaM, ... }` | `src/eco/serpente.js` |

### Combate — `combate`
`ataques[]` com `{ nome, alcance, dano, preparoSeg, recargaSeg, regioes[], clipe }`, mais `protecao` por região,
`forca`, `defesa`, `esquiva`, `agarrar`, `forcaMordida`, `resistenciaDor`, `equilibrio`. Resistência a veneno é
`resistenciaVeneno` (0–1) na raiz da ficha. Saúde e ferimentos: `saude { max, resistencia, sangramentoBase,
regenPorDia, suscetibilidadeDoenca }`.

### Assets — `modelo`
`glb`, `frente`, `medidaReferencia` (`comprimento` ou `altura`), `clipes` (mapa papel→nome real do clipe) e
`limitacoes` (lista em texto). A escala é derivada: `comprimentoM ÷ extensão medida no GLB`.
**`limitacoes` não é decoração**: é onde fica registrado o que o rig não faz. Clipe que não existe, animação
no lugar, ausência de pesos de skinning — tudo entra aqui.

## 3. Capacidades opcionais

Nada é ligado por dedução. Cada sistema só toca a espécie que declara o bloco correspondente:

| capacidade | bloco na ficha | estado criado |
| --- | --- | --- |
| veneno | `veneno { tipo, potencia, doseMg, reservaMg, ataques[], meiaVidaSeg, latenciaSeg, ... }` | `a.veneno` |
| camuflagem óptica | `camuflagemAtiva { ... }` | `a.camuflagem` |
| termorrecepção | `percepcao.termorrecepcao` | `a.atencaoTermica` |
| voo | `voo` | `a.voo` |
| subsolo | `subsolo` | `a.subsolo` |
| serpente | `serpente` | `a.serpente` |
| emboscada | `taticasDeEmboscada { raioBuscaM, esperaMaxSeg, distanciaDisparoM }` | ramo do cérebro |
| engolir inteira | `engolirInteira { massaMaxFracao, alturaMaxM, segundos, ... }` | ramo do cérebro |
| comer cupins | `dieta.cupins { alcanceM, abre, ... }` | `memoria.cupinzeiros` |

Cada um desses sistemas tem um teste do tipo *"espécie sem a capacidade não ganha estado"*. Se você declarar
um bloco, declare também a limitação do rig que o acompanha.

## 4. Usar a criatura

Acrescente uma população ao cenário (`config/eco/cenarios/<id>.json`):

```json
{ "especie": "<id>", "individuos": [{ "id": "<id>-1", "x": 100, "y": 80, "fome": [40, 65] }] }
```

Grupos sociais usam `grupos: [{ x, y, raio, adultos, filhotes, raioCasa }]`.

## 5. Conferir

```bash
npm test
```

```bash
node scripts/perfis-modelos.mjs
```

O primeiro carrega e valida todas as fichas e roda a suíte. O segundo mede o GLB novo e grava
`config/eco/modelos.json` com sha256, extensão, frente e clipes — é o registro de procedência do asset.
Para ver no navegador: `npm run dev` e abra `ecossistema.html?cenario=<cenário>`.
