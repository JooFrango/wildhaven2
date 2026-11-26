# Folhisco — asset 3D animado v0.1 (visual aprovado)
 
O modelo **Folhisco v0.1** foi gerado como um arquivo **glTF 2.0 / GLB animado**, com malhas reais mid-poly, 11 articulações hierárquicas, 15 animações distintas, 21 materiais, 9.216 vértices e 16.240 triângulos.

**Aprovação de design (2026-11-06):** o usuário aprovou o modelo e as animações **exatamente como apresentados**. Preservar silhueta, paleta, proporções, aparência e conjunto de movimentos. Qualquer mudança estética requer nova aprovação; correções de integração não devem alterar o visual aprovado.

**Situação técnica:** GLB e código-fonte gerados e validados em ambiente local de trabalho. **Os arquivos binários ainda não estão publicados neste repositório.** Não confundir o registro de metadados com o arquivo real. O pacote ZIP está disponível como artefato na conversa que o gerou.

## Primeira entrega

- Modelo: `folhisco_animated_v01.glb` (700.196 bytes; SHA-256 informado no manifesto).
- Fonte: `generate_folhisco.py` (NumPy), regeneração de geometria, skin e clipes.
- Visualizador: `index.html` (Three.js via CDN, navegador local).
- Prévia: `folhisco_animations_preview.gif`, `folhisco_15_actions_preview.png`.
- Validação: `validate_glb.py` (estrutura GLB, buffers, pesos, 15 canais de ações) e teste de importação via trimesh.

## Ações

| Ação | Clip | Duração |
| --- | --- | ---: |
| Repouso em pé | `idle` | 3,0 s |
| Caminhar | `walk` | 1,0 s |
| Correr/fugir | `run` | 0,6 s |
| Bicar alimento | `peck` | 1,25 s |
| Ciscar | `scratch` | 1,6 s |
| Observar | `scan_head` | 2,8 s |
| Estado de alerta | `alert` | 1,6 s |
| Chamar o bando | `alarm_call` | 1,9 s |
| Saltar e bater asas | `jump_flap` | 1,2 s |
| Esconder-se | `hide` | 2,4 s |
| Dano | `hurt` | 0,8 s |
| Morte | `death` | 2,4 s |
| Beber | `drink` | 1,6 s |
| Limpar penas | `preen` | 2,2 s |
| Dormir | `sleep` | 3,5 s |

## Integração futura

Os clipes são **in-place**. Deslocamentos pelo mapa e colisão devem ser feitos pelo controlador de navegação. Criar transições de estado (idle → alert → run; foraging → peck; rest → sleep) e controlar animações via `AnimationMixer`. O protótipo usa pesos rígidos por articulação, **não** possui IK de pés, áudio, hitboxes ou IA. Pode receber correções técnicas (ex.: contatos dos pés, colisões, integração e otimização), desde que não modifiquem sua estética nem o resultado visual aprovado.

## Próxima etapa de armazenamento

Publicar o GLB real, a fonte Python e as prévias em `assets/models/creatures/folhisco/` e atualizar `creatures/species/folhisco.json` somente depois que os arquivos aparecerem de fato no GitHub.

Ver também: [ficha de espécie](../../../../creatures/species/folhisco.md) e [sistema sensorial](../../../../gameplay/SENTIDOS-E-IA-DE-CRIATURAS.md).
