# Hunter PvP v06 — poses esqueléticas para aprovação do diretor

**Escopo:** somente laboratório. Sem integração na Alpha, sem sobrescrita de v05, sem alteração do PvE Monster Hunter.

## Origem e fidelidade

- Fonte **real:** `labs/hunters/assets/hunter-v05/hunter_combat_v05.glb` da branch `feat/hunter-jogador-v04` / PR #24, com 1.000 triângulos e 19 juntas.
- Os 83 clipes existentes da v05 são preservados. Os dez clipes PvP são aditivos e ficam em um arquivo versionado separado.
- As dez artes conceituais anteriores são **referências de direção do movimento**, não renders GLB. Como o Hunter atual não está equipado como a arte de couro/capa, os renders devem manter o Hunter real; nenhuma malha de roupa ou espada é inventada dentro do GLB.
- O visualizador cria **uma espada provisória separada** ligada à `RightHand`, com material cinza. É somente um marcador de visualização do movimento, não uma arma oficial integrada ou nova malha corporal.
- Uso: PvP de decisão automática estilo Kenshi. O clipe é visual; o dano, hitbox e acertos continuam no simulador, **não** na animação.

## Lote proposto (um clipe/GIF por revisão)

| # | Clip | Arte / ação | Decisão de revisão |
|---|---|---|---|
| 01 | `pvp_sword_01_ready` | Guarda inicial / preparação | Aguardando |
| 02 | `pvp_sword_02_slash_right` | Corte horizontal da direita | Aguardando |
| 03 | `pvp_sword_03_slash_left` | Corte horizontal reverso | Aguardando |
| 04 | `pvp_sword_04_overhead` | Corte vertical pesado | Aguardando |
| 05 | `pvp_sword_05_thrust` | Estocada | Aguardando |
| 06 | `pvp_sword_06_guard_high` | Defesa alta | Aguardando |
| 07 | `pvp_sword_07_parry` | Aparo de espada | Aguardando |
| 08 | `pvp_sword_08_dodge` | Esquiva lateral | Aguardando |
| 09 | `pvp_sword_09_take_hit` | Reação ao dano / desequilíbrio | Aguardando |
| 10 | `pvp_sword_10_kneel_injured` | Ferido, cai de joelho | Aguardando |

## Pipeline de geração e revisão

Do checkout da branch do PR #24 no repositório `carioca1111/wildhaven-new`:

```bash
node labs/hunters/scripts/animate-hunter-pvp-v06.mjs
node labs/hunters/scripts/validate-hunter-pvp-v06.mjs
cd labs/hunters && npm run dev
```

Abrir `http://localhost:5195/hunters/viewer/pvp-preview-v06.html`. Escolher um dos 10 clipes. O botão **Exportar GIF deste movimento** gera um arquivo `.gif` de 12 FPS a partir dos quadros do **modelo GLB real** do visualizador. O botão **Gerar os 10 GIFs separados** oferece os dez arquivos individuais; é possível que o navegador solicite permissão de downloads múltiplos.

O GIF usa um codec RGB332 e 300×380 px para que a prévia fique leve. O GLB permanece a fonte de verdade; os GIFs não se tornam animações de jogo. O navegador deve ter WebGL e acesso ao CDN do Three.js. Não depender de animação por imagem IA.

## Critérios de aprovação antes da publicação definitiva

1. Comparar a pose e a silhueta do GLB com a arte conceitual de cada movimento.
2. Confirmar que os pés não deslizam excessivamente, que não há T-pose e que os braços não se esticam além da anatomia.
3. Conferir o ponto e o tempo de impacto, defesa, parry e recuperação, sem dano disparado pela animação.
4. Verificar se o clip de queda e o levantar posterior respeitam o estado de incapacitação do simulador.
5. Validar `glTF` e inspectar visualmente todos os dez GIFs reais em três ângulos antes de aprovação técnica.
6. Após aprovação específica do diretor, conectar os clipes ao runtime PvP, preservar a v05 e publicar o GLB real, manifesto com SHA remoto e os GIFs reais.

## Limites conhecidos nesta proposta

O script e a página são entregas de código para gerar a revisão. O fato de um script existir **não** equivale a um GLB exportado nem a GIFs renderizados. Um relatório de execução com hash e capturas reais só pode ser marcado como concluído depois de executar sobre o binário e conferir sua saída. A versão v06 permanece **não aprovada** até auditoria técnica e revisão visual.