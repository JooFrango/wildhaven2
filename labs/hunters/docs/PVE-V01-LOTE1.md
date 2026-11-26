# PvE v01 — lote 1 (espada): locomoção de combate, guarda, esquiva, bloqueio, ataque leve, ataque pesado, recuperação

Primeiro lote do [contrato de animações PvE](CONTRATO-ANIMACOES.md). **Validação técnica concluída. Aprovado
pelo diretor em 2026-11-19 como piloto** (junto com a [IA PvE](PVE-V01-IA.md)); não integrado à Alpha. Nada aqui altera PvP, Alpha, criaturas ou GLBs aprovados: a v12 é regerada byte a byte
igual (sha256 `b36f7a82…`), e o PvE só liga com `?pve1=1`.

## Arquivos

| | |
|---|---|
| GLB | `assets/hunter-pve-v01/hunter_pve_v01.glb` — sha256 `9c94bcdba88512cbc0263807e65a5339922c4a6509d19ef170365c8e04bf5e09`, 2 410 876 bytes, 105 clipes (93 da v12 + 12 `pve1_*`), 23 juntas, espada integrada ao socket `WeaponSocket_Right_PvP12` |
| Manifesto | `assets/hunter-pve-v01/manifest.json` (QA global e por clipe) |
| Fonte editável | `scripts/animate-hunter-pvp-v09.mjs --pve1` (poses-chave, trilhas de pé, curvas) |
| Contrato gerado | `src/trajetorias-pve1.js` — fases, interrupções, contatos de pé, deslocamento e lâmina por quadro |
| Renders | `resultados/pve-v01/` — GIF de perfil, frente e três-quartos por clipe, e PNG de cada fase |

## Os doze clipes

| Clipe | Mód. | Duração | Contato | O que é |
|---|---|---|---|---|
| `pve1_b_sword_guard` | B | 2,40 s (laço) | — | Guarda de caçador: tronco alto e inclinado à frente, ponta da espada para a frente e para cima, mão livre à frente do peito. Respiração e microajuste de peso. |
| `pve1_b_sword_step_forward/back/left/right` | B | 0,85 s (laço) | — | Passos em guarda: o ciclo validado da v12 sobre a guarda PvE. |
| `pve1_a_sword_run` | A | 0,65 s (laço) | — | Corrida com espada sacada, 3,9 m/s nativos: dois apoios de 0,16 s e duas fases de voo, braço oposto à perna, pelve e tronco em contrarrotação. |
| `pve1_b_sword_block` | B | 1,00 s | 0,30 s | Bloqueio contra monstro: base baixa, lâmina atravessada; o impacto empurra o corpo inteiro para trás e para baixo. |
| `pve1_b_sword_dodge_left/right` | B | 1,00 s | — | Esquiva lateral em salto de 1,20 m: agacha, empurra na ponta do pé de trás, voa, aterrissa, o corpo continua 0,28 m sobre os pés plantados e os pés voltam em dois passos curtos. |
| `pve1_c_sword_light` | C | 1,15 s | 0,417 s | Corte diagonal curto do ombro direito ao quadril esquerdo, com passo da perna da frente. |
| `pve1_c_sword_heavy` | C | 2,00 s | 0,933 s | Corte vertical por cima da cabeça: carga longa e legível, descida rápida, tronco cai sobre a perna da frente, recuperação pesada. |
| `pve1_b_sword_recover` | B | 2,00 s (laço) | — | Recuperação ofegante com pose própria (tronco curvado, espada baixa). |

Contato de ataque **calculado** (alcance máximo da lâmina na direção do alvo) e sempre dentro da janela ativa.

## QA medido (portões que reprovam a geração ou a validação)

| Clipe | Erro IK mão (mm) | Erro IK pé (mm) | Pé plantado (mm/quadro) | Desvio do punho (°) | Cotovelo (°) | Punho–cabeça (cm) |
|---|---|---|---|---|---|---|
| guard | 0,0 | 0,0 | 0,00 | 40,7 | 115–116 | 52,7 |
| step_forward / left / right | 0,0 | 0,0 | 0,00 | 43,9 | 109–119 | 51,2 |
| step_back | 0,0 | 4,1 | 0,00 | 43,9 | 109–119 | 51,2 |
| run | 0,0 | 0,0 | (percorre) | 49,9 | 55–81 | 33,1 |
| block | 0,0 | 0,0 | 0,00 | 42,7 | 105–135 | 38,1 |
| dodge_left | 0,0 | 8,3 | 1,07 | 53,5 | 64–115 | 37,3 |
| dodge_right | 0,0 | 0,0 | 1,07 | 53,2 | 63–118 | 32,2 |
| light | 0,0 | 0,0 | 1,52 | 58,1 | 80–**142** | 17,6 |
| heavy | 0,0 | 0,0 | 0,00 | 40,3 | 85–**155** | 26,5 |
| recover | 0,0 | 0,0 | 0,00 | 50,9 | 117–120 | 54,3 |
| **limite** | 10 | 12 | 2 | 60 | ataque ≥ 140 no contato; demais ≤ 150 | ≥ 16 |

