# Lagarto-Papagaio v02 — revisão iterativa
Conceito: grande carnívoro quadrúpede da selva, verde e amarelo. V01 preservada. Cada rodada tem GLB, atlas, SHA-256, fonte e renders reais de reimportação.
1. Crânio e mandíbula: cunha, bochecha profunda, olho e sobrancelha. Comparação revelou dentes superiores parcialmente separados.
2. Corpo, patas e cauda: mais massa nas coxas/ombros, curva caudal, dedos maiores e raízes dentárias corrigidas.
3. Faixas amarelas UV, escudos dorsais mais baixos e crista da nuca; comprimento aumentado.
4. Focinho mais afunilado, mandíbula mais profunda, presas e nova resolução do atlas UV (1536x1536). Abertura da boca em pose estática de inspeção.
Final: 4946 triângulos, 5.82 m de extensão longitudinal, 1.63 m de altura; 85 cascas independentes fechadas, sem faces invertidas detectadas, uma malha, um material, sem skin/clipes. Não é uma superfície única soldada; continuidade de junções, volume muscular, detalhe da face e fidelidade artística ainda exigem revisão. A meta de 5000 triângulos foi escolhida como orçamento de blockout, não um novo limite do diretor. Nenhuma mudança na Alpha.
Reprodução: python source/revisar.py (todas as 4 rodadas). Cada uma usa VTK para renderizar a importação do GLB. Comparação artística é qualitativa; não há percentual de fidelidade medido. A comparação local usa a arte original fornecida no chat.
