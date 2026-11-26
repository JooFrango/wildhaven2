# 08 — IA de caçada: furtividade, rodeio montado e armadilhas

**Estado: modalidades de ataque CONFIRMADAS; condições de sucesso, números, animações e balanceamento pendentes. Somente planejamento.**

## Regra-base [CONFIRMADO]
Quando o Hunter **avista a criatura** procurada, **não ataca automaticamente**. Se ela for arisca/fujona, perigosa ou capaz de atacá-lo, o Hunter **monta uma estratégia de caça** baseada no animal e na situação. O jogador continua sem comando direto de movimento/ataque.

## Estratégia A — Aproximação furtiva e ataque montado [CONFIRMADO]
1. Hunter observa a criatura e procura chance de aproximação sem ser visto.
2. **Agacha-se** e avança discretamente na direção de uma posição adequada.
3. Quando está suficientemente perto **sem a criatura perceber**, **salta fisicamente sobre ela**.
4. Permanece **montado sobre a criatura**, em um combate estilo **rodeio**.
5. Enquanto se sustenta, **causa dano com a espada**. O animal continua presente na simulação e pode reagir.

### Para funcionar de modo convincente [PROPOSTO]
- Requer posição, alcance, visibilidade e anatomia compatíveis com a montagem. Não permitir salto/montagem impossíveis em qualquer criatura.
- Usar animação real de agarrar/saltar/segurar/atacar e ancoragem dinâmica de contato com o corpo do animal, sem teleporte nem atravessar malhas.
- Animal tenta se sacudir, correr, colidir com obstáculos ou se defender conforme anatomia/IA.
- Hunter possui risco real de cair e sofrer consequência. Não transformar rodeio em sequência invulnerável ou vitória automática.
- Condicionar a tática à **arma espada** ou a armamento compatível, de acordo com a regra final de equipamentos.
- O resultado pode ser falha por detecção precoce, distância, ângulo, resistência ou reação da criatura.

## Estratégia B — Armadilha + provocação [CONFIRMADO]
1. Hunter **coloca uma armadilha no chão** em local escolhido.
2. Afasta-se ou toma posição de modo a induzir passagem pela armadilha.
3. **Grita/provoca** a criatura para atraí-la.
4. A criatura, se reagir avançando, pode **cair na armadilha**.
5. **Durante alguns segundos**, dependendo do **tipo de armadilha**, o animal fica sem conseguir revidar; o Hunter aproveita a janela para causar dano.

### Reações e durações [PROPOSTO]
- A armadilha deve existir fisicamente na simulação, com posição, área de ativação e condição de disparo.
- Nem todo animal será atraído pelo grito: criaturas ariscas podem fugir, predadores territoriais podem atacar, outras podem ignorar.
- Espécies e tamanhos podem exigir armadilhas apropriadas; tipo define efeito e duração. **Nenhum tempo fixo aprovado.**
- Consumir recurso/armadilha conforme inventário e políticas de crafting que forem definidas.
- A criatura pode evitar ou contornar uma armadilha descoberta; falha não obriga a IA a jogar a criatura no gatilho.
- Evitar ataque impossível durante um estado de armadilha efetivamente imobilizante, mas tratar resistências e recuperações de modo coerente.

## Decisão tática sugerida [PROPOSTO]
```text
Hunter encontrou pistas → seguiu rastro → avistou animal
                                   ↓
                 Avalia agressividade, fuga, porte,
                 visibilidade, terreno, equipamentos,
                 armadilhas, companheiros e risco
                                   ↓
           ┌───────────────────────┴───────────────────────┐
       A: Furtividade                                B: Armadilha
  Aproxima agachado                                 Prepara no solo
  Salta e monta                                     Grita e provoca
  Dano com espada                                   Criatura reage
  Pode ser derrubado                                Pode cair ou evitar
           └───────────────────────┬───────────────────────┘
                         Reavaliar / continuar
                         combate, fugir ou recuar
```

O Hunter **escolhe a estratégia de forma autônoma**; não é garantia de que uma das duas sempre será possível. Outras reações de emergência (fugir, esperar reforço) podem integrar a IA, conforme normas gerais do projeto.

## Integração com sobrevivência e resgate
- O animal precisa manter seus estados de percepção, agressividade e fuga — não virar objeto passivo ao ser alvo.
- Se os Hunters caírem e se configurarem as condições do sistema de resgate, Chad/Nailon podem ser acionados conforme `03-resgate-hunters.md`.
- Um Hunter montado não se torna invulnerável; os riscos incluem queda, ferimento e morte permanente conforme o restante da simulação.

## Critérios de aceitação
- [ ] Ao avistar criatura fujona/perigosa, Hunter observa e escolhe plano, sem carga cega obrigatória.
- [ ] Hunter faz deslocamento agachado e tenta saltar **sem ter sido avistado**.
- [ ] A montagem acontece com animação/contato físicos plausíveis e o Hunter ataca montado **com a espada**.
- [ ] Criatura pode reagir e derrubar Hunter; rodeio não é modo automático de dano.
- [ ] Hunter consegue instalar armadilha no solo e **provocar gritando**.
- [ ] Criatura pode entrar, fugir ou evitar a armadilha, de acordo com IA e situação.
- [ ] Se presa, a criatura não revida durante **uma janela de segundos determinada pelo tipo de armadilha**.
- [ ] Falha do plano resulta em reavaliação, não travamento da IA.

## Pendências
- Quais classes de tamanho e formas anatômicas aceitam rodeio?
- Quais espadas e equipamentos permitem atacar montado?
- Catálogo e duração/efeitos de armadilhas.
- Se o jogador pode autorizar/proibir alguma tática no menu de ordens (sem microcontrole).
- Limites e testes reais de animação física, IK, rig e estabilidade de estados, especialmente contra animais grandes.
