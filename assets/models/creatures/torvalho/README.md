# Torvalho — Modelos 3D animados v0.1 (protótipo)

**Criatura 003 · Wildhaven · Produzido em 2026-11-06/07**

O Torvalho foi modelado como **herbívoro bovino de grande porte**, com silhueta inspirada em bois selvagens e bisões: corpo robusto, corcova muscular, juba de mechas geométricas, chifres permanentes curvos, cauda com tufo e cascos fendidos.

**Estado:** dois GLBs reais, esqueleto e animações foram gerados e validados na sessão do ChatGPT, mas **ainda não foram adicionados como binários ao repositório GitHub**. A ficha e o manifesto abaixo são o registro da entrega e não devem ser confundidos com arquivos GLB disponíveis no GitHub. O pacote completo ZIP está disponível como artefato da conversa que o produziu. **A estética do protótipo ainda aguarda aprovação do usuário.**

## Arquivos gerados na conversa

| Modelo | Triângulos | Vértices | Ossos | Clipes | Tamanho |
| --- | ---: | ---: | ---: | ---: | ---: |
| `torvalho_animated_v01.glb` (LOD0) | 33.186 | 18.771 | 23 | 27 | 1.413.784 bytes |
| `torvalho_LOD1_animated_v01.glb` (LOD1) | 12.438 | 7.160 | 23 | 27 | 607.004 bytes |

### Arquivos de produção

- `generate_torvalho.py` — gerador original completo de malhas, rig, skin e animações, baseado em NumPy.
- `validate_glb.py` — valida glTF, matrizes inversas, dados de vértices, pesos e clipes, além de importar o modelo em Trimesh.
- `index.html` — visualizador responsivo com Three.js, controle de animações e seleção LOD0/LOD1, requer servidor HTTP e acesso à CDN.
- `torvalho_preview_v01.png`, `torvalho_actions_contact_sheet.png`, `torvalho_animations_preview.gif`, `torvalho_preview_celular.mp4` — prévias produzidas a partir das malhas animadas.
- `torvalho_manifest.json`, `torvalho_validation.json` — metadados, hash SHA256, resultados dos testes.

### Ações e clipes

`idle`, `walk`, `trot`, `run`, `calf_follow`, `graze`, `chew`, `ruminate`, `sniff_air`, `watch`, `alert`, `alarm_bellow`, `herd_guard`, `stomp`, `charge_windup`, `charge`, `horn_sweep`, `head_toss`, `drink`, `rest`, `sleep`, `dust_bath`, `tail_swish`, `turn_left`, `turn_right`, `hurt`, `death`.

## Verificações efetivamente realizadas

- Ambos os GLBs têm header glTF 2.0 válido e buffers consistentes.
- Os 23 ossos correspondem às skin inverse bind matrices.
- Os vértices incluem normais, juntas e pesos normalizados.
- Os 27 clipes contêm curvas temporais e quaternions válidos.
- Importação de ambos os modelos no Trimesh e renderização estática e de ações via VTK.
- Arquivo ZIP foi testado quanto à integridade.

**Limitações importantes:** skinning rígido por região, ausência de IK de cascos, animações de movimento *in-place*, sem sincronização com colisões, áudio, navegação, IA de manada e lógica de combate. Não é uma integração funcional na Alpha do jogo, apenas um asset técnico animado e visualizador. As proporções e a expressão devem passar por revisão artística antes de serem consideradas finais.

## Próximos passos

1. Aprovar ou solicitar ajustes ao visual atual em relação à [arte conceitual da espécie](../../../../creatures/species/torvalho.md).
2. Enviar os arquivos GLB e scripts originais para esta pasta, confirmando cada hash.
3. Implementar controlador de navegação e animação com velocidades reais, colisões, IK e áudio.
4. Testar LODs e múltiplas manadas no navegador e só então integrar em uma branch própria.

[Manifesto do protótipo](./asset-prototype-manifest.json).
