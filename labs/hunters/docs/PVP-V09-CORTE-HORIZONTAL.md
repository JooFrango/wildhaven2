# Hunter PvP v09 — corte horizontal (aguardando aprovação do diretor)

Somente animação 3D. Nenhuma lógica de combate, dano, IA, controles, arena ou Alpha foi tocada.

## Arquivos

| O quê | Caminho |
|---|---|
| GLB (v05 + 1 clipe + espada) | `labs/hunters/assets/hunter-pvp-v09/hunter_pvp_v09.glb` |
| Manifesto (SHA-256, ossos, triângulos, clipes, QA) | `labs/hunters/assets/hunter-pvp-v09/manifest.json` |
| GIFs reais (perfil, frente, 3/4) | `labs/hunters/resultados/pvp-v09/pvp09_sword_horizontal_cut_*.gif` |
| Poses-chave (8 fases × 3 ângulos) | `labs/hunters/resultados/pvp-v09/pose_*.png` |
| Gerador | `labs/hunters/scripts/animate-hunter-pvp-v09.mjs` |
| Validador | `labs/hunters/scripts/validate-hunter-pvp-v09.mjs` |
| Captura | `labs/hunters/scripts/capture-hunter-pvp-v09.mjs` |
| Viewer | `labs/hunters/viewer/pvp-preview-v09.html` |

Reproduzir (Node 22+, `npm ci` em `labs/hunters-codex`):

```bash
node labs/hunters/scripts/animate-hunter-pvp-v09.mjs
node labs/hunters/scripts/validate-hunter-pvp-v09.mjs
node labs/hunters/scripts/capture-hunter-pvp-v09.mjs --chrome "<caminho do Chrome>"
```

`--probe` no gerador imprime cotovelo, desvio do punho, torção e eixo da espada por instante.

## Auditoria das versões anteriores

- Base: `hunter_combat_v05.glb` (19 ossos, 1000 triângulos, 83 clipes) continua sendo a versão aprovada mais recente. A v08 só acrescentou um clipe experimental sobre ela; v06/v07/v08 não estão aprovadas.
- Rig: T-pose, frente +Z, mão direita em −X. Tem clavículas, pescoço e cabeça. **Não tem ossos de dedo nem de dedo do pé.** A malha da mão é uma "pá" aberta.
- Causa raiz da v08 ("espada entrando na mão"): o socket alinhava o cabo com o eixo antebraço→mão. A espada era o prolongamento do antebraço e o cabo atravessava a palma no comprimento.
- Causa raiz do "braço fechado no peito" (v08): cotovelo nunca passava de 111°, contato no centro do peito e pouca rotação do tronco no follow-through.
- A rolagem da mão na v08 ficava indefinida quando a lâmina ficava quase paralela ao antebraço. Por isso o fio não conduzia o corte.
- A captura da v08 deixava o loop de reprodução avançar o tempo entre `setTime` e a captura. Algumas poses não correspondiam ao tempo do nome do arquivo.

## O que mudou na v09

1. **Empunhadura:** o cabo cruza a palma na diagonal, a 75° do eixo da mão (ponta inclinada para a frente). O fio fica do lado dos nós dos dedos. A espada é uma malha real filha de `WeaponSocket_Right_PvP09` em `RightHand`.
2. **Mão guiada pelo fio:** cada pose define a direção da lâmina e a do fio. O fio aponta na direção do arco. A orientação da mão sai disso, e o cotovelo é puxado para onde o antebraço precisa estar (`ELBOW_FOLLOW`). O antebraço segue a espada, sem quebrar o punho.
3. **Pronação/supinação:** 60% da torção fica no antebraço. A torção é desembrulhada quadro a quadro, sem salto em ±180°.
4. **Corpo inteiro:** o quadril dispara antes dos ombros (separação quadril/ombro) e a clavícula protrai no contato. O tronco gira cerca de 63° no follow-through. A cabeça contra-gira e mantém o olhar no alvo.
5. **Pés:** o pé da frente avança 15 cm com arco de elevação e volta. O pé de trás gira e levanta o calcanhar em torno da bola do pé. Os pés ficam planos. Fora das janelas de passo, deslizamento ≈ 0.
6. **Braço livre:** fica como contrapeso, sempre abaixo do peito (0,88–0,98 m). Vai à frente na preparação e é puxado para trás no golpe.
7. **Interpolação:** Catmull-Rom/Hermite com velocidade contínua. As chaves `hold` (guarda, carga, fim da continuação) assentam o corpo com tangente zero. Os pés usam ease in/out próprio, sem overshoot.

