# Wildhaven — Fauna Optimization v05

Fifth optimization batch, limited to two species:

- Velsari v01 -> v02 optimized candidate with LOD0/1/2.
- Torvalho v01 -> v02 optimized candidate with LOD0/1/2.

Velsari uses batching + geometric simplification. Torvalho deliberately preserves its existing mesh/node submission structure because the source already has only ~31 draw calls; its optimization focuses on triangle/byte reduction and completion of a true LOD2 while keeping the original v01 and published LOD1 untouched.

All previews are rasterized from the exported GLBs. No world/gameplay integration is performed.
