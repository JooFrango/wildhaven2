# Relatório V3 — combate, socialização e testes com GLBs reais

Gerado por `npm run v3:relatorio` a partir de `resultados/v3/*.json`. Simulações determinísticas (mesma semente → mesmo resultado no CLI e no navegador).

## 1. Locomoção e colisões (mesmas sementes, antes × depois)

Sementes 1-20, 300 s por encontro. "Antes" = código da V2 com as mesmas métricas de observação.

| Cenário | Métrica | Antes (V2) | Depois (V3) | Redução |
|---|---|---|---|---|
| `bebedouro` | bloqueios físicos (passo impedido) | 8754 | 50 | 99.4% |
| `bebedouro` | contatos com obstáculo (inclui deslizes) | 17622 | 2539 | 85.6% |
| `bebedouro` | episódios de animal preso (5 s sem sair do lugar) | 576 | 108 | 81.3% |
| `bebedouro` | corpos sobrepostos (pares × s) | 2601 | 1.3 | 100.0% |
| `bebedouro-real` | bloqueios físicos (passo impedido) | 0 | 0 | — |
| `bebedouro-real` | contatos com obstáculo (inclui deslizes) | 3 | 2 | 33.3% |
| `bebedouro-real` | episódios de animal preso (5 s sem sair do lugar) | 706 | 18 | 97.5% |
| `bebedouro-real` | corpos sobrepostos (pares × s) | 1329.5 | 0 | 100.0% |

Causas encontradas e corrigidas: segmento amostrado a cada 0,5 m "escapava" pela quina entre duas células bloqueadas na diagonal (agora DDA visita todas as células); A* sem margem corporal; animais que ficavam numa célula alagada pela chuva sem conseguir sair; filhote alternando a cada passo entre "seguir a mãe" e "ir beber"; nível 2 oscilando entre manchas de pasto (e morrendo de fome ao lado do capim); corpos que se atravessavam (sem separação).

## 2. Bancada do Varrisco no navegador (GLB original)

Página `laboratorio-varrisco.html`. GLB `assets/models/creatures/varrisco/v02/varrisco-animated-v02-LOD0.glb` (sem modificação). Os comandos só escolhem destino/olhar/golpe; locomoção, IK, acertos, esquivas e quedas são do núcleo `src/eco`.

**Clipes:** 17 clipes, 17 movem ossos de fato: idle (4), walk (15), run (15), stalk (15), turn_left (8), turn_right (8), alert (6), sniff (6), bite (8), claw_slash (9), pounce (11), feed (7), drink (7), threat_display (9), rest (4), hurt (8), death (12).

| Teste | Passos | Frente × rumo méd/máx | v máx (m/s) | Colisões | Deslize do pé no apoio: só animação → com IK | Erro de altura do pé: só animação → com IK | Clipes usados |
|---|---|---|---|---|---|---|---|
| Bote, mordida e garra (Velsari manequim) | 5/5 | 0.09° / 1.1° | 4.29 | 0 | 0.964 → 0.597 m/s | 6.7 → 0.1 cm | idle, walk, pounce, bite, turn_left, turn_right, claw_slash |
| Caça real: Varrisco × Velsaris (IA livre) | 0/0 | 0.23° / 4.19° | 13.07 | 0 | 1.033 → 0.32 m/s | 9.8 → 0.8 cm | idle, walk, turn_right, stalk, run |
| Correr em terreno irregular | 2/2 | 0.07° / 1.65° | 13.07 | 0 | 2.816 → 1.454 m/s | 11.7 → 2.1 cm | idle, walk, run, turn_left |
| Curvas, giro de 90° e 180° | 7/7 | 0.17° / 3.31° | 4.22 | 0 | 1.132 → 0.244 m/s | 11.6 → 1.1 cm | idle, walk, run, turn_right |
| Ferimento na perna, recuo e descanso | 5/5 | 0.02° / 0.49° | 4.22 | 0 | 1.411 → 0.635 m/s | 11.9 → 1.2 cm | idle, walk, run, rest |
| Dois Varriscos e uma carcaça (IA livre) | 0/0 | 0.1° / 3.73° | 4.22 | 0 | 0.622 → 0.073 m/s | 9.5 → 0.6 cm | idle, walk, feed, turn_left, turn_right, alert, run |
| Navegar entre rochas | 2/2 | 0.05° / 1.48° | 4.22 | 0 | 0.801 → 0.082 m/s | 7.4 → 0.3 cm | idle, walk, run, turn_left |
| Caminhar nas 8 direções | 16/16 | 0.11° / 3.76° | 1.51 | 0 | 0.657 → 0.051 m/s | 9.4 → 0.5 cm | idle, walk, turn_right, turn_left |