Também: penetração lâmina–tronco 0; skin dos clipes antigos 7,4 × 10⁻⁸ m; prefixo binário da v05 intacto;
costura PvE (quadro 0 **e** último quadro contra a guarda) **0,038°**; costura v12 0,186° (inalterada).
Na esquiva o pé plantado é medido no mundo (pé local + curva de deslocamento).

## Como rodar

```
node scripts/animate-hunter-pvp-v09.mjs --pve1        # gera GLB, manifesto e trajetorias-pve1.js
node scripts/validate-hunter-pvp-v09.mjs --pve1       # portão estrutural + contrato + costura
node scripts/capture-hunter-pvp-v09.mjs --pve1 --clip pve1_c_sword_heavy   # GIFs e poses (precisa de Chrome)
npm test                                              # 79 testes do laboratório
```

No navegador: `viewer/pvp-preview-v12.html?pve1=1&clip=pve1_b_sword_dodge_left` (a esquiva anda pela curva).
No laboratório: `hunter-lab.html?cenario=jogador-espada&pve1=1` — Hunter com espada contra o Varrisco real.

## Ligação no laboratório (`?pve1=1`)

`remapPve1` em `src/animacao-jogador.js` traduz estado canônico → clipe PvE. Com a biblioteca ligada, a espada
desenhada é a do GLB (presa ao socket) e o braço segue o clipe autorado; a espada simulada fica escondida.

## Pendências — o que este lote **não** resolve

- **Vídeo contra o Varrisco não gravado.** O script existe (`node scripts/capture-jogador.mjs --pve1`), mas
  precisa de um servidor na raiz do repositório na porta 8782, e a execução desse servidor foi bloqueada pela
  permissão do ambiente nesta sessão.
- **A simulação ainda não lê `trajetorias-pve1.js`** (etapa da IA, Sonnet 5.5): o teste de contato usa a
  trajetória antiga e o tempo do golpe vem do núcleo, então o renderizador estica os clipes. A taxa não foi
  medida no laboratório (ver item anterior). O portão 0,90×–1,10× do contrato só pode passar depois dessa etapa.
- **A esquiva não tem lado na simulação.** `remapPve1` escolhe pelo sentido do movimento, e o tempo é
  esticado de 0,65 s (núcleo) para 1,00 s (clipe). A simulação também não aplica a curva de deslocamento.
- **Reação, cambaleio, queda, levantar e morte** caem na guarda PvE (módulos D/E, lote 3).
- **glTF Validator** não está instalado nesta máquina: a validação estrutural é a do repositório
  (`validate-hunter-pvp-v09.mjs --pve1`), não a da Khronos.
- **Referência visual**: a direção vem da descrição do pedido (Monster Hunter World); nenhuma imagem de
  referência foi consultada.

## Notas da revisão visual feita pelo autor (não é aprovação)

Corrigido nesta entrega, achado olhando os renders:

- Carga do pesado: o punho e a guarda da espada entravam no rosto. A mão foi levada para fora e para trás do
  ombro, e o portão punho–cabeça (≥ 16 cm) passou a reprovar a geração.
- Esquiva: a pelve subia só 2 cm no voo e a esquiva parecia um arrasto lateral. Agora ela sobe 10 cm, e os pés
  saem 24 e 20 cm do chão.

Pontos que o diretor deve olhar:

- **Ataque leve, vista de perfil, no contato**: braço reto e lâmina horizontal à frente. De lado, a diagonal pode
  parecer uma estocada.
- **Corrida**: a espada vai à frente e para cima, como na guarda. Isso foi escolhido para não torcer o punho
  (portão de 60°). Uma corrida com a lâmina baixa, ao lado da perna, pede outro jeito de segurar a espada.
- **Mão livre**: ela não toca a lâmina no bloqueio. A mão esquerda é posta sem restrição de contato com a espada.
- O corpo é o Hunter de oficina sem armadura (1000 triângulos, 23 juntas). A leitura de peso fica limitada pela
  malha.
