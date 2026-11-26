# Silvarano — Dossiê de criatura 002

> **Projeto:** Wildhaven · **Mundo:** Auralis · **Revisão:** conceito v0.1 · **Data:** 2026-11-06  
> **Status:** proposta de design detalhada. **Não há modelo 3D, animações ou IA implementados deste animal.**  
> **Objetivo:** estabelecer a espécie de herbívoro reptiliano de **médio porte** que habita **florestas temperadas e tropicais**, como base confiável para arte, rig, animação, simulação e gameplay.

## 1. Identidade

| Item | Definição |
| --- | --- |
| Nome comum | **Silvarano** |
| ID técnico | `silvarano` |
| Registro de fauna | **Criatura 002** (numeração conceitual) |
| Dieta | **Exclusivamente herbívora** |
| Categoria ecológica | Herbívoro folívoro/frugívoro de porte médio; consumidor do sub-bosque |
| Grupo fictício | Réptil quadrúpede, linhagem endêmica de Auralis |
| Habitats | Florestas temperadas, florestas tropicais úmidas, bordas de clareiras e matas ciliares |
| Sociabilidade | Grupos frouxos de 3 a 7, com eventuais indivíduos solitários |
| Papel | Consumidor de folhas e brotos, dispersor de sementes e presa para grandes predadores |
| Agressividade | Baixa em rotina; defesa física quando encurralado ou protegendo filhotes |
| Referências | **Ecologia/porte dos cervos** e **anatomia reptiliana**, sem reproduzir espécie de outra franquia |

**Princípio de design:** o animal não deve parecer um cervo recoberto por escamas. Sua fisiologia, silhueta craniana, patas, forma de comer, cauda e termorregulação devem deixar inequívoco que é um réptil original.

## 2. Anatomia e silhueta

### Dimensões (adulto; estimativa de design)

| Dimensão | Intervalo proposto |
| --- | ---: |
| Altura do dorso na região dos ombros | 1,15–1,35 m |
| Comprimento total, focinho à ponta da cauda | 1,90–2,30 m |
| Massa | 110–170 kg |
| Cauda | 0,55–0,85 m, incluída no comprimento total |
| Envergadura visual da coroa craniana | Variável, menor nas fêmeas e juvenis |

**Anatomia:** quatro membros alongados e musculosos, com articulações discerníveis; dedos separados e garras córneas curtas (não cascos). Membros posteriores mais robustos produzem impulsão de corrida; coluna flexível e cauda contrabalançam curvas fechadas. Pescoço em S discreto, cabeça reptiliana estreita, focinho com borda queratinosa para arrancar folhas e placas trituradoras posteriores apropriadas à dieta vegetal fictícia.

**Pele:** escamas finas sobre flancos, rostro e membros; escudos levemente maiores e discretos na linha dorsal; ventre arenoso com placas largas. Nada de pelagem ou orelhas externas de mamífero: aberturas auditivas pequenas ficam atrás dos olhos. Olhos âmbar laterais, pupila adaptada à iluminação de mata.

**Coroa craniana:** projeções ósseas permanentes envoltas em queratina que lembram galhos ramificados. Não são galhadas de cervo e **não caem a cada ano**. Crescem lentamente com o animal, desgastam-se e podem apresentar fraturas cicatrizadas. Usadas sobretudo em exibição e defesa curta; indivíduos devem ser capazes de transitar entre árvores, por isso a coroa não pode ter amplitude absurda.

**Diferenças individuais:** tamanho geral, ramificação da coroa, idade, marcas faciais, saturação da cor, cicatrizes e pequenas assimetrias. Machos adultos tendem a ter coroas maiores, mas ambos os sexos podem portar projeções. Filhotes nascem com protuberâncias mínimas.

## 3. Coloração e ecótipos

**Base comum da espécie:** dorsal verde oliva e verde-musgo, placas cor de casca e cobre profundo, região ventral bege/areia, olho âmbar e acentos terrosos. Padrão quebrado no flanco reduz silhueta na vegetação; pernas menos saturadas e cauda com bandas suaves.

**Temperado (`silvarano_temperate`):** oliva dessaturado, marrom/cobre e ventre creme; boa leitura sob folhas secas, musgo, pedras e luz quente. A superfície dorsal pode ser um pouco mais espessa, mas sem se transformar em pelagem.

