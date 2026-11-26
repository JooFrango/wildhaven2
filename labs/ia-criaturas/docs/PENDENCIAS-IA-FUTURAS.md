# Pendências de IA para depois da V1.0

Nada aqui foi executado nesta operação, e nada aqui bloqueia o núcleo. É a lista do que ficou medido,
registrado e adiado. Cada item diz onde o problema está e como se vê que ele existe.

## Rigs e assets individuais

| pendência | onde | evidência |
| --- | --- | --- |
| Serpáduna: cauda imóvel em 11 dos 13 clipes do GLB | no GLB v03 | `node scripts/serpente-auditar.mjs` — amplitude 0 nas juntas traseiras; o controlador contorna, o clipe segue errado |
| Serpáduna: `coil_enter`/`coil_exit` afundam a −9,3 m | no GLB v03 | mesma auditoria; o laboratório ignora essa translação |
| Frutavil: rig por pivôs, sem pesos de skinning | no GLB v01 (manifesto oficial) | `scripts/auditar-glb.mjs` → `ossos 0` |
| Clipes no lugar (sem root motion) na maioria das espécies | nos GLBs | `config/eco/modelos.json` → `rootMotion: 0` |
| Ossos reciclados desenhados com proxy procedural | `src/web3d/v7-3d.js` | não existe GLB de esqueleto |

## Física e colisão

- **Colisão corporal da serpente.** Só a cápsula de cabeça/pescoço (`serpente.capsulaM`, 2,6 m) participa da
  física. Os outros ~12 m são visuais e medidos, mas não são obstáculo: nada esbarra no tronco dela.
- **Extremidades dos voadores.** A colisão do voador é o corpo, não a envergadura. Asa não encosta em nada.
- **Células intransponíveis.** No mapa derivado da savana há `preso` 39–252 vezes por execução de 1200 s,
  sempre instantâneo (nenhum bloqueio contínuo passou de 0,0 s em 1200 s, semente 3). É atrito de rota,
  não prisão.

## Desempenho

- **A\* subterrâneo é caro** e continua sendo o pior passo do núcleo. Nenhuma regressão nova (ver o
  checkpoint), mas a otimização segue pendente.
- **Bandos grandes.** Medidos até 20 voadores. Acima disso, não há medida.

## Comportamento e balanceamento

- Taxa de acerto do bote em campo aberto é baixa; as decisões são coerentes, o acerto é que é raro.
- Camuflagem ativa **piora** o resultado contra grupos (medido na V7: 20% contra 40% de abates). Está
  registrado como resultado contrário à expectativa, não corrigido.
- Reprodução acontece, mas o ciclo completo (gestação → nascimento → desmame) não tem cenário dedicado.

## VFX e apresentação

- Sangue e ferimentos visuais não persistem no corpo nem no chão além do pool de partículas.
- Não há GIF nem captura automatizada do ciclo da carcaça.

## Integração

- **Mapa completo e Alpha.** O laboratório roda em terrenos derivados do mapa oficial, mas nada foi
  integrado a `game/alpha01/`. Essa ponte é uma operação própria.
- **Hunters, equipamento e combate do jogador.** Fora do escopo do núcleo de criaturas.

## Encerrado: o erro `computeBoundingSphere ... NaN`

Estava aqui como observação não reproduzida. A CI reproduziu no commit `2509b83`, a causa foi achada e
corrigida: Pica-Termita e Ferrunco declaravam `social.territorial` sem `raioTerritorioM`, o animal nascia
com `territorio = { x, y, raio: undefined }` e o renderizador montava o círculo do território com NaN.
Detalhe no checkpoint, §5.
