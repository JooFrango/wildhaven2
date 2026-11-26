# Varrisco v10 — modelo corrigido e locomoção nova (55 clipes)

Pedido do diretor em 2026-11-20 (bug de textura na v09 e andar/correr ruins); escopo aprovado antes da autoria.
A v09 aprovada fica intacta. **Aprovada pelo diretor em 2026-11-20** no Hunter Lab (`?pve1=1&pve2=1&mh=1`, PR #98); integração na Alpha fora desta aprovação. Capturas do bug: `../referencias/bug-v09-*.png`.

## Diagnóstico da v09

- Sem normal invertida: volume +0,3803, 2916/2916 faces coerentes, malha fechada (nenhuma aresta aberta).
- **Buracos brancos nos joelhos:** vão entre a casca da coxa e a da canela quando o joelho dobra. Já existia na
  malha da v02; as cores da v09 deixaram o vão mais visível.
- **Triângulos escuros grandes:** pintura da v09 — faixas e losangos pintavam faces inteiras, e as faces grandes
  da base da cauda e do flanco viravam cacos.
- **Garra em foice flutuando:** posição fixa que não acompanhava o topo do dedo.
- **Andar e correr acelerados:** `walk` e `run` da v02 foram feitos para 0,95 e 4,0 m/s; o jogo anda a 1,5,
  trota a 4,2 (com o `walk` acelerado 4,4x) e corre a 13 m/s (o `run` acelerado 3,2x).

## O que muda

- **Joelhos:** esfera facetada (64 triângulos) em cada joelho, pesada meio a meio coxa/canela.
- **Garra em foice:** no topo do dedo interno, com os pesos do vértice do pé mais próximo.
- **Pintura:** faixas e losangos escuros só fora das 10% maiores faces; faixas da cauda só onde ela afina.
- **Canelas** ~15% mais grossas.
- **Locomoção** (passada de raptor, gerada por `andadura()` em `source/build_v10.py`):

| Clipe | Ciclo | Velocidade natural | Pé no chão | No jogo |
| --- | ---: | ---: | ---: | --- |
| `walk` (refeito) | 1,00 s | 1,5 m/s | 55% | andar 1,5 m/s: 1,0x |
| `trot` (novo) | 0,62 s | 4,2 m/s | 38% | trote 4,2 m/s: 1,0x (`?mh=1` mapeia `trote → trot`) |
| `run` (refeito) | 0,46 s | 9 m/s | 26% | corrida 13 m/s: ~1,4x |

  Pés por IK de 2 ossos, por baixo do corpo (coxas fechadas 4–6°) e rolando para a ponta dos dedos no fim do
  apoio, com o tornozelo subindo para a ponta não entrar no chão; quadril mais baixo no meio de cada apoio,
  girando e inclinando sobre o pé de apoio; tronco inclinado conforme a velocidade; pescoço e cabeça
  compensam o quadril (cabeça estável); cauda de contrapeso com atraso; braços recolhidos.

## O que não muda (teste `labs/ia-criaturas/test/varrisco-v10-mh.test.mjs`)

Nós e nomes dos ossos, skin, matrizes de bind e os 52 clipes que não são `walk`/`run`, idênticos aos da v09.
Os 8262 vértices da v08 guardam os pesos. Os três ciclos de locomoção fecham sem salto no loop.

## Evidências

- `previews/walk.png`, `trot.png`, `run.png` e `qa.json`: malha sempre acima do chão (mínimo 0,0 m no
  `run`); o pé no apoio recua 0,053 / 0,150 / 0,318 unidades por quadro, igual ao deslocamento de cada
  andadura (sem deslizar quando o corpo anda nessa velocidade).
- `previews/repouso-vs-conceito.png`: perfil, frente e três-quartos sobre a prancha.
- Hunter Lab `?mh=1` (semente 17): `labs/hunters/resultados/mh-v10/` com `walk` e `trot` em jogo, 0 erros.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\5.3\python\bin\python.exe" assets/models/creatures/varrisco/v10/source/build_v10.py
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python assets/models/creatures/varrisco/v05/source/render_v05_blender.py -- <GLB v10> <v10/previews> walk,trot,run
node --test labs/ia-criaturas/test/varrisco-v10-mh.test.mjs
```

## Limitações

- As faixas do corpo ficaram mais discretas que na prancha: com uma cor por face, faixa em face grande vira caco.
- A esfera do joelho aparece como uma articulação arredondada quando o joelho dobra muito.
- De frente, as coxas continuam abertas na pose de repouso (esqueleto mantido); em movimento os pés entram por
  baixo do corpo.
- `run` não apareceu na captura do lab (a caçada não chegou à corrida plena nos 35 s capturados).