**Tropical (`silvarano_tropical`):** verde folha escura, esmeralda abafado e manchas ocre; contraste discreto em crista e flancos; melhor ocultação na sombra úmida. **São variantes da mesma espécie**, não seres independentes, e os modelos devem compartilhar esqueleto e maioria das animações.

## 4. Habitat e necessidades

- **Preferências:** cobertura vegetal intercalada com pequenos espaços de alimentação, folhas novas acessíveis, água corrente rasa e áreas secas para descanso.
- **Evita:** escarpas verticais, água muito profunda, campos sem refúgio, áreas constantemente ocupadas por grandes predadores.
- **Termorregulação:** por ser réptil, precisa manejar calor. Procura áreas iluminadas ao amanhecer/frio e sombra/água no calor elevado. A temperatura modifica vigor, frequência de alimentação e decisões sem tornar a espécie inativa de modo arbitrário.
- **Transição de bioma:** grupos podem caminhar entre floresta temperada e tropical **pela continuidade real do mapa**; não há teletransporte nem desaparecimento ao cruzar hexágonos.
- **Dieta vegetal:** folhas largas, brotos tenros, samambaias jovens, flores, frutos caídos e casca macia em escassez. **Não come insetos ou carne.**
- **Consumo de recurso:** a vegetação possui disponibilidade e regeneração. Quando a área empobrece, os indivíduos mudam rotas, gerando trilhas e deslocamentos.

## 5. Sentidos — diferenças por espécie

| Sensor | Proposta inicial | Condições |
| --- | ---: | --- |
| Campo horizontal de visão | **290°** | 70° de zona cega aproximada atrás |
| Detecção visual de alvo em movimento | **até 45 m** | Linha de visão, luz e contraste favoráveis |
| Detecção visual de alvo imóvel | **até 18 m** | Reduzida por camuflagem e obstrução |
| Audição | **alta; referência 38 m** | Som diminui com distância, vento e cachoeiras |
| Olfato | **moderado; referência 25 m** | Gradiente de odor, direção do vento, chuva e tempo |
| Reação | Rápida para ameaça clara | Limiar varia por experiência, idade e temperamento |

**Regras críticas da IA:**

1. Visão usa posição da cabeça, arco de percepção e linha de visão física. Arbustos densos, troncos e acidentes do terreno podem obstruir.
2. Audição capta eventos sonoros com localização aproximada, **não** transfere posição exata de alvos invisíveis.
3. Olfato utiliza fontes, rastro e vento; não funciona como radar de 360°.
4. Sons de alarme propagam-se por distância e ruído ambiente. Animais do outro lado de uma montanha não recebem alerta mágico.
5. Memória guarda último avistamento com confiança que decai, e pode levar a falso alarme ou exploração cautelosa.
6. Todo alcance é **parâmetro inicial para testes**, não representação científica de um réptil real.

## 6. Locomoção

| Ação | Velocidade inicial de gameplay |
| --- | ---: |
| Andar | **1,4 m/s** |
| Trotar | **3,2 m/s** |
| Corrida de fuga | **11 m/s**, até ~8 s |
| Arrancada emergencial | Pico próximo de **12 m/s** por poucos segundos |
| Salto vertical útil | ~**1,1 m** em condições favoráveis |

A corrida precisa ter frenagem, aceleração, inclinação lateral, movimento de cauda e atenção a obstáculos. Não deve correr eternamente na velocidade máxima. Corridas curtas elevam calor e fadiga; em frio extremo (para seu micro-habitat) as arrancadas perdem eficiência.

Travessia de água: **riachos rasos**, com passos lentos e inspeção do leito. Não presumir capacidade de nadar em rios largos sem um módulo de nado implementado. Obstáculos altos são contornados por navegação válida.

## 7. Estrutura social e comunicação

- Grupos mistos e frouxos de **3–7**; parentescos e afinidades influenciam quem segue quem.
- Fêmeas e juvenis mantêm vínculos mais estáveis; adultos machos podem permanecer solitários em parte do ciclo anual.
- Sem líder artificial fixo: um indivíduo experiente pode iniciar fuga, deslocamento ou acesso à água; os demais decidem segundo percepção própria.
- Comunicação: assobio grave e curto de alerta, estalos/roncos suaves para contato, posturas com a coroa e a cauda.
- Interações: inspeção olfativa curta, aproximação, disputa ritualizada com exibição lateral e afastamento.
- Indivíduos não compartilham a localização perfeita de predadores; reagem ao chamado e procuram confirmar o estímulo.

## 8. Máquina comportamental sugerida

