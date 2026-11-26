# Hunter Lab — combate como jogador, v04

Escopo desta atualização: somente `labs/hunters/`, a versão Claude atualizada no PR23. Base `48acee90579dc51119dfc96df719faf9995fa055`. Nenhum arquivo de `hunters-codex`, `ia-criaturas`, `combate-tatico` ou Alpha é alterado por esta atualização. Dependências já existentes desses diretórios continuam sendo consumidas.

## Oito pontos implementados

1. **Partes do corpo**: posições de cabeça, flanco e pernas calculadas a partir da cápsula visível, orientação e altura percebidas. O ponto desejado orienta aproximação e altura do membro. O acerto continua dependendo do contato físico do núcleo, que pode atingir uma região diferente da pretendida ou errar.
2. **Sinais e antecipação**: uma fronteira de observação sanitiza o movimento visível. Habilidade muda latência e confiança; golpes desconhecidos podem ser classificados incorretamente por novatos. A memória aprende preparação/recuperação pelas transições observadas. A IA não recebe HP, energia, RNG ou intenção oculta do rival.
3. **Aberturas**: estima o tempo disponível por postura, orientação, fuga, recuperação ou queda observadas. Compara preparo, recuperação e margem de saída. Não recebe o relógio futuro exato do inimigo. Pode errar a previsão.
4. **Sequências condicionais**: cada arma tem até duas/três ações, conforme agressividade e oportunidade. Cada continuação exige nova avaliação. Erro, interrupção, energia insuficiente, fim da abertura ou distância ruim encerram a sequência. Não há alternância obrigatória de ataques.
5. **Esquiva para o flanco**: prevê o corredor pela direção observada e testa dois lados navegáveis. Aplica impulso físico, custo de energia e compromisso temporal. Apenas o final da recuperação pós-impacto pode ser cancelado; nenhum golpe pendente é apagado para esquivar instantaneamente.
6. **Armas distintas**: lança/escudo conserva alcance, guarda e contra-estocada após contato defendido; espada possui sequência/saída mais rápidas; montante demanda abertura maior e preparação longa. Mãos nuas também possuem clipes próprios. Armas são equipamentos de laboratório, sem balanceamento aprovado.
7. **Habilidade separada da personalidade**: `habilidade` controla reconhecimento/estimativa/reação, enquanto agressividade/cautela controlam risco e extensão da sequência. A interface permite editar os valores independentemente e persiste a alteração por comando.
8. **Apresentação**: novo GLB v04, transições, variantes alta/baixa, recuperação integrada ao ataque, caminhada/trote/corrida por distância percorrida e apoio visual dos pés por IK de dois ossos. Levantar após queda possui janela física própria e clipe. Armas provisórias acompanham as mãos.

Ao perder visão, o Hunter busca a última pista percebida por curto período. Quando a criatura foge longe, corre para persegui-la, estima deslocamento por 250 ms e recupera fôlego antes de outra corrida. Próximo do alvo, reduz a passos de combate.

## GLB real

`assets/hunter-v04/hunter_combat_v04.glb`: mesma malha de 1.000 triângulos, 19 joints, uma skin, imagens/materiais originais e Walking/Running intactos. Setenta clipes adicionais no arquivo, **72 no total**; cinquenta a mais que a v03. Incluem três ciclos novos de locomoção, passos/giro/guarda, ataque leve/seguimento/finalização/pesado para quatro estilos em três alturas, contra-estocada e reações/queda/levantada/rendição. O prefixo binário da fonte permanece intacto.

O gerador `scripts/animate-hunter-v04.mjs` reconstrói as transformações do rig, resolve IK na autoria e grava trilhas reais de quaternion/posição no GLB. Manifesto contém SHA-256, bytes, rig, triângulos, parâmetros e nomes. Validação técnica em `resultados/jogador/gltf-validation.json`. A versão fica dentro deste laboratório para respeitar o pedido de isolamento; nenhuma v02/v03 é sobrescrita.

O sampler `src/animacao-jogador.js` mapeia o instante de impacto do clipe ao impacto da simulação. Não aplica dano. O apoio dos pés trabalha somente na representação visual e solta a âncora durante o balanço. A simulação conserva posição, colisão, saúde e eventos como autoridade.

## Abrir e reproduzir

