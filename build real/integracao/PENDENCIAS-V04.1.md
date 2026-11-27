# Pendências da V04.1

Itens não concluídos ou não verificáveis neste ambiente: contêiner Linux, Chromium com SwiftShader, sem GPU física.

## Medições que dependem do computador do diretor

1. **FPS, 1% low e frametime numa GPU real (Intel Iris Xe).** Nada aqui mede GPU física: o SwiftShader rasteriza na CPU e chega a ~10 quadros/s na vila. No PC do diretor:
   - Na vila, perfil Médio: F3 → **Gravar quadros (60 s)**.
   - Repita durante uma viagem, à noite perto da vila (lanternas) e ao trocar de Hunter.
   - O JSON traz cada pico com a causa observada no mesmo quadro. É assim que se confirmam ou descartam os ganhos de shaders, luzes locais e capim.
2. **Compilação paralela de shaders.** O portão de luzes e a compilação de modelos novos usam `compileAsync`. Com a extensão `KHR_parallel_shader_compile` (Chrome no Windows/D3D11 normalmente a tem) isso sai do quadro; sem ela, a compilação continua síncrona. O SwiftShader não tem a extensão, então o caso "sem travar" não pôde ser medido aqui.
3. **Tempo de GPU por quadro.** Depende do `EXT_disjoint_timer_query_webgl2`, indisponível aqui. O gravador registra quando existe.

## Trabalho técnico em aberto

| Item | Situação | Próximo passo |
| --- | --- | --- |
| ACT-01 durante travessia de região | A correção está integrada e o teste de cancelamento passa. Falta um teste que force troca de LOD enquanto o hex muda. | Cenário do laboratório: Hunter viajando ×10 com a câmera a 30–80 m de criaturas. |
| Compilação no meio do jogo | Pré-compilação e portão reduziram de 15 para 8 os programas compilados ao acender as lanternas. Os 8 restantes são materiais de relevo carregados depois da tela de carregamento. | V04.2: compilar cada material de relevo novo com `compileAsync` ao chegar (como já é feito com os modelos de criatura). |
| Sombras | Medido: só 2 (Médio) a 18 (Alto) instâncias de vegetação entram no passe de sombra, todas dentro do mapa. O custo está no passe em si (~1,7 ms de GPU na Iris Xe segundo o Codex). | V04.2: experimentos isolados de cache estático + dinâmico e atualização por invalidação, comparando imagens. |
| `getProgram`/`getParameters` por quadro | Ainda aparecem no perfil depois da correção da vegetação. Suspeita: o material de profundidade compartilhado no passe de sombra entre objetos instanciados, com esqueleto e comuns. | V04.2: contar trocas de programa por passe e testar materiais de profundidade próprios por tipo de objeto. |
| Alocação por quadro | ~288 KB por quadro na V04.1 antes das correções de relevo. Não foi medida de novo depois delas. | V04.2: medir de novo e eliminar o resto. |
| Carregamento por visibilidade (VIS-01) em campo | A regra foi trocada e verificada por código e build. A comparação de bytes num instantâneo com criaturas próximas não foi feita: o teste de 8 h ainda estava no começo. | Medir com o servidor do teste longo quando houver criaturas por perto. |
| Teste longo do servidor | Iniciado às 17:36 UTC (480 min pedidos). | Registrar a duração executada informada pelo próprio JSON. |
| 24 h | Não executado. | Requer infraestrutura que fique de pé 24 h; o contêiner reiniciou uma vez durante o teste da V04. |
