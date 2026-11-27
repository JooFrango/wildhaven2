# Benchmark V03 × V04

**Ambiente:** contêiner Linux com 4 núcleos e Chromium headless com SwiftShader, que rasteriza o WebGL na CPU.
- A CPU do modo 3D inclui essa rasterização. Os números servem para **comparar** as versões, não para prever o FPS numa GPU real.
- **Nenhum FPS foi medido em GPU real.** No PC do diretor, use F3 → "Exportar relatório".

## 1. Cliente na mesma cena

**Condições:**
- `tools/bench-modos.mjs`, perfil Baixo, 60 s por modo;
- servidores recém-iniciados, Hunter seguido na vila (HV_01), mesmo navegador;
- V03 com os 7 hexes do ZIP, V04 com o continente inteiro presente no disco.

Arquivos: `game/build-real-v04/bench/v0X-mesma-cena-*.json`.

| Modo | | V03 | V04 |
| --- | --- | ---: | ---: |
| **3D** | CPU do navegador (% de um núcleo) | 334% | 333% |
| | Quadros/s (SwiftShader) | 9,0 | 8,0 |
| | Draw calls · triângulos | 134 · 307 k | 102 · 300 k |
| | VRAM estimada | 112 MB | 118 MB |
| | WebSocket | 7,9 KB/s | 9,1 KB/s |
| | RSS do navegador | 1338 MB | 1439 MB |
| **Econômico** | CPU do navegador | 11,6% | 12,2% |
| | Quadros/s | 15 | 15 |
| | WebSocket | 4,8 KB/s | 5,1 KB/s |
| **Aba oculta** | CPU do navegador | 4,5% | 4,6% |
| | Quadros desenhados | 0 | 0 |
| | WebSocket | 1,7 KB/s | 1,7 KB/s |
| **Servidor** | CPU | 1,0% | 1,1% |
| | RSS | 72 MB | 291 MB |

**Leitura dos números:**
- **CPU, quadros e rede:** a V04 mantém o desempenho da V03 com 272 hexes em vez de 7.
- **Horizonte:** desenhar o continente inteiro custa poucos draw calls.
- **Medidor:** a CPU do Econômico e da aba oculta inclui a sonda de 60 Hz do próprio medidor (`raf/s`).
- **Memória do navegador:** +100 MB, do horizonte dos 272 hexes e do catálogo de 34 espécies.
- **Memória do servidor:** quase toda a diferença é o cache de física, configurado em 256 MB na V04 (`WH_CACHE_MB`) contra 128 MB na V03. O cache enche até o teto e depois descarta por uso.

## 2. Servidor com o continente inteiro (teste longo)

Este teste usa `tools/test/soak-servidor.mjs` (arquivo: `bench/soak-servidor-8h.json`):
- os 266 hexes certificados estão presentes;
- todos os Hunters exploram em ×1;
- quem volta à vila parte de novo a cada 30 min.

(Os números finais são preenchidos ao fim do teste.)

## 3. Testes executados

Os testes executados estão listados no `RELATORIO-V04.md`, seção 8.