A página normal `hunter-lab.html` inicia em **Caçada tática — lança e escudo**. Também há espada e montante, todos com Hunter e Varrisco reais no recorte do hex52. Os cenários antigos permanecem disponíveis. Selecione habilidade/agressividade e use **Aplicar ao selecionado**; as alterações entram no próximo passo. H comanda pesado e Espaço esquiva no controle manual.

`viewer/index.html` mostra doze modelos reais com os movimentos principais e permite selecionar qualquer um dos 72 clipes. `resultados/jogador/index.html` apresenta os vídeos e capturas do renderizador real.

```powershell
node --test --test-concurrency=1 labs/hunters/test/*.test.mjs
node labs/hunters/scripts/animate-hunter-v04.mjs
node labs/hunters/scripts/measure-jogador.mjs
node labs/hunters/scripts/capture-jogador.mjs lanca
node labs/hunters/scripts/capture-jogador.mjs espada
node labs/hunters/scripts/capture-jogador.mjs montante
```

O servidor de criaturas que já atende o laboratório ou o servidor local existente em 8782 pode servir a página. As ferramentas de autoria/captura usam Three/Playwright já instalados na revisão anterior; não houve instalação ou alteração do outro laboratório. O teste sequencial evita concorrência de várias cópias de configuração em uma máquina com pouca memória disponível.

## Evidências e limites

A regressão Hunter inclui 23 testes anteriores e 14 novos: fronteira perceptiva, partes, habilidade, aprendizagem, orçamento temporal, sequência/erro, previsão de trajetória, esquiva física/obstáculo, persistência no meio do golpe, comandos, impactos, integridade do GLB, guarda/contra-ataque e corrida/limite de mira.

`comparacao.json` compara política anterior e nova no **mesmo Hunter Lab**, três armas × três sementes, máximo de 120 s. Um término pelo limite de observação é identificado como tal, nunca descrito como vitória. `browser-<arma>.json` registra clipes realmente vistos, estado, invariantes e desfecho da gravação. Vídeos usam canvas real com HUD e velocidade 2× identificada.

Os clipes e equipamentos continuam em revisão artística. A geometria de contato do núcleo é por cápsulas e trecho do membro; não é colisão por triângulo da lâmina nem ragdoll. A estimativa das aberturas é uma heurística de aprendizado local, sem modelo treinado. O apoio dos pés é experimental e pode perder contato quando o alvo de IK excede o alcance da perna. Não representa animação final aprovada nem cópia exata do combate de Monster Hunter.

A simulação remota agregada permanece fora desta atualização. Nenhuma otimização, regra de criatura ou laboratório alternativo foi alterado para produzir a demonstração.


## Correção de pose T

O Hunter usa agora um único controlador visual (`visual-hunter.js`). O animador de criaturas continua responsável pelas criaturas; para Hunters, somente a interpolação da posição/escala é reutilizada. O mixer antigo não escolhe nem para clipes do humano a cada passo/quadro.

O controlador amostra diretamente as trilhas esqueléticas exportadas no GLB, incluindo quando o relógio da simulação está pausado. Isso impede que a restauração da pose de vínculo pelo mixer substitua a postura atual. A pose de guarda é aplicada antes do primeiro quadro visível. Clipes indisponíveis usam `combat_guard`; as transições visuais terminam pelo tempo visual sem avançar ataques ou causar dano. Variantes alta/baixa não recebem sufixo duplicado.

Regressão com o GLB real: o controlador anterior foi recuperado do commit `3b981ca` e, com um nome de clipe ausente, produziu pose T em 16/16 quadros. A correção apresentou 0/192 quadros T nos casos pausados (repouso, ataque, clipe ausente, caminhada, corrida, bloqueio, esquiva, impacto, queda, levantar, rendição e retorno ao repouso), além de 0/300 quadros no confronto real. A detecção verifica ambos os braços estendidos lateralmente à altura dos ombros no espaço local do modelo. Evidências: `resultados/jogador/tpose-regressao.json` e `hunter-sem-tpose.png`.

Reproduzir: `node labs/hunters/scripts/regression-tpose.mjs` com o servidor em 8782. `HUNTER_TEST_URL` permite apontar para o pacote estático local. A correção é apenas visual e não modifica o GLB, o rig, as decisões de combate ou qualquer outro laboratório.
