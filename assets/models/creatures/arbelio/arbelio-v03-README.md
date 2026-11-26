# Arbélio V03 — candidato experimental

Revisão baseada na descrição aprovada em `creatures/species/arbelio.json`, no GLB V02 e no GLB V4 do laboratório, com 24 clipes. A imagem conceitual aprovada não está disponível na migração; não foi usada como referência visual direta. Não é uma versão artisticamente aprovada.

- Anatomia reconstruída: corpo alongado, crina curta, cauda arqueada contínua, dedos agarradores.
- Atlas UV pintado para pelagem e padrões, sem cascas adicionais de manchas. Skinning real, 20 juntas e um skin.
- 11 clipes primários reautorizados e 13 reações/comportamentos do V4 reamostrados; nomes preservados. Marcha por IK analítico pré-calculado; sem IK runtime.
- Triângulos: LOD0 5012 → 4998; LOD1 3532 → 3554; LOD2 2680 → 2754. Nenhuma versão anterior substituída.
- Prévia CPU: perfil, três-quartos, frente e amostra de salto, renderizadas a partir do GLB reimportado.
- Validação estrutural de índices, valores finitos, pesos e quaternions. Pendente reprodução integral no Blender/Three.js, contato das patas e revisão artística contra o conceito original. A malha reúne volumes anatômicos sobrepostos; não é uma superfície soldada integralmente.
- Não integrado à Alpha ou IA.

Para reproduzir, importe `buildPair` do arquivo fonte V03 e passe o base64 do GLB de laboratório e os três orçamentos V02. O retorno contém os três GLBs, atlas, preview e manifesto.
