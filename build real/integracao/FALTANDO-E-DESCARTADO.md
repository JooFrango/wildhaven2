# O que está faltando e o que foi descartado — Build Real v01

## Faltando (bloqueios e pendências reais)

### Acesso
- **`carioca1111/wildhaven` (privado) e `carioca1111/wildhaven-new`**: inacessíveis nesta sessão na nuvem (`add_repo`: sem acesso; `git fetch` e API pública: 403/404). O remote `legacy` foi adicionado, mas o fetch de `feat/build-real-continental-272-v01`, `docs/build-real-planejamento-2026-11-28` e `feat/regioes-moveis-v023` **falhou**. Não houve contorno.
  - Efeito: a procedência de `build real/continental/` (declarada como PR #108) **não foi reverificada** contra o legado. Usou-se a cópia já presente em `JooFrango/wildhaven2@main` (`0a7aab5`).
  - Efeito: os 272 GLBs **não** foram baixados das origens. Foram conferidos (bytes, SHA-1 de blob, SHA-256 da v12) a partir do espelho `JooFrango/wildhaven2@0a7aab5:assets/world/continental-272/`, que já os contém. Como o SHA-1 de blob é igual ao registrado no manifesto para os 272, o conteúdo é idêntico ao das origens. Por isso **nenhum hex ficou bloqueado por acesso**.
- `docs/prompts/README.md`, `docs/prompts/CONTINUIDADE.md` e `docs/prompts/MAPAS.md` são citados pelo `AGENTS.md`, mas **não existem** neste repositório. Foram lidos: `AGENTS.md`, `docs/prompts/CRIATURAS.md`, `docs/prompts/prompt-mestre-criaturas.md`, `docs/POLITICA-ASSETS-3D.md` e `build real/README.md`. Não existe `CLAUDE.md`.

### Técnico
- **43 hexes costeiros sem certificação:** vegetação em instâncias GPU sem regra de árvore com raio medido. Também não há malha de superfície do mar nesses GLBs.
- **5 arestas reprovadas:** 4 por água ao longo de toda a fronteira (PT_+3_11|costa_+04_+10, PT_+2_12|PT_+3_12, PT_+2_13|costa_+02_+14, PT_+3_13|costa_+02_+14) e 1 por emenda de 3,9 a 5,4 cm, acima de 0,03 m, com inclinação acima de 35° (MN2_05|MN2_06).
- **6 `iceberg-sea`:** sem travessia terrestre, por regra. Falta o projeto de navegação marítima.
- **Classificação de nós v01**, limites de inclinação (35°), largura mínima de portal (4 m) e "água bloqueia a pé": são **propostas** e aguardam revisão do diretor.
- **Pacotes WHP1 não publicados:** 3,44 GB. Ficam reproduzíveis, com hashes registrados.
- **Clipe `Running`:** os métodos de velocidade divergem 43% e o clipe precisa de revisão. Não existe clipe `Idle` no GLB do workshop; parado, o Hunter fica sem animação.
- **FPS em GPU real não medido.** O teste de runtime usou Chromium headless com renderização por software (SwiftShader). Os 1–2 FPS observados ali **não** representam desempenho.
- **Ainda não existe:** occlusion culling, LOD/HLOD visual, múltiplos Hunters em cena, criaturas, combate em gameplay, salvamento de travessias no reload (só o log no PostgreSQL), autenticação e contas.

## Descartado (e por quê)

| Item | Decisão | Motivo |
| --- | --- | --- |
| Commitar de novo os ~1,37 GB de GLBs | descartado | já estão em `main` (`assets/world/continental-272/`); o fetch os materializa por hardlink/`git cat-file` |
| Commitar os `.whp.gz` (3,44 GB) | descartado | tamanho; só hashes por tile em `pacotes-fisicos-272.manifest.json` |
| Usar os centros arredondados do manifesto | descartado | erro de até 4,7 cm mascarava emendas; usa-se a grade exata (`--snap-centers lattice`) e a correção é registrada |
| Terreno plano ou collider fictício para hex sem nó `terrain` | descartado | proibido; o lote base registra 21 falhas e a v01 resolve por classificação medida e revisável |
| Velocidade de corrida no gameplay | descartado | clipe inconsistente |
| Controle direto (WASD) | descartado | o Hunter é autônomo; não há endpoint de controle |
| Importar trabalho dos PRs #1–#7 | descartado | retrabalho paralelo de fauna em revisão; não sobrescrever |
| Alterar `game/alpha01/` | descartado | somente leitura (só executada para gerar vetores de paridade) |
