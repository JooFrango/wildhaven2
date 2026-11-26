# Escolha das criaturas

> **Status: pendente.** O laboratório foi construído fora do repositório, com espécies de exemplo genéricas. Preencha este documento ao integrar ao `wildhaven-new`.

## Critérios

1. Um herbívoro e um predador do **mesmo bioma**.
2. Relação alimentar plausível: o predador come esse herbívoro segundo a documentação de ecologia em `gameplay/`.
3. De preferência, os dois com GLB **animado**. Confira os clipes reais com `npm run clipes -- <caminho.glb>`.

## Fontes consultadas

| Fonte | Caminho | O que foi usado |
|---|---|---|
| Regras do repositório | `AGENTS.md`, `CLAUDE.md` | |
| Ecologia | `gameplay/...` | |
| Ficha do herbívoro | `creatures/species/...` | |
| Ficha do predador | `creatures/species/...` | |
| Catálogo | `catalogo/entregas.json` | |

## Escolha

| | Herbívoro | Predador |
|---|---|---|
| Espécie | | |
| Bioma | | |
| GLB (caminho original, sem copiar) | | |
| Clipes reais (`npm run clipes`) | | |
| Mapeamento estado → clipe | | |

**Justificativa:**

## Como aplicar

1. Copie `config/especies/herbivoro-exemplo.json` para `config/especies/<id-herbivoro>.json` e o predador da mesma forma. Preencha `origem.ficha`, `modelo.glb` (caminho relativo à raiz do repositório) e `modelo.clipes`.
2. Traduza os números da ficha (velocidades, sentidos, dieta) para os campos. O que não vier da ficha vai para `balanceamento.provisorios`.
3. Atualize `relacoes.teme` / `relacoes.presas` / `relacoes.come`, `config/indice.json` e o campo `especie` das criaturas em `config/cenarios/*.json`.
4. Rode `npm run verificar` e `npm run paridade`.
