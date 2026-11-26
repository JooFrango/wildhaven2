# Folhisco — Criatura 001 (proposta)

**Classe:** ave terrestre herbívora · **Bioma:** florestas temperadas de Auralis · **Status:** proposta, sem modelo 3D ou gameplay implementado.

## Aparência e escala

Ave inspirada em galinhas selvagens, mas com identidade original: crista de penas em pontas, penas ferrugem e creme para camuflagem, cauda curta em leque, pernas musculosas e olhos grandes laterais. Altura 35–45 cm e massa 2–3 kg são metas iniciais. Modelo 3D futuro: mid-poly com proporções plausíveis, esqueleto simples e animações naturais.

## Nicho ecológico

- Alimentação **vegetal**: sementes, brotos, folhas jovens, frutos caídos e pequenas bagas.
- Procura alimento ciscando com as patas e bico no sub-bosque.
- Atua como consumidor de sementes, potencial dispersor e presa de predadores de floresta.
- Prefere clareiras pequenas, bordas de trilhas e arbustos baixos próximos a refúgios.
- Vive em bandos pequenos de 4–9; separações e reencontros devem acontecer sem teletransporte.

## Sentidos: parâmetros iniciais de simulação

| Sensor | Proposta | Resultado de gameplay |
| --- | --- | --- |
| Visão | Campo horizontal de 300°, 60° de ângulo cego atrás | Detecta melhor alvos móveis; galhos, pedras e árvores bloqueiam a visão |
| Percepção de alvo móvel | Até 30 m em condições favoráveis | Predador em movimento é percebido antes |
| Percepção de alvo imóvel | Cerca de 12 m | Predador camuflado pode surpreender |
| Audição | Boa; até 20 m em condições favoráveis | Detecta sons entre a vegetação; cachoeira/vento dificultam |
| Olfato | Fraco; até ~4 m para pistas próximas | Não detecta ameaças automaticamente através do terreno |
| Corrida | 5 m/s por até 6 s | Fuga curta e rápida; cansado procura abrigo |
| Caminhada | 1,1 m/s | Ciscagem com movimentação lenta e pausas |
| Salto | Até ~0,5 m; não voa | Supera galhos e pedras baixos, evita escarpas e rios fundos |

Valores de design **não são dados biológicos definitivos**. Linha de visão, obstáculos, iluminação e densidade de vegetação deverão modificar as distâncias.

## IA — sequência básica

1. **Ciscar:** procurar sementes/brotos em manchas de recursos; alternar entre passos e bicadas.
2. **Vigiar:** interromper ocasionalmente a alimentação, girar a cabeça e olhar os arredores.
3. **Congelar:** quando um ruído ou movimento é suspeito, parar e procurar a fonte.
4. **Alarmar:** se a ameaça for confirmada, vocalizar e transmitir o alerta aos companheiros que conseguirem ouvir.
5. **Fugir:** correr pela rota navegável mais curta para uma zona com cobertura; priorizar arbustos sem atravessar rios.
6. **Esconder e reagrupar:** aguardar o perigo diminuir e reencontrar o bando de forma plausível.

## Animações mínimas

`idle`, `walk`, `run`, `peck`, `scratch`, `scan_head`, `alert`, `alarm_call`, `jump_flap`, `hide`, `hurt`, `death`.

## Reprodução (proposta futura)

Ovíparo; ninhos ocultos na vegetação baixa e ciclo de ovo/filhote/jovem/adulto. Taxas de postura, incubação e envelhecimento exigem ajuste à escala temporal do jogo e ao equilíbrio populacional.

## Primeiros testes

- Grupo com 6 Folhiscos alimenta-se e se desloca na floresta.
- Lobrapedra atravessa vegetação densa sem visão direta: aves podem ouvi-lo, mas não devem reagir se estiver fora dos alcances e sem estímulos.
- Predador avistado a 20 m: um indivíduo alerta, o bando corre para coberturas diferentes.
- Separação e travessia de borda de chunk não podem duplicar, apagar ou teletransportar animais.
- Escarpas e rios não podem ser atravessados sem navegação permitida.
- O custo de IA deve ser medido com grupos visíveis e grupos simulados à distância.

Ficha executável de dados: [folhisco.json](./folhisco.json).
