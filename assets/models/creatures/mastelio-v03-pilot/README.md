# Wildhaven · Mastélio v03 — anatomia facetada (modelo-piloto)

**Status:** BLOCKOUT DE APROVAÇÃO, NÃO MODELO FINAL. A arte conceitual foi aprovada; este novo GLB ainda precisa de aprovação artística.

## Objetivo

Reproduzir a direção visual aprovada no Torvardo v03 e aplicada ao Raizauro v03: silhueta marcante, planos firmes, anatomia compreensível, poucos triângulos e absolutamente nenhuma malha com aparência de massinha. A fonte de verdade é o modelo glTF 2.0 exportado, **não uma imagem generativa**.

## Arquivos

- `mastelio-v03-anatomy-blockout.glb`: modelo 3D binário real, 1 malha de jogo, triângulos facetados e cores de vértice.
- `manifest.json`: medição real de triângulos, partes de modelagem, tamanho, SHA256 e estado da etapa.
- `previews/mastelio-v03-real-glb-{front,side,three_quarter}.png`: prints feitos com `vtkGLTFImporter` lendo o GLB exportado.
- `previews/Mastélio_v03_Preview_GLb_Real_3_Angulos.png`: prancha de três ângulos autênticos.
- `previews/Mastelio_Comparacao_Real_V02_V03.png`: lado a lado usando os renders verdadeiros das versões v02/v03, quando a v02 estiver disponível.
- `source/build.py`: modelagem geométrica editável e reproduzível; `source/render.py` e `source/validate.py` para testes.

## Anatomia preservada do conceito aprovado

Corpo de herbívoro pesado com lombos arredondados em **grandes planos facetados**, quatro pernas colunares de apoio, placas de unha nos dedos, cabeça de mandíbula larga, orelhas grandes em leque com superfícies internas, pequeno topete em massas planificadas, manchas claras integradas nas cores reais das faces e tromba **curta, preênsil e curvada para cima** feita de uma malha poligonal contínua. A cauda possui tufo terminal.

As proporções são relativas ao conceito e **a escala em metros ainda precisa ser calibrada** no pipeline de integração. O material e as marcas de pelagem são placeholders de modelagem artística e não reproduzem toda a textura final.

## Regra de produção

**Não** criar rig, animações ou LODs até a silhueta ser analisada e aprovada. A v03 não deve substituir a v01/v02 nem modificar o mundo, o jogo, a Alpha, Hunters, ecologia ou outros animais. Sem avaliação de deformação não se pode alegar que o asset esteja animado.

## Reproduzir

```sh
python3 -m pip install 'numpy==2.3.5' 'trimesh==4.11.1' 'vtk==9.6.2' 'pillow==11.3.0'
python3 assets/models/creatures/mastelio-v03-pilot/source/build.py
xvfb-run -a python3 assets/models/creatures/mastelio-v03-pilot/source/render.py
python3 assets/models/creatures/mastelio-v03-pilot/source/validate.py
```

O screenshot real de v02 para comparação é procurado na pasta canônica `assets/models/creatures/mastelio/`, existente na branch-base do projeto.