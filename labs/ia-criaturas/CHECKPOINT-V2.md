# Checkpoint — IA Ecológica V2

Registro compacto de progresso. Status: ✅ feito e testado · 🟡 parcial · ⏳ pendente.

## Decisões (com base em fichas reais)
- Bando: **Velsari** (`creatures/species/velsari.json`: savana, grupo 4–10, alarme, 22 kg, 50 km/h, fuga com saltos laterais).
- Presas solitárias: **Cromátil** (solitário pela ficha — não forma bando), **Tarruco** (solitário; mãe+filhote).
- Predador principal e competidor: **Varrisco** × 2 (solitário ou par ocasional; dieta: pequenos herbívoros, vertebrados terrestres, carniça oportunista).
- Variante de borda deserto/savana: **Rocantraz** (ápice, solitário, raro; dieta: herbívoros grandes, carnívoros intermediários, carniça; evita perseguições longas).
- Necrófago: **nenhum compatível com savana** tem ficha + GLB animado (Carniroca é de floresta/campo temperado; Garruva só tem blockout sem animação). Carcaças são consumidas por carnívoros com carniça na dieta e por decomposição.
- Filhotes: **não existem GLBs juvenis**; filhotes usam o GLB adulto em escala reduzida (aproximação visual declarada).

## Auditoria de GLBs (scripts/auditar-glb.mjs)
| Espécie | Frente | Rig | Root motion | Observação |
|---|---|---|---|---|
| Varrisco v02 | +X (manifesto: "X-forward Y-up") | skin 22 ossos | ciclos no lugar | min/max de accessors gravados como escalar (fora do padrão) |
| Cromátil v01 | +X | animação por nós | no lugar | |
| Velsari v02 | +Z | animação por nós | no lugar | sem clipe `drink` (usa `graze`) |
| Tarruco v02 | +Z | animação por nós | no lugar | |
| Rocantraz v05 | +Z | animação por nós | no lugar | |
| Carniroca v02 | −Z | skin 18 | — | fora do bioma |

Causa da caminhada lateral em `savana-real.html`: `rotation.y = −direção + π/2` aplicado a modelos com frente +X (precisa de `−direção`).

Velocidade natural dos ciclos (varredura dos pés, unidades do modelo): Varrisco walk 0,95 / run 4,02; Velsari walk 0,60 / run 3,0; Cromátil walk 0,08 / scurry 0,47; Tarruco walk 0,23 / trot 0,84; Rocantraz walk 0,55 / run 1,58. Os ciclos de corrida foram animados para velocidades bem abaixo do máximo das fichas → sincronizar `timeScale` reduz, mas não elimina, o deslizamento em sprint (limitação dos GLBs).

## Marcos
- 🟡 M1 orientação/animação 3D — auditoria pronta; demos legadas corrigidas (frente +X); controlador 3D novo: ver demo
- ✅ M2 múltiplos animais, bandos (líder, sentinela, alarme por som, contágio visual, proteção de filhotes, reagrupamento)
- ✅ M3 saúde por região, sangramento, fratura/sequela, ataques com preparo/esquiva, disputas com escalada, distração do predador, carcaças com dono
- ✅ M4 territórios/marcação/intrusos, água e sede, clima (chuva/seca/nível da água/fogo), migração, reprodução, herança, envelhecimento, doença (placeholder), persistência exata
- 🟡 M5 navegação 3D em terreno procedural (A*, inclinação, água, rochas); recorte do hexágono real: pendente
- ✅ níveis de simulação 1/2/3 com ledger (sem duplicação) — tempo ecológico no nível 3 (90 s ativos/hora)
- ⏳ M6 cenário bebedouro 3D + relatório V2

## Correções feitas durante a validação (resumo)
- Relógio ignorava `horaInicial` (todo cenário começava à meia-noite).
- Contágio de fuga se realimentava entre animais parados.
- Água subia sem limite na chuva e sumiam os pontos de beber → morte por sede em massa.
- Nível 3: pasto buscado só no raio de 1 h de caminhada → fome com pasto disponível; tempo comprimido impedia o vaivém água↔pasto.
- Predador não se empanturrava → caçava todo dia (predação implausível).
- Golpes iniciados sem prever a fuga do alvo; colisões em massa com a margem do lago.

## Estado final desta etapa
Implementado e testado:
- Orientação e escala por GLB; animação escolhida por estado e velocidade, com `timeScale` pela velocidade natural; troca de andadura com fase preservada; golpes e reação a impacto; interpolação entre ticks; inclinação no relevo. Desvio frente×rumo medido: 0° em todos os modelos.
- Bandos: alarme por som (só a posição de quem chamou), contágio visual, proteção de filhote e reagrupamento. Carnívoros: território com marcação, intrusos, disputas em 4 fases e distração (oportunidade de fuga).
- Saúde por região, sangramento, fratura e sequela; carcaças com dono, decomposição e reciclagem.
- Água, sede, chuva, seca, fogo e migração; reprodução com herança, envelhecimento, mortalidade juvenil e doença com caso índice.
- Microfauna (ground_vertebrates da ficha) como recurso agregado.
- Níveis 1/2/3 com ledger; persistência exata; recorte navegável derivado do hexágono real 52_savana_bosques_de_acacia; demo 3D local e hospedada.

Pendente ou parcial (não declarar como pronto):
- Navegação no mapa completo e transição entre hexágonos: só um recorte de 240×200 m foi derivado e testado.
- Voo e natação: nenhuma espécie do cenário usa; não há implementação nem teste. Escalada só como flag (Cromátil em rochas).
- Necrófago: nenhuma espécie da savana com ficha e GLB animado.
- Filhotes: usam o GLB adulto em escala reduzida.
- Os ciclos de corrida dos GLBs foram autorados lentos, então há deslizamento em sprint (`timeScale` limitado a 2,5). Não há IK de patas.
- Rocantraz: modelado e auditado, mas sem cenário de borda com o deserto.
- Caça em par: implementada (flanco), mas desativada nos cenários padrão (ficha: par ocasional).
- Doença: placeholder, sem base em ficha.
- Nível 3: deslocamento em tempo ecológico (90 s ativos por hora), uma aproximação.
- Desempenho: medido até cerca de 25 animais no nível 1 e cerca de 55 nos níveis 2/3; populações maiores ainda não foram medidas.

## Testes V2
`test/eco-*.test.mjs`: 26 testes (social, combate, ecologia, técnico). Suíte total: 54/54.
