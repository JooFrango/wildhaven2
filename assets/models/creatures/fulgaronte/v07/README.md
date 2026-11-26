# Fulgaronte v07 — 15 animações cinematográficas em cima do GLB correto do Claude

Base imutável: ../v04/fulgaronte_v04_animado.glb (PR #38), rig original com 36 ossos, 2.688 triângulos, 9 clipes, atlas UV/textura. Não usa os rigs anteriores de 29 ossos.

Modelo desta revisão: fulgaronte_v07_cinematic_claude36.glb; gerado por source/build_cinematic_from_claude.py a partir do binário do Claude. Mantém malha, pesos, rig, imagens e animações da v04, acrescentando 15 novas sequências (total 24).

Clipes inéditos: cin_breathing_look, cin_heavy_walk, cin_stalk_ambush, cin_charging_stride, cin_bite_lunge, cin_tail_whip, cin_territorial_roar, cin_predatory_swim, cin_electric_warning, cin_electric_burst, cin_overload_exhausted, cin_hit_recoil, cin_death_collapse, cin_feed_carcass e cin_track_target.

Cada coreografia envolve vários ossos, com poses de antecipação, deslocamento in-place, impacto/atrito, inércia, movimento secundário da cauda/nadadeiras/velas e recuperação. A marcha imita fases de suporte e balanço, mas NÃO inclui IK verdadeiro ou foot-lock corrigido pelo terreno.

Validação estrutural: source/validate_cinematic.py; validação por reimportação e deformação real no Blender: source/render_cinematic_blender.py; GIFs montados apenas dos frames verdadeiros do Blender: source/make_gifs.py.

Arquivos úteis de prévia: previews/comparativo_original_claude_v07.png, previews/cin_*.gif, previews/cin_*_05.png e previews/render_manifest.json. Frames intermediários são temporários e removidos após montagem, para economizar tamanho do repositório.

Não implementa: descargas elétricas como VFX, hitboxes, arremesso, colisão, IA tática, IK, controle adaptativo de terreno. A aprovação artística ainda está pendente; o Filtro de Qualidade deve examinar deformações, loops, clipping e fidelidade ao conceito antes de qualquer integração. Nenhuma modificação na Alpha.

Referência técnica: workflow .github/workflows/fulgaronte-v07-cinematic-claude.yml; checagem remota SHA-256 do GLB no GitHub Actions.