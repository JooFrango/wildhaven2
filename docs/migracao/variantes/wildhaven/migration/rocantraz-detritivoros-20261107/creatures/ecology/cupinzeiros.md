# Cupinzeiro — recurso ecológico finito (planejamento)

**Estado:** conceito de ecossistema, ainda sem modelo 3D ou integração ao jogo.

O cupinzeiro é uma **estrutura externa simples**, sem interior modelado. Serve como alimento a animais especializados em cupins. Cada colônia possui população persistente `population` e capacidade `capacity`.

## Regras acordadas
1. Um animal especialista se aproxima de um cupinzeiro ativo e consome uma quantidade de cupins, reduzindo a população.
2. Enquanto a população for **maior que zero**, ela cresce novamente com o passar do tempo, respeitando um limite máximo.
3. Se a população chegar **exatamente a zero**, a colônia fica **definitivamente extinta** e nunca mais se recupera, mesmo que o consumo pare.
4. A partir da extinção, o cupinzeiro deixa de fornecer alimento e sua estrutura degrada-se até desaparecer.
5. O tempo de desgaste da estrutura pode variar com chuva, erosão e condições ambientais.
6. O sistema não simula milhares de animais individualmente; armazena população, atividade, integridade e tempo.

### Parâmetros provisórios para balanceamento
- Capacidade ilustrativa: 20.000 cupins.
- População inicial ilustrativa: 12.000–20.000.
- Regeneração: função dependente da população restante (por exemplo, crescimento logístico), somente enquanto `population > 0`.
- Consumo: depende do animal especialista, da duração da alimentação e da população disponível.

Estes números não são taxas definitivas do jogo. A morte de uma colônia **não cria uma reposição no mesmo local**; novas colônias em outras regiões seriam um sistema separado.

**Não alterar `game/alpha01` neste estágio.**