**Sequência de combate (Velsari manequim, IA de combate real):** 2.4s ataque_inicio bote → 2.9s ferimento bote (pescoco) → 2.9s empurrao bote → 2.9s agarrao (pescoco) → 3s ataque_inicio mordida → 3.7s ferimento mordida (tronco) → 6.1s soltou [vitima_escapou] → 6.1s escapou_agarrao → 7.8s ataque_inicio garra_foice → 8.1s esquiva garra_foice → 8.2s ataque_inicio mordida → 8.9s esquiva mordida → 9.1s perseguicao_inicio.

## 3. Combate (bebedouros, sementes 1-30, 300 s)

| Cenário | Golpes iniciados | Acertos | Esquivas | Erros (membro não alcança) | Contra-ataques | Empurrão / desequilíbrio / queda | Agarrões (escapes) | Regiões atingidas | Fraturas | Disputas: fase final | Predações | Mortes em combate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `bebedouro` | 102 (garra_foice 99, chicotada_cauda 1, mordida_defensiva 2) | 12 | 7 | 83 | 2 | 3 / 3 / 4 | 0 (0) | pernas 7, tronco 4, cabeca 1 | 3 | intimidacao 19, observacao 7, confronto 4 | 6 | 0 |
| `bebedouro-real` | 35 (garra_foice 35) | 3 | 2 | 30 | 0 | 1 / 0 / 2 | 0 (0) | flanco 1, tronco 1, pernas 1 | 1 | observacao 3, confronto 1, intimidacao 1 | 2 | 0 |

## 3. Combate (Savana Viva, sementes 1-10, 600 s)

| Cenário | Golpes iniciados | Acertos | Esquivas | Erros (membro não alcança) | Contra-ataques | Empurrão / desequilíbrio / queda | Agarrões (escapes) | Regiões atingidas | Fraturas | Disputas: fase final | Predações | Mortes em combate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `savana-viva` | 67 (garra_foice 67) | 10 | 3 | 54 | 0 | 8 / 1 / 0 | 0 (0) | pernas 4, tronco 5, flanco 1 | 1 | intimidacao 5, observacao 1 | 2 | 0 |

## 4. Fugas durante disputas entre carnívoros (cenários de disputa pela presa, sementes 1-40)

| Cenário | Sementes com disputa (pela presa) | Disputas: fase final | Oportunidades percebidas | Tentativas (modo) | Fugas efetivas | Recapturas | Predações |
|---|---|---|---|---|---|---|---|
| `disputa-presa` | 4 (4) | confronto 1, observacao 2, intimidacao 1 | 2 | 2 (abrigo 2) | 2 | 0 | 0 |
| `disputa-presa-cobertura` | 8 (8) | intimidacao 7, confronto 2 | 17 | 17 (abrigo 17) | 7 | 0 | 0 |

## 4. Fugas durante disputas entre carnívoros (bebedouro real e Savana Viva, sementes 1-20)

| Cenário | Sementes com disputa (pela presa) | Disputas: fase final | Oportunidades percebidas | Tentativas (modo) | Fugas efetivas | Recapturas | Predações |
|---|---|---|---|---|---|---|---|
| `bebedouro-real` | 2 (0) | observacao 1, confronto 1, intimidacao 1 | 0 | 0 (—) | 0 | 0 | 2 |
| `savana-viva` | 15 (4) | intimidacao 17, observacao 6, confronto 2 | 24 | 24 (abrigo 17, corrida 7) | 12 | 2 | 8 |

Fuga efetiva = a presa sai da vista dos dois predadores por 10 s e continua viva; recaptura = um deles a fere ou mata depois da tentativa. Nada é forçado: a presa só tenta quando vê um predador ocupado com o rival (encarando, exibindo ou lutando, olhando para o rival e sem se aproximar), e escolhe entre acelerar para longe dos dois, correr para cobertura ou esconder-se.

## 5. Socialização (sementes 1-10, 300 s)

