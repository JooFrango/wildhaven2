# Wildhaven — quatro répteis herbívoros do deserto, v02 animados

Novos assets animados de **Caudraco, Lajurim, Cornévio e Fossário**, derivados diretamente dos GLBs estáticos texturizados v01. Os originais **não são sobrescritos**.

## Identidade e movimentos

Cada espécie tem 16 clipes: `idle`, `walk`, `trot`, `flee`, `turn_left`, `turn_right`, `alert`, `sniff`, `forage`, `feed`, `drink`, `rest`, `hurt`, `death`, além de duas defesas específicas:

- **Caudraco**: `tail_sweep`, `burrow_block` — golpe da cauda espinhosa e bloqueio defensivo da toca.
- **Lajurim**: `wedge_brace`, `flatten` — travamento lateral e achatamento do corpo em fendas.
- **Cornévio**: `inflate`, `horn_threat` — expansão volumétrica e exposição dos chifres.
- **Fossário**: `dig`, `tail_decoy` — escavação com garras e distração com cauda.

Skinning **real** em `JOINTS_0`/`WEIGHTS_0` com 26 juntas, uma `skin` e matrizes inversas; interpolação por quaternions/keyframes no GLB. Malhas e UVs são derivados da geometria v01 sem alteração. Atlas 2048×2048 pintado incorporado exatamente; nenhuma mancha modelada com polígonos extras.

### Evidências e reprodução

`source/build.py` exporta os GLBs, `source/render.py` reimporta o binário e produz três renders e GIFs a partir do skinning do **GLB exportado**, `source/validate.py` audita o arquivo e a preservação de textura.

```bash
python source/build.py --species caudraco lajurim cornevio fossario
python source/render.py --species caudraco lajurim cornevio fossario
python source/validate.py --require-previews
```

Na CI do repositório, `WILDHAVEN_CREATURE_ROOT` aponta à cópia somente-leitura dos arquivos `v01` dos dois membros do lote, e `WILDHAVEN_V02_ROOT` aponta ao destino `assets/models/creatures`.

## Estados e limites

- **Produção**: 4 GLBs v02 animados e três GIFs por espécie, um por `walk` e dois movimentos defensivos.
- **Técnica**: hash SHA-256, bytes, 16 clipes, 26 juntas, original v01 e textura verificados; movimento mensurável nos 16 clipes após reimportar o GLB.
- **Arte**: v02 em **revisão**, não aprovada automaticamente por testes técnicos.
- **Publicação**: GitHub branch + PR por lote de duas espécies, enquanto aguarda aprovação artística; nenhum merge automático.
- **Gameplay**: NÃO integrado à Alpha. Animações in-place, sem IK de solo, colisões, IA ou simulação de alimentação/reprodução.
- **LODs**: nesta revisão somente LOD0 animado; LOD1 e LOD2 pendentes de decisão depois da revisão de forma/animação.
- **Forma**: v01 preservada; nenhuma alteração na anatomia deliberadamente ainda bloqueada em revisão artística.