## Fases (metadados em `animations[83].extras.phases`)

| Fase | t (s) |
|---|---|
| guarda | 0 |
| preparação | 0,10 |
| carregamento | 0,42 |
| execução | 0,62 |
| contato | 0,84 |
| continuação | 0,86 |
| recuperação | 1,18 |
| retorno à guarda | 1,90 |

Versão in-place: o pé avança e volta, sem translação final.

## QA técnico (manifesto `qa`)

| Medida | Valor | Limite |
|---|---|---|
| erro IK mão / pé | ~0 / ~0 | 1 cm / 1,2 cm |
| deslizamento do pé plantado | 0,03 mm | 2 mm |
| cotovelo | 109°–167° | ≥ 140° no contato |
| desvio do punho | ≤ 51° | 60° |
| torção do antebraço (vs. T-pose) | −4° → 175° (contínua) | 200° |
| lâmina dentro da cápsula do tronco | 0 | 0 |
| altura do braço livre | 0,88–0,98 m | ≤ 1,05 m |

Os 83 clipes, a malha, o skin, as texturas e os materiais originais são idênticos à v05. O prefixo do BIN também é byte a byte igual, e o validador confere isso.

## Limites conhecidos (precisam de decisão do diretor)

- **Mão sem dedos (v09):** o cabo encosta na palma, mas nenhum dedo fecha sobre ele. No close-up, parece espada apoiada na mão aberta. Não se resolve só com animação.
  Resolvido na v10 (seção abaixo). Proposta original: acrescentar `RightFingers`/`LeftFingers` (um osso de curl por mão, filho de `*Hand`). Pesar só os vértices dos dedos, com bind = pose atual. Nos 83 clipes antigos o osso fica em identidade, então nada muda neles. Nos clipes de espada, o osso fecha o punho em volta do cabo. Isso exige editar o skin num GLB novo, sem tocar a v05.
- A checagem de interseção cobre só lâmina × tronco (cápsula). Lâmina × braço/perna e mão × cabo foram verificadas visualmente nas poses e nos close-ups, não por geometria.
- Sem variante com root motion.
- A comparação com Kenshi foi feita de memória da linguagem de movimento do jogo, sem material de referência dentro do repositório.

## v10 — extensão do rig com dedos (mesmo corte)

Pedido do diretor após a v09: estender o rig dos dedos. Mesmo movimento da v09, agora com o punho fechado em volta do cabo.

| O quê | Caminho |
|---|---|
| GLB v10 (23 ossos) | `labs/hunters/assets/hunter-pvp-v10/hunter_pvp_v10.glb` |
| Manifesto | `labs/hunters/assets/hunter-pvp-v10/manifest.json` |
| GIFs e poses | `labs/hunters/resultados/pvp-v10/` |
| Viewer | `labs/hunters/viewer/pvp-preview-v10.html` |

Reproduzir: os mesmos scripts com `--v10` (`animate-…`, `validate-…`, `capture-…`). Sem a flag, o gerador ainda produz a v09 byte a byte igual (SHA `a34f080d…`).

