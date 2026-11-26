# Wyvern das Escarpas — Wildhaven

## Aprovações e escopo

**Arte conceitual aprovada**, incluindo cabeça de cobra, duas patas traseiras, asas como membros anteriores, macho vermelho e fêmea dourada, versões selvagem/montaria. **Blockout 3D em revisão artística**: nenhuma aprovação da forma ainda. Esta entrega não muda a Alpha, Hunters, biomas, ecossistema ou gameplay.

Bioma: montanha. Dieta: carnívoro e necrófago. Ninhos raros protegidos por pais; buffs de ataque/defesa, perseguição no roubo do ovo e eclosão 10% são REGRAS PLANEJADAS, ainda não implementadas. Não introduzir braços extras.

## Modelos reais (GLB estático + atlas UV incorporado)
- `wyvern_macho_selvagem_v01_blockout.glb` — 3.690 triângulos.
- `wyvern_macho_montaria_v01_blockout.glb` — 3.956 triângulos.
- `wyvern_femea_selvagem_v01_blockout.glb` — 3.690 triângulos.
- `wyvern_femea_montaria_v01_blockout.glb` — 3.956 triângulos.

Coloração superficial (vermelho/dourado, escamas, membrana): exclusivamente texturas UV; geometria somente para corpo, olhos, dentes, asas, ossos, silhueta, garras e equipamentos. Atlas 2048×2048 por sexo em `textures/`. Fonte Python em `source/build_wyvern_v01.py`, validação e renderizador de GLB reimportado em `source/`. Arquivos `*_manifest.json` incluem bytes, hash SHA-256 e métricas. 12 prints reais e quatro pranchas em `previews/`.

Referências formais: Torvardo v03 (PR #39), Mastélio v03 (#42), Garruva v03 (#44). Identidade e proporções são específicas deste wyvern. **Sem rigs, skins, juntas, animações ou LODs** no blockout. Refino/rig/animações dependem da aprovação da forma; este PR fica em draft e não deve ser mesclado automaticamente.

Os renders têm iluminação ajustada para leitura; são obtidos de importação dos GLBs reais (não arte conceitual). Publicar e verificar binários efetivos no GitHub antes de declarar a entrega remota concluída.
