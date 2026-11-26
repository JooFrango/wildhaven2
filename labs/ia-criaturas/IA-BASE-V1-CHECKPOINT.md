# IA Base V1.0 — checkpoint

**Estado: PRONTA PARA APROVAÇÃO**, com as limitações listadas no fim e a auditoria independente do
Agente 06 ainda por fazer. Testes verdes não substituem essa auditoria.

## 1. GitHub

| item | valor |
| --- | --- |
| branch de consolidação | `release/laboratorio-ia-base-v1` |
| commit base | `126d629de187ec41cd6734e0b26c02865610e676` (cabeça do PR #18) |
| commit de consolidação | `d179794` — todo o trabalho desta operação |
| repositório | `carioca1111/wildhaven-new` |
| merge automático | **não feito**. Nada foi integrado a `main` nem à Alpha. |

### Ancestralidade verificada

`126d629` **contém** as seis branches da evolução do laboratório, confirmado uma a uma com
`git merge-base --is-ancestor`:

| PR | branch | contida em 126d629 |
| --- | --- | --- |
| #1 | `feat/laboratorio-ia-criaturas` | sim |
| #2 | `feat/lab-dunas-subsolo-v01` | sim |
| #11 | `fix/arenoceto-mergulho-visivel-v01` (`a4d3dcf`) | sim |
| #12 | `feat/lab-v6-combate-ecologia-fisica` | sim |
| #17 | `feat/lab-v7-sobrevivencia-ecossistema` | sim |
| #18 | `feat/lab-serpenduna-locomocao-v01` | é a própria cabeça |

A linhagem dos modelos da Serpáduna (PRs #14, #15, #16) entrou por um commit de merge explícito
(`b3043bd`), sem reescrever nenhum dos dois lados. Nenhum commit foi duplicado e nenhuma versão histórica
foi sobrescrita.

### Integridade do repositório

O alerta de objetos ausentes da entrega da Serpáduna ficou **restrito ao clone local de trabalho**.
Verificação: clone limpo do remoto + `git fsck --no-progress` → **sem saída**. A branch do PR #18 roda a
suíte e o build inteiros nesse clone limpo. O clone local ainda acusa 10 blobs quebrados, todos de arquivos
históricos, e nenhum deles pertence a estes commits. Nenhum comando destrutivo foi usado.

## 2. Arquitetura

```
config/eco/especies/*.json   ficha = contrato da criatura (18 espécies)
config/eco/cenarios/*.json   cenário = terreno + populações + clima + decomposição (25)
config/eco/modelos.json      procedência dos GLBs: sha256, frente medida, clipes reais

src/core/      matemática determinística, mundo e percepção da V1
src/eco/       o núcleo: mundo, cérebro, percepção, locomoção, combate, saúde,
               social, relações, clima, carcaça, cupins, veneno, camuflagem, termo,
               voo, subsolo, serpente, engolir, vibrações, níveis, persistência,
               invariantes
src/web3d/     renderizador, animador, controladores visuais (serpente, areia, VFX)
test/          22 arquivos, 185 testes
```

**Regra central:** uma espécie só recebe um sistema se a ficha dela declarar o bloco correspondente.
Nenhum módulo é duplicado por espécie. Cada capacidade opcional tem um teste do tipo *"espécie sem a
capacidade não ganha estado"*.

**Determinismo:** `src/eco/*.js` não pode usar `Math.sin/cos/tan/atan/asin/acos/hypot/exp/log/pow/cbrt`
nem `**`; usa `src/core/matematica.js`. O teste `eco-tecnico` falha se alguém escapar disso.

## 3. Inventário dos módulos

| módulo | estado | observação |
| --- | --- | --- |
| Percepção (visão, audição, olfato) | funcional e testado | `test/percepcao.test.mjs`, `dunas-percepcao` |
| Memória | funcional e testado | memória de criaturas, carcaças, água, experiências |
| Tomada de decisão | funcional e testado | `cerebro.js` + ramos por meio |
| Fome e sede | funcional e testado | |
| Energia e descanso | funcional e testado | |
| Locomoção terrestre | funcional e testado | |
| Navegação | funcional com limitações | A\* caro no subsolo; células intransponíveis geram atrito |
| Colisões | funcional com limitações | corpo da serpente e extremidades de voadores fora da física |
| Saúde e ferimentos | funcional e testado | |
| Combate | funcional e testado | alcance e contato válidos verificados |
| Fuga | funcional e testado | |
| Veneno | funcional e testado (experimental) | carga por dose × potência × massa × região |
| Camuflagem óptica | funcional e testado (experimental) | resultado contra grupos é pior que sem ela — medido, não corrigido |
| Termorrecepção | funcional e testado (experimental) | |
| Voo | funcional com limitações | 3 das 28 espécies têm clipe real de voo; extremidades não colidem |
| Bandos | funcional e testado | medido até 20 voadores |
| Locomoção subterrânea | funcional com limitações | custo de A\* |
| Locomoção de serpentes | funcional com limitações (experimental) | só a cápsula de cabeça colide |
| Reprodução | funcional e testado | ciclo completo sem cenário dedicado |
| Relações sociais | funcional e testado | |
| Clima | funcional e testado | chuva intensa, tempestade de areia, nevasca |
| Alimentação | funcional e testado | |
| Carcaças e decomposição | funcional e testado | ossos desenhados com proxy procedural |
| Persistência e níveis | funcional e testado | contrato corrigido nesta operação (ver §5) |

## 4. Testes

| gate | resultado |
| --- | --- |
| `npm test` | **185 testes, 185 aprovados, 0 falhas** (eram 177 antes desta operação) |
| `node scripts/simular.mjs --sementes 1-30 --falhar-se-erro` | sem falhas nos 6 cenários da V1 |
| `npm run build` | `Build ok → dist/` |
| `npm run paridade` | impressão digital `94df59e1` (180 encontros, sementes 1–30) |
| `node scripts/perfis-modelos.mjs` | 14 GLBs auditados, frente conferida contra a ficha |
| navegador | executado de verdade; ver §7 |

Os 7 testes novos estão em `test/ia-base-v1.test.mjs`.

## 5. Defeitos bloqueantes corrigidos nesta operação

1. **Reação sem percepção (`cerebro-dunas.js`).** O Serracórion resolvia um corpo pela vibração a distância
   de contato e agia sobre ele sem que nada entrasse na memória — o próprio mundo marcava
   `reagiu_sem_perceber` em 2 de 5 sementes. A localização por vibração **é** percepção, então agora ela
   registra o contato em `memoria.criaturas` com `via: 'vibracao'`, que é a marca que `vibracoes.js` já
   esperava. Depois: 0 falhas em 5 sementes.
2. **Memórias perdidas em silêncio ao salvar (`persistencia.js`).** `memoria.cupinzeiros`,
   `memoria.vibracoes` e `atencaoTermica` são `Map` criados sob demanda; o JSON os transformava em `{}` e
   o mundo retomado perdia a memória sem erro. A memória de vibração ainda guarda dois `Set` por pista —
   restaurá-la sem tratá-los quebrava `consolidar` no primeiro passo.
3. **Clima e cupinzeiros não eram salvos.** Uma tempestade em curso sumia ao retomar e os cupinzeiros
   voltavam à população inicial do cenário.
4. **O terreno inteiro era serializado dentro de cada serpente** (`serpente.terreno`). Agora sai no salvar
   e é religado ao terreno do mundo no carregar. Formato da persistência: `versao: 3`.
5. **Nutriente criado do nada na reciclagem da carcaça** (`carcaca.js` e o caminho antigo em `mundo.js`).
   O solo era enriquecido por `carneInicial`, a massa inteira do animal, mesmo quando outros animais
   tinham carregado a carne para longe. Agora vale `materiaLocalKg(c)` = massa inicial − o que os animais
   levaram no corpo; o que apodreceu, o que os insetos comeram ali e os ossos continuam contando.
6. **Capacidade declarada sem o parâmetro que ela exige** (`especies.js`, `pica-termita.json`,
   `ferrunco.json`). As duas fichas declaravam `social.territorial: true` **sem `raioTerritorioM`**. O animal
   nascia com `territorio = { x, y, raio: undefined }`; a simulação não reclamava porque toda comparação com
   NaN é falsa — na prática o território dessas duas espécies **não existia**, embora a ficha dissesse que
   sim — e o renderizador montava o círculo do território (97 vértices, só `position`, z = 0) com x e y NaN,
   que é o `THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN` que a CI pegou no commit
   `2509b83`. Correção na origem: o validador recusa `territorial` sem raio numérico maior que zero, as duas
   fichas (e o gerador que as produz) ganharam o raio, e o invariante passou a acusar `territorio`/`casa`
   com valor inválido. Nenhum aviso foi suprimido.

## 6. Cenário integrado

Dois cenários sobre o mesmo núcleo, porque subsolo exige volume de areia e voadores de savana não vivem
na duna. Forçar tudo num mapa só seria bioma incompatível.

**`ia-base-v1-integracao`** (savana derivada do mapa oficial, 240 × 200 m, 23 animais, 11 espécies):
Velsari em grupo com filhotes, Tarruco, Cromátil, Folhisco, **Frutavil**, Varrisco territorial, Boscaranha
peçonhenta de emboscada, protótipo caçador camuflado, 2 Carnirocas voadoras, Pica-Termita, Ferrunco,
2 cupinzeiros, chuva intensa agendada e ciclo de carcaça com necrófagos.

**`ia-base-v1-integracao-dunas`** (DN-19, 600 × 600 m, 8 animais): Arenoceto, 2 Arraias-de-areia, Escarvão,
Serracórion, Serpáduna de 14 m e 2 Cromáteis de superfície, com tempestade de areia agendada.

Medido em 5 sementes × 1200 s cada (`resultados/ia-base-v1/medicao.json`), **0 falhas registradas em todas
as 10 execuções**. O que apareceu, somado:

| comportamento | evidência |
| --- | --- |
| procurar alimento e água | `busca_abrigo` 20–21, fome/sede evoluem; cupinzeiros consumidos (2988 e 724 de população) |
| predador detecta presa | `caca_inicio` 18–33 por semente na savana |
| presa identifica ameaça | `perigo passou`, `tolera_predador`, sentinelas |
| perseguição → fuga ou captura | `perseguicao_inicio`/`_fim`; `predacao` 1–2 mortes em 3 das 5 sementes |
| dano só com contato válido | `golpe_errou` 6–13, `ferimento` 1–4, `agarrao` 9–17 nas dunas |
| ferimento muda o comportamento | abate da presa ferida no cenário da carcaça |
| gasto de energia e descanso | estados `descansando`/`abrigado` no painel |
| grupos interagem | `cumprimento` 76–217, `limpeza_mutua` 12–230, `sentinela` 27 |
| morte justificada | `predacao`, `engolida` |
| carcaça entra no ciclo | `carcaca_estagio` 3–6, `ossos_reciclados` 1, `necrofagos_chegaram` |
| voador decola e pousa | `decolagem` 38–47, `pouso` 38–49 |
| habilidade respeita limite | `emboscada_armada` 34 contra `emboscada_disparou` 5 e `emboscada_desistiu` 25; `camuflagem_quebrou` 2. O limite anatômico do engolir não apareceu nestas sementes: está coberto por `test/serpaduna.test.mjs`. |

Nas dunas: `mergulho_inicio` 35–204, `emergencia_inicio` 33–204, `investigacao_vibracao` 322–386,
`serpente_enrolou` 1–4 e, na semente 4, a sequência completa de caça da serpente — `inoculacao` →
`ferimento` → `morte (engolida)` → `engolir_fim`.

## 7. Navegador (Chromium real)

`scripts/testar-oficina-navegador.mjs` cobre o cenário integrado além da Oficina e é o que a CI executa
(`npm install --no-save playwright` no passo do workflow, nada no `package.json` do laboratório, que segue
com zero dependências). Aqui ele foi executado **três vezes seguidas** com Chromium headless e swiftshader,
as três aprovadas. As mesmas verificações também foram feitas à mão, com o navegador aberto, em
`http://localhost:5179/ecossistema.html`:

| verificação | resultado |
| --- | --- |
| carregamento do laboratório | cenário integrado sobe com 23 animais, 11 espécies |
| carregamento dos GLBs | **17 modelos** carregados com clipes reais, Frutavil incluída (11 clipes) |
| animação e movimento | 23 de 23 animais mudaram de posição em 200 s |
| combate | `ataque_inicio` 4 em 200 s |
| voo | `decolagem` 2 / `pouso` 5 em 200 s |
| carcaça e alimentação | presa envenenada, morta e **engolida inteira** (semente 4 das dunas, t≈172 s) |
| reinício de cenário | troca savana → dunas sem erro, mundo novo íntegro |
| coordenadas e HP | nenhum NaN |
| erros de console | **0**, em 3 execuções seguidas do smoke test com Chromium real, depois da correção do §5.6 |

Capturas em `resultados/ia-base-v1/evidencias/` — são capturas do renderizador real, não imagens geradas.

## 8. Desempenho

5 sementes × 1200 s simulados por cenário, medido em `scripts/v7-medir.mjs`:

| cenário | animais | p50 | p95 | p99 | pior passo | buscas de caminho |
| --- | --- | --- | --- | --- | --- | --- |
| savana | 23 | 1,8–2,4 ms | 4,0–5,5 ms | 5,1–7,4 ms | 59–169 ms | 57–346 |
| dunas | 8 | 0,22–0,43 ms | 0,57–1,09 ms | 0,75–4,50 ms | 43–185 ms | 0–2 |

O pior passo é de arranque e de busca de caminho, não do regime: um passo isolado no fim de 1200 s custa
**2,46 ms**. Memória: RSS 253–340 MB num processo que acumula as 10 execuções em sequência; não é o custo de
uma simulação. Comparação com a linha de base: `eco-tecnico` exige menos de 5 ms por animal por segundo
simulado e continua passando; nenhuma regressão grave apareceu na consolidação. O A\* subterrâneo segue
sendo a limitação conhecida de custo.

## 9. GLBs usados (procedência)

| espécie | arquivo | sha256 (16) | bytes | clipes |
| --- | --- | --- | --- | --- |
| velsari | velsari/velsari-savanna-optimized-v02-LOD0.glb | f073b93fc3927eb0 | 1135904 | 10 |
| cromatil | cromatil/cromatil-savanna-animated-v01-LOD0.glb | e20a09480c52ad91 | 321120 | 11 |
| tarruco | tarruco/tarruco-savanna-optimized-v02-LOD0.glb | 33e619c3c0d5f01d | 1264452 | 10 |
| varrisco | varrisco/v02/varrisco-animated-v02-LOD0.glb | 774f80944633a65b | 667968 | 17 |
| rocantraz | rocantraz/rocantraz-desert-biped-optimized-v05-LOD0.glb | b2455283afe6a701 | 2570936 | 12 |
| boscaranha | boscaranha/boscaranha-optimized-v02-LOD0.glb | 208218ea188c1bda | 588336 | 22 |
| folhisco | folhisco/folhisco-optimized-v02-LOD0.glb | 0ef862fbb4c24937 | 462504 | 15 |
| proto-cacador-camuflado | varrisco/v02/varrisco-animated-v02-LOD0.glb (proxy) | 774f80944633a65b | 667968 | 17 |
| proto-serpente-termica | gravarto/v02/gravarto-v02-animated-LOD0.glb (proxy) | 848bea01332c9923 | 5365036 | 17 |
| carniroca | carniroca/carniroca-optimized-v02-LOD0.glb | bb074a3822150a9a | 568820 | 25 |
| pica-termita | pica-termita/pica-termita-optimized-v03-LOD0.glb | 810f0b045c7e421c | 1235248 | 18 |
| ferrunco | ferrunco/ferrunco-optimized-v03-LOD0.glb | 0b0efbc4e4ced430 | 1353608 | 16 |
| serpaduna | serpaduna/v03/serpaduna_v03_uncoiled_rigged.glb | 4591ad59b0ec8a75 | 1649172 | 13 |
| **frutavil** | frutavil/frutavil-savanna-animated-v01-LOD0.glb | 91f8c8d150ea70db | 248540 | 11 |
| arenoceto | arenoceto/v02/arenoceto-v02-skinned-animated-LOD0.glb | 2c70d4c14c7fa614 | 1588096 | 20 |
| arraia-de-areia | arraia-de-areia/v03/arraia-de-areia-v03-rig-animated-LOD0.glb | c6d20ba62d51632d | 5607416 | 22 |
| escarvao | escarvao/v02/escarvao_cobre_rig_anim_v02.glb | cef2ac4d2ba20cfc | 1959516 | 18 |
| serracorion | serracorion/v03/serracorion-v03-rig-animado-LOD0.glb | b12a9c509b9f7c3f | 3571696 | 20 |
| dunébrio (necrófago) | detritivoros/dunebrio-optimized-v02-LOD0.glb | adcd46b3b9ca238a | 331764 | 7 |

**Nenhum GLB foi alterado, substituído ou apagado.** Todos são lidos.

## 10. Contrato de criaturas

O formato está em [`docs/COMO-ADICIONAR-CRIATURA.md`](docs/COMO-ADICIONAR-CRIATURA.md). A prova de que ele
é reutilizável é a **Frutavil**: espécie real do catálogo (`creatures/species/frutavil.json`), com GLB
próprio, que entrou com **um JSON e uma linha no índice**, sem nenhuma mudança em `src/`. Ela não declara
capacidade opcional nenhuma — nem voo, apesar de ser uma ave, porque o GLB só tem `short_flight` e o
laboratório não finge um controlador que não existe. O teste verifica que ela não recebeu estado de veneno,
camuflagem, voo, subsolo nem serpente, e que o cérebro compartilhado decide por ela sem código próprio.

## 11. Critérios de aceitação

| critério | situação |
| --- | --- |
| PRs auditados e ancestralidade correta | **ok** (§1) |
| integridade do repositório verificada | **ok** (§1) |
| suíte automatizada passando | **ok** — 185/185 |
| build passando | **ok** |
| cenário integrado em múltiplas sementes | **ok** — 5 sementes, 2 biomas, 0 falhas |
| sem falha crítica conhecida no núcleo compartilhado | **ok** — as 5 da §5 foram corrigidas |
| persistência e restauração verificadas | **ok** — hash idêntico + Maps e clima preservados |
| inclusão de espécie padronizada e testada | **ok** — Frutavil |
| navegador executa cenário real sem erro crítico | **ok** — GitHub Actions verde |
| desempenho documentado | **ok** (§8) |
| limitações por espécie registradas | **ok** — `modelo.limitacoes` em cada ficha + pendências |
| arquivos publicados no GitHub | **ok** — branch `release/laboratorio-ia-base-v1` |
| Agente 06 recebeu a entrega | **pendente** — é o próximo passo, fora do alcance deste trabalho |

## 12. Problemas conhecidos

Lista completa em [`docs/PENDENCIAS-IA-FUTURAS.md`](docs/PENDENCIAS-IA-FUTURAS.md). Os que mais importam:
corpo da serpente não colide (só a cabeça), extremidades de voadores não colidem, A\* subterrâneo caro,
cauda imóvel em 11 dos 13 clipes do GLB da Serpáduna. O erro de geometria NaN que estava em aberto foi
reproduzido pela CI, teve a causa achada e corrigida (§5.6).
