# Dodarro — Dodo Gigante (Wildhaven)

**Etapa:** blockout anatômico v01 em revisão de forma; conceito já aprovado pelo usuário.
**Espécie:** Dodarro, ave terrestre de grande porte, oportunista frugívora e necrófaga.
**Biomas:** savana e planície.
**Escala proposta:** ~2,4 m de altura, ~2,8–3,1 m de comprimento; ~320–380 kg (aferir gameplay posteriormente).

## Variantes da mesma espécie

- `dodarro_selvagem_v01_blockout.glb`: corpo natural, ainda sem sela.
- `dodarro_montaria_v01_blockout.glb`: a mesma anatomia com sela, arreios e alforjes de pequena capacidade.
- `textures/dodarro_atlas_v01.png`: **atlas UV real**, com variações de plumagem, bico, pernas, couro e tecido. A alteração de cor superficial acontece por **textura**, não malhas de recoloração. Geometria de penas só existe para preservar silhueta.
- `source/build_dodarro.py`: fonte procedural completa, gerando ambos os GLBs e manifestos.
- `source/render_glb.py`: importa os arquivos GLB já exportados e captura perfil, frente e três-quartos.
- `previews/dodarro_*_REAL_*.png`: seis renders efetivos de GLBs reimportados, não imagens conceituais.
- `manifest_{selvagem,montaria}_v01.json`: hashes, bytes, polígonos e limitações verificadas do export.

## Direção artística e metodologia

Referência principal: **Torvardo v03 (PR39)**. Complementares: Mastélio v03 (PR42) e Garruva v03 (PR44), todos blockouts estáticos de revisão. Planos anatômicos facetados com seções controladas, articulações legíveis, pés portantes, bico e olhos inseridos. Evitar aparência de massinha.

Aprovação artística do **conceito** não aprova este **blockout**. Não executar refinamento, rig ou clipes antes da análise visual pelo usuário. Nesta etapa: **0 skins, 0 juntas, 0 clipes, 0 LODs**. Não há integração ao runtime, mapas ou balanceamento de IA.

## Comportamento planejado, ainda não implementado

Ovos em ninhos raros; pais patrulham e defendem o ninho com bônus temporário de ataque/defesa; furto gera perseguição. Eclosão do ovo na vila com 10% de sucesso. Montaria resistente e retorno autônomo à vila após morte permanente do Hunter, quando rota viável. Essas regras são de **design**, não há scripts de gameplay nesta branch.

## Validação e publicação

Os GLBs devem ser exportados, reimportados e renderizados por GitHub Actions. O workflow só comita arquivos binários após validação de geometria, textura UV, dimensões da exportação, SHA-256 e seis screenshots reais. Estado técnico/artístico deve permanecer separado; PR em draft enquanto a forma estiver em revisão.

Não substituir assets aprovados, não mesclar PR automaticamente.
