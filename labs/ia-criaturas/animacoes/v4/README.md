# Oficina de animações V4 — catálogo de 20 criaturas

Foram criadas versões GLB binárias derivadas para 20 modelos reais, preservando malhas, materiais, skins e clipes existentes. Todos os novos clipes terminam em `_v4`. A produção está em fase de **protótipo**, sem inspeção visual concluída e sem integração ao motor de combate.

## Modelos incluídos

| Espécie | Anatomia | Modelo derivado |
|---|---|---|
| Arbelio | quadrupede | [GLB](animacoes/v4/arbelio/arbelio-savanna-faceted-v02-LOD0-anim-v4.glb) |
| Boscaranha | aracnideo | [GLB](animacoes/v4/boscaranha/boscaranha-optimized-v02-LOD0-anim-v4.glb) |
| Brotarro | quadrupede | [GLB](animacoes/v4/brotarro/v02/brotarro-v02-skinned-animated-LOD0-anim-v4.glb) |
| Carniroca | ave | [GLB](animacoes/v4/carniroca/carniroca-optimized-v02-LOD0-anim-v4.glb) |
| Cavoru | quadrupede | [GLB](animacoes/v4/cavoru/cavoru-forest-optimized-v02-LOD0-anim-v4.glb) |
| Cipria | quadrupede | [GLB](animacoes/v4/cipria/v02/cipria-v02-skinned-animated-LOD0-anim-v4.glb) |
| Cromatil | quadrupede | [GLB](animacoes/v4/cromatil/cromatil-savanna-animated-v01-LOD0-anim-v4.glb) |
| Folhisco | ave | [GLB](animacoes/v4/folhisco/folhisco-optimized-v02-LOD0-anim-v4.glb) |
| Frutavil | ave | [GLB](animacoes/v4/frutavil/frutavil-savanna-animated-v01-LOD0-anim-v4.glb) |
| Nharuk | quadrupede | [GLB](animacoes/v4/nharuk/v02/nharuk-temperate-plains-optimized-v03-LOD0-anim-v4.glb) |
| Rambrel | quadrupede | [GLB](animacoes/v4/rambrel/rambrel-savanna-animated-v03-LOD0-anim-v4.glb) |
| Sevilho | quadrupede | [GLB](animacoes/v4/sevilho/sevilho-savanna-faceted-v02-LOD0-anim-v4.glb) |
| Silvarano | quadrupede | [GLB](animacoes/v4/silvarano/silvarano-temperate-optimized-v02-LOD0-anim-v4.glb) |
| Talvero | quadrupede | [GLB](animacoes/v4/talvero/talvero-savanna-animated-v05-LOD0-anim-v4.glb) |
| Torvalho | quadrupede | [GLB](animacoes/v4/torvalho/torvalho-optimized-v02-LOD0-anim-v4.glb) |
| Tufrilo | quadrupede | [GLB](animacoes/v4/tufrilo/tufrilo-optimized-v02-LOD0-anim-v4.glb) |
| Tumbira | quadrupede | [GLB](animacoes/v4/tumbira/v02/tumbira-v02-skinned-animated-LOD0-anim-v4.glb) |
| Turvagal | quadrupede | [GLB](animacoes/v4/turvagal/turvagal-savanna-animated-v03-LOD0-anim-v4.glb) |
| Varrisco | bipede | [GLB](animacoes/v4/varrisco/v02/varrisco-animated-v02-LOD0-anim-v4.glb) |
| Velufim | ave | [GLB](animacoes/v4/velufim/v02/velufim-v02-skinned-animated-LOD0-anim-v4.glb) |

## Testes e revisão

- Catálogo de arquivos: [MANIFEST.json](MANIFEST.json).
- Visualizador 3D: `labs/ia-criaturas/animacoes-v4.html` (página do servidor de desenvolvimento do laboratório). Seletor de espécie, clipe, velocidade e captura PNG.
- Gerador reprodutível: `node scripts/animacoes-v4.mjs --todos` executado na pasta do laboratório. Faz versões derivadas onde encontrar rig compatível e registra modelos sem suporte como pendentes.
- Não considerar as animações aprovadas sem verificar transições, apoio das patas, contato entre criaturas, sincronismo dos golpes e presença de deformações no renderizador.
- Perfis específicos para bípede, quadrúpede, ave e aracnídeo. Modelos sem rig reconhecido não devem receber movimentos genéricos incorretos.
- **Ainda pendente:** demais espécies/variantes, rigs incompatíveis, ajustes artísticos individuais e integração à IA V3.

## Restrições

Não tocar na Alpha, nos mapas ou nos GLBs originais. Não fazer merge sem autorização. Arquivos derivados ficam em `labs/ia-criaturas/`.
