# Pipeline de produção Hunter Workshop

1. Congelar a referência GLB/PNG e conferir o manifesto.
2. Verificar rig, hierarquia dos 19 joints, bind pose, escala, UV e materiais.
3. Criar peça por variação de textura, substituição de superfície ou geometria sobreposta.
4. Declarar slots, conflitos e regiões do corpo a ocultar.
5. Modelar, transferir pesos, ajustar deformação e exportar GLB real.
6. Reimportar para testar `Walking`, `Running`, colisões de roupas e compatibilidade.
7. Gerar renders reais e manifestos com triângulos, vértices, hash e bytes.
8. Publicar arquivos binários GLB/PNG reais em branch, conferir os hashes remotos.
9. Aprovar artisticamente; depois, integrar à engine em etapa separada.

**Orçamento inicial de planejamento**: cabelos 80–200 vértices exportados; torso 150–350; pernas 100–250; luvas 60–120; botas 100–200; capacetes 100–200; armadura complementar 300–700. Avatar equipado alvo 1.800–3.000 vértices visíveis, teto provisório 3.500. São metas, não medições na engine.

Não modificar `game/alpha01` nem mapas durante preparação de assets.
