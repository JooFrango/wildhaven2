# Varrisco v07 — reação de dano da linha MH (54 clipes)

Base: GLB v06 aprovado (49 clipes), copiado sem alteração (malha, pesos, nós, clipes; BIN da v06 é prefixo).
Acrescenta 5 clipes de reação. Escopo aprovado pelo diretor em 2026-11-20 antes da autoria; aprovação visual
dos clipes: **aprovada pelo diretor em 2026-11-20** na caçada do Hunter Lab (`?pve1=1&pve2=1&mh=1`, PR #98). Integração na Alpha não faz parte desta aprovação.

| Clipe | Quando toca (`?mh=1`) | Dur. |
| --- | --- | ---: |
| `hit_side_l` / `hit_side_r` | reação média (dano 12–18) no tronco/flanco, golpe vindo da esquerda/direita | 0,55 |
| `hit_heavy_l` / `hit_heavy_r` | reação pesada (dano ≥ 18 ou corte pesado): vacilo forte e passo de equilíbrio para trás | 1,10 |
| `hit_head` | reação média de frente na cabeça/pescoço: focinho joga para cima e para trás | 0,60 |

Sufixo `_l`/`_r` = lado de onde veio o golpe; `_r` é o espelho de `_l`. Reação média nas pernas usa
`hurt_leg` (v04). Golpe leve não troca de clipe: a vista faz um tranco lateral de 0,25 s, e todo acerto congela
a animação por 70 ms (`labs/hunters/src/visual-monstro.js`).

## Método e reprodução

`source/build_v07.py` importa o motor de poses da v05 (poses-chave, easing, cauda com atraso, tremor, IK de 2
ossos nas pernas); 30 fps, LINEAR, no lugar. A rolagem fica no tronco, não na pelve, para os pés não deslizarem.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\5.3\python\bin\python.exe" assets/models/creatures/varrisco/v07/source/build_v07.py
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python assets/models/creatures/varrisco/v05/source/render_v05_blender.py -- <GLB v07> <v07/previews> hit_side_l,hit_side_r,hit_heavy_l,hit_heavy_r,hit_head
node --test labs/ia-criaturas/test/varrisco-v07-mh.test.mjs
```

## QA (`previews/qa.json`, Blender 5.3)

- Malha sempre acima do chão (mínimo 0,013 m).
- Pés plantados: ≤ 3 mm/quadro, exceto o passo chaveado do `hit_heavy` (2 cm/quadro).

## Limitações

- Keyframes autorados por agente, não por animador.
- O passo de equilíbrio é para trás: o IK das pernas resolve só no plano sagital, sem passo lateral.
- Recuo, interrupção do golpe e resistência na raiva vêm da IA (`monstro-varrisco.js`), não do clipe.
