# 07 — Pegadas, rastreamento e otimização para navegador

**Estado: comportamento de rastros CONFIRMADO; arquitetura técnica PROPOSTA para viabilizar a escala do mundo. Somente planejamento.**

## Comportamento visto pelo jogador [CONFIRMADO]
1. Hunters chegam à região de caça **sem conhecer a localização exata da criatura**.
2. Investigam a área à procura de **pegadas inicialmente invisíveis**.
3. **Quando o Hunter encontra** um trecho válido, as pegadas **começam a brilhar em azul no chão**.
4. O Hunter segue o rastro revelado, respeitando terreno, obstáculos e suas próprias capacidades.
5. **Se a criatura passou pela água, o rastro desaparece/interrompe-se**; não criar pegadas atravessando rios/lagos como se fossem piso firme.
6. O Hunter terá de procurar novamente a criatura após perder a pista. O modo exato de recuperar a trilha na outra margem **ainda é uma proposta**, não um comportamento aprovado.

### Regra sem "GPS"
O Hunter não deve saber, por onisciência, onde está o animal só porque a caçada foi iniciada. O mapa do dossiê informa *habitat*, e as pegadas são sinais locais. Não mover o animal à força para coincidir com os rastros, nem inventar pistas onipresentes que garantam toda caçada.

## Problema de desempenho [CONFIRMADO PELO DIRETOR]
**Não encher o mundo de rastros invisíveis**, gerando meshes/objetos/colisores para todas as pegadas de todos os animais. Isso explodiria memória, draw calls, custo de física e atualizações da IA.

## Arquitetura proposta: trilha virtual, gerada por interesse [PROPOSTO]
- **Dados compactos em vez de objetos 3D:** representar uma trilha candidata como poucos segmentos/âncoras de posição, tempo, tipo de solo e ID da criatura, sem materializar pegadas.
- **Escopo local:** manter dados de pegada somente em células próximas a Hunters rastreadores ou missões ativas, e apenas para criaturas relevantes ao ambiente ativo. Fora dessa área, a simulação simplificada guarda o mínimo ecológico necessário; não reproduzir rastros globais detalhados.
- **Amostragem esparsa:** criar/atualizar âncoras quando o deslocamento ou a mudança de direção justificar, não em todo frame, pisada ou triângulo do mapa.
- **Limites rígidos:** orçamento máximo de âncoras por célula/criatura e tempo de expiração (TTL); os números dependem de profiling e não estão aprovados.
- **Índice espacial:** consultar apenas células ao redor do Hunter; nunca varrer todas as criaturas, pegadas e hexágonos.
- **Rastros candidatos não renderizados:** o dado fica invisível como registro compacto, **não como objeto 3D invisível**.
- **Descoberta orientada por percepção:** quando Hunter investiga local e seus sentidos encontram evidência (raio, visão do chão, solo, frescor etc.), converter **apenas as âncoras próximas descobertas** em pegadas visuais temporárias.
- **Efeito azul somente na descoberta:** usar pool de decals/instâncias compartilhadas, sem colisão individual; retirar quando o trecho sair da área relevante, envelhecer ou missão terminar.
- **Água interrompe continuidade:** um trecho que entra na água encerra a sequência rastreável no ponto de entrada; não mostrar uma linha azul atravessando água. Retomar após água requer **nova busca real** e uma nova pista válida, não conexão automática.
- **Persistência seletiva:** guardar missão, último indício e resultados; evitar salvar milhões de amostras de pegadas no arquivo de jogo.
- **Limpeza:** ao encerrar missão, expirar pista ou descarregar área, liberar dados e objetos do pool; impedir vazamentos ao atravessar muitos hexágonos.

## Pipeline sugerido
```text
Movimento animal (simulação local)
        ↓
Amostras compactas, com limite por região/tempo
        ↓
Índice espacial das amostras — sem mesh
        ↓
Hunter procura sinais / percepção local
        ↓
Trecho detectado?
    NÃO → continuar a busca
    SIM → revelar um trecho de pegadas azuis
        ↓
Hunter segue a próxima sequência válida
        ↓
Passagem pela água?
    SIM → interromper pista; voltar à busca
    NÃO → prosseguir até nova evidência/avistamento
```

## Otimização em camadas [PROPOSTO]
- **Distante:** sem simulação geométrica de pegadas. Somente estado simplificado de animais/ecologia.
- **Próximo dos Hunters:** alguns candidatos compactos amostrados em baixa frequência.
- **Trecho realmente descoberto e visível:** desenhar somente as pegadas azuis necessárias.
- **Sem cálculos por frame para cada trilha:** atualizações por evento/interesse e por intervalos compatíveis com IA.
- **Recursos limitados:** quantidade máxima de pegadas renderizadas e custo de CPU/GPU/memória a definir por medição em navegador comum.

## Casos críticos de teste
- [ ] 100+ criaturas circulando **sem Hunter procurando** não geram centenas de meshes invisíveis.
- [ ] 1 Hunter procurando produz consulta **local**, e não varredura de todos os hexágonos.
- [ ] Descobrir uma pista revela **somente o trecho próximo**, em azul.
- [ ] Uma criatura cruza rio/lago: **a continuidade da pista cessa** ao entrar na água.
- [ ] Rastro vencido ou missão cancelada: nenhum objeto residual permanece.
- [ ] Ao atravessar vários hexágonos, uso de memória e custo de draw calls permanecem limitados.
- [ ] O Hunter não recebe informação exata da posição atual da presa sem percebê-la.
- [ ] A lógica de visão/audição/olfato respeita o guia `gameplay/SENTIDOS-E-IA-DE-CRIATURAS.md` do projeto.

## Pendente de decisão
- Quanto dura um rastro em cada bioma/solo, e o que chuva, vento ou neve fazem com ele?
- Os rastros ficam visíveis **para o jogador** até expirar ou só durante a perseguição?
- Identificação de espécie por pegadas antes de confirmar visualmente o animal?
- Como criar indícios recentes em uma área que acabou de entrar na simulação detalhada sem inventar rastro/teleportar animais?
- Como recuperar uma pista na margem oposta da água?
- Valores dos limites de CPU/GPU/memória/TTL: medir, não fixar arbitrariamente.
