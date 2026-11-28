# Pendências da V04.2

Itens não concluídos ou não verificáveis neste ambiente: contêiner Linux, Chromium com SwiftShader, sem GPU física.

## Medições que dependem do computador do diretor

1. **FPS, 1% low e frametime na Intel Iris Xe (meta: 60 FPS).**
   - No SwiftShader as três versões ficam em ~5 quadros/s no Médio: a rasterização por software domina e esconde os ganhos de CPU do JS.
   - No PC do diretor, com o portátil v04.2: F3 → **Gravar quadros (60 s)**:
     - na vila;
     - numa viagem;
     - à noite perto da vila;
     - ao trocar de Hunter.
   - Repetir com o portátil v04.1 para a comparação.
2. **WebGL × WebGPU.**
   - Abrir `http://127.0.0.1:8787/lab/webgpu.html` com o portátil v04.2 rodando.
   - O JSON aparece na tela.
   - O SwiftShader não oferece WebGPU.
3. **Compilação paralela de shaders (`KHR_parallel_shader_compile`).** Com ela, `compileAsync` (portão de luzes, modelos e agora materiais de relevo) tira a compilação do quadro. Não existe no SwiftShader.

## Trabalho técnico em aberto

| Item | Situação | Próximo passo |
| --- | --- | --- |
| Multi-instância para 1.000 jogadores | Analisada com números (relatório, seção 2.4); não implementada | Shard com várias instâncias e repositório físico compartilhado (`Arc<Chunk>` já existe); medir quanto do RSS base (62–65 MB) é dado estático compartilhável |
| Cópia na CPU de horizonte (13,6 MB), vegetação (10,6 MB) e vila (5,1 MB) | Medida | Verificar se algum código lê esses arrays depois do envio à GPU; se não, liberar como no relevo |
| Relevo L0 na CPU (32 MB) | Necessário para o raycast do capim | Alternativa só se mantiver a posição idêntica do capim |
| Lixo restante por quadro | −14% na V04.2; o resto é parse de GLB, montagem do capim e fila do relevo | Medir num build não minificado para separar as funções embutidas em `update` do relevo |
| Sombras | Experimento feito; cache estático e 15 Hz rejeitados (teto −9%, mudança visual com o sol móvel) | Repetir as capturas ao meio-dia (as atuais são do amanhecer) |
| Picos no roteiro noturno | Em 40 s com ×50 o ciclo não chega à noite | Medido à parte com `tools/lab/lanternas.mjs` |
| Worker da BVH do capim | Adiado | Só se o gravador do diretor mostrar a construção (2–8 ms) como pico |
| ACT-01 durante travessia | Herdado da V04.1 | Cenário de viagem ×10 com a câmera a 30–80 m de criaturas |
| VIS-01 em campo | Herdado da V04.1 | Comparar bytes carregados num instantâneo com criaturas próximas |
| **Picos de 105–160 ms na geração de criaturas (P1)** | Causa medida: 160–250 leituras síncronas de chunks no anel de busca de água; existe igual na V04.1. A tentativa de espera assíncrona ponto a ponto foi desfeita: atrasava a geração (292 × 1.722 criaturas) | Calcular de antemão as 40 posições candidatas (dependem só da sequência aleatória), pedir em lote todos os chunks delas e dos anéis e gerar quando todos chegarem. Validar: digesto no `sim_check`, contagem de criaturas no tempo igual à V04.1 e tick máximo no servidor real |
| Testes de 8 h e 24 h da V04.2 | Não executados | O de 8 h da V04.1 está registrado; 24 h requer infraestrutura que fique de pé (o contêiner já reiniciou uma vez) |
