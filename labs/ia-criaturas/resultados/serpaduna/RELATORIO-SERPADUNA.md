# Relatório — Serpáduna: corpo estendido e locomoção de serpente

A ordem chama a criatura de **Serpenduna**. Esse nome não existe em nenhum dos dois repositórios. O que
existe é a **Serpáduna**, com três versões (PRs #14, #15 e #16). Trabalhei sobre ela.

## 1. GitHub

| | |
|---|---|
| Branch | `feat/lab-serpenduna-locomocao-v01` |
| Base | merge de `feat/lab-v7-sobrevivencia-ecossistema` (PR #17) com `feat/serpaduna-uncoiled-v03` (PR #16) |
| Por que o merge | as duas linhagens eram separadas: o laboratório não enxergava os GLBs da serpente, e a branch da Serpáduna não tinha o laboratório. O merge não alterou um único arquivo das duas pontas. |

Nenhum GLB, textura ou manifesto da Serpáduna foi alterado. As versões v01, v02 e v03 estão intactas; o
trabalho novo está todo em `labs/ia-criaturas/`.

## 2. Auditoria: qual era a causa do corpo permanentemente enrolado

Medi os três GLBs com um script novo (`scripts/serpente-auditar.mjs`), que percorre a cadeia da coluna e
mede, quadro a quadro: comprimento de arco, **retidão** (ponta a ponta ÷ comprimento — 1 é reta, perto de 0
é enrolado), curvatura por junta e auto-interseção.

| | v01 | v02 | v03 |
|---|---|---|---|
| Rig | **sem skin** (blockout) | 70 juntas de coluna + 2 faciais | 70 + 2 |
| Retidão em REPOUSO | — | **0,282** | **0,993** |
| Ponta a ponta | — | 3,97 m (corpo de 14,10 m) | 14,04 m (corpo de 14,13 m) |
| Auto-cruzamentos em repouso | — | **749** | **0** |
| Curvatura máxima da coluna | — | 22,7° | 6,0° |

**A causa era a pose de repouso do rig, não a geometria e não os clipes.** A prova está na distribuição: na
v02 **todos os 11 clipes** ficam presos na mesma retidão (0,27–0,29). Um clipe que enrolasse o corpo mudaria
só o seu; aqui o corpo já nasce enrolado e as animações apenas o balançam. O manifesto do PR #16 diz o mesmo
com outras palavras — "v02 was permanently coiled by rest mesh and inverse bind pose" —, e a medição
independente confirma.

**A v03 corrigiu isso**: retidão 0,993, zero cruzamentos, curvatura máxima de 6°. **Não precisei corrigir a
geometria nem criar um GLB novo.** O v03 foi usado como está.

### O que ainda está errado no v03 (medido, não corrigido no GLB)

| Defeito | Medida |
|---|---|
| **A cauda não se move** | amplitude 0 na ponta da cauda em **11 dos 13 clipes** — a onda nasce na cabeça e morre antes do fim |
| `coil_enter` / `coil_exit` afundam | a coluna desce a **−9,3 m** abaixo da origem, e a cabeça anda 13,6 m |
| `coil_defend` afunda | **−3,9 m** |
| Nenhum clipe avança | root motion zero (esperado: todos os GLBs do Wildhaven são in-place) |

Dois são corrigíveis só no GLB e ficam como pendência para o agente de rig. O laboratório contorna os dois
últimos: **o avanço vem do controlador**, e a espiral de enrolar também — a translação dos clipes `coil_*` é
ignorada, e isso está declarado em `modelo.limitacoes` na ficha.

## 3. O que foi implementado — `src/eco/serpente.js`

A ordem é clara: *"não pode se locomover deslizando como um objeto rígido"* e *"a cabeça não deve virar
sozinha enquanto os 15 metros restantes continuam rígidos"*.

**O corpo é uma fila amarrada ao rastro da cabeça.** Quem avança é a cabeça, pelo controlador terrestre que
já existia; os 70 segmentos passam depois pelo mesmo lugar. A ondulação lateral é aplicada **em função do
comprimento de arco** de cada segmento, perpendicular ao caminho — por isso a onda viaja da cabeça até a
ponta da cauda **sem nenhum código que a propague**: é geometria, não script.

Isso dá de graça o que a ordem pede: curvas contínuas, cauda que segue a trajetória, corpo que acompanha o
relevo, comprimento constante e nenhuma parte atravessando outra.

**Simplificação declarada:** a física (colisão, rota, separação) usa o **centro liso** da cabeça; a onda
entra só no corpo desenhado. Numa serpente de 14 m com onda de 0,75 m, isso não muda nenhuma decisão da IA e
evita que a oscilação empurre o corpo para dentro de obstáculos.

### Defeitos reais encontrados e corrigidos durante o trabalho

Cada um apareceu numa medição, não numa inspeção visual:

1. **A serpente não conseguia inverter o rumo.** O giro é proporcional à velocidade (um corpo longo não
   pivota no lugar); parada, ela não girava, e com o destino atrás ficava travada de costas. Agora faz a
   meia-volta andando devagar.
2. **Raio de curvatura fisicamente impossível.** Com 1,6 m, uma meia-volta faria o corpo de 14 m dobrar
   sobre si mesmo. O valor passou a ser derivado: **comprimento ÷ π = 4,5 m**, o menor raio em que uma
   meia-volta não encosta no próprio tronco.
3. **Quina de 65–77° ao parar.** A amplitude da onda caía de 0,76 m a zero num passo e deixava um degrau
   gravado no rastro. Resolvido movendo a onda do rastro para o corpo (o rastro ficou liso).
4. **Cauda colapsando num ponto.** A poda do rastro cortava rente ao comprimento; a curvatura saltava de
   18° para 65° no passo em que um ponto era descartado. Agora guarda 2 m de folga.
5. **Enrolar esticava o corpo 39,6%.** Interpolar entre a reta e uma espiral não conserva o arco. Enrolar
   passou a ser **percorrer uma espiral**: o corpo segue o mesmo rastro de sempre e o comprimento se
   conserva sozinho.

## 4. Testes com o GLB real — `test/serpaduna.test.mjs`

11 testes novos. Todas as medidas saem do passo normal da simulação, do **mesmo corpo que o renderizador
desenha**:

| Teste | Medido |
|---|---|
| Nasce estendida | comprimento **14,13 m**, retidão **1,000**, **0** cruzamentos |
| Linha reta (110 m) | variação de comprimento **0,00%**, curvatura máx **17,2°**, retidão 0,939–1,000, cauda anda **0,279 m/passo** |
| Cauda segue a cabeça | maior desvio do corpo em relação ao rastro: **0,67 m** (a amplitude da onda) |
| Curva de 90° | variação **0,00%**, curvatura **18,1°**, folga mínima **0,89 m**, retidão cai a **0,806** |
| Curva de 180° | variação **0,00%**, curvatura **21,6°**, folga mínima **0,86 m**, retidão cai a **0,546** |
| Duna (amplitude 6 m) | corpo entre **0,00 m** e **0,00 m** do terreno — não afunda nem flutua |
| Enrolar e desenrolar | retidão **0,226 → 0,940**, comprimento varia **0,00%** |
| Sem a capacidade | espécie comum não ganha corpo de serpente |
| Bote, veneno e alimentação | em 12 sementes: **2** inocularam, **2** paralisaram, **2 engoliram** (4,3 kg e 4,1 kg) |
| Limite anatômico | Rocantraz de 3.813 kg recusado (`massa_acima_do_limite`); engolida **não deixa carcaça** |
| Digestão | com `digerindoAte` no futuro, não caça |

**Suíte completa: 177 testes, 0 falhas** (166 antes). `npm run build` ok. Nenhum teste foi enfraquecido.

### Verificações que a ordem pede, e o resultado

- *Cabeça acompanha a direção do movimento* — sim: o rastro é o caminho dela.
- *Cauda com trajetória contínua* — sim, e ela se move (0,279 m/passo); era justamente o que faltava no GLB.
- *Corpo não se atravessa* — 0 cruzamentos em todos os testes; folga mínima 0,86 m nas curvas.
- *Vértebras com deformação excessiva* — curvatura por junta ≤ 21,6° em todos os casos.
- *Deslizamento artificial* — o corpo nunca sai mais de 0,67 m do caminho da cabeça.
- *Penetração no terreno* — 0,00 m na duna de 6 m de amplitude.
- *Clipes produzem movimento real* — o avanço vem do controlador; os clipes seguem no lugar, como todos os
  GLBs do laboratório. Está declarado, não disfarçado.

## 5. Caça com veneno — reusa o sistema da V7

A sequência da ordem está implementada: detecta (visão, **calor** ou vibração) → embosca na cobertura →
bote → morde e inocula **só com contato válido** → solta → espera os sintomas → aproxima quando rendida →
engole inteira se couber → digere.

- **O veneno é o da V7**, sem fork: neurotóxico paralisante, com dose, massa da vítima, resistência, região,
  latência e meia-vida.
- **A mordida não mata.** O dano dos golpes foi reduzido a 3–4 (de 10–14): quem derruba é a paralisia. Uma
  única mordida não é morte obrigatória, como a ordem exige.
- **Engolir tem limite anatômico**: massa ≤ 8% da própria e altura do corpo ≤ 0,7 m. O Rocantraz é recusado.
- Engolida **não vira carcaça** — a biomassa entra no predador.
- Depois de engolir, **600 s de digestão** sem caçar.

Quatro defeitos de combate apareceram e foram corrigidos na origem, todos específicos de corpo longo:

1. O bote era descartado porque o alcance (4,5 m) era menor que a meia-frente da cápsula de 14 m. A cápsula
   de contato passou a ser a **cabeça e o pescoço** (`serpente.capsulaM`), que é o que de fato toca.
2. O bote somava o avanço do corpo ao alcance e passava metros além do alvo. Num bote de serpente **o tronco
   não é lançado**.
3. A emboscada disparava a uma distância fixa e gastava o bote longe demais. Quem embosca de tocaia agora
   **espera o alvo entrar no alcance real do golpe**.
4. A serpente perdia a presa ao escurecer porque a caça só olhava contatos de visão. Quem tem fosseta
   **mantém o alvo pelo calor** — a pista dá posição, nunca espécie.

## 6. Evidências (renderizador real, GLB v03, sem IA)

No navegador, os 70 ossos reais do GLB são dobrados ao longo do corpo simulado, por quadro, depois do
clipe — `src/web3d/serpente3d.js`. O GLB não é alterado.

| Arquivo | O que mostra |
|---|---|
| `serpaduna-vista-perfil.png` | corpo estendido em perfil, 14,13 m |
| `serpaduna-vista-superior.png` | vista superior: corpo contínuo em S sobre as dunas |
| `serpaduna-vista-tres-quartos.png` | três-quartos |
| `serpaduna-vista-enrolada.png` | enrolada (retidão 0,422) |
| `serpaduna-vista-desenrolada.png` | depois de desenrolar (retidão 0,673), mesmo comprimento |
| `serpaduna-1-locomocao-perfil.png` | em locomoção, curvando nas dunas |
| `serpaduna-bote.png` | instante do bote a partir da emboscada |
| `serpaduna-serpenteando.gif` | 40 quadros serpenteando (câmera seguindo) |

## 7. Problemas ainda existentes

| Item | Situação |
|---|---|
| Cauda imóvel em 11 dos 13 clipes do GLB | **no GLB** — contornado pelo controlador, mas o clipe segue errado; é tarefa de rig |
| `coil_enter`/`coil_exit` a −9,3 m | **no GLB** — o laboratório ignora essa translação |
| Corpo longo não colide com outros animais | só a cabeça colide; os 14 m de tronco são visuais e medidos, não são obstáculo |
| Bote erra no cenário B | o ciclo completo está provado em teste (2 de 12 sementes engolem); no cenário aberto o bote ainda erra muito |
| Sidewinding | **não implementado** — a ordem pede "caso combine com sua anatomia", e não há evidência anatômica no GLB para isso |
| Clipes de locomoção in-place | o avanço é do controlador; nenhum clipe novo foi criado |
| Engolir no navegador | medido em teste; não capturei o instante no renderizador |

**Nenhuma animação nova foi criada.** A ordem diz "Não invente um clipe funcional se ele não existir" — os
13 clipes usados são os reais do v03, mapeados na ficha.

## 8. Estado

| Item | Estado |
|---|---|
| Causa do corpo enrolado identificada e medida | **CONCLUÍDO** |
| Corpo estendido | **CONCLUÍDO** (v03, confirmado por medição independente) |
| Serpentear com propagação cabeça→cauda | **IMPLEMENTADO E TESTADO** |
| Curvas de 90° e 180°, dunas, obstáculos | **IMPLEMENTADO E TESTADO** |
| Enrolar e desenrolar | **IMPLEMENTADO E TESTADO** |
| Veneno paralisante e engolir inteira | **IMPLEMENTADO E TESTADO** |
| Dobra dos 70 ossos no renderizador | **VALIDADO VISUALMENTE** |
| Correções no GLB (cauda, coil) | **PENDENTE** — tarefa de rig, registrada acima |
| Sidewinding | **NÃO IMPLEMENTADO** — sem base anatômica |
| Aprovação artística | **PENDENTE** |