| Estado | Gatilho | Ação | Saída |
| --- | --- | --- | --- |
| `browse` | Fome e vegetação acessível | Seleciona folha/broto, inclina pescoço, mastiga | Saciedade, ruído ou ameaça |
| `forage` | Recursos locais escassos | Caminha entre manchas vegetais | Alimentação encontrada |
| `drink` | Sede e água segura | Baixa cabeça, ingere água | Sede resolvida ou perigo |
| `thermoregulate` | Desconforto térmico | Procura sol ou sombra | Temperatura adequada |
| `vigilance` | Vigilância basal | Para, ergue a cabeça e observa | Segurança ou estímulo |
| `freeze` | Estímulo suspeito | Fica imóvel e orienta cabeça | Alarme ou retorno |
| `alarm` | Perigo confirmado | Vocaliza; grupos próximos podem reagir | Fuga ou proteção |
| `flee` | Ameaça imediata | Corre para cobertura usando rota segura | Distância suficiente |
| `regroup` | Ameaça cessou | Procura parceiros por visão e som | Contato restabelecido |
| `defend` | Sem fuga/filhotes ameaçados | Exibição, coice, cabeçada curta | Ameaça afasta ou fuga abre |
| `rest` | Cansaço, segurança | Deita/repousa e vigia intermitente | Necessidade/ameaça |
| `social_display` | Época reprodutiva | Exibe a coroa, posturas e aproximação | Disputa ou parceiro |
| `nest_guard` | Ninho ativo | Mantém distância de segurança e alerta | Mudança de turno/ameaça |

**Exemplo:** Silvarano come folhas → ouve galhos quebrando → congela → examina o setor com audição + visão → detecta predador em movimento → vocaliza → escolhe rota entre árvores → dispara → reagrupa quando o risco cai. Se um filhote ficar isolado, um adulto pode arriscar uma demonstração defensiva, conforme temperamento.

## 9. Reprodução e ciclo de vida

**Escolha criativa:** **ovíparo**. A espécie deposita poucos ovos grandes, com casca rígida e padrão terroso, em ninho de folhas/solo abrigado. Reprodução deve usar a escala de tempo do jogo, a ser definida, não dias reais necessariamente.

- Pares podem se formar na época de reprodução após exibições da coroa.
- Ninhos ficam ocultos em vegetação e leve elevação do terreno; adultos podem se revezar nas proximidades.
- Lote pequeno (proposta: **1–3 ovos**); incubação conceitual **35–45 dias do mundo**, sujeita a balanceamento e escala temporal.
- Filhotes saem com pernas relativamente longas, cauda mais fina, coroa rudimentar e marcações de camuflagem; seguem o grupo e se escondem.
- Fases propostas: **ovo → filhote → juvenil → adulto → senescente**.
- Maturidade conceitual próxima de **1 ano do mundo**; mortalidade, reprodução e sazonalidade precisam ser calibradas para não produzir superpopulação.

Evitar crescimento visual instantâneo: usar variantes escalonadas ou escalas progressivas com rig consistente.

## 10. Relações ecológicas e persistência

**Consumidor:** desbasta folhas e brotos em áreas de forrageio, podendo alterar regeneração localizada. **Dispersor:** consome frutos e deposita sementes via sistema de resíduos/ecologia (simulação agregada distante). **Presa:** sustenta grandes carnívoros; filhotes sofrem maior risco de predadores menores. **Competidor:** disputa brotos e água com outros herbívoros médios.

A presença de um predador deve alterar as rotas, horários e agrupamentos com consequências persistentes: mais vigilância, menos tempo de alimentação e deslocamento para áreas seguras.

**Fora da câmera:** animais importantes preservam ID, atributos, vínculos, estado de saúde e última posição; grupos distantes usam atualização por intervalos e balanço de recursos, sem simular todas as articulações. Mudanças na população devem ser consequência da simulação, não respawn sem justificativa.

**Relação com Folhisco:** podem ocupar a mesma clareira e reagir aos chamados uns dos outros como ruídos ambientais, sem formar uma única manada. O Folhisco usa sementes no solo; o Silvarano explora brotos e folhas mais altas, reduzindo competição direta.

## 11. Vestígios, Hunters e vila

