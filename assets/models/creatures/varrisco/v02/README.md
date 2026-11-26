# Varrisco v02 — carnívoro bípede da savana e do deserto

**Wildhaven / Auralis.** Um **único fenótipo** para os dois biomas, inspirado no plano corporal de um velocirraptor sem copiar animais ou criaturas de outras franquias. Conceito aprovado em 2026-11-09; rig/animação solicitados na sequência.

## Entrega real (GitHub Actions verificado)

- **GLB:** [varrisco-animated-v02-LOD0.glb](varrisco-animated-v02-LOD0.glb) — 667.968 bytes; 2.754 triângulos; **1 skin ponderada com 22 juntas**, 17 animações glTF embutidas; 1 material e 1 variante.
- **Prévias reais:** [três ângulos](previews/varrisco-v02-three-real-glb-views.png) e [GIF walk/run](previews/varrisco-v02-walk-run-animated-real-glb.gif). Há poses reais de bite, death, pounce, run, threat_display e walk em `previews/`.
- **Fontes:** [build_animated.py](source/build_animated.py), [blockout_source.py](source/blockout_source.py), [validate_and_preview.py](source/validate_and_preview.py).
- **Manifesto:** [manifest.json](manifest.json), com bytes, hash SHA-256, duração e loop dos 17 clipes, triângulos, juntas e SHA-256 dos renders.
- **Versão anterior:** [v01 estática preservada](../v01/varrisco-v01-anatomy-blockout.glb), com seu gerador em `../v01/source/`.

## 17 animações

`idle`, `walk`, `run`, `stalk`, `turn_left`, `turn_right`, `alert`, `sniff`, `bite`, `claw_slash`, `pounce`, `feed`, `drink`, `threat_display`, `rest`, `hurt`, `death`.

O rig exporta `JOINTS_0`, `WEIGHTS_0` e `inverseBindMatrices`, com animações de rotação/translação incorporadas ao GLB. A prévia verifica a geometria do **arquivo exportado e reimportado**, não renders do conceito.

## Reproduzir

```bash
python -m pip install numpy scipy trimesh vtk pillow
python source/build_animated.py
python source/validate_and_preview.py

# Servir a pasta v02 e abrir http://localhost:8080/viewer/
python -m http.server 8080
```

O visualizador web, quando disponível em `viewer/`, exige servidor HTTP local por restrições de leitura de GLB em `file://`.

## Limitações e status

- Movimentos principalmente **in-place**; sem IK de terreno, colisão de pés, física, caça/IA nem integração na Alpha.
- Não foram gerados LOD1/LOD2 independentes. O LOD0 já possui apenas 2.754 triângulos; mais níveis deverão preservar a silhueta na distância de uso.
- A validação **técnica** e publicação são independentes da **aprovação artística**, pendente para esta versão animada.
- PR de revisão draft, sem merge automático e sem modificar outras espécies, mapas, vila ou Hunters.
