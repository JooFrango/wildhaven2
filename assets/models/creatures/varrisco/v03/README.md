# Varrisco v03 — animações experimentais para testes das três camadas

Primeira entrega: 12 animações novas e cinco clipes revisados, mantendo
os demais 12 clipes originais da v02. **Meta futura:** 41 clipes, somente após
avaliação visual e métricas. Nenhuma aprovação artística está implícita.

## Construção do GLB verdadeiro

`source/build_v03.py` (Python >= 3.10, apenas biblioteca padrão) lê os
**bytes do GLB v02** e preserva a geometria, materiais, UV/cores, skinning,
pesos e dados originais do BIN. Acrescenta keyframes glTF para chegar a 29 clipes,
com 22 ossos e os 2.754 triângulos originais.

O GitHub Actions `.github/workflows/build-varrisco-v03.yml`
gera, testa e publica `varrisco-animated-v03-LOD0.glb` e `manifest.json`
nesta branch. **A publicação só está concluída quando esses binários
estiverem presentes e forem verificáveis pelo hash do manifesto.**

Novos clipes: sprint, backstep, strafe_left, strafe_right, dodge_left,
dodge_right, jump_takeoff, jump_land, bite_heavy, claw_right,
double_claw e feint.

Revisados: walk, run, bite, claw_slash e pounce.

## Três camadas

1. **Animação esquelética:** clipes dentro do GLB com cadência e poses
   revisadas; fase experimental, exigindo análise artística e de contato.
2. **Procedural:** preserva o IK e a mira de cabeça do laboratório, sem
   afirmar que o deslizamento já foi eliminado.
3. **IA:** preserva a lógica ecológica e física compartilhada. Na bancada
   v03, a fuga é associada a `sprint` e o recuo a `backstep` quando
   a lógica visual o escolher. A IA ainda NÃO usa as fintas e esquivas
   novas por decisão tática automatizada.

## Reproduzir e comparar

```sh
python assets/models/creatures/varrisco/v03/source/build_v03.py
cd labs/ia-criaturas
node --test test/varrisco-v03-asset.test.mjs
npm run dev
```

Bancada de mesmo cenário/semente:
- v02: `http://localhost:5180/laboratorio-varrisco.html?modelo=v02`
- v03: `http://localhost:5180/laboratorio-varrisco.html?modelo=v03`
- viewer isolado: `/repo/assets/models/creatures/varrisco/v03/viewer/index.html`

## Pendências

Validação Khronos/Three.js visual real, métricas A/B dos pés e cadência,
tempos de contato dos ataques e impacto, transições, testes de desempenho
e revisão artística. Nenhuma modificação no jogo Alpha ou no rig base.
Sem merge automático.
