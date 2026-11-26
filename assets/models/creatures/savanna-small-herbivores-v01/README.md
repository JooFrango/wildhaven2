# Wildhaven — Quatro pequenos herbívoros da savana · GLBs v01

**Escopo estrito:** criação de criaturas 3D e clipes, sem alterações no jogo, mapa, IA ou ecossistema.

## Criaturas aprovadas conceitualmente

| ID | Espécie | Biologia de referência | Assinatura do modelo | Clipes |
|---|---|---|---|---:|
| `sevilho` | Sevilho | Coletor terrestre de sementes | Orelhas grandes, bolsas nas bochechas e cauda felpuda | 11 |
| `arbelio` | Arbélio | Herbívoro escalador de acácias | Corpo comprido, garras de agarre e cauda curva | 11 |
| `frutavil` | Frutavil | Ave frugívora | Bico curvo, crista longa, asas com penas e cauda em leque | 11 |
| `cromatil` | Cromátil | Réptil herbívoro das rochas | Corpo baixo, placas dorsais sobrepostas e cauda defensiva | 11 |

## Arquivos reais

Cada pasta `models/<id>/` contém **três GLBs glTF 2.0** (LOD0, LOD1 e LOD2), com triângulos, materiais PBR de cores, paleta de cores por vértice no corpo, hierarquia de nós articulados e **11 clipes embutidos no próprio GLB**. Os `manifests` registram bytes, SHA-256, animações e quantidade de triângulos.

A pasta `previews/` inclui **12 capturas de geometria 3D real**, feitas importando os **GLBs finais** diretamente via `vtkGLTFImporter`, nos ângulos frente, perfil e três-quartos, mais a prancha conjunta. Não são imagens conceituais/IA.

## Reproduzir

```bash
pip install numpy==2.3.5 vtk==9.6.2 pillow==11.3.0
python source/generate.py
python source/render_exported.py
python source/make_sheet.py
python source/validate.py
python -m http.server 8000
```

Abrir `http://localhost:8000/viewer/` para reproduzir animações, alternar LODs e girar a câmera. O HTML importa Three.js pela CDN, portanto exige acesso à internet inicialmente.

## Limitações técnicas e visuais

Os assets são **protótipos v01 para inspeção artística**; as artes conceituais estão aprovadas, **não** a fidelidade destes modelos. A topologia é leve, com volumes anatômicos simplificados e sobreposições entre partes. **Não há skinning ponderado**: a animação é feita por pivôs hierárquicos GLB, que funcionam em Three.js mas podem mostrar encaixes nas juntas. Voo, escalada, armazenamento de sementes e alimentação ainda são gestos simplificados; não há física, IK, ground contact dinâmico, root motion real, colisão nem IA. Não declare modelos prontos para produção sem revisão de anatomia e animações.

Os três LODs são arquivos separados: o jogo precisa implementar seu próprio switching posteriormente (fora do escopo deste trabalho).