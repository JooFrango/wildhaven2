# Wildhaven — Arraia-de-Areia v02: refinamento anatômico (estático)

**Etapa:** silhueta v01 e conceito aprovados pelo usuário; esta revisão anatômica v02 precisa de inspeção visual antes do rig. Não houve integração no jogo, merge ou animações.

## O que mudou em relação à v01

- Mantém escala aprovada: 18 metros de envergadura, ~19,83 m de comprimento; mesma estrutura de disco/cauda/escudos.
- Transição da parte cefálica às nadadeiras melhorada na **geometria da superfície** (volume e espessura, não manchas como malhas).
- Órbitas reconstruídas com rim craniano facetado, íris anatômica e pupila pequena, preservando uma única textura UV para coloração.
- Três nervuras de sustentação musculoesquelética rasas por nadadeira, ligadas à curvatura do manto; sulcos e cores superficiais permanecem pintados na textura.
- Cristas sensoriais cranianas discretas e pregas funcionais nos cantos da mandíbula filtradora.
- Atlas UV de 2048² refeito a partir da pintura da v01, com desgaste mineral e abrasões finas **apenas em pixels**; o atlas é incorporado ao GLB.

## Entrega técnica

- Modelo: `arraia-de-areia-v02-anatomia-refinada.glb` (6.576 triângulos, 1 mesh, 1 material PBR, sem ossos/clipes/LODs nesta etapa).
- Textura: `textures/arraia-de-areia-v02-pintura-uv-refinada.png`.
- `manifest.json`: tamanho, SHA-256, medidas, grupos de anatomia, número de materiais, aprovação e estado.
- Reimportação: `trimesh` confere estrutura e UV; `vtkGLTFImporter` renderiza GLB REAL em perfil, frente, três-quartos e superior.
- `source/build_refined.py`: criação reproduzível da revisão a partir de `../v01/source/build.py` e do PNG original da v01, sem alterar o v01.
- `source/render.py`: captura fiel do arquivo exportado, não conceito por IA.

## Status

PR em draft enquanto a v02 aguarda aprovação artística de refinamento. **Não criar rig ou animações por antecipação**. O GLB desta versão ainda é estático. Nenhum arquivo da v01 é modificado ou eliminado.
