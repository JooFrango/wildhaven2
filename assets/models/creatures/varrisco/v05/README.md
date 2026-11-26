# Varrisco v05 — moveset de monstro (linha MH), 44 clipes

Etapa E2 da linha "Varrisco estilo Monster Hunter" (caçada PvE `?pve1=1&pve2=1&mh=1`, flag ainda não ligada).
Base: GLB v04 (41 clipes). A v02, a v03 e a v04 continuam intactas. O Hunter Lab, a IA ecológica e a Alpha
ainda carregam a v02; nenhuma integração foi feita nesta etapa.

## O que mudou em relação à v04

- **8 ataques refeitos** (mesmos nomes, consumidos pelo código atual): `bite`, `bite_heavy`, `claw_slash`, `claw_right`,
  `double_claw`, `pounce`, `jump_land`, `body_slam`.
- **3 clipes novos:** `roar`, `tail_sweep` (giro de 360° com salto, cauda chicoteando), `limp` (andar mancando, perna esquerda).
- **33 clipes da v04 mantidos** com os mesmos keyframes (verificado em teste).
- **Pesos corrigidos:** as placas da cauda e a crista dorsal sobre a pelve estavam 100% no osso `thorax` desde a v02 e se
  soltavam do corpo quando a cauda ou o peito se moviam. As placas agora seguem a cauda e a crista mistura pelve/thorax.
- **glTF válido:** 17 accessors de tempo herdados da v02 tinham `min/max` escalares; agora são arrays (o importador do
  Blender recusava a v04). Os dados dos 8 clipes substituídos saíram do BIN.

Geometria, índices, normais e matrizes de bind são iguais aos da v04: 2.754 triângulos, 22 juntas, 1 skin.

## Golpes: avisos e janelas (segundos, em `extras.janelasSeg` de cada clipe)

| Clipe | Duração | Aviso | Ativo | Punição |
| --- | ---: | --- | --- | --- |
| `bite` | 1,00 | 0–0,28 cabeça recua e sobe | 0,36–0,44 | 0,52–1,00 |
| `bite_heavy` | 1,60 | 0–0,72 empina, boca abre, tremor | 0,84–0,96 + sacudida | 1,00–1,60 |
| `claw_right` / `claw_slash` | 1,00 | 0–0,30 braço alto, tronco torce | 0,36–0,48 | 0,55–1,00 |
| `double_claw` | 1,20 | 0–0,38 dois braços no alto | 0,44–0,56 | 0,62–1,20 |
| `pounce` | 1,30 | 0–0,40 agacha e treme | 0,62–0,78 (no ar e na queda) | 0,80–1,30 |
| `body_slam` | 1,46 | 0–0,45 gira o ombro para trás | 0,70–0,86 | 0,90–1,46 |
| `tail_sweep` | 1,40 | 0–0,35 torce para o lado oposto | 0,50–0,82 (giro) | 0,92–1,40 |
| `roar` | 2,00 | 0–0,50 abaixa e inspira | 0,60–1,60 (rugido) | 1,60–2,00 |

`jump_land` (0,70 s) é o pouso; `limp` (1,10 s, loop) supõe 1,0 m/s.

## Método

Autoria pose-a-pose em `source/build_v05.py` (só stdlib): cada clipe é uma tabela de poses-chave (antecipação, golpe,
overshoot, recuperação) com easing por trecho, cauda com atraso automático, tremor aditivo e **IK analítico de 2 ossos**
nas pernas, que mantém os pés plantados ou nos alvos chaveados. Amostragem a 30 fps, interpolação LINEAR, in-place.
`source/render_v05_blender.py` reimporta o GLB exportado no Blender 5.3, mede chão/pés e gera as folhas de quadros
em `previews/` (perfil; três-quartos para `tail_sweep`, `roar` e `body_slam`).

São keyframes autorados por agente, não por um animador. **Aprovado pelo diretor em 2026-11-20**, na caçada do Hunter Lab (`?pve1=1&pve2=1&mh=1`, PR #98). Integração na Alpha não faz parte desta aprovação.

## Reproduzir

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\5.3\python\bin\python.exe" assets/models/creatures/varrisco/v05/source/build_v05.py
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python assets/models/creatures/varrisco/v05/source/render_v05_blender.py
node --test labs/ia-criaturas/test/varrisco-v05-mh.test.mjs
```

Viewer: servir a raiz do repositório por HTTP e abrir `assets/models/creatures/varrisco/v05/viewer/`.

## QA (`previews/qa.json`)

- Malha nunca abaixo do chão (mínimo 0,003 m, no impulso do `pounce`).
- Pés plantados sem deslize em `bite`, `bite_heavy`, `double_claw`, `roar`; ≤ 4,5 mm/quadro nas garras.
- Deslize intencional: passos chaveados (`pounce`, `jump_land`, `body_slam`), pivô do giro (`tail_sweep`, ~5,7 cm/quadro)
  e esteira do `limp` (velocidade do clipe).
- Three.js r160 (viewer): 44/44 clipes tocam. Blender 5.3: importa sem erro.

## Limitações

- IK das pernas resolve no plano sagital com correção de guinada; rolagem forte da pelve tira o pé do alvo alguns mm.
- `tail_sweep` gira o osso `root` 360° no lugar; o corpo no jogo mantém a direção.
- Os braços do Varrisco são curtos: as garras leem mais pela torção do tronco do que pelo braço.
- Clipes não aplicam dano nem movem o corpo no jogo (autoridade física: núcleo ecológico).
- Validação Khronos independente: pendente.