| Evento | `bebedouro` | `bebedouro-real` | `savana-viva` |
|---|---|---|---|
| cumprimento | 74 | 244 | 487 |
| limpeza_mutua | 278 | 221 | 1186 |
| brincadeira | 43 | 53 | 159 |
| curiosidade | 0 | 0 | 3 |
| disputa_social | 0 | 0 | 0 |
| disputa_social_fim | 0 | 0 | 0 |
| submissao | 4 | 5 | 10 |
| alarme | 68 | 8 | 38 |
| alarme_ouvido | 127 | 0 | 152 |
| alarme_outra_especie | 74 | 3 | 35 |
| tolera_predador | 0 | 0 | 0 |
| protege_filhote | 2 | 0 | 11 |
| sentinela | 70 | 70 | 140 |
| novo_lider | 1 | 0 | 0 |
| olhadas de vigilância compartilhada | 257 | 161 | 512 |
| relações individuais memorizadas | 576 (companheiro 520, filhote 20, mae 20, conhecido 2, rival 14) | 564 (companheiro 512, filhote 20, mae 20, parceiro 8, rival 4) | 1750 (companheiro 1376, conhecido 288, filhote 40, mae 40, parceiro 4, rival 2) |

## 6. Desempenho

Navegador (savana-viva, 24 animais, 1280x720, quadros a passo fixo): com IK 32.69 ms/quadro (sim 1.02 · animação+IK 13.91 · render 17.76) ≈ 30.6 fps; sem IK 21.22 ms ≈ 47.1 fps. Quadros a passo fixo (60 Hz) com simulação 10 Hz, animação/IK por quadro e renderização com sombras; IK com nível de detalhe (≤ 45 m da câmera).

Orientação medida no navegador: desvio máximo frente × rumo 0.58° entre 24 animais.

## 7. Evidências visuais (renderizador real dos GLBs)

- [v3-disputa-presa-fuga.gif](../capturas/v3-disputa-presa-fuga.gif)
- [v3-disputa-presa-inicio.png](../capturas/v3-disputa-presa-inicio.png)
- [v3-savana-caca.png](../capturas/v3-savana-caca.png)
- [v3-savana-disputa-varriscos.png](../capturas/v3-savana-disputa-varriscos.png)
- [v3-savana-fuga-durante-disputa.gif](../capturas/v3-savana-fuga-durante-disputa.gif)
- [v3-savana-oportunidade-fuga.png](../capturas/v3-savana-oportunidade-fuga.png)
- [v3-savana-retorno-atividades-ferido.png](../capturas/v3-savana-retorno-atividades-ferido.png)
- [v3-savana-social-brincadeira.png](../capturas/v3-savana-social-brincadeira.png)
- [v3-savana-social-cumprimento.png](../capturas/v3-savana-social-cumprimento.png)
- [v3-savana-social-limpeza.png](../capturas/v3-savana-social-limpeza.png)
- [v3-savana-vigilancia.png](../capturas/v3-savana-vigilancia.png)
- [v3-savana-viva-geral.png](../capturas/v3-savana-viva-geral.png)
- [v3-varrisco-ataque.gif](../capturas/v3-varrisco-ataque.gif)
- [v3-varrisco-bote.png](../capturas/v3-varrisco-bote.png)
- [v3-varrisco-caminhando.png](../capturas/v3-varrisco-caminhando.png)
- [v3-varrisco-corrida.png](../capturas/v3-varrisco-corrida.png)
- [v3-varrisco-curva.png](../capturas/v3-varrisco-curva.png)
- [v3-varrisco-curvas-giros.gif](../capturas/v3-varrisco-curvas-giros.gif)
- [v3-varrisco-garra.png](../capturas/v3-varrisco-garra.png)
- [v3-varrisco-mordida-agarrao.png](../capturas/v3-varrisco-mordida-agarrao.png)
- [v3-varrisco-patas-lateral-com-ik.png](../capturas/v3-varrisco-patas-lateral-com-ik.png)
- [v3-varrisco-patas-lateral-sem-ik.png](../capturas/v3-varrisco-patas-lateral-sem-ik.png)
- [v3-varrisco-patas-lateral.gif](../capturas/v3-varrisco-patas-lateral.gif)
- [v3-varrisco-persegue-velsari.png](../capturas/v3-varrisco-persegue-velsari.png)
- [v3-velsari-fuga-perseguicao.gif](../capturas/v3-velsari-fuga-perseguicao.gif)
- [v3-velsari-fuga.png](../capturas/v3-velsari-fuga.png)
