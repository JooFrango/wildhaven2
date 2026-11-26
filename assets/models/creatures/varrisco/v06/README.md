# Varrisco v06 — 4 golpes novos da linha MH (49 clipes)

Base: GLB v05 aprovado (44 clipes). A v05 continua intacta; a v06 copia malha, pesos, nós e os 44 clipes sem
alteração (BIN da v05 é prefixo do BIN da v06) e acrescenta 5 clipes. A lista de golpes foi aprovada pelo diretor
em 2026-11-20 antes da autoria, e os clipes foram **aprovados pelo diretor em 2026-11-20** na caçada do Hunter Lab (`?pve1=1&pve2=1&mh=1`, PR #98). Integração na Alpha não faz parte desta aprovação.

## Golpes novos (segundos, em `extras.janelasSeg`)

| Clipe | Golpe na IA (`?mh=1`) | Dur. | Aviso | Ativo | Punição |
| --- | --- | ---: | --- | --- | --- |
| `sickle_kick` | `chute_garra` | 1,20 | 0–0,45 apoia na cauda, recolhe a perna | 0,48–0,62 | 0,66–1,20 |
| `bite_turn_l` / `bite_turn_r` | `mordida_giro_esq` / `_dir` | 1,00 | 0–0,26 olho e pescoço viram | 0,33–0,42 | 0,48–1,00 |
| `pounce_chain` | `bote_triplo` (só na raiva) | 2,60 | 0–0,45 agacha e treme; saltos em 0,45 / 0,95 / 1,45 | 1,62–1,86 | 1,88–2,60 (+0,75 s na IA) |
| `backstep_tail` | `rabada_recuo` | 1,10 | 0–0,25 torce o quadril | 0,36–0,56 | 0,62–1,10 |

`bite_turn_r` é o espelho de `bite_turn_l`.

## Método

`source/build_v06.py` importa o motor de poses da v05 (`v05/source/build_v05.py`, cuja montagem só roda como
script): poses-chave com easing, cauda com atraso, tremor e IK analítico de 2 ossos nas pernas; 30 fps, LINEAR,
no lugar. Os saltos do `pounce_chain` e o recuo do `backstep_tail` movem o corpo pela IA, não pelo clipe.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\5.3\python\bin\python.exe" assets/models/creatures/varrisco/v06/source/build_v06.py
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python assets/models/creatures/varrisco/v05/source/render_v05_blender.py -- <GLB v06> <v06/previews> sickle_kick,bite_turn_l,bite_turn_r,pounce_chain,backstep_tail
node --test labs/ia-criaturas/test/varrisco-v06-mh.test.mjs
```

## QA (`previews/qa.json`, Blender 5.3)

- Malha não entra no chão, exceto 6 mm no pouso do `pounce_chain`.
- Pés plantados: deslize ≤ 1 cm/quadro, exceto os passos chaveados do `pounce_chain`.
- Folhas de quadros em `previews/` (perfil; três-quartos para os giros, a rabada e o chute).

## Limitações

- Keyframes autorados por agente, não por animador.
- Braço e pé ficam sob o peito: garras e chute só acertam com os corpos encostados (regra `contatoCorpo` da IA).
- `bite_turn_l/r` giram pelve, tórax e pescoço ~80°; o rumo do corpo no jogo não muda.
- Validação Khronos independente: pendente.
