# Serpáduna — Wildhaven — blockout v01 (aguardando aprovação da forma)

**Referência:** prancha conceitual fornecida e aprovada pelo diretor em 2026-11-12. A informação de 4–7 m da imagem é substituída pela instrução posterior **15 m**. Vive em dunas e desertos; carnívora, predadora de emboscada; inocula veneno paralisante e engole presas inteiras. Nenhuma destas funções de simulação está implementada no modelo estático.

## Arquivos
- `serpaduna_v01_blockout.glb`: GLB real do blockout estático (malhas tridimensionais; unidades em metros).
- `serpaduna_v01_uv_body.png`: imagem-fonte da pintura UV usada no GLB. Cor do dorso, manchas, escamas e placas ventrais **não usam malhas adicionais**.
- `source/build.py`: gerador procedural reprodutível do GLB. Requer `numpy scipy pillow trimesh`.
- `source/render.py`: reimporta o GLB gerado em VTK (`vtkGLTFImporter`) e produz três renders reais. Requer `vtk` e execução em OpenGL/Xvfb quando headless.
- `previews/`: vistas perfil, frente e três-quartos obtidas **do GLB reimportado**, não de IA.
- `manifest.json`: métricas, status e SHA-256 local.

## Anatomia e solução para movimentos naturais

O **corpo principal é uma única malha contínua** criada com anéis transversais de 16 lados, orientados por referencial local ao longo da linha central; as costuras UV duplicam vértices coincidentes nas bordas da textura. Este modelo não usa uma cadeia de esferas/cápsulas desconectadas, peças sobrepostas para manchas, nem um rig rígido de articulações esparsas. A cabeça e a mandíbula são partes anatômicas distintas para a futura abertura durante captura/ingestão.

### Recomendação para a próxima etapa (NÃO implementada)
1. Retopologia/otimização da malha principal para deformação, em especial na junção cervical e ventre; diagnosticar possíveis problemas de auto-intersecção durante enrolamento.
2. Esqueleto axial distribuído, com aproximadamente 60–85 articulações ao longo dos 15 m (estimativa de design), mais controles próprios para crânio e mandíbula. Pesos de pele graduais sobre 3–4 articulações vizinhas, distribuídos longitudinalmente; evitar pivôs rígidos desconectando anéis.
3. No editor autoral, usar spline IK/B-Bones para construção de poses; **exportar keyframes de rotações e posições para GLB**, pois IK procedural de Blender não é transferido automaticamente pelo glTF. No jogo, oferecer controlador de ondulação lateral com ondas que se propagam da cabeça à cauda e restrições de contato ventral com solo deformável.
4. Separar comportamentos: ondulação lateral, rastejo lento, locomoção retilínea em aproximação, enrolamento, postura de alerta com cabeça elevada, escavação superficial, ataque venenoso, reaproximação e deglutição. Alimentação deve lidar com dimensões reais da presa; não usar transformação visual instantânea.
5. Simulação de veneno em gameplay deve ter latência e intensidade variável por presa, com queda de mobilidade antes da paralisia; o sistema de rastreio e ingestão dependerá da integração posterior, não desta arte.

## Estado da revisão
- **Arte conceitual:** aprovada pelo diretor.
- **Blockout v01:** pronto tecnicamente; **forma ainda não aprovada**.
- **Rig/skin:** zero (não confundir o design de movimento com sistema implementado).
- **Animações/clipes:** zero.
- **LOD1/2:** não criados na etapa blockout.
- **Integração na Alpha:** não realizada.

Após aprovação da forma: refinar rosto, relevos de escamas, bordas do ventre e material, validar a seção cervical sob flexão e só então realizar rig e animações. Não substituir arquivos de outras versões.
