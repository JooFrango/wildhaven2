# Sirocauro — blockout anatômico pesado v01 (Wildhaven)

**Etapa:** conceito aprovado com alteração do diretor para um corpo mais pesado. **Forma do GLB: AGUARDANDO APROVAÇÃO.** Nenhum rig, clipe de animação, LOD ou integração de gameplay foi produzido nesta etapa.

## Direção aprovada e alterações

- Réptil carnívoro bípede do Mar de Dunas; territorial, aproximação encoberta pela tempestade de areia de raio máximo **100 m**, pouca velocidade de perseguição.
- Intimidação: cuspir fogo a até **20 m**, custo energético elevado. Essas habilidades são requisitos **para futuras etapas de IA/VFX**; **não estão implementadas** neste GLB.
- Proposta mais pesada (alteração do diretor): caixa torácica profunda, quadril largo, coxas e canelas reforçadas, pescoço estruturado, cabeça e mandíbula grandes, placas ósseas e cauda de contrapeso mais grossa. Massa visual estimada **16 a 22 toneladas** (proposta, não simulação ou medição física).
- Medidas **da malha GLB**: ~6,19 m do ponto mais alto ao mais baixo e ~14,40 m do focinho ao extremo da cauda; altura de design 6 m. Proporção ainda em revisão artística.
- Verde-oliva e ocre, placas bege-rochosas, olhos âmbar. **Atlas UV pintado e embutido**, sem malhas decorativas exclusivamente para manchas/cores.
- Referência de geometria angular/planos anatômicos: Torvardo v03; Mastélio e Garruva v03 complementam.

## Arquivos reais

- `sirocauro-v01-anatomia-pesada-blockout.glb`: malha real GLB estática **6.238 triângulos**, 1 mesh glTF, 123 componentes construtivos originais fundidos, atlas UV embutido. Sem skins, juntas ou animações.
- `textures/sirocauro-v01-uv-atlas.png`: fonte externa do atlas, já embutida no GLB.
- `source/build.py`: gerador reproduzível com seções transversais, placas, mandíbula, dentes, braços, pernas e cauda.
- `source/render.py`: **carrega o GLB exportado**, prepara cena VTK EGL e grava três renders reais, mais prancha e comparação com o conceito.
- `previews/sirocauro-v01-real-glb-perfil.png`, `...-frente.png` e `...-tres-quartos.png`: imagens realmente renderizadas da geometria do GLB importado.
- `previews/sirocauro-v01-real-glb-3-vistas.png`: prancha de revisão.
- `previews/sirocauro-v01-conceito-vs-glb.png`: arte enviada pelo diretor à esquerda, render real à direita, claramente identificados.
- `manifest.json`, `validation.json`: hashes e estados.

## Produção e validação

```bash
python source/build.py
python source/render.py
```

Dependências: Python, `trimesh`, `numpy`, `Pillow` e `vtk` (EGL para render offscreen). O validador usa `trimesh` para reimportar o GLB, verificar triângulos, UV e ausência de animações/skins. Não há afirmação de contato com física, marcha real, renderização em Three.js nem fidelidade artística aprovada.

## Próximo gate

**Diretor:** inspecionar as três vistas e aprovar ou pedir ajustes à forma, sobretudo focinho/mandíbula, coxas, pés, proporção e espinhos. Refinamento, rig, skinning, VFX e animações **não estão autorizados automaticamente**. Não fazer merge ou alterar a Alpha.