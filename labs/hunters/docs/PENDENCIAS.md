# Hunter Lab — o que está pronto, o que não está

Escrito para ser lido contra o pedido original, item por item. Nada marcado como pronto aqui foi declarado sem
teste executado.

## Pronto e testado

| Pedido | Onde | Teste |
|---|---|---|
| Hunter em terreno 3D real (hexágono 52) | `config/cenarios.json` → `hex52-encontro` | aberto no navegador, 4320 × 4960 m, 0 invariantes violados |
| Movimentação, colisão e desvio de obstáculo | núcleo de locomoção | cenários 1 e 2 |
| Percepção: só vira alvo quem foi percebido | `cerebro-hunter.js` | cenário 3, mais `metricas.falhas` vazia em todos |
| Detecção e fuga de predador | `cerebro-hunter.js` | cenários 4 e 5 |
| Ataque a criatura, com o animal decidindo por si | `abrirConflito` no ataque | cenário 6 |
| PvP 1×1 desarmado e armado | `mundo-hunters.js` | cenários 7, 8 |
| Armas com alcance, dano, preparo, recarga e energia próprios | `config/equipamento.json` | cenário 8 |
| Armaduras com proteção por região e penalidade de mobilidade | `montarFicha` | cenário 9 |
| Saúde humana por região com consequências | `saude.js` + `anatomiaHumana` | cenários 11, 12 |
| Fadiga decidindo o combate | `limiarRecuo`, `querSair` | cenário 10 |
| Retirada, rendição e incapacitação | `cerebro-hunter.js` | cenários 10, 13 |
| Equipes, aliado nunca vira alvo | `aliado()` | cenário 14 |
| Troca de câmera não cancela a luta | `nivelFixo` | cenário 15 |
| Persistência de ferimentos, conflitos e equipamento | `salvarMundoHunters` | cenário 17 |
| Reprodutibilidade por semente | determinismo do núcleo | cenário 18 |
| Invariantes (NaN, duplicação, dano duplo, morte repetida) | `invariantes.js` + testes | teste dedicado |
| Modo treino sem morte e modo letal | `instalarRegrasDeTreino` | cenário 7 |
| Interface com painéis que funcionam | `hunter-lab.html` | usada no navegador real; não há teste automatizado dela |
| Contrato de animações | `docs/CONTRATO-ANIMACOES.md` | — |

## Não implementado nesta etapa

### 1. Simulação remota de Hunter (item 10 do pedido) — **pendência principal**

O pedido descreve dois níveis: Hunter acompanhado (detalhado) e Hunter remoto (econômico). **Só o primeiro
existe.** Todo Hunter recebe `nivelFixo = true` e nunca é rebaixado.

Isso resolve a parte **crítica** do item — trocar de câmera não encerra mais a luta, porque o defeito apontado
estava em `niveis.js` (`sairDoNivel1` fechava o conflito com motivo `fora_de_foco`) e Hunters não passam mais
por ali. O teste 15 prova que o resultado do combate é idêntico com e sem troca de foco.

O que falta é o outro lado: um nível 2 de Hunter que continue a luta mais barato, em vez de simplesmente não
baixar de nível. Como está, 50 Hunters custam 13,9 ms por passo (p50) **todos em nível 1**.

### 2. Criaturas que caçam o Hunter

Nenhuma ficha de criatura declara `hunter` em `dieta.presas` nem em `teme`. Mexer nisso altera o laboratório de
criaturas e a impressão digital `94df59e1`, e é decisão de direção. Hoje o animal reage ao Hunter quando é
atacado — aí entra numa disputa de verdade e decide lutar ou fugir pelo cérebro dele.

### 3. Modelos 3D de equipamento

Lança, espada, escudo e armaduras existem como **mecânica**, não como objeto. Na cena são marcadores de
depuração. A arquitetura aceita GLB depois: ver `visual` em `config/equipamento.json` e a seção final do
contrato de animações.

### 4. Benchmark com renderização real

`scripts/bench-hunters.mjs` mede o passo de simulação. Não mede desenho, animação nem FPS. O custo por Hunter
medido (60 s, semente 1, nesta máquina):

| Hunters | passo p50 | p95 | p99 | pior | ms por Hunter·s | × tempo real |
|---|---|---|---|---|---|---|
| 1 | 0,012 | 0,036 | 0,152 | 15,7 | 0,44 | 2280× |
| 2 | 0,029 | 0,141 | 0,444 | 4,5 | 0,30 | 1680× |
| 5 | 0,072 | 0,231 | 0,368 | 8,9 | 0,24 | 837× |
| 10 | 0,197 | 0,502 | 0,730 | 2,3 | 0,26 | 381× |
| 20 | 0,715 | 1,293 | 1,778 | 2,7 | 0,38 | 131× |
| 50 | 13,860 | 24,036 | 26,547 | 41,9 | 2,89 | 7× |

**O salto de 20 para 50 é real e não foi investigado.** O custo por Hunter sobe 7,5× (0,38 → 2,89 ms). A
suspeita é o amontoado: 50 Hunters num anel pequeno, todos em combate, pagam resolução de sobreposição e
percepção mútua. Isso é trabalho de perfil de CPU, não de palpite, e não foi feito nesta etapa.

Separar custo de IA, física, colisão e renderização, como o pedido pede, exigiria instrumentar o núcleo. A
tentativa de medir a IA ligando e desligando a decisão **não funciona**: parados, os Hunters se amontoam e a
corrida "sem IA" chega a ser mais lenta. O número está no JSON de resultados com essa ressalva explícita.

### 5. Smoke test de navegador automatizado

A página foi verificada **no navegador real**, à mão: GLB carregado, altura desenhada de 1,750 m conferida
contra a ficha, orientação determinada visualmente, combate rodando, marcadores aparecendo, zero erro de
console. As capturas em `resultados/evidencias/` são desse navegador. Não existe ainda um script Playwright que
repita isso na CI, como existe para a Oficina em `labs/ia-criaturas`.

### 6. Expedições e inventário

O pedido cita módulos de inventário e expedições na estrutura (item 13). Não existem. O Hunter carrega
equipamento, e só.

### 7. Hospedagem

Não existe infraestrutura de hospedagem para este laboratório. Nada foi publicado e nenhuma URL foi afirmada.

## Defeitos encontrados e corrigidos durante o trabalho

Registrados porque todos foram achados **medindo**, e cada um deles faria o laboratório mentir:

1. Defender durante todo o preparo do adversário paralisava o Hunter (2 ataques contra 9 do oponente).
2. Andar até a posição do rival colava os dois a 0,60 m, onde a arma passa do corpo e o núcleo rejeita todo
   golpe — os dois ficavam parados frente a frente até o tempo acabar.
3. Altura de impacto fixa por ataque fazia **todos** os golpes caírem na cabeça, e o atordoamento decidia a
   luta sozinho.
4. `errosSeguidos` do núcleo trava um duelista para sempre depois de quatro erros (num predador isso é certo:
   ele desiste da caçada e tenta outra).
5. O `mover` do ecossistema ignora `olharPara`: o Hunter atacava virado 81° para o lado do adversário.
6. A cena não chamava `passoSimulacao`, e os corpos ficavam desenhados longe da posição real.
7. A persistência do ecossistema guarda a espécie pelo `id`: o Hunter recarregado voltava **sem arma e sem
   armadura**, com os ferimentos certos. Corrigido no contrato desta camada.
8. O desfecho do combate não era persistido e o laboratório julgava a luta de novo ao recarregar.
