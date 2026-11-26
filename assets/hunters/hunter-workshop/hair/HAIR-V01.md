# Cabelos v01 — Curto e Moicano

Dois novos modelos 3D reais para o `hunter_masculino_1000v.glb`, originalmente enviado pelo usuário:

| Item | Triângulos | Vértices geométricos exportados | Textura |
| --- | ---: | ---: | --- |
| Curto | 156 | 117 | UV PNG 128×128 embutida no GLB |
| Moicano | 72 | 40 | UV PNG 128×128 embutida no GLB |

- O personagem de referência tem 19 ossos e animações `Walking` e `Running`.
- As duas peças são **malhas rígidas na coordenada local do osso `Head`**.
- Cada peça ocupa o slot `hair`, sem criar rig, animação ou peso adicional.
- O visualizador em `viewer/index.html` anexa a malha carregada ao osso `Head` e troca a peça por clique; as animações pertencem somente ao Hunter.
- O cabelo curto é castanho-escuro, com franja facetada; o moicano tem crista estreita e laterais expostas.
- Cores/estrias usam apenas textura UV; geometria é dedicada à silhueta e volume.
- Os materiais e GLBs são 100% originais deste projeto; nenhum cabelo gera modelos de corpo alternativos.
- Se o modelo base não estiver no checkout remoto, o visualizador permite escolher o GLB local por arquivo.

## Gerar e testar localmente

```bash
python -m pip install numpy trimesh Pillow
python assets/hunters/hunter-workshop/hair/source/generate_hairs.py
python assets/hunters/hunter-workshop/hair/source/verify_hairs.py
python -m http.server 8000
```

Abrir `http://localhost:8000/assets/hunters/hunter-workshop/viewer/`.

## Limites e estado

A publicação dos **GLBs de cabelo** só deve ser considerada concluída quando o workflow fizer commit dos binários e os arquivos forem recuperados remotamente. O **GLB do corpo base e a sua PNG** ainda não foram enviados à branch do GitHub no PR #70; existem no pacote ZIP entregue no chat. Não foi realizada integração com `game/alpha01` nesta etapa, apenas o sistema funcional de prévia do workshop. A aprovação artística dos dois cabelos permanece aberta.
