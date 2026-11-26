# Talvero v04 — reconstrução anatômica experimental

**Apenas criatura e animações. Não tocar em mapas, fauna simulada, vila, gameplay ou Hunters.**

## Estado
- Espécie: Talvero, herbívoro de médio porte da savana.
- Versão: v04. **Ainda aguardando aprovação artística**.
- Base de continuidade: v03 preservada; não sobrescrever `talvero-savanna-anatomy-skinned-v03.glb`.
- GLB principal: `assets/models/creatures/talvero/talvero-savanna-anatomy-skinned-v04.glb`.
- Capturas reais VTK: `talvero-real-3d-{side,front,three_quarter}-v04.png`.
- Manifesto: `talvero-manifest-v04.json`, contendo SHA256 e nomes dos clipes.
- Gerador reproduzível: `talvero-v04/source/generate.py`, `base_v03.py` e `base_v02.py`.

## Principais mudanças frente à v03
- Perfil craniano alongado e estreito, com nariz conformado à superfície do focinho.
- Pálpebras, íris, orelhas, linha mandibular e tufos da testa trabalhados em malha real.
- Crina de várias camadas e fios volumétricos 3D, ligada ao esqueleto do pescoço.
- Ajustes na transição de cintura torácica, coxas, abdômen, cores e relevos da pelagem.
- Agrupamento de mechas no exportador para reduzir malhas/draw calls sem perder o rig.
- Mantidas 10 animações GLB: `idle`, `walk`, `trot`, `gallop`, `graze`, `alert`, `flee`, `kick`, `rest`, `death`.

## Executar a geração
Na raiz do repositório:

```bash
python3 -m pip install numpy==2.2.6 scikit-image==0.25.2 trimesh==4.11.1 vtk==9.4.2
xvfb-run -a python3 assets/models/creatures/talvero-v04/source/generate.py
```

O workflow separado gera, valida e publica GLB binário + PNGs VTK + manifesto no branch, sem acessar a Alpha. Abra o visualizador Three.js v04 a partir de um servidor HTTP (ex.: `python3 -m http.server 8000`).

## Limitações que não devem ser confundidas com aprovação
O v04 é um asset 3D original funcional com skinning por pesos e animações, **mas não replica integralmente a arte conceitual**. Em especial cabeça/crina, músculos em movimento, aparência da pelagem e locomoção ainda precisam de refinamento artístico. Os clipes são *in-place*, sem IK completo de solo irregular e sem simulação física. Avaliar a silhueta e a qualidade visual nas capturas reais antes de mesclar.
