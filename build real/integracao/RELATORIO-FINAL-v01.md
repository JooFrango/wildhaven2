# Relatório final — Build Real v01 (sessão de 26/11/2026)

Escopo definido pelo diretor: Fase 0 + Fase 1 + início da Fase 2. Branch `feat/build-real-jogavel-v01`, PR em rascunho, **sem merge na `main`**.

## O que roda (verificado nesta sessão)

| Item | Comando | Resultado observado |
| --- | --- | --- |
| Testes do compilador e do runtime continental | `node --test "build real/continental/test/continental.test.mjs" "build real/continental/test/compiler.test.mjs"` | **17/17 passando** (14 originais + 3 novos) |
| Fetch dos 272 GLBs | `node "build real/continental/tools/fetch-sources.mjs" --out .generated/sources --link` | **272/272** com bytes e SHA-1 de blob conferidos; SHA-256 conferido nos 170 da v12 (os demais têm SHA-256 calculado e registrado) |
| Lote do compilador, base (sem classificação nova) | `cli.mjs --all …` | 251/272 em 5 min 4 s; falham `C` e `WG_01..20` (sem nó `terrain`) |
| Lote do compilador, v01 | `cli.mjs --all … --node-classes …v01.json --snap-centers lattice` | **272/272** em ~5,5 min; 3.443.770.538 bytes de `.whp.gz` |
| Portais e certificação | `validate-portals.mjs …` | 705/738 arestas validadas, 5 reprovadas, 28 marítimas; **223** hexes certificados tecnicamente; escala 4.330,127 × 5.000 m conferida nos 272 |
| Testes Rust | `cd game/build-real-v01/server && cargo test` | **11/11 passando**: relógio (4), hex (1), ToInt32 (1), paridade com a Alpha (4: 448 valores xorshift32, 200 `hash`, `clamp`, 120 cenários de `strike`), contrato v1 (1) |
| Simulação headless no terreno real | `wh-sim-check 6000` | 20 min simulados: HV_01 → ER_18 no tick 687 e ER_18 → HV_01 no tick 1035; 1.377,2 m percorridos; passo máximo de 0,2347 m (= 1,1733 m/s × 0,2 s, sem teleporte); 0 ticks sem chão compilado; residência coerente com a posição |
| Servidor + cliente | `cargo run --release -p wh-server` e abrir `:8787` | snapshot v1 por HTTP/WS; cliente renderiza os GLBs reais de HV_01 e vizinhos e o Hunter do workshop animado; captura em `evidencias/cliente-v01-hv01.png` |
| PostgreSQL 16 local | `DATABASE_URL=… wh-server` | migration `0001_init` aplicada; Hunter e 2 travessias gravados; após reiniciar, época do relógio e posição restauradas |
| Build do cliente | `npm ci && npm run build` | `tsc --noEmit` sem erros; `vite build` ok |

## O que não roda / não foi feito

- O acesso aos repositórios legados (`carioca1111/wildhaven` privado e `carioca1111/wildhaven-new`) está **bloqueado nesta sessão**: não houve fetch das três branches pedidas e a procedência legada não foi reverificada. O conteúdo dos 272 GLBs foi confirmado pelo SHA-1 de blob do manifesto, via o espelho já presente no wildhaven2. Para fechar a reverificação: dar a esta conta acesso de leitura aos dois repositórios e rodar `fetch-sources.mjs` com `--legacy-remote`/`--original-remote`.
- 43 costeiros sem certificação (vegetação instanciada sem raio medido) e 5 arestas reprovadas (ver `RELATORIO-N-N.md`).
- Os 6 `iceberg-sea` ficam como exceção marítima, sem travessia.
- FPS em GPU real **não medido**. O único navegador disponível renderizou por software, a 1–2 FPS, número que não representa desempenho.
- Combate, criaturas, múltiplos Hunters, carroças, bestiário, clima V08, PvP, BR, economia, stress de 1.000 e modo pixel ficam no backlog.
- Nenhuma aprovação artística foi feita ou presumida.

## Separação de status

- **Validação técnica:** compilador, portais, certificação técnica de 223 hexes, testes, paridade e sim-check, todos acima.
- **Aprovação artística:** nenhuma nova. Terrenos seguem `pending-review`/`unverified-in-this-build`; o Hunter é "base de referência".
- **Publicação:** código, relatórios, hashes e captura neste PR. Nenhum GLB novo foi criado, então a regra de publicação binária do `AGENTS.md` não se aplicou. Os pacotes WHP1 não foram publicados por tamanho.
- **Integração:** `game/build-real-v01` usa os 223 hexes certificados e o Hunter do workshop. A `game/alpha01` não foi alterada.


## Atualização — fatia demonstrável do roadmap (mesma sessão, a pedido do diretor: "só pare quando terminar a build real")

O critério de demonstração de `05-roadmap-aceitacao.md` foi **executado de ponta a ponta** sobre o terreno real compilado:
explorar → avistar (página nova no Bestiário) → Caçar com seleção, carroça e pagamento → recusa do 7º Hunter →
viagem simulada → acampamento em clareira → pegadas azuis → estratégia autônoma → combate e abate → itens guardados
→ retorno à vila. Também foram executados: Hunter sozinho contra predador, armadilha com imobilização, Desvio 1 e 5,
ferimento, resgate por Chad/Nailon (pode chegar tarde) e morte permanente.

Evidências:
- `game/build-real-v01/data/demo-check-v01.json`: linha do tempo completa da demo roteirizada.
- `build real/integracao/evidencias/`: roteiro no navegador por cliques (diálogo Caçar, Modo Econômico).
- Testes: `cargo test` **17/17** (9 unitários, 1 contrato, 3 regras de gameplay, 4 paridade com a Alpha) e `node --test` **17/17**.
- Item a item, com o que é parcial e o que falta: [`ACEITACAO-ROADMAP-v01.md`](ACEITACAO-ROADMAP-v01.md).

**Tudo o que é número de gameplay é PROVISÓRIO** (`game/build-real-v01/data/gameplay-provisorio-v01.json`): preço da
carroça, armadilhas, drops, janela do Hunter caído (600 s), densidade de fauna, percepção da Lobrapedra, habilidades
iniciais dos Hunters. Cada bloco cita o item de decisão do diretor (05-roadmap, itens 1–14).

Ainda faltam para fechar 100% do roadmap:
- **Arte e assets:** HUD ilustrada (a imagem não está no repo); animações de técnicas, Desvio, agachar e queda; carroça; aprovação do Dodarro.
- **Medição:** desempenho em GPU real, incluindo GPU integrada.
- **Sistemas:** LOD visual, occlusion de construções e vegetação, troca de equipamento, Escalada e Primeiros socorros com efeito.
- **Escala:** IA adaptativa e stress de 1.000.
- **Mapa:** navegação marítima; correção da escala das árvores.

## Próximos passos sugeridos

1. Revisão do diretor sobre `node-classes-v01.json` e sobre os limites propostos (35°, 4 m, água).
2. Medir os raios das espécies instanciadas dos costeiros e certificar os 43.
3. Rodar o cliente em máquina com GPU e registrar FPS, p95/p99 e RAM/VRAM.
4. Portar a próxima fatia da Alpha (decisão de criatura `decide`) com paridade por seed.
5. Múltiplos Hunters e criaturas no servidor; LOD visual dos GLBs de terreno.
