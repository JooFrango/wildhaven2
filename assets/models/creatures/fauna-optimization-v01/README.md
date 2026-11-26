# Wildhaven — Global Fauna Optimization v01

This branch starts the repository-wide fauna audit requested for browser performance.

The first executable priority is **Arumbar v03** because its current published model combines about 145k triangles with 287 mesh instances/draw-call candidates and no LOD chain, while its anatomy/design is already defined well enough to optimize without redesigning it.

The pipeline:
- inventories every real GLB under assets/models/creatures;
- does not count species JSON files as modeled animals;
- ranks canonical current assets using triangle count, draw calls and missing LODs;
- preserves the original Arumbar v03 binary;
- batches static geometry under animated parents by compatible material/schema;
- creates LOD0/LOD1/LOD2 with volume-preserving quadric simplification;
- preserves animation sampler data and clip names;
- emits genuine raster renders from exported GLBs, including wireframe and animation poses;
- records structural 10/25/50/100/200-instance benchmarks without inventing FPS;
- never edits world/ or game/alpha01/.

No optimized model is merged into main automatically. Artistic review remains required.
