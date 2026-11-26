# Wildhaven — Sevilho e Arbélio v02

**Base exata:** `wildhaven-small-savanna-herbivores-animated-v01`. As artes conceituais das espécies foram aprovadas; os modelos v02 permanecem **em revisão artística**, não aprovados.

## Mudança nesta revisão

- Fontes em `source/refine_pair.py` reutilizam o gerador, rigs hierárquicos e clipes v01; geram **6 GLBs novos** (LOD0, LOD1, LOD2 por espécie) em diretórios canônicos e manifestos SHA-256 versionados.
- Substitui orelhas arredondadas por volumes 3D facetados com planos internos, aplica normais planas por face e planos adicionais próprios da anatomia, reduzindo aparência de massinha.
- Preserva as bolsas e cauda do Sevilho e a morfologia escaladora/cauda preênsil do Arbélio.
- `source/capture_real.py` importa o **GLB exportado**, gera frente, perfil, três-quartos e prancha de ambos os modelos; não usa imagens conceituais como prova.
- `.github/workflows/wildhaven-sevilho-arbelio-faceted-v02.yml` gera, verifica e publica binários e imagens ao receber push.

## Limites explícitos

Não é substituição da v01 nem integração à Alpha. Animações são feitas por nós rígidos, **zero skins/ossos ponderados**, sem IK em terreno real nem física. A continuidade dos 11 nomes de clipes não comprova qualidade de cada movimento; exigir inspeção visual, poses extremas e contatos de pé antes de aprovação final.

Apenas marcar publicação depois de verificar os GLBs gerados no repositório. Se Actions falhar, a fonte está disponível, porém os binários desta versão ainda não estarão publicados.
