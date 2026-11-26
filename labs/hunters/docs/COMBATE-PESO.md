# Combate com peso — laboratório único

Escopo: apenas `labs/hunters/`; o caminho público do laboratório permanece o mesmo. Nenhuma alteração na Alpha nem no laboratório paralelo.

## Implementação

- Trajetória de lâmina compartilhada entre gerador esquelético, equipamento visível e verificação de contato. O núcleo continua aplicando dano uma única vez. O corpo usa cápsula com seção vertical elíptica; não há colisão por triângulos da pele nem colisão arma contra arma.
- Escudo orientado para a frente. Ataques comprometidos não ganham uma segunda esquiva probabilística gratuita. Impulsos variam por massa e intensidade; reações preservam o compromisso do ataque.
- Falha de golpe expira após recuperação e saída. O Hunter firma apoio antes de atacar, retoma fôlego também a curta distância, revê aproximações sem progresso e procura pistas na última posição percebida. Decisões não leem vida ou energia adversária.
- Montante considera a abertura adicional observável quando um animal está de costas; a estimativa pode falhar e o preparo continua punível. Armas preservam seus tempos e reservas diferentes.
- No treino, um Hunter persistentemente ferido pode conceder após sua tentativa de retirada. O resultado depende da condição e da decisão; não há vencedor forçado pelo limite de gravação.
- GLB v05 conserva 1.000 triângulos e o rig/textura aprovados. 83 clipes; novos guard/recover por arma e reações leves/pesadas/bloqueadas. Ajuste visual de mãos acompanha a altura real do alvo; pés usam IK visual existente.
- Som opcional, câmera e efeitos são apresentação e não mudam o resultado físico.

## Evidências reproduzíveis

`node --test --test-concurrency=1 labs/hunters/test/*.test.mjs`

`node labs/hunters/scripts/verify-epic.mjs`

`node labs/hunters/scripts/regression-tpose.mjs`

`node labs/hunters/scripts/measure-jogador.mjs`

`node labs/hunters/scripts/capture-jogador.mjs lanca` (também espada/montante)

Resultados JSON, vídeos reais e manifesto acompanham a entrega. Alguns confrontos podem permanecer sem desfecho durante os 120 segundos observados. A comparação atual desliga/liga a política de jogador mantendo o mesmo contato físico; não é a execução de um commit histórico.

## Estado

Implementado e tecnicamente verificável; direção artística em avaliação. O rig simples de 19 juntas e o modelo original limitam expressividade. Som sintetizado é provisório. Não implica aprovação artística nem integração à Alpha.