**Rig**
- Ossos novos: `RightFingers1` e `RightFingers2` (falange proximal e distal; nós a 10 cm do punho, meio a 15,2 cm), mais o par equivalente da esquerda. São filhos de `*Hand` e entram no fim de `skins[0].joints` (índices 19–22). A ordem dos 19 ossos originais não mudou.
- `IBM_dedo = L⁻¹ · IBM_mão`. Com os ossos em repouso, a matriz de skin dos dedos é igual à da mão.
- Os 83 clipes antigos não têm canais para esses ossos, então os dedos ficam em repouso neles. Teste numérico com pose arbitrária: skin novo × skin v05 = Δ máx. 7·10⁻⁸ m.
- Repeso só dos vértices 100% presos à mão, a partir dos nós (rampa de 2 cm entre mão, proximal e distal). O polegar ficou fora. Posições, normais, UVs e índices continuam sendo os accessors da v05; só `JOINTS_0`/`WEIGHTS_0` são novos.
- Curl: mão direita 74° + 89° (punho fechado). Mão esquerda 26° + 32° (relaxada).

**Empunhadura**
- A posição do cabo é ajustada automaticamente. O gerador busca onde os dedos fechados mais encostam no cabo sem nenhum vértice dentro dele (detalhes em `qa.grip` no manifesto).
- A palma do Hunter tem ~20 cm de largura, então o cabo da v10 tem 21,5 cm (mão e meia). Com o cabo da v09, guarda e pomo entravam nos dedos.

**Limites v10**
- Os dedos fecham como dois blocos por mão; não há dedos individuais nem polegar animado.
- A checagem de interseção mão × cabo é por vértice. Faces da malha low-poly podem cruzar o cabo entre vértices; isso foi verificado só por close-up.

## v11 — corte horizontal reverso (2ª animação, aguarda aprovação)

O diretor aprovou a v10. A v11 é a v10 (rig de dedos + corte aprovado, dados idênticos byte a byte) mais o clipe `pvp11_sword_horizontal_reverse_cut`: revés da esquerda para a direita, mesmas 6 fases e mesma duração (1,9 s, contato em 0,84 s).

| O quê | Caminho |
|---|---|
| GLB v11 (23 ossos, 85 clipes) | `labs/hunters/assets/hunter-pvp-v11/hunter_pvp_v11.glb` |
| Manifesto (`perClipQa` por clipe) | `labs/hunters/assets/hunter-pvp-v11/manifest.json` |
| GIFs e poses do revés | `labs/hunters/resultados/pvp-v11/` (`pose_reverse_*`) |
| Viewer | `labs/hunters/viewer/pvp-preview-v11.html?clip=pvp11_sword_horizontal_reverse_cut` |

Reproduzir: `animate-… --v11`, `validate-… --v11`, `capture-… --v11 --reverse`. `--probe --reverse` mostra o revés quadro a quadro.

**Movimento**
- Carga: o tronco enrola para a esquerda (quadril +0,10 rad, peito +0,40 rad). A espada deita sobre o ombro esquerdo com a palma para baixo, e o cotovelo cruza na frente do peito.
- Execução: o quadril dispara para a direita antes dos ombros. O braço desdobra pela frente do peito e a ponta vem atrasada pela esquerda.
- Contato: braço quase estendido (156°) à frente do corpo. O fio aponta para a direção do arco (tangente invertida em relação ao corte de direita).
- Continuação: o tronco gira cerca de 57° para a direita e o braço termina do lado direito. A recuperação traz a lâmina de volta à guarda pelo centro.
- Pés: o da frente avança e volta, como no corte de direita. O de trás gira aberto (−0,62 → −0,85 rad) e o calcanhar quase não sai do chão.

**QA do revés**: cotovelo 102°–156°, punho ≤ 56°, torção do antebraço ≤ 91° (palma para baixo, sem supinação forte), deslizamento do pé plantado 0,03 mm, lâmina fora da cápsula do tronco, braço livre ≤ 0,98 m.

**Limites**: o alcance do revés é menor que o do corte de direita porque o ombro direito recua. É anatômico, mas o contato fica cerca de 0,44 m à frente do ombro, contra 0,60 m no corte de direita. Os mesmos limites de dedos da v10 valem aqui.
