# Checkpoint — IA Ecológica V3 (combate, socialização, GLBs reais)

Status: ✅ feito e verificado · 🟡 parcial · ⏳ pendente. Números completos: `resultados/v3/RELATORIO-V3.md` (`npm run v3:relatorio`).

## Inspeção do GLB real do Varrisco (antes de mexer no controlador)
`npm run inspecionar-rig -- ../../assets/models/creatures/varrisco/v02/varrisco-animated-v02-LOD0.glb`
- Rig de 22 ossos, **bípede**: `pelvis → thighL/R → shinL/R → footL/R`; braços curtos `shoulder → forearm → hand`; cauda `tailA..D`; `neck → head → jaw`.
- 17 clipes, todos movem ossos (medido no navegador). `turn_left/turn_right` existem e agora são usados no giro no lugar.
- Problemas encontrados nos próprios clipes (não alterados — o GLB é original):
  - `walk`/`run`: o pé "de apoio" flutua 1–10 cm (`walk` 0,18–0,27 m de altura do tornozelo no apoio; repouso 0,17) → corrigido em tempo real por IK com travamento do pé.
  - `bite`: a cabeça **recua** e volta (preparo), sem avançar além do repouso; impacto no fim do avanço (0,69 s de 0,92 s).
  - `claw_slash`: só a mão esquerda se move, para trás/baixo (rasgo); alcance real da mão ≈ 0,52 m à frente da raiz.
  - `pounce`: no lugar (sem deslocamento da raiz); a cabeça avança 0,23 m → o salto do corpo é feito pelo núcleo (investida) e termina ao encostar no alvo.
  - Velocidade natural medida no apoio do pé (unidades do modelo/s): `walk` 1,44, `run` 4,46 (a auditoria V2 estimava 0,95/4,02).
- Velsari: pernas em pêndulo (nós, sem skin), cadeia `HipOrShoulder → Knee → Ankle`; sem clipe `hurt` (usa `alert`), sem clipe de limpeza (usa `graze`).

## Marcos
- ✅ **M1 Locomoção** — A* com margem corporal (folga por transformada de distância), suavização com folga, DDA sem "escapar pela quina", antecipação de obstáculos com desvio, separação entre criaturas e cápsulas anatômicas sem sobreposição, frenagem antes de curvas, giro reduzido em velocidade, giro no lugar, saída de célula alagada, destinos inacessíveis memorizados. Bebedouro procedural (mesmas 20 sementes, 300 s): bloqueios **8.754 → 50 (−99,4%)**, contatos com obstáculo 17.622 → 2.539 (−86%), animais presos 576 → 108 (−81%), corpos sobrepostos 2.601 → 1,3 pares·s. Bancada do Varrisco: 0 colisões em todos os testes.
- ✅ **M1 Visual** — IK de duas articulações nos ossos reais (Varrisco, Velsari, Tarruco, Cromátil) com travamento do pé no apoio detectado na própria animação; ajuste ao relevo; abaixamento do quadril; inclinação lateral em curvas; mira procedural de pescoço/cabeça (ossos `neck`/`head`) na mordida, bote e agarrão; IK por nível de detalhe (≤ 45 m da câmera).
- ✅ **M2 Combate** — alcance, instante de impacto e osso de cada golpe **medidos no GLB** (`scripts/anatomia-glb.mjs` → `modelos.json`); acerto só se o trecho final do membro alcança a cápsula do corpo do alvo; região pela geometria do contato; proteção natural por região (fichas: carapaça do Tarruco, placas do Cromátil), resistência à dor, equilíbrio, força de mordida, lesões musculares, atordoamento, sangramento arterial no pescoço; empurrão/desequilíbrio/queda pela quantidade de movimento; agarrão com luta para se soltar; esquiva com passo lateral; contra-ataque; previsão de esquiva do alvo (reação, giro observado, aceleração) e cautela após erros; exaustão reduz força e aumenta recarga; dor alta faz abandonar a luta.
- ✅ **M3 Disputas** — sequência observação → intimidação → confronto → combate preservada; postura e foco visíveis (encarando/exibindo/lutando) permitem à presa perceber a distração; presa escolhe acelerar para longe dos dois, correr para cobertura ou esconder-se; métricas de oportunidade, tentativa, fuga efetiva e recaptura; cenários `disputa-presa` e `disputa-presa-cobertura`.
- ✅ **M4 Socialização** — memória social persistente por indivíduo (mãe, filhote, parceiro, companheiro, rival, conhecido; afinidade, familiaridade, dominância); cumprimento ao reencontrar, limpeza mútua, brincadeira de filhotes, curiosidade por outras espécies, competição por ponto de água/pasto (submissão ou disputa ritualizada sem dano), vigilância compartilhada ("muitos olhos"), alarme de outras espécies, tolerância vigilante a predador saciado, reagrupamento até a área de vida quando o bando se divide além do alcance do chamado.
- ✅ **M5 Savana Viva** — `savana-viva` no recorte real (24 animais: 2 bandos de Velsaris com filhotes, 2 Cromáteis, 2 Tarrucos, 2 Varriscos); bancada `laboratorio-varrisco.html`; capturas e GIFs reais em `resultados/capturas/v3-*`.

