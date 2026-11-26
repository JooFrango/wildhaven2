# Wildhaven — Serracórion v02 | Correção de espinhos dorsais

**Origem:** Serracórion v01, PR #74. **Referência:** a última imagem aprovada em chat com espinhos integrados à carapaça.

## O que foi corrigido
- Oito espinhos dorsais, cada um modelado como estrutura chitinosa contínua com uma placa de base.
- Base de oito vértices em cada placa posicionada **0,20 m abaixo** da superfície real interpolada do corpo em X/Z, evitando espinhos flutuantes na silhueta e nos ângulos laterais.
- Anéis superiores e faces dos espinhos modelados com normais externas, evitando o sombreamento quase preto da geometria anterior.
- Mantida a pintura UV de 2048 × 2048, pixel a pixel idêntica à v01. Nenhuma malha para manchas, listras ou cores.
- Restante da forma (cabeça, pinças, pernas, cauda) não foi redesenhado.

## Entregáveis
- `serracorion-v02-espinhos-integrados.glb`: um único material PBR e uma única malha, com textura UV embutida.
- `textures/serracorion-v02-painted-uv.png`: albedo UV original sem alteração de cores.
- `source/build.py` e `source/render.py`: geração e renderização reproduzíveis.
- `manifest.json`: hash SHA-256, contagem de faces, certificado numérico das oito bases enterradas.
- `previews/`: perfil, frente, três-quartos, superior e close do dorso, reimportados do GLB via VTK. Comparação v01/v02.

## Estado e aprovação
GLB v02 estático corrigido para avaliação. A v01 não é substituída. Sem rig, animações, LODs ou integração na Alpha. PR em rascunho até aprovação.
