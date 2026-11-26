# PvE v02 — E7: os 12 clipes do rig v13 ligados à caçada do laboratório

Etapa E7 do [plano PvE](PLANO-EVOLUCAO-PVE.md): a ligação que o [lote 1](PVE2-E4-LOTE1.md) e o
[lote 2](PVE2-E4-LOTE2.md) deixaram em aberto. Status: **integração experimental, para avaliação visual**.
Nenhuma animação foi refeita nesta etapa. PvP, Alpha, PvE v01, monstros e IA ecológica não foram tocados.

## Como abrir

```
node labs/hunters-codex/scripts/server.mjs
```

<http://127.0.0.1:8782/labs/hunters/hunter-lab.html?cenario=jogador-espada&pve1=1&pve2=1&semente=17>

Caçada PvE: o Hunter de espada contra o Varrisco real, no recorte do hexágono 52. **As duas flags são obrigatórias**:
sem `pve2`, o laboratório continua exatamente no caminho anterior. Com elas, o GLB passa a ser
`assets/hunter-rig-v13/hunter_rig_v13_blockout.glb` e o tempo dos golpes vem de `src/trajetorias-pve2.js` (gerado;
não editar à mão).

## Controles

Com a IA ligada, o Hunter caça sozinho. **Controle manual** passa o Hunter selecionado para o teclado:

| Tecla | O que faz | Clipe |
|---|---|---|
| W / S / A / D | anda (frente, trás, lados) | `pve2_a_sword_walk` |
| Shift + W | corre; acima de 2,2 m/s entra o trote e acima de 4 m/s a corrida, com a **pegada reversa** | `pve2_a_sword_jog`, `pve2_a_sword_run` |
| J | golpeia e **encadeia o combo 1 → 2 → 3** | `pve2_c_sword_combo_1/2/3` |
| H | carrega e libera o golpe pesado (1,00 s de carga em laço, depois a liberação) | `pve2_c_sword_charge_loop` → `pve2_c_sword_charge_release` |
| Espaço | rolamento de 0,90 s e 1,3 m; A ou D escolhem o lado (sem tecla, rola para a direita) | `pve2_b_sword_roll_left/right` |
| K | guarda | `pve2_b_sword_guard` |

**Painel "Animações do rig v13"** (barra lateral, só com `?pve1=1&pve2=1`): **Tocar** põe um clipe em laço no Hunter
selecionado, no relógio real e sem a IA — funciona com a simulação pausada. **Soltar** devolve a escolha à simulação.

## O que foi ligado

- **`remapPve2`** (`src/animacao-jogador.js`): estado canônico → clipe `pve2_*`. O que o rig v13 não tem (bloqueio,
  reação, cambaleio, queda, levantar, rendição, morte, giro parado) cai na guarda PvE v02. Recuo e passo lateral usam
  o ciclo de caminhada, com o passo pela distância andada.
- **Tempo da simulação tirado do clipe** (`src/combate-jogador.js`): preparo e recuperação de cada golpe são os do
  clipe que vai tocar, escolhido antes de o ataque começar (fator 1,00×). Combo de 3; pesado = carga (1,00 s) +
  liberação (1,20 s). Janelas de interrupção do clipe, contadas do início do clipe.
- **Deslocamento autorado aplicado uma única vez**, no passo de simulação: rolamento (1,3 m de lado) e avanço dos golpes
  (0,08–0,51 m). O clipe toca em lugar (o `root` do GLB é estático em todos os clipes). O avanço **para a 0,25 m do
  alvo**: o passo leva a lâmina, não o corpo para dentro do Varrisco.
- **Giro do corpo no golpe** (`giroAcao`, `src/trajetoria-arma.js`). No contato autorado, a lâmina do rig v13 passa
  **0,49–0,75 m à direita** da linha do corpo (no PvE v01 eram 0,06–0,13 m): o golpe ia para o lado do alvo e errava.
  O corpo gira em torno do eixo vertical para pôr esse ponto da lâmina na linha da frente (29° no combo 1, 52° no
  combo 2, 30° no combo 3, 43° na liberação), entrando até a janela ativa e saindo na recuperação. A mesma rotação vale
  para a lâmina simulada e para o corpo desenhado. **A animação não mudou**: o arco aberto para a direita é do clipe, e
  é o que deve ser corrigido quando os golpes forem revisados.
