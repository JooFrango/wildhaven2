# Fulgaronte — render correto para verificar a fidelidade v04 × v06

**Motivo:** o GIF v06 anterior usava um rasterizador Pillow que amostrava somente **um pixel UV por triângulo** e usava ordenação aproximada, sem pipeline 3D adequado. Isso destrói o detalhe de textura e torna a forma enganosa.

Esta pasta contém uma revisão **somente de visualização e auditoria**, sem modificar GLBs ou animações. Renderiza `v04` e `v06` por Blender/Cycles em câmeras equivalentes, com PBR/UV original, inclusive os ossos realmente animados no Blender.

Arquivos esperados:
- `fulgaronte_v04_blender_original.png`
- `fulgaronte_v06_bind_pose_blender.png`
- `comparacao_v04_v06_blender.png`
- `{heavy_walk,bite_heavy,overload_burst}_blender_real.gif`

Se Blender não conseguir importar ou reproduzir clipes, **não há fallback para o antigo rasterizador como evidência de fidelidade**. A execução deve falhar e o problema deve ser investigado.

Modelos v04/v05/v06 e Alpha preservados. Nenhuma aprovação automática da anatomia, deformações ou animações.
