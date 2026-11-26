# Nharuk — Revisão anatômica 3D v0.2

**Wildhaven / Criatura 005 · status: protótipo mid-poly em revisão visual.**

Foram produzidas **duas variantes regionais**, cada uma com **LOD0 e LOD1**, todos em GLB 2.0 real e com os mesmos **27 clipes** e **24 ossos** da v0.1.

## O que mudou na anatomia

- **Tronco remodelado como uma malha contínua:** caixa torácica profunda, cintura estreita, coxas fortes e ombros musculosos, substituindo a sequência de ellipsoides que deixava aparência de partes soltas.
- **Patas digitígradas com articulações anguladas:** cotovelos recuados e punhos avançados nas patas anteriores; joelhos e jarretes reposicionados nas posteriores, com volumes cônicos variáveis, patas acolchoadas e dedos com garras pequenas.
- **Cabeça mais coerente:** crânio em cunha compacta, maçãs do rosto, sobrancelhas, mandíbula independente, focinho encurtado, olhos menores e orelhas menos exageradas.
- **Pescoço e pelagem:** musculatura do pescoço remodelada, crista mais discreta, marcas angulares projetadas na superfície do corpo e cauda gradual com penacho geométrico.
- **Silhuetas regionais:** Nharuk-da-Sombra permanece menor, oliva-escuro, e Nharuk-dos-Campos maior e cobreado.

## Malhas geradas

| Arquivo | Triângulos | Vértices | Juntas | Clipes |
|---|---:|---:|---:|---:|
| `nharuk_tropical_animated_v02.glb` | 20.752 | 11.646 | 24 | 27 |
| `nharuk_tropical_LOD1_animated_v02.glb` | 9.378 | 5.451 | 24 | 27 |
| `nharuk_temperate_plains_animated_v02.glb` | 20.752 | 11.646 | 24 | 27 |
| `nharuk_temperate_plains_LOD1_animated_v02.glb` | 9.378 | 5.451 | 24 | 27 |

Detalhes verificáveis: [`nharuk_manifest_v02.json`](./nharuk_manifest_v02.json) (hash SHA256) e [`nharuk_validation_v02.json`](./nharuk_validation_v02.json) (estrutura + importação). Testes também renderizaram poses baseadas em clipes reais.

## Visualizador e reprodução

- [`index.html`](./index.html): visualizador Three.js, disponível em navegador/celular servido via HTTP.
- [`generate_nharuk.py`](./generate_nharuk.py): gerador procedural do modelo e animações, requer NumPy.
- [`validate_glb.py`](./validate_glb.py): valida os quatro arquivos, requer NumPy, Trimesh e jsonschema.
- [`render_nharuk.py`](./render_nharuk.py): prévia com VTK/SciPy/Pillow e ffmpeg para MP4.
- [`nharuk_anatomia_antes_depois.png`](./nharuk_anatomia_antes_depois.png): comparação visual antes e depois.

**Execução local:** na pasta dos arquivos, `python -m http.server 8000` e abra `http://localhost:8000`. É necessária conexão à CDN do Three.js.

## Limitações ainda abertas

A v0.2 melhora as formas, mas **não é escultura orgânica de qualidade final**. O skinning continua rígido por segmentos; sem IK de apoio, blendshape facial, suavização avançada de juntas, root motion, colisão/combate ou IA ecológica. As 27 ações continuam sendo curvas in-place, não garantem contato correto das patas no terreno. Aprovação visual ainda pendente.

**Publicação:** versão nova em `assets/models/creatures/nharuk/v02/`; preservar os arquivos v0.1 anteriores na pasta superior, sem sobrescrever.