## Decisões
- Comandos de teste (`a.comandoTeste`) só existem na bancada; estados físicos (caído, agarrado, atordoado) sempre vêm do núcleo.
- Cápsula de colisão contra animal baixo (< 55% da altura) ignora o terço frontal (cabeça/pescoço passam por cima) — garras do Varrisco alcançam Cromátil/Tarruco/Velsari só se o alvo não for empurrado (preso, caído, ou parado e pesado).
- Ao encostar no próprio alvo o predador acompanha a velocidade dele (sem "atropelar").
- Linha de visão só quando algum sentido depende dela (resultado idêntico, custo −45%).
- Novos atributos das fichas (`protecao`, `resistenciaDor`, `equilibrio`, `forcaMordida`, `agarrar`) marcados como provisórios, com a fonte (ficha/GLB) no campo `_v3`.

## Pendências reais (não declarar como pronto)
- Sem clipe de queda nem de limpeza/cumprimento nos GLBs: queda é procedural (corpo tomba de lado), limpeza usa `graze`/`feed`, cumprimento usa `call`/`sniff`/`alert`.
- Ciclos de corrida dos GLBs foram animados lentos: em sprint (13 m/s) o `timeScale` satura em 2,5 e o pé ainda desliza (≈1,4 m/s no apoio com IK, contra ≈2,8 sem IK).
- IK de patas não usa a malha do terreno (usa a altura bilinear da simulação); pode haver poucos cm de diferença em declives fortes.
- Mira de cabeça é só de inclinação (não gira o pescoço lateralmente).
- Garras do Varrisco raramente acertam presas em fuga (braço curto, medido); predação vem de bote/mordida e de presas cansadas, feridas ou encurraladas.
- Navegação no mapa completo e transição entre hexágonos continuam pendentes (só o recorte de 240×200 m).
- Recorte real: o mesh `river_water` do hexágono fica ~8 m acima do terreno nas margens deste recorte (dado derivado, somente leitura). A simulação mantém esse nível (rio fundo e intransponível); a página desenha a água no nível da margem para não formar uma "parede". Conferir o posicionamento do `river_water` no GLB oficial.
- Implementados mas não observados nas sementes medidas: disputa social ritualizada entre herbívoros (exige dominâncias parecidas e temperamento agressivo, raro em Velsari) e tolerância vigilante a predador saciado (exige predador comendo/descansando a > 25 m à vista).
- A IA de caça usa garras com mais frequência que mordidas: a mordida do GLB leva 0,69 s até o impacto e quase nunca compensa contra presa em fuga; a maioria das garradas erra (braço curto), o que é coerente com a anatomia medida, mas reduz a taxa de predação em relação à V2.
- Desempenho medido até 24 animais com IK no navegador (≈30–40 fps a 1280×720 no navegador embutido) e 23–24 no CLI; populações maiores não medidas.
