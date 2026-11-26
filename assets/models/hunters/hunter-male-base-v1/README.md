# Wildhaven — Hunter Masculino Base v1.0

**Estado:** protótipo de malha 3D real, aguardando avaliação e refinamento visual. **Não integrado ao jogo**.

- Estilo: low-poly com cabeça careca, corpo compacto, musculatura discreta, apenas cueca. Bind pose: T-pose. Altura de referência: 1,72 m.
- LOD0: `output/hunter_male_base_v1_lod0_animated.glb` — **1.616 triângulos**.
- LOD1: `output/hunter_male_base_v1_lod1_animated.glb` — **1.168 triângulos**.
- Rig: 18 ossos e atributos `JOINTS_0/WEIGHTS_0`. A skin é rígida por peça; requer aperfeiçoamento de deformação em torno das juntas.
- Oito clipes de animação procedurais: `idle`, `walk`, `run`, `attack`, `guard`, `dodge`, `hit`, `death`. São **clipes iniciais**, não animações artísticas finais.
- Materiais simples de cores sólidas, sem textura bitmap e sem cabelo, barba ou acessórios.
- Render **real da geometria do LOD0**: `output/hunter_male_base_v1_real_preview.png`.
- Contagem de triângulos, SHA-256 e bytes dos arquivos: `output/manifest.json`.
- Fonte editável/reprodutível: `build_hunter_base_v1.py` (Python 3, biblioteca padrão).
- Renderizador da malha: `render_preview.py` (numpy e matplotlib).
- Visualizador para inspecionar animações em Three.js: `viewer.html`, selecione um GLB local.

## Reproduzir

```bash
python3 build_hunter_base_v1.py
python3 -m pip install numpy matplotlib trimesh
python3 render_preview.py
```

## Limitações e próximos passos

A geometria aproxima a arte aprovada, mas a malha ainda precisa de revisão de rosto, ombros, articulações e deformações dos movimentos. Não foi produzido `.blend` nativo: o GLB é importável no Blender e o gerador Python é editável. Ainda não existem equipamentos/cabelos intercambiáveis nem customização procedural de indivíduos.

**A construção desses assets não altera `game/alpha01`**, mapas, criaturas ou gameplay. Integração é uma etapa separada após aprovação.
