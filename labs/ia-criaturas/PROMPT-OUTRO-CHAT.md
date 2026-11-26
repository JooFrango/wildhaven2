# Prompt para outro chat: testes de IA das criaturas com o laboratório

Copie tudo abaixo da linha para o outro chat. O laboratório já está no GitHub, na branch `feat/laboratorio-ia-criaturas` do repositório `carioca1111/wildhaven-new` (PR #1); não é necessário recriar a pasta nem a branch.

---

Você vai **continuar o laboratório de IA de criaturas já existente** no repositório `carioca1111/wildhaven-new`, na branch `feat/laboratorio-ia-criaturas`, que já tem o PR #1 aberto: https://github.com/carioca1111/wildhaven-new/pull/1. O laboratório já está em `labs/ia-criaturas/`. Acesse essa branch e leia `labs/ia-criaturas/README.md` antes de qualquer alteração.

## O que o laboratório já tem (não reescreva, estenda)

- Núcleo de IA determinístico em `src/core/`, com o mesmo código na página e no simulador sem interface:
  - Percepção: visão em cone, alcance e linha de visão; audição proporcional ao ruído e abafada por obstáculos.
  - Memória da última posição conhecida.
  - Fome, energia, navegação contornando obstáculos e colisão.
  - Cérebros por arquétipo em `src/core/comportamentos/`: `herbivoro`, `predador` e `estatico` (boneco de teste).
- Tudo é configurável por JSON:
  - `config/especies/*.json`: velocidades, sentidos, necessidades, ataque, relações `teme`/`presas`/`come`, limiares de decisão, `modelo.glb`, `modelo.clipes` e `balanceamento.provisorios`.
  - `config/cenarios/*.json`: terreno, obstáculos com `bloqueiaVisao`/`bloqueiaMovimento`/`atenuacaoSom`, alimento, criaturas e patrulha.
  - `config/indice.json`: o que é carregado.
- Página `index.html` com escolha de cenário e semente, pausa, velocidade, reinício, inspetor ao clicar no animal (atividade, energia, alvo, motivo da última decisão), camadas de percepção e memória (× da última posição vista) e captura PNG. A API `window.laboratorio` existe para automação.
- Sem dependências npm, só Node ≥ 22. Comandos (dentro de `labs/ia-criaturas/`): `npm test`, `npm run simular`, `npm run reproduzir -- --cenario X --semente N`, `npm run paridade`, `npm run build`, `npm run dev`, `npm run verificar` e `npm run clipes -- <glb|pasta>`.

## Regras de escopo (obrigatórias)

1. **Continue na branch existente** `feat/laboratorio-ia-criaturas` (PR #1). Se precisar clonar, use `git clone --branch feat/laboratorio-ia-criaturas https://github.com/carioca1111/wildhaven-new.git`; se já tiver o repositório, faça checkout dessa branch e atualize-a com `git pull --ff-only`. **Não crie outra branch e não recopie o laboratório**: ele já existe em `labs/ia-criaturas/`.
2. **Toda alteração fica dentro de `labs/ia-criaturas/`.** `game/alpha01/` é somente leitura. O laboratório tem que funcionar com a Alpha desligada.
3. Pode **ler** fichas, docs de ecologia, manifestos e GLBs do repositório. Referencie os modelos **pelo caminho original**, sem copiar binários. Na página, eles ficam acessíveis em `/repo/<caminho>` pelo servidor do laboratório. Configs, dependências, resultados e documentação novos ficam em `labs/ia-criaturas/`.
4. Antes de enviar os commits para o PR #1, rode `git diff --name-only origin/main...HEAD` e confira também as alterações ainda não commitadas. Confirme que **todo** caminho modificado começa com `labs/ia-criaturas/`. Não altere arquivos fora desse diretório.

## Tarefa 1: escolher as criaturas reais

- Leia `AGENTS.md`, `CLAUDE.md`, os documentos relevantes em `gameplay/`, as fichas em `creatures/species/` e `catalogo/entregas.json`.
- Escolha um herbívoro e um predador do **mesmo bioma**, com relação alimentar plausível e, de preferência, GLB animado.
- Confira os clipes **reais** com `npm run clipes -- ../../<caminho do glb ou pasta>`. Não invente nomes de clipe.
- Preencha `ESCOLHA-DAS-CRIATURAS.md`. Crie `config/especies/<id>.json` para cada uma, partindo dos exemplos:
  - Preencha `origem.ficha`, `modelo.glb` (caminho relativo à raiz do repositório) e `modelo.clipes`. As chaves do mapa de clipes são `parado`, `andar`, `trote`, `corrida`, `comer`, `alerta`, `descansar`, `ataque`, `farejar` e `morte`.
  - Traduza os números da ficha. O que for chute vai para `balanceamento.provisorios`.
- Atualize `config/indice.json` e o campo `especie` das criaturas nos três cenários. Pode remover as espécies `*-exemplo`, mas mantenha `boneco-teste`.

## Tarefa 2: ajustar e testar a IA dessas criaturas

- O herbívoro precisa procurar alimento, comer, detectar perigo, fugir e voltar à atividade quando estiver seguro.
- O predador precisa patrulhar, detectar, aproximar-se, perseguir, atacar dentro do alcance e desistir quando perder o rastro ou ficar cansado.
- Regra de ouro: **uma criatura só reage ao que percebeu**.
  - Os cérebros recebem só `sentidos`.
  - O mundo registra a falha `reagiu_sem_perceber` se o alvo não estiver na percepção ou na memória.
- Se a espécie tiver comportamento próprio (emboscada, bando, vigia, pastar em grupo), crie um arquétipo novo em `src/core/comportamentos/<nome>.js` com `decidir(sentidos, mente)`, registre em `index.js` e aponte `comportamento` na espécie.
- Escreva testes específicos em `test/`, usando `test/ajudantes.mjs` (`configCom`, `cenario`, `rodarAte`, `eventos`) e as variantes `presa-rota`/`predador-parado`. Cubra pelo menos:
  - Alimentação.
  - Detecção, incluindo não detectar o que está fora da visão e em silêncio.
  - Fuga e volta à atividade.
  - Perda de contato, com o alvo sendo a última posição vista e não a real.
  - Desistência por cansaço.
  - Alcance de ataque.
  - Colisão.
- **Furtividade e encontros que não acontecem são prioridade.** Nos primeiros testes, todos os encontros em campo aberto terminaram em detecção. O laboratório já tem:
  - `furtividade.camuflagem`, `fatorParado` e `ruidoPassos` por espécie.
  - `visao.tempoReconhecimentoSeg` (reconhecimento gradual).
  - Capim alto (`ocultacao`) nos cenários.
  - Métricas de "despercebido" e quase-encontro no relatório.
- Calibre esses valores pela ficha (pelagem, hábito noturno, emboscada, vigilância em grupo). Garanta testes em que:
  - Um animal camuflado e parado não é visto além do alcance efetivo.
  - O capim alto esconde.
  - Andar é mais discreto que correr.
  - Os dois passam perto sem se perceber.
  - Em `territorios-separados`, a maioria dos encontros não acontece.
- Mantenha os seis cenários (crie mais se a espécie pedir, por exemplo emboscada ou bebedouro) e ajuste posições e obstáculos ao tamanho das espécies reais:
  - `territorios-separados`, `capim-alto` e `aproximacao-furtiva`, que testam furtividade.
  - Os três obrigatórios abaixo.
  - `campo-aberto`: os dois descansados.
  - `obstaculo`: rocha entre os dois; a presa pode quebrar a linha de visão.
  - `predador-cansado`: o predador começa com pouca energia.

## Tarefa 3: simular, conferir e registrar

- `npm run simular` (30 sementes por cenário; use `-- --sementes 1-100` para mais) gera `resultados/relatorio.md` e `resultados/resumo.json`. Analise:
  - Encontros sem detecção.
  - Perseguições iniciadas.
  - Fugas.
  - Desistências por cansaço e por perda de rastro.
  - Capturas.
  - Duração das perseguições.
  - Na seção de furtividade: quase-encontros, quem detecta primeiro, distância da primeira detecção e tempo "no alcance sem ver" por motivo.
- Se algum resultado esperado nunca aparecer (por exemplo, perda de rastro no cenário com obstáculo), investigue com `npm run reproduzir -- --cenario X --semente N --eventos` e na página. Corrija a lógica ou o balanceamento, mas **não force o resultado**.
- Guarde no relatório uma semente de exemplo por resultado e **toda semente que revele falha**, com a explicação.
- Paridade página × CLI: `npm run paridade` imprime um hash. Na página (`npm run dev`), rode no console `laboratorio.impressaoDigital('1-30').hash`. **Os dois têm que ser iguais.** Se divergirem, procure uso de `Math.sin/cos/atan2/hypot/pow`, `Date`, `Math.random` ou ordem não determinística em `src/core`. Use `src/core/matematica.js` e `src/core/rng.js`.
- Teste a página no navegador: troque cenário e semente, pause, acelere, reinicie, clique nos dois animais e ligue as camadas de percepção e memória. Salve pelo menos uma captura real com 📷 (vai para `resultados/capturas/`) num momento que mostre o comportamento.

## Tarefa 4: entregar

- `npm run verificar` precisa passar: testes, 30 sementes sem falha e build.
- Atualize o README do laboratório com os comandos exatos e um encontro de exemplo para assistir: cenário, semente, URL, comando `reproduzir`, hash e o que observar.
- Confira o diff completo contra a `main` (todo caminho em `labs/ia-criaturas/`). Faça commit e push **na branch existente** `feat/laboratorio-ia-criaturas`, atualizando o **PR #1 já aberto**: https://github.com/carioca1111/wildhaven-new/pull/1. **Não abra outro PR e não faça merge.**
- Na resposta final, envie os links do **PR #1 atualizado**, da pasta e do relatório, uma semente interessante, o comando para reproduzi-la e o comportamento a observar.

## Armadilhas conhecidas

- No PowerShell, passe listas de sementes entre aspas: `--sementes "1,2,7"`.
- Arquivos JSON devem ser salvos em UTF-8 sem BOM. `Set-Content` do PowerShell 5 corrompe acentos; use o editor ou `[IO.File]::WriteAllText` com UTF-8.
- A velocidade da página nunca muda o `dt` (0,1 s). Mude apenas quantos passos rodam por quadro.
- Mudanças em `src/core` mudam os hashes. Rode `npm run simular` de novo e atualize os hashes citados no README.