- Esquiva = rolamento do lote 2. IK de pé pelos `footContacts`, fora dos rolamentos. Troca de pegada com rampa de 0,30 s.
- **Sem cansaço na caçada experimental** (pedido do diretor, 2026-11-20): energia e fôlego do Hunter voltam ao máximo antes de cada decisão (`semCansacoPve2`). Fora do modo experimental, o cansaço segue como antes.
- Teclado: cadeia própria do combo; pesado comandado (a escolha do núcleo o recusava, também sem `pve2`); Shift corre de
  fato na orientação de combate (só no modo experimental).

## Caçada medida

`node labs/hunters/scripts/medir-cacada-pve2.mjs --modo pve1|pve2` — `jogador-espada`, sementes 7, 17 e 23, até 120 s,
sem renderizador. Golpes do Hunter:

| | Golpes | Feriram | Erraram | Varrisco derrotado em | Tempo com os corpos colados (< 0,15 m) |
|---|---|---|---|---|---|
| PvE v01 aprovado | 12 / 21 / 19 | 10 / 15 / 11 | 0 / 2 / 5 | 78 / 106 / 105 s | 37 / 6 / 35 % |
| v13, antes do giro | 34 / 42 / 34 | 11 / 20 / 9 | 19 / 18 / 23 | 112 / 100 s / sem desfecho | 4 / 12 / 1 % |
| **v13, com o giro** | 19 / 21 / 23 | 13 / 16 / 17 | **2 / 1 / 1** | **30 / 46 / 43 s** | 5 / 7 / 4 % |

Antes do giro, a lâmina passava ao lado do Varrisco, a IA errava mais da metade dos golpes e repetia o ataque. Com o
giro, erra 1 ou 2 por caçada. A caçada ficou mais curta que no v01 porque o combo encadeia até 3 golpes.

No Chrome real (`scripts/capture-pve2-lab.mjs`, Playwright, ANGLE SwiftShader): salto de pose 0,000 m no quadro de
cada troca de clipe; rolamentos de 1,37 m para cada lado; 0 invariantes violadas; nenhum erro de página. O navegador
headless roda a ~10 fps, então os 12 quadros a 60 fps depois da troca continuam não medidos.

## Testes

- `test/pve2-e7-lab.test.mjs` (13 testes), entre eles: lâmina na linha da frente no contato de cada golpe, avanço
  parando antes do alvo, ação do golpe comandado durando exatamente o clipe, rolamento andando 1,3 m uma única vez.
- `npm test` em `labs/hunters`: **123 passam**.
- `scripts/regressao-pve1.mjs`: impressão digital `6c3fe698…` (igual — o PvE v01 não mudou).
- `assets/hunter-v05/manifest.json`: `trajectorySourceSha256` atualizado, porque `src/trajetoria-arma.js` mudou.

## O que fica aberto

- **Arco dos golpes do rig v13 aberto para a direita.** O giro corrige contato e direção, mas o corpo gira 29–52° em
  cada golpe e os pés giram junto, alguns centímetros. A correção definitiva é no clipe.
- **Sem clipe no rig v13:** bloqueio, reação, cambaleio, queda, levantar, rendição, morte, giro parado, recuo e passo
  lateral.
- **Varrisco quase não ataca.** Quando morde, fere (uma mordida tirou 24–83 de vida, com sangramento), mas em 30–46 s de caçada ele começa só 1–2 mordidas: a IA tática recua quando o Hunter está perto demais e a IA ecológica desiste do confronto 10–17 vezes. Temperamento no máximo não muda isso. Fica para o projeto novo de monstro (comportamento e animações no estilo Monster Hunter), em sessão própria.
- Exceções dos rolamentos (lâmina no chão e no corpo) seguem como no lote 2.
- Espaço de mistura de locomoção, camadas, hit-stop e câmera (E3) continuam fora.
- Vinco do ombro (E1) e glTF Validator da Khronos seguem abertos.
