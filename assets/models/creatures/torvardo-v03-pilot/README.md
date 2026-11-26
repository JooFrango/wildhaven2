# Wildhaven — Torvardo v03 | Estudo de silhueta e anatomia facetada

**Status: BLOCKOUT 3D EM REVISÃO ARTÍSTICA. Ainda NÃO aprovado.**

Este trabalho responde à rejeição da v02 por aparência de “massinha”. Usa o guia visual oficial `Wildhaven_Guia_Visual_Oficial_Criaturas_3D` como direção artística: silhueta forte, massas firmes, faces planas deliberadas, baixo número de polígonos.

## Arquivos

- `torvardo-v03-anatomy-blockout.glb`: GLB real, malha única com 3.910 triângulos e cores por vértice.
- `previews/torvardo-v03-real-glb-{side,front,three_quarter}.png`: screenshots verdadeiros do GLB importado pelo VTK, não arte conceitual.
- `previews/Torvardo_v03_Preview_GLb_Real_3_Angulos.png`: composição dos três renders.
- `previews/Torvardo_Comparacao_Real_V02_V03.png`: comparação fotográfica entre o modelo 3D real v02 e o v03.
- `manifest.json`: SHA256, orçamento geométrico, características e estágio de produção.
- `source/build.py`: gerador de malhas anatômicas low-poly, divisões por planos, partes nomeadas e exportação com *single draw mesh*.
- `source/render.py`: importação do GLB e geração das três vistas reais.
- `source/validate.py`: verifica integridade, geometria, shader colors, prévias e SHA256.

## Detalhes visuais reconstruídos

1. Caixa torácica alta e distinta do quadril; contornos de 14 faces.
2. Massas anatômicas dos quatro membros com joelhos e base de apoio próprios.
3. Cascos bifurcados com bordas retas e superfícies planas.
4. Juba composta por camadas de mechas largas e facetadas.
5. Escudo frontal córneo com arestas e crista central; chifres curvos.
6. Olhos embutidos na cabeça; focinho e narinas sem esferas salientes.
7. Todas as 145 peças semânticas combinadas numa só malha exportada, para diminuir draw calls; cores e planos preservados.

## Reprodução

Na raiz desta pasta:

```bash
python3 -m pip install numpy==2.3.5 trimesh==4.11.1 vtk==9.6.2 pillow==11.3.0
python3 source/build.py
python3 source/render.py
python3 source/validate.py
```

Em Linux, execute `source/render.py` com `xvfb-run -a` caso não haja servidor gráfico.

## O que NÃO está incluído

Não existe rig, skin weights nem animações nesta fase. O usuário aprovou começar pelo Torvardo v03 **como modelo-piloto**, e o fluxo acordado é aprovar primeiro a geometria e depois implementar rig, animações e LODs. Não há integração de gameplay, IA, mapa ou outras criaturas. **Não declarar esta etapa como modelo acabado.**

### Checklist antes do próximo estágio

- [ ] Silhueta comparada com conceito e aprovada pelo usuário.
- [ ] Transições musculares e cabeça consideradas suficientes em perfil/frente/3-4.
- [ ] Só então: rig e 12 clipes do Torvardo, depois LOD1/LOD2.
- [ ] Só então aplicar o método ao Raizauro, Mastélio e Garruva.