# Benchmark executado

Chromium real, GLBs reais, viewport 1600 × 1000. Renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver).

Cada nível rodou por quatro segundos de parede, com um passo fixo de 50 ms por quadro renderizado. O tempo simulado e o número de amostras estão no JSON. É uma sondagem curta: p95/p99 com poucas amostras não descrevem uma sessão longa. FPS é o medido no renderizador por software; não prevê FPS de uma GPU física.

| Hunters | Representação | Amostras | FPS | Passo p50 ms | p95 ms | p99 ms | Heap JS MB | Modelos ativos |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | todos visíveis | 30 | 7.34 | 0.30 | 4.10 | 7.50 | 22.3 | 1 |
| 2 | todos visíveis | 30 | 7.50 | 0.70 | 8.80 | 33.00 | 21.1 | 2 |
| 5 | todos visíveis | 26 | 6.64 | 1.50 | 17.40 | 34.40 | 26.3 | 5 |
| 10 | todos visíveis | 26 | 6.42 | 3.30 | 65.00 | 133.30 | 28.1 | 10 |
| 20 | todos visíveis | 23 | 5.57 | 32.70 | 46.10 | 98.60 | 30.5 | 20 |
| 50 | todos visíveis | 16 | 4.09 | 139.40 | 257.10 | 257.10 | 37.8 | 50 |
| 50 | 1 acompanhado +49 ocultos | 24 | 6.19 | 150.70 | 175.30 | 186.60 | 56.5 | 1 |

## Separação de custos

`browser.json` registra IA humana, colisão fina, núcleo ecológico sem IA humana, demais efeitos de combate/saúde, atualização de cena/animação e submissão do renderizador. O núcleo compartilhado ainda agrupa percepção, navegação, colisão ampla, saúde e IA animal; não se declara que esses custos foram medidos isoladamente. Tempo de render é CPU de submissão; GPU e VRAM não foram medidos. Heap JS não é a memória total do navegador.

## Resultado e limites

Os níveis de 20/50 Hunters apresentaram picos de CPU; 50 não sustentou o orçamento de 50 ms por passo nessas condições. Ocultar remotos reduz custo visual, mas não elimina gameplay de confrontos ativos. Essa consistência é intencional. A V1 não deve ser apresentada como pronta para multidões em produção.

O arquivo benchmark-before-spatial-rays.json preserva uma sondagem anterior. A otimização espacial reduziu varreduras de triângulos, mas execuções curtas têm ruído e as tabelas não constituem uma comparação controlada de GPU. A regressão de 185 testes foi executada separadamente da medição final.

Reprodução: servidor ativo e `npm run browser`. Hardware real, sessões de resistência e worker/servidor dedicado continuam pendentes.