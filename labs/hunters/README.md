> [Abrir Hunter Lab v04 publicado](https://wildhaven-hunter-lab-codex.jvbrmandarino11.chatgpt.site/labs/hunters/hunter-lab.html) · [PR24 em rascunho](https://github.com/carioca1111/wildhaven-new/pull/24). Prévia privada, sem merge.

> **Atualização v04 — somente este Hunter Lab:** [combate como jogador e novos clipes](docs/COMBATE-JOGADOR-V04.md). Abra `hunter-lab.html`, selecione lança, espada ou montante e pressione Iniciar. [Galeria real das animações](viewer/index.html) · [Vídeos desta versão](resultados/jogador/index.html). Habilidade é configurável separadamente da personalidade.

> Atualização nesta branch: [combate orgânico e tático](../combate-tatico/README.md), GLB experimental v03 e integração Claude. O texto abaixo descreve a versão V1 original; consulte a atualização para resultados e limites atuais.

# Hunter Lab — laboratório de combate e PvP dos Hunters

Laboratório isolado para testar Hunters do Wildhaven: movimentação em terreno real, encontros com criaturas,
combate Hunter × Hunter, ferimentos por região, fadiga, retirada e rendição. Roda sem a Alpha e **sem nenhuma
dependência npm** (Node ≥ 22).

## Abrir no navegador

```bash
cd labs/hunters && npm run dev
```

Depois abra **http://localhost:5195/hunters/hunter-lab.html**.

O servidor é o do laboratório de criaturas, servindo a pasta `labs/` inteira: a página fica em `/hunters/…`, os
módulos compartilhados em `/ia-criaturas/…` e os GLBs reais do repositório em `/repo/…`.

Parâmetros de URL: `?cenario=<id>&semente=<n>`. Cenários em [`config/cenarios.json`](config/cenarios.json):
`arena-duelo`, `arena-obstaculos`, `arena-equipes`, `arena-letal`, `hex52-encontro`.

Controle manual do Hunter selecionado: **W/S/A/D** anda, **Shift** corre, **J** ataca, **K** bloqueia.

## Rodar os testes

```bash
cd labs/hunters && npm test
```

## Benchmark de simulação (sem navegador)

```bash
cd labs/hunters && node scripts/bench-hunters.mjs --niveis 1,2,5,10,20,50 --segundos 60
```

## A decisão de arquitetura

O Hunter **não tem um simulador próprio**. Ele entra como uma espécie do laboratório de criaturas
([`config/hunter.json`](config/hunter.json)), e com isso percepção, cápsulas de corpo, alcance de golpe, região
atingida, ferimento, sangramento, fratura, dor, atordoamento, desequilíbrio, queda e morte vêm todos do núcleo
já testado em `labs/ia-criaturas`. Os animais o percebem como entidade física válida sem integração nenhuma.

Esta camada acrescenta só o que é humano:

| Arquivo | O que faz |
|---|---|
| [`src/hunter.js`](src/hunter.js) | equipamento vira ficha individual; postura; regiões humanas; situação |
| [`src/cerebro-hunter.js`](src/cerebro-hunter.js) | decisão de combate, recuo, rendição e controle manual |
| [`src/mundo-hunters.js`](src/mundo-hunters.js) | monta o mundo, regras de treino, desfecho, persistência |
| [`src/web3d/app-hunters.js`](src/web3d/app-hunters.js) | a página 3D (só desenha; não decide nada) |

A decisão do Hunter é instalada no gancho `comandoTeste` do núcleo. Isso tem uma consequência deliberada:
**estados físicos continuam sendo do núcleo**. Um Hunter caído, agarrado ou atordoado não obedece a decisão
nenhuma — nem da IA, nem do jogador.

### Informação que a IA pode usar

A decisão lê `a.contatos` (a percepção daquele passo) e `a.memoria.criaturas`. Posição, velocidade, porte
estimado e "está ferido" vêm do contato, com o erro que o sentido tiver. Duas coisas são lidas do rival porque
são visíveis de fato: a equipe (um Hunter reconhece um aliado) e o golpe em preparo — que é justamente o
movimento de corpo que `preparoSeg` modela. Vida, energia e intenção oculta, nunca.

O próprio núcleo fiscaliza isso: reagir a quem não foi percebido entra em `mundo.metricas.falhas` como
`reagiu_sem_perceber`, e os testes exigem essa lista vazia.

## Mudanças feitas no núcleo

Quatro, todas aditivas e condicionadas a uma declaração nova, para que o ecossistema não mude:

1. `saude.js` — regiões `torax`, `abdomen` e `bracos` (nenhuma ficha de criatura as declara).
2. `combate.js` — região pela **altura** do golpe para fichas com `anatomiaHumana: true`.
3. `combate.js` — golpe barrado por obstáculo sólido, sob a opção de cenário `bloqueioGolpePorTerreno`.
4. `niveis.js` — `a.nivelFixo`: um agente que nunca é rebaixado de nível.

**Prova de que o ecossistema não mudou:** `npm run paridade` em `labs/ia-criaturas` continua dando
`94df59e1` e os 185 testes de lá continuam passando.

## Modos de combate

- **treino** (padrão): ninguém morre. `mundo.matar` é substituído para os Hunters em treino — a vida para em 5%,
  o sangramento zera e o Hunter fica `incapacitado`. Reiniciar o cenário com a mesma semente restaura o estado
  inicial exatamente, porque a simulação é determinística.
- **letal**: a morte simulada acontece, dentro do estado descartável desta simulação. Não toca em nada da Alpha
  nem em qualquer Hunter de produção.

## Limites do que está medido

Leia também [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md). Em resumo:

- O **FPS** mostrado na página é desta máquina e deste navegador. Não é número de desempenho do jogo.
- O benchmark de `scripts/bench-hunters.mjs` mede **passo de simulação**, não desenho, e não separa percepção de
  colisão: isso exigiria instrumentar o núcleo.
- **Nenhuma criatura declara o Hunter como presa ou como espécie temida.** Os animais reagem a ele quando ele
  ataca (aí abre uma disputa de verdade, e o animal decide com o cérebro dele) ou quando ele atrapalha. Caçar o
  Hunter é decisão de direção, não do laboratório.
- **Não existe simulação remota de Hunter.** Hunters ficam presos ao nível 1.
- Os valores de dano, alcance, custo de energia e limiares de rendição são **provisórios**, declarados como tal
  em `config/hunter.json` → `balanceamento`.

## Evidências

Capturas do laboratório 3D real rodando, em [`resultados/evidencias/`](resultados/evidencias/):

| | |
|---|---|
| [duelo 1×1 até a rendição](resultados/evidencias/01-duelo-1x1-rendicao.jpg) | lança × espada e escudo |
| [equipes 2×2](resultados/evidencias/02-equipes-2x2.jpg) | aliado nunca vira alvo |
| [hexágono 52 com criaturas reais](resultados/evidencias/03-hexagono-52-com-criaturas.jpg) | terreno oficial de 4320 × 4960 m |
| [orientação do GLB](resultados/evidencias/04-hunter-glb-v02-rumo-mais-x.png) | como a frente `+Z` foi determinada |
