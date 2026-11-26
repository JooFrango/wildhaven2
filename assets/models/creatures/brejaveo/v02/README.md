# Brejáveo v02 — rig e 24 animações reais (Wildhaven)

**Status:** v01 preservado. V02 animada para revisão técnica/artística. **Não aprovada definitivamente, não integrada à Alpha.**

## Proveniência

- Conceito: arte fornecida e aprovada pelo diretor.
- Base: `assets/models/creatures/brejaveo/v01/brejaveo-v01-anatomia-blockout.glb` — SHA-256 `eaa65d74edbe0e3e14d84b66bea3328917b1b174308cc4d2207475feffb40977`.
- V02: `brejaveo-v02-skinned-animated-LOD0.glb` — consultar `manifest.json` para hash/bytes.
- 3.692 triângulos, 89 malhas originais, 1 atlas UV incorporado, 1 skin real, 33 juntas, pesos por vértice em `JOINTS_0` + `WEIGHTS_0` e 24 clipes glTF.
- Padrão visual e anatomia referenciados ao Torvardo v03, Mastélio e Garruva, sem alterar a forma aprovada do conceito.

## Esqueleto e grupos

Coluna/tronco, cervical em 2 níveis, crânio, mandíbula, língua retrátil, cauda articulada em quatro segmentos, membros traseiros com quadril/joelho/jarrete/pé, membros anteriores que funcionam como asas (ombro/cotovelo/punho/dedos de apoio e nervuras das asas com dobra, ponta e margem posterior). Skinning ponderado com influência de até 4 juntas em cada vértice.

## Clipes reais incorporados no GLB

`idle`, `walk`, `run`, `wade`, `stalk`, `takeoff`, `fly`, `glide`, `landing`, `tongue_aim`, `tongue_strike`, `tongue_hook_pull`, `bite_swallow`, `ambush`, `feed`, `hide`, `rest`, `sleep`, `alert`, `threat`, `hurt`, `death`, `turn_left`, `turn_right`.

Os clipes da língua possuem escala longitudinal de osso para projeção e retração. **Não há implementação de colisão ou de prender automaticamente presas pela língua**. Contato real, resistência/puxão, distância mínima, eventos de mordida, adaptador para o laboratório de IA, foot IK e física de voo devem ser calibrados e testados separadamente.

## Testes e provas

- Execute: `python source/build_rig_animations.py` (depois de manter `brejaveo_v01` como diretório irmão).
- Execute: `python source/validate_render.py` (usa GLB exportado, avalia matrizes glTF, `JOINTS_0`, `WEIGHTS_0` e renderiza vértices deformados em VTK).
- Consulte `validation.json` para métricas da inspeção independente do script de geração.
- GIFs e prancha da pasta `previews/` foram renderizados dos **vértices deformados em cada keyframe do GLB exportado**, não de arte gerada por IA.
- `viewer.html` permite selecionar clipes no navegador quando servido por um servidor estático e com internet para carregar o módulo Three.js (somente dependência do visualizador; o GLB não depende da internet).

## Limitações de aceitação

A geometria visual é a versão de blockout original; densidade dos suportes de asa e língua ainda é econômica. Os GIFs são para avaliação visual e não constituem teste de contato com solo ou de agarramento de presas. A auditoria técnica independente do agente QA e a aprovação artística do diretor permanecem pendentes. Não criar LODs artificiais ou sobrescrever v01; não mesclar o PR nem modificar a Alpha.