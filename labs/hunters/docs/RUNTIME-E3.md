# Runtime de animação — etapa E3, primeira parte (transição por inércia e contato de pé)

Etapa E3 do [plano PvE](PLANO-EVOLUCAO-PVE.md), com a E1 aprovada pelo diretor em 2026-11-19.
Status: **validação técnica parcial; aprovação pendente**. Só vista: simulação, dano e IA não mudam.

## Escopo: o que entrou e o que ficou para depois

Esta parte cobre só o que pode ser validado com os clipes que já existem (PvE v01):

| Item da E3 (plano §3.3) | Estado |
|---|---|
| 1. Transição por inércia | **feito** |
| 4. IK de pé lendo `footContacts` | **feito** |
| Defeito `'Neck'` × `neck` (flinch de impacto nunca rodava) | **feito** |
| 2. Espaço de mistura de locomoção, distance matching e stride warping | depois da E4: precisa dos clipes de andar, trote e corrida do rig v13 |
| 3. Início, parada, pivô e giro parado | depois da E4: não há clipes |
| 5. Camadas (metade superior e aditivos) | depois da E4: os golpes da v01 são de corpo inteiro |
| 6. Warping do avanço do golpe | depois da E4: precisa de golpes com avanço |
| 7. Hit-stop e câmera | depois da E4: precisa de contato autorado nos golpes novos |

Fazer os itens 2, 3, 5, 6 e 7 agora significaria escrever código contra clipes que ainda não existem e depois refazê-lo.

## Como ligar

`hunter-lab.html?cenario=jogador-espada&pve1=1&pve2=1`. **Sem `pve2`, nada muda.** O PvP, o PvE v01 aprovado
(`?pve1=1` sozinho) e a Alpha continuam no caminho anterior.

## O que mudou

- `src/inercia.js` (novo): na troca de clipe, guarda o desvio entre a pose que estava na tela e a pose nova.
  O desvio decai por mola criticamente amortecida (λ = 30/s), partindo da velocidade que a pose anterior tinha, e zera
  em 0,20 s (a mistura máxima do contrato). A pose nova toca desde o primeiro quadro: não há instantâneo congelado nem
  dois clipes avaliados ao mesmo tempo.
- `src/animacao-jogador.js`:
  - com `pve2`, a transição usa `inercia.js` no lugar do instantâneo linear de 0,12 s;
  - o IK de pé usa os `footContacts` autorados do clipe, no lugar da regra `fase < 0,62` (que não sabia da fase de voo
    da corrida);
  - o flinch de impacto procura o osso `neck`.
- `src/visual-hunter.js`: lê a flag `pve2` (exige `pve1`).

## Medido

Laboratório real no navegador, `jogador-espada`, semente 1, 30 s, 38 trocas de clipe. Medida: deslocamento da mão
por quadro, em metros.

| | Salto máximo no quadro da troca | p99 fora das trocas |
|---|---|---|
| padrão (`pve1`) | **0,078 m** | 0,223 m |
| `pve1&pve2` | **0,000 m** | 0,257 m |

- O p99 fora das trocas é o movimento normal do golpe. As duas corridas não são idênticas (o relógio do navegador
  muda o desfecho), então a diferença entre 0,223 e 0,257 não está separada do ruído.
- **Não medido:** o salto nos 12 quadros depois da troca com `pve2`. O painel do navegador estava oculto e a página
  pausa a renderização. No padrão esse valor foi 0,282 m (máximo) e 0,073 m (p90).
- Sem erro de console nas duas corridas.
- `test/inercia.test.mjs`: 5 testes. Cobrem a continuidade no quadro da troca, a velocidade inicial igual à da pose
  anterior, o fim em 0,20 s, a queda monótona e o contato de pé da corrida v01 (inclusive a fase de voo).
- `npm test` em `labs/hunters`: **100 passam**.
- `scripts/regressao-pve1.mjs`: impressão digital `6c3fe698…` (igual).

## Pendências

- Medir os 12 quadros depois da troca com `pve2`, com o painel visível.
- Os itens 2, 3, 5, 6 e 7 entram com os clipes da E4.
