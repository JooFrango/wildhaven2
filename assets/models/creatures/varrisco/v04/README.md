# Wildhaven — Varrisco v04 | 41 clipes esqueléticos experimentais

Esta versão **adiciona os 12 clipes restantes** à v03 real. A v02 (17 clipes)
e a v03 (29 clipes) continuam intactas. Não houve substituição de asset,
alteração da Alpha ou integração automática ao jogo.

## O que foi implementado

- **41 clipes reais no GLB v04**: preserva todos os 29 existentes e acrescenta 12.
- Geometria da v02/v03: 2.754 triângulos; esqueleto e skin: 22 juntas / 1 skin.
- Gerador reproduzível sem dependências externas: `source/build_v04.py`.
- Viewer 3D próprio com seleção de clipes, esqueleto e câmera orbital,
  além de controle de velocidade para revisar movimentos em câmera lenta.
- Laboratório ecológico A/B/C: `laboratorio-varrisco.html?modelo=v02`,
  `?modelo=v03` ou `?modelo=v04`. Mantém cenários e sementes.

### 12 clipes novos (v04)

| Categoria | Clipe | Movimento visível | O que NÃO faz sozinho |
| --- | --- | --- | --- |
| Combate | `body_slam` | Agacha, acelera ombros e recupera | Não causa impacto automaticamente |
| Combate | `grab_start` | Abre mandíbula, investe e fecha | Não prende presas sem física |
| Combate | `grab_hold` | Sustenta a postura e resiste | Não mantém vínculo físico |
| Combate | `grab_release` | Solta a mandíbula e recua | Não calcula soltura |
| Ferimento | `hurt_head` | Reação ao golpe na cabeça | Não altera HP |
| Ferimento | `hurt_leg` | Perna cede e corpo compensa | Não calcula mancar |
| Ferimento | `stagger` | Perde equilíbrio e se recompõe | Não aplica atordoamento |
| Ferimento | `fall` | Queda lateral com pose final sustentada | Não substitui contato com terreno |
| Ferimento | `get_up` | Volta gradualmente da pose caída | Não decide quando pode levantar |
| Comportamento | `exhausted` | Respiração, panting, postura baixa | Não altera energia |
| Comportamento | `guard_carcass` | Protege alimento e vigia | Não escolhe território |
| Comportamento | `search_lost_prey` | Fareja e procura pelos lados | Não conhece a posição invisível da presa |

**Total:** 17 clipes v02 + 12 novos v03 + 12 novos v04 = 41.
Cinco clipes legados foram **refinados na v03**. Todos os clipes preexistentes
da v03 foram preservados sem alterações binárias.

## Como reproduzir

```bash
python assets/models/creatures/varrisco/v04/source/build_v04.py
node --test labs/ia-criaturas/test/varrisco-v04-41-clips.test.mjs

cd labs/ia-criaturas
npm run dev
```

URLs (servidor local do laboratório):

- `http://localhost:5180/laboratorio-varrisco.html?modelo=v02`
- `http://localhost:5180/laboratorio-varrisco.html?modelo=v03`
- `http://localhost:5180/laboratorio-varrisco.html?modelo=v04`
- `http://localhost:5180/repo/assets/models/creatures/varrisco/v04/viewer/index.html`:
  verificar a rota `/repo/` do servidor; alternativamente servir a raiz
  do repositório via HTTP e abrir `assets/models/creatures/varrisco/v04/viewer/`.

## Avaliação e limitações

O workflow `.github/workflows/build-varrisco-v04.yml` é responsável por gerar,
validar, versionar e publicar o GLB+manifesto na branch experimental.

As animações são curvas de keyframes procedurais originais, **não** um passe de
animação manual revisado por artista. A contagem de 41 não demonstra por si só
naturalidade biomecânica, ataque coordenado, contato com o chão ou FPS.

**Camada 1:** 41 clipes exportados.
**Camada 2:** IK, compensação e mira do laboratório atual preservados;
validar visualmente os clipes novos com IK e obstáculos.
**Camada 3:** IA ecológica existente preservada; fintas e agarrões têm clipes
disponíveis, mas decisões de usá-los ainda exigem integração tática e testes
de alcance/colisão — não ativar dano pela animação.

Critérios para promoção: validador glTF independente, reprodução Three.js/
Chromium, comparação v03/v04 em mesmas sementes, erros de pé, perfil de CPU/FPS,
contatos reais de mordida/garras e avaliação artística. PR permanece em
rascunho, sem merge ou integração automática na Alpha.
