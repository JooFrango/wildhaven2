# Testes e desempenho — Playable Build V01 (2026-11-21)

Máquina das medições: Windows 11, **Intel Iris Xe (GPU integrada)**, Chrome do sistema (ANGLE/D3D11), janela 1600×900.
Nenhum número abaixo foi estimado: todos saem de `npm test`, `npm run test:navegador` e `navegador.json`.

## `npm test` (Node, terreno derivado real) — 6/6 passaram

| Teste | Resultado |
|---|---|
| terreno cobre HV_01, FX_20, ER_18 | 0 células sem terreno; 117 células de parede da vila |
| semente 1 (IA, vida 100%) | 44 golpes do Varrisco (11 tipos), 12 ferimentos no Hunter, 34 no Varrisco, Hunter fora de combate |
| semente 2 | 33 golpes (12 tipos), 14 / 31 ferimentos, Hunter fora de combate |
| semente 3 | 38 golpes (10 tipos), 13 / 44 ferimentos, Hunter fora de combate |
| preset Demonstração (50%), semente 5 | Varrisco derrotado |
| WASD sem inimigo | anda para o norte relativo à câmera, sem atravessar bloqueio |

Nenhuma semente mostrou o defeito histórico de "aproxima e circula sem atacar": o Varrisco abriu 24–44 golpes por luta.

## `npm run test:navegador` — passou servindo `dist/` (`navegador-dist.log`, `navegador.json`)

O jogador sintético usa as teclas reais (W, Shift, J, H, Espaço); só o teleporte até a toca e o giro da câmera
são atalhos de teste.

| Etapa | Resultado |
|---|---|
| Carga | sem erro de página, sem resposta HTTP ≥ 400 |
| W + Shift na vila | anda para o norte; resistência cai |
| Travessia | de (375, 430) em HV_01 até (375, 394) em **FX_20**, andando, altura contínua |
| Caçada s1 / s2 / s3 (vida 50%) | 26 / 24 / 36 golpes do Varrisco; 12 / 13 / 16 acertos do jogador; 9 / 10 / 12 ferimentos sofridos; as três terminaram em derrota com a tela "O Hunter caiu" |
| Vitória | na rodada anterior (repositório, mesma build menos as correções de recursos): semente 2 terminou em "Caçada concluída", Varrisco com clipe `death`, retorno à vila andando |
| Recursos | 5 sessões seguidas: 71 geometrias e 10 texturas constantes (antes da correção: +2 texturas por sessão, `Skeleton.boneTexture`) |

O combate roda em tempo real no navegador, então a mesma semente não reproduz o mesmo resultado entre rodadas.

## Desempenho medido (8 s explorando, 600 quadros, Iris Xe)

| Preset | FPS médio | ms mediano | ms p95 | Draw calls | Triângulos | Heap JS | Hexágonos carregados |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baixa | 58,4 | 16,7 | 16,9 | 42 | 0,93 M | 102 MB | 8 |
| Média | 54,1 | 16,7 | 33,2 | 47 | 1,11 M | 146 MB | 8 |
| Alta | 43,6 | 16,8 | 33,9 | 68 | 1,92 M | 220 MB | 19 |

Meta de 30 FPS estáveis em GPU integrada: **atingida nos três presets nesta máquina**, com quedas pontuais (p95
de 33 ms) em Média e Alta. No painel do Claude Desktop o mesmo jogo ficou travado em 30 FPS (mesma GPU; provável limite de
quadros do painel, não medido). Sem medição em outras GPUs.

## Capturas

`01-carregado.png` · `02-vila.png` · `03-travessia.png` · `04-cacada-s*.png` · `05-fim-s*.png` · `06-vitoria.jpg` · `07-mapa-continental.jpg` · `08-combate-painel.jpg`
(capturas reais: PNG do Chrome automatizado; JPG do navegador do Claude Desktop, onde a vitória da semente 200 foi jogada até a volta à vila. Nenhum vídeo gravado).
