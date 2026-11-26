# Wildhaven — Clavascárnio v01 | blockout real

Conceito (arte enviada pelo diretor): **aprovado**. Blockout v01: **aguardando aprovação da forma**.

## Modelo e medidas

- GLB: `clavascarnio-v01-blockout.glb`
- Envergadura X: 4,976 m; altura Y: 3,000 m; extensão Z, incluindo as pinças: 4,483 m.
- Octópode de marcha com **oito patas locomotoras** + **dois membros quelípodes** (pinças assimétricas).
- 6.152 triângulos reimportados em 144 meshes nomeadas; 145 nós, 1 atlas UV pintado embutido no GLB.
- Geometria para carapaça, junções, espinhos defensivos e dentes. A pintura ocre/ferrugem/ossos vive somente na textura UV; não foram usadas malhas para simular manchas.
- **Sem rig/skinning, sem clipes, sem LODs adicionais**. Não há integração no jogo/Alpha.

## Identidade

**Clavascárnio, caçador couraçado das dunas**. Nicho carnívoro/necrófago de emboscada; detecta vibrações da areia. Porte colossal em face dos humanos, carapaça protegida, pés especializados em substrato solto. Valores de combate, IA e animações não implementados.

## Evidências

- `previews/clavascarnio-v01-glb-real-perfil.png`
- `previews/clavascarnio-v01-glb-real-frente.png`
- `previews/clavascarnio-v01-glb-real-tres-quartos.png`
- `previews/clavascarnio-v01-tripla-real-glb.png` — montagem dos três renders acima

Os três renders foram gerados por `vtkGLTFImporter` lendo e reimportando o **arquivo GLB efetivamente exportado**, após conferência do SHA-256 com o manifesto. A iluminação do viewer foi ajustada para apresentação; a geometria e o UV não foram modificados por esses ajustes de renderização. Não são imagens geradas por IA.

## Reprodução

Dependências: `python`, `numpy`, `Pillow`, `trimesh`, `vtk`.

```
python source/build.py .
python source/render.py .
python source/validate.py .
```

A arte conceitual original foi fornecida no chat e não está incluída no GLB como textura plana.

## Qualidade e próxima etapa

GLB de inspeção anatômica. Antes de qualquer refinamento é necessária a aprovação artística específica da **forma**. Após isso: refino anatômico/textura, rig com skinning, clipes e testes, otimização/LODs quando apropriado e Filtro de Qualidade. Não alterar nem sobrescrever versões antigas, nem modificar Alpha.

Destino planejado para publicação real com branch de revisão (não alegar publicação antes de confrontar bytes remotos): `carioca1111/wildhaven-new/assets/models/creatures/clavascarnio/v01/`.
