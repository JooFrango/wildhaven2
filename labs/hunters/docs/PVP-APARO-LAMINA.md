# PvP — espada contra espada: aparo de lâmina, interrupção no contato e revide

Primeira entrega do laboratório de PvP: duelo 1×1 na **Arena dos Caçadores** em que o golpe é interrompido
pelo encontro real das duas lâminas, com reação física dos dois Hunters e contra-ataque do defensor.
Aguarda aprovação. Nada aqui altera a Alpha, o combate PvE, os monstros ou os GLBs aprovados.

## O que foi feito

| Peça | Arquivo | O que mudou |
|---|---|---|
| Pose de guarda | `src/trajetoria-arma.js` | `armaLocal(..., {bloqueio})`: a lâmina é posicionada **a partir da linha lida do golpe** (altura visível e inclinação), no plano frontal, com o punho puxado para dentro do alcance do ombro da espada. Não é um clipe pronto. |
| Teste estreito lâmina × lâmina | `src/trajetoria-arma.js` | `contatoLaminas` (segmento × segmento, com raio da lâmina) e `aparoNoIntervalo`, que varre **todo o golpe** — aço parado no meio do arco nunca chega à carne. |
| Hitstop | `src/trajetoria-arma.js` | `tempoAcao`: o golpe aparado segura no instante do contato por 0,10 s e **recupera de lá**. Corpo e lâmina leem o mesmo relógio, então nada mais na cena congela. |
| Decisão de aparar | `src/combate-jogador.js` | `apararComLamina`: só com arma que apara, braços em condição e fôlego. O gatilho é **quanto falta do preparo** contra o tempo de reação, não um temporizador fixo. |
| Leitura do golpe | `src/combate-jogador.js` | O atraso de reconhecimento não pode ser maior que o próprio preparo (antes, a 0,1 s de passo, o defensor só reconhecia o golpe no instante do impacto e nunca defendia). |
| Attack slot do par | `src/combate-jogador.js` | Quem compromete o golpe primeiro segura a vez até a ação acabar. Sem isso os dois golpeavam no mesmo passo e ninguém ficava livre para defender. |
| Resolução do aparo | `src/impacto-combate.js` | `registrarAparo`: recuo do atacante na própria linha, desgaste e recuo menor do defensor, reação de impacto nos dois, janela de revide aberta. O evento vira `golpe_interrompido` (`motivo: aparo_lamina`) mais `impacto_arma` **bloqueado** no ponto de contato. |
| Revide | `src/combate-jogador.js` | O contra-ataque deixou de ser exclusivo da lança. |
| Animação | `src/animacao-jogador.js`, `src/visual-hunter.js` | O atacante aparado também reage (`combat_guard_recoil`); a mão vai até o punho da guarda pela IK que já existia (`alinharMao`). |
| Persistência | `src/mundo-hunters.js` | A vez de atacar entra no save: recarregar não libera os dois para golpear no mesmo passo. |

**O contato desenhado é o contato simulado**: a lâmina do renderizador, a pose de guarda e o teste estreito
saem todos de `src/trajetoria-arma.js`.

## Cenário

`arena-aparo` — a mesma Arena dos Caçadores do duelo 1×1, com as duas espadas e sem escudo, passo de 0,05 s.
Nenhuma arena nova: só o equipamento que esta entrega exige.

```
node --test test/aparo.test.mjs      # 9 testes: geometria, pose, hitstop, duelo, slot, save/load
npm test                             # 71 testes do laboratório
node scripts/capture-aparo.mjs       # vídeo + quadros reais da arena (precisa de Chrome)
```

## Evidência

`resultados/pvp-aparo/` — vídeo real do canvas do laboratório em dois ângulos (perfil e três-quartos),
quadros PNG no instante de cada aparo e `manifest.json` com o SHA-256 do GLB, dos vídeos, o erro de
empunhadura medido no aparo e a lista de encontros de lâmina.

Medido na gravação (semente 17, 22 s): 7 aparos, erro de empunhadura 0,000 m no atacante e 0,033 m no
defensor, zero invariantes violados.

## Limites conhecidos

- **Sem GLB novo.** Usa `combat_block` e `combat_guard_recoil`, que já existem nos 85 clipes do v11; o
  revide de espada toca `sword_light` com a temporização de contra-ataque. Só a lança tem clipe próprio de
  contra-ataque. Um `sword_block`/`sword_counter` autorado exigiria um v12 pelo gerador.
- **Linha baixa.** O ombro da guarda é fixo e o Hunter não agacha: num corte baixo a guarda fica até ~25 cm
  curta e o golpe passa. Está marcado como `shortcut:` no código.
- **Escudo inalterado.** Quem tem escudo continua no bloqueio por postura de antes; o aparo de lâmina é para
  quem só tem a arma.
- Fora do escopo desta entrega, por combinação: 2×2, slots de multidão, Rust/WebAssembly e reescrita de
  ferimentos, membros, inconsciência e queda (que já vêm do núcleo ecológico).
