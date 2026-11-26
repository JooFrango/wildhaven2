# Quedravo v01 — Caçador das Escarpas

**Estado:** arte conceitual aprovada; blockout anatômico GLB real aguardando aprovação específica da forma. Sem rig, skin ou clipes.

## Arquivos
- `quedravo_v01_blockout.glb`: corpo, cabeça, bico, garras, plumas estruturais e grandes asas abertas, UV pintada embutida.
- `quedravo_v01_uv_atlas.png`: atlas externo de origem também embutido no GLB.
- `source/build.py`: gerador autoral, cria GLB e manifesto.
- `source/render.py`: importa o GLB exportado usando `vtkGLTFImporter`, gera vistas reais.
- `source/validate.py`: reimporta glTF, verifica geometria, UV, dimensão, textura, clipes e SHA-256.
- `previews/`: perfil, frente, 3/4 e prancha.
- `manifest.json` e `validation.json`: evidências mensuráveis do GLB.

## Anatomia e ecologia (propostas, não gameplay implementado)
- Predador territorial de cumeeiras; grandes térmicas e voo planado com envergadura aproximadamente 11 m.
- Estatura empoleirado do dorso/cabeça cerca de 2.8–2.9 m; pontas alares elevadas até 4.17 m no blockout.
- Duas pernas fortes, três dedos anteriores e um posterior por pé, unhas curvas para agarrar e prender pequenas e médias presas, soltar sobre rochas e se alimentar após a queda.
- Consome carcaças e frutas ocasionalmente. Massa 90–140 kg é **estimativa fictícia**; a capacidade de voo com carga depende de futura simulação e não foi verificada.
- Crânio com bico em gancho, penacho, rufos cervicais claros e plumagem carvão/roxo-escuro.
- Asas separadas anatomicamente por úmero, antebraço e mão; penas secundárias e primárias têm volume real para silhueta (não usadas meramente para mudar cor).

## Regras e limites
- Estilo facetado das referências Torvardo/Mastélio/Garruva v03. Materiais e marcas somente UV, sem malhas para pintura.
- Nenhuma integração, mapa, caçador ou Alpha alterada.
- Abertura das asas nesta versão é uma pose estática de apresentação. O rig futuro deverá lidar com abertura, dobra, voo e transporte de presa; nada disso está animado agora.
- Não declarar finalizado até revisão da forma, refinamento, rig, animação e Filtro de Qualidade.
