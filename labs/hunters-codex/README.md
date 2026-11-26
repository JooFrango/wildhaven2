> Atualização nesta branch: [combate orgânico e tático](../combate-tatico/README.md), GLB experimental v03 e integração Claude. O texto abaixo descreve a versão V1 original; consulte a atualização para resultados e limites atuais.

# Hunter Lab Codex v1.0

Laboratório 3D isolado, separado de `labs/hunters/` e da versão do Claude. Não modifica a Alpha, mapas, assets oficiais, rigs ou clipes. PvP aqui significa **simulação local experimental**, não multiplayer em rede nem autoridade de produção.

## Executar

Node >=22. Na raiz do repositório:

```powershell
cd labs/hunters-codex
npm ci
npm run dev
```

Abra **http://127.0.0.1:8782/labs/hunters-codex/hunter-lab.html** e clique **Iniciar**. Começa com dois Hunters v02, lança contra espada/escudo. Selecione Hunter × Varrisco para o encontro com a criatura. Câmera livre por mouse, acompanhamento e visão geral no seletor. Não é necessário iniciar o jogo.

Versão privada publicada: https://wildhaven-hunter-lab-codex.jvbrmandarino11.chatgpt.site (autenticação do proprietário). Deploy confirmado como concluído; acesso sem autenticação retorna 401 esperado. O mesmo pacote estático foi executado no Chromium com os dois confrontos e nenhum recurso ausente. A sessão autenticada no host não foi automatizada. PR em rascunho: https://github.com/carioca1111/wildhaven-new/pull/22.

WASD move o Hunter em controle manual; Shift corre, J/K atacam leve/pesado, B bloqueia, Espaço esquiva e R rende. Duplo clique no chão emite ordem de movimento. O Hunter manual conserva decisões de sobrevivência quando a IA está habilitada. Alterações de configuração e comandos entram no próximo passo da simulação; se estiver pausado, pressione Iniciar. Reiniciar restaura a configuração inicial do cenário e a semente atual.

## Implementado e executado

- GLB oficial Hunter masculino v02, textura original, 1.000 triângulos, 19 ossos, uma skin, clipes Walking/Running. Instâncias clonadas com esqueleto independente. SHA do GLB e PNG confere com o PR81 do repositório original.
- Recorte visual e geométrico de 100 × 100 m do hexágono oficial 52. Altura por coordenadas baricêntricas dos triângulos; obstáculos por geometria sólida e raio corporal; movimento varrido em subpassos de até 12 cm. Navegação compartilhada em grade de 50 cm, não a grade de 8 m.
- Duelo, Hunter × Varrisco, equipes e todos contra todos; treinamento e modo letal descartável.
- Alcance e direção de armas, preparo/recuperação, energia, bloqueio frontal, escudo, esquiva com deslocamento físico, interrupção por atordoamento e ferimentos localizados. Contato e linha 3D são conferidos no impacto. O indicador acima da cabeça é depuração, não animação de ataque.
- Saúde e veneno compartilhados com o ecossistema; cabeça/pescoço/tórax/abdômen/braços/pernas, dor, sangramento, fratura, mobilidade, desequilíbrio e queda lógica quando há suporte no solo. Rendimento dos braços afeta dano e bloqueio. Armaduras alteram proteção e movimento.
- Percepção e memória ecológicas; predador reconhece o Hunter como presa física. IA humana usa contatos observáveis e últimas pistas; coragem/agressividade, energia e ferimentos influenciam confronto, cobertura, retirada, descanso e rendição.
- Seleção, adição/remoção, atributos, equipamentos, personalidade, IA/manual, pausa/velocidade/semente, diagnóstico e exportação/importação do estado completo com fila e histórico de comandos.
- Câmera separada do núcleo. Remotos ocultam modelo/animação e só economizam decisões ociosas; encontros ativos conservam física, saúde e passos de 50 ms. Mudar o foco não encerra confrontos nem apaga impactos pendentes.
- 24/24 testes do Hunter Lab; regressão ecológica 185/185; Chromium com os GLBs reais, controles e dois combates; paridade exata do estado do duelo entre Node e Chromium. Resultados em `resultados/`.

## Verificação

```powershell
npm test
npm run browser
```

O teste do navegador requer Chrome instalado; opcionalmente defina `CHROME_PATH`. Deixe `npm run dev` ativo em outro terminal. `node scripts/browser.mjs --smoke` executa controles, encontros, paridade e capturas sem repetir o benchmark. `npm run derive` reproduz o recorte a partir do GLB oficial, sem alterá-lo. `node scripts/package-site.mjs <diretorio-dist>` monta um pacote estático independente da Alpha, incluindo somente as dependências necessárias.

`resultados/pvp-real.png`, `hunter-creature-real.png` e `hex52-real.png` são capturas do renderizador. `demo-pvp.json` e `demo-creature.json` guardam estados reais importáveis pelo campo `save`. `scenarios.json` registra cada cenário executado; `eco-regression.tap` contém a regressão compartilhada; `browser.json` contém o benchmark. Os dois GLBs do lab passaram no validador glTF com zero erros e avisos.

## Limitações e pendências

- Não foram criados ataques/esquivas/quedas animados, rigs, skinning ou texturas novos para o Hunter. Repouso usa a pose original, e os estados sem clipe usam marcadores. Equipamentos são gizmos provisórios; armadura é representada mecanicamente e na interface. Veja `docs/ANIMATION-CONTRACT.md`.
- Não há servidor autoritativo, multiplayer em rede, recompensas, contas, inventário persistente de produção ou morte de Hunters reais. O contrato do núcleo é local; a futura autoridade deve validar comandos e resolver impactos no servidor.
- Os números de dano, alcance, proteção, saúde e personalidade são parâmetros experimentais, não balanceamento aprovado. Fraturas mantêm penalidades e exigem tratamento futuro; estabilizar apenas cessa sangramento, não cura tecido nem fratura. Veneno está integrado e testado, mas o Varrisco da demonstração não é venenoso.
- Investiga sons e últimas posições memorizadas. Não há rastros persistentes de pegadas, cheiro humano detalhado ou expedições de longo prazo. A cobertura é uma heurística local conservadora, não um planejador tático completo.
- Obstáculos usam projeção conservadora de triângulos sólidos com faixa vertical, não um motor de corpos rígidos/ragdoll. A área não testa natação, salto, escalada, túneis ou travessias entre hexágonos. Apenas Varrisco foi integrado e demonstrado como predador nesta etapa.
- Remotos em combate permanecem detalhados por consistência. A simulação agregada de grandes distâncias ainda não foi implementada. O benchmark mede 1/2/5/10/20/50 modelos reais e 1 acompanhado +49 ocultos; não comprova escalabilidade de produção. Custos/FPS e limites estão em `docs/BENCHMARK.md`.
- Reprodutibilidade foi executada em Node/Chromium no mesmo host; equivalência entre motores diferentes, como Safari e Firefox, ainda não foi validada.

Histórico de auditoria/base em `docs/AUDIT.md`. Desenvolvimento em branch específica, PR em rascunho, sem merge automático.
