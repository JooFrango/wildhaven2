# Brejáveo v04 — revisão experimental de modelo, textura e animação

Base: v03 real, SHA-256 b06878ac4c590f20fdea154c52225b9c57c23cf93aa763860f5b55bc1d875603. Conceito original: v01/conceito-aprovado.png. Não substitui a v03 nem altera a Alpha. Todos os arquivos novos permanecem na pasta já existente da espécie.

- Modelo: cauda alongada e curvada, pescoço arqueado, olhos ajustados, dedos alares redesenhados a partir do punho e membranas novas.
- Textura: atlas UV pintado, escamas, manchas arroxeadas, ventre claro, membranas alaranjadas; sem malhas para coloração.
- Rig: skinning real de 40 juntas; locomoção com posicionamento analítico de pés, 24 clipes nomeados compatíveis com v02, inclusive voo, decolagem, aterrissagem, captura por língua, alerta e morte.
- Orçamento: 5164 → 5188 triângulos (+24, +0,46%). 86 malhas, um skin.
- Verificação: GLB reaberto e estruturas, índices, pesos normalizados, quaternions e amostra de voo renderizada em CPU. Prévia real: perfil, três-quartos, frente e voo. Não é um render Blender/WebGL. 
- Pendente: avaliação artística, playback integral, confirmação da abertura/deformação das asas e apoio dos membros no runtime. A textura permanece estilizada e os membros ainda precisam de revisão visual. Sem LODs novos ou integração; a v03 não tinha LODs.
- Reproduzir: importe `buildBrejaveoV04` de `brejaveo-v04-build.mjs` e passe o base64 do GLB v03. A função retorna GLB, textura, preview em base64 e métricas. 
