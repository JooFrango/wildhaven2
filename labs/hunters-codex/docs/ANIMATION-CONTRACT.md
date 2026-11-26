# Contrato de animações

Fonte executável: `src/animation.js`, `ANIMATION_CONTRACT` e `animationState(entity,t)`. Cada entidade possui seu mixer e esqueleto clonado. O laboratório nunca gera keyframes, altera rig, skinning ou arquivo GLB oficial.

| Identificador | Clipe oficial Hunter | Estado atual |
|---|---|---|
| idle | nenhum | pose de repouso original |
| walk | Walking | conectado |
| run | Running | conectado |
| attack_light | nenhum | lógica + marcador |
| attack_heavy | nenhum | lógica + marcador |
| block | nenhum | lógica + marcador/interface |
| dodge | nenhum | deslocamento físico + evento |
| hit_reaction | nenhum | ferimento/evento |
| stagger | nenhum | restrição física + marcador |
| knockdown | nenhum | queda lógica + marcador; sem ragdoll |
| get_up | nenhum | expiração do estado lógico |
| death | nenhum | morte simulada + marcador |
| interact | nenhum | reservado |

Futuros clipes devem ser fornecidos com nome, duração, ossos compatíveis, política de root motion e pontos de preparo/impacto/recuperação. A resolução de contato continuará sendo do núcleo no tick autoritativo; um callback de animação não pode aplicar dano novamente. IDs de ataques e ledger impedem impactos duplicados. Após carregar um replay, visual e clipe devem ser reconstruídos do estado atual, sem reexecutar eventos históricos.

Equipamentos: hoje `View.gear` cria representações provisórias. Para trocar por GLBs oficiais, substituir essa fábrica por um loader/cache e encaixes homologados no esqueleto existente; não reconstruir o corpo. Configurações mecânicas ficam em `src/equipment.js`, independentes da malha.

Rede futura: `Simulation.command(type,id,data,tick)` representa uma intenção. O servidor deverá validar identidade, equipamento, sequência/tick e limites, executar o núcleo e publicar snapshots/eventos. O navegador deste lab não é fonte oficial de dano, morte, equipamento ou recompensa.
