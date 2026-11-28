# Checklist V04.2 — segunda varredura de otimização

**Onde está:**
- código: `game/build-real-v04-2/`;
- branch: `feat/build-real-v04-2-segunda-varredura`;
- base: V04.1, que fica intacta em `game/build-real-v04-1/` e na branch `feat/build-real-v04-1-extreme-performance`.

**Como retomar:** leia esta lista e `git log origin/feat/build-real-v04-2-segunda-varredura`.

**Regras do diretor (as mesmas da V04.1):**
- **Não reduzir:** densidade de vegetação, polígonos, texturas, população de criaturas.
- **Não remover nem alterar:** sombras, clima, animações, regras de IA.
- **Preservar:** interface e telas de carregamento.
- **Sem fal.**
- **Nenhuma mecânica nova nesta etapa.**

**Método:** ciclos de medir → maior gargalo → alternativas → implementar → comparar → qualidade → regressão → medir de novo.

## Servidor

- [x] Escalabilidade 1k/5k/10k/20k criaturas, Hunters na vila e espalhados (`sim_check escala`, `bench/v04-2/escala-*.json`).
- [x] Vizinhos por referência; grade plana; uma raiz por criatura; clima indexado; hash de célula; areia por hex; espécie numa consulta; estado/clipe sem alocação.
  - Digesto idêntico.
  - 20k espalhados: 10,22 → 6,79 ms por passo.
- [x] Publicação no ritmo dos clientes: 1 Econômico 9,5 → 5,4 ms/s; segundo plano 7,8 → 3,9 ms/s.
- [x] Cache físico: experimento 64/128/256 MB (mesmo digesto). Padrão interno 128 MB, como o portátil: RSS 321 → 190 MB.
- [x] Arquitetura multi-instância para 1.000 jogadores: análise com números (relatório, seção 2.4); sem implementação nesta etapa.

## Cliente

- [x] Alocações por quadro: cores e vetores temporários do céu, atores, câmera, vila e portão de luzes.
- [x] Pegadas: pulso no shader; matrizes reenviadas só quando a lista muda.
- [x] Materiais de relevo novos compilados com `compileAsync` antes de aparecer.
- [x] Vértices de relevo liberados da RAM da CPU após o envio à GPU, exceto L0 de relevo, usado pelo capim.
- [x] Laboratório WebGL × WebGPU isolado (`/lab/webgpu.html`).
- [x] Medir alocações por quadro V04.1 × V04.2 (A/B/B/A).
  - 1ª rodada: sem diferença.
  - 2ª rodada (relevo, capim, vegetação, F3): 1,45/1,66 → 1,40/1,32 MB/s (−14%).
  - Capim equivalente: 1.117 de 1.117 pontos.
- [x] Medir heap V8 e memória dos assets: heap vivo 41 MB nas duas; vértices na CPU 67,5 → 62,6 MB.
- [x] Experimento de sombras: congelado −9%, sem −24% (SwiftShader). Cache estático e 15 Hz rejeitados (sol móvel = mudança visual).
- [x] Aba oculta: os 300 MB eram lixo à espera de GC. Na V04.1 cai para 12 MB aos ~60 min; na V04 ficava em ~255 MB (MEM-01).
- [x] Gravador de picos: zoom, troca e viagem, V04.1 × V04.2. Nenhum pico > 2,5× a mediana nas duas; lanternas medidas à parte.
- [x] Capturas comparativas V04 × V04.1 × V04.2 (`bench/v04-2/final/capturas/`; 0,03–0,04% de pixels diferentes entre V04.1 e V04.2).
- [x] Testes longos da V04.2: Econômico e oculto 2 h; 3D 30 min. 8 h e 24 h não executados (ver pendências).
- [x] Picos de geração no servidor: causa medida; correção tentada e desfeita (atrasava a geração); pendente com desenho.
- [ ] ZIP v04.2, SHA-256 conferido.
- [x] Documentos:
  - RELATORIO-OTIMIZACAO-V04.2;
  - BENCHMARK-V04-V04.1-V04.2;
  - PENDENCIAS-V04.2.