- Pegadas reptilianas de dedos separados; estimativa de **8–11 cm**, ajustável ao rig final.
- Marcas de mordida/corte vegetal, cauda roçando plantas, solo revolvido em bebedouros e marcas superficiais de galhada em cascas.
- Fezes fibrosas e fragmentos vegetais podem indicar direção de deslocamento e tempo aproximado.
- Hunters rastreiam por vestígios, vento, sons e histórico ecológico, nunca por posição de IA onisciente.
- Materiais de caça propostos: couro escamado leve, carne, osso da coroa e escudo dorsal (raridade dependente de qualidade). Equilibrar economia com conservação da espécie.
- Ausência prolongada pode indicar pressão de caça ou mudança ambiental; não criar missões obrigatórias para cada deslocamento.

## 12. Direção de arte e produção 3D

### Silhueta inegociável do conceito

- Corpo quadrúpede fino e firme, com cintura escapular e coxas fortes.
- Pescoço longo, cabeça escamada reptiliana e olhos laterais.
- **Quatro patas com dedos e pequenas garras; nunca cascos de cervo.**
- Cauda reptiliana real, articulável, essencial para pose e corrida.
- Placas escamadas sobrepostas discretas, **não armadura grossa**.
- Coroa craniana orgânica e assimétrica, de osso + queratina, sem repetir um modelo de galhada real.
- Duas variantes regionais usando **a mesma malha-base e rig** sempre que possível.
- Materiais físicos simples, malhas mid-poly reais, texturas usadas para cor/detalhes finos e não para simular elementos estruturais.

### Guia para modelagem

Vistas necessárias: **3/4 em cena, lateral esquerda, lateral direita, frontal, traseira, detalhes de cabeça, patas, escamas e coroa**. Escala humana e estudo de filhote também são úteis. Priorizar fidelidade de forma antes de superfície.

Esqueleto mínimo sugerido: raiz/quadril, 3 segmentos de coluna, base do pescoço + pescoço + cabeça + mandíbula, 4 cadeias independentes de membros com articulação de tornozelo/dedos, **3–5 ossos de cauda** e controle leve para coroa/placas. Definir pesos e IK somente depois de validar as proporções.

### Clipes planejados

`idle`, `walk`, `trot`, `run`, `sprint`, `turn`, `browse`, `chew`, `drink`, `rest`, `sleep`, `thermoregulate`, `scan`, `freeze`, `alarm_call`, `flee_start`, `jump`, `land`, `regroup`, `social_display`, `head_sweep`, `hind_kick`, `short_charge`, `hurt`, `death`, `nest_guard`, `juvenile_follow`.

**Nenhum clipe está implementado.** A maioria pode ser reutilizada entre variantes; juvenis exigem ajustes de ciclo e velocidade.

**Desempenho:** orçamentos de triângulos, rig e compressão GLB/LOD serão definidos por benchmark no navegador com grupos de Silvaranos e outros animais. Não fixar um orçamento sem medir o cenário real.

## 13. Testes de comportamento e aceitação

1. Grupo de 5 atravessa pequena clareira; nenhum membro atravessa troncos ou flutua sobre desníveis.
2. Um predador imóvel e oculto a 25 m não dispara fuga apenas pela presença no mundo; vento e outros sinais podem mudar o resultado.
3. Um ruído em meio a cachoeira produz menor chance de detecção que o mesmo som em bosque silencioso.
4. Um integrante avista perigo, vocaliza, e somente os que **ouvem** mudam de comportamento.
5. O grupo consegue se dispersar e reagrupar; filhotes procuram proteção sem teletransporte.
6. Em clima frio, o padrão de termorregulação influencia atividade sem gerar paralisia permanente.
7. Cruzar chunks/biomas não duplica nem apaga indivíduos; parentesco e estado permanecem.
8. Recursos alimentares diminuem por consumo e se regeneram segundo dados do mundo.
9. Predador e presa têm resoluções de caça sem certeza absoluta de sucesso.
10. Instâncias distante/visível apresentam resultados coerentes, com orçamento de CPU aceitável.

## 14. Situação dos arquivos e aprovação

O conceito visual foi gerado nesta conversa em 2026-11-06. **A arte binária ainda não foi enviada para a pasta do GitHub**; portanto, `assets.concept` fica `null` na ficha JSON até upload real e verificado. Não há GLB, rig ou animação publicados do Silvarano. A documentação representa o desenho proposto, não uma funcionalidade concluída.

**Próxima revisão:** verificar preferência visual sobre a coroa óssea, corpo e patas; aprovar conceito; criar turnaround em resolução adequada e modelo 3D animado.

Ficha técnica para sistemas: [silvarano.json](./silvarano.json).
