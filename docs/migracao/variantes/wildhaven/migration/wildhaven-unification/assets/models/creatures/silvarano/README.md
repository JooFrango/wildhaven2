# Silvarano — modelos 3D animados v0.1 (protótipos)

**Data:** 2026-11-06 · **Espécie:** `silvarano` · **Status visual:** não aprovado, aguardando revisão.

Foram criados **dois GLBs reais** da criatura de médio porte, um para floresta temperada e um para floresta tropical. Cada GLB contém **17.640 triângulos**, **10.352 vértices**, **21 articulações**, **25 materiais** e **28 clipes de animação**.

## Arquivos já produzidos — armazenamento ainda pendente

- `silvarano_temperate_animated_v01.glb` — 816.616 bytes.
- `silvarano_tropical_animated_v01.glb` — 816.604 bytes.
- `generate_silvarano.py` — fonte procedural e autoria da malha, rig e clipes.
- `index.html` — visualizador interativo mobile/desktop com seleção de variante e ação.
- `silvarano_preview_celular.mp4` e `silvarano_animations_preview.gif` — prévias animadas.
- `validate_glb.py`, `silvarano_manifest.json`, `silvarano_validation.json` — verificação e metadados.

**Importante:** estes arquivos físicos foram criados e fornecidos em um pacote ZIP na conversa com o ChatGPT, **mas ainda não foram enviados para este repositório**. Esta pasta contém apenas documentação até que o upload binário seja confirmado. Não apontar assets de runtime para GLBs inexistentes no GitHub.

## 28 ações

`idle`, `walk`, `trot`, `run`, `sprint`, `turn_left`, `turn_right`, `browse`, `chew`, `drink`, `rest`, `sleep`, `thermoregulate`, `scan`, `freeze`, `alarm_call`, `flee_start`, `jump`, `land`, `regroup`, `social_display`, `head_sweep`, `hind_kick`, `short_charge`, `hurt`, `death`, `nest_guard`, `juvenile_follow`.

## Parâmetros técnicos e qualidade

- GLB 2.0 com `skin`, `JOINTS_0`, `WEIGHTS_0`, IBM e keyframes reproduzíveis; ambas as variantes passaram validação estrutural com importação em Trimesh.
- As animações são **in-place**: deslocamento pelo terreno deve ser controlado por navegação e colisão no jogo.
- Pele/músculos não têm deformação orgânica fina: pesos rígidos por região causam costuras; faltam IK de pés, colisores, áudio, LOD e IA.
- Protótipo procedural, **não** um modelo final esculpido manualmente; precisa de aprovação visual e revisão das ações de corrida, descanso e defesa.
- Mudanças de bioma usam a mesma estrutura anatômica e rig, com paleta de material adaptada.

A integração ao jogo ocorre **somente após aprovação visual**, upload dos arquivos reais e benchmarks no navegador.

Veja também: [dossiê da espécie](../../../../creatures/species/silvarano.md) e [manifesto](./asset-prototype-manifest.json).
