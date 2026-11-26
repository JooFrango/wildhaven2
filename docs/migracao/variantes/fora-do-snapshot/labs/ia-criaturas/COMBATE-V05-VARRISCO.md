# Combate avançado v05 — Varrisco (GLB v04, 41 clipes)

**Escopo:** seis sistemas de IA de combate integrados no núcleo `src/eco`, sem motor paralelo, sem alterar Alpha, Hunter, mapa ou comportamento oficial das outras espécies. Esta PR é experimental e permanece em rascunho até aprovação visual.

## Ativação controlada

O flag `combate.iaAvancada=true` é aplicado à ficha **temporária** do Varrisco no laboratório apenas quando acessado por `laboratorio-varrisco.html?modelo=v04`. As variantes `v02` (17 clipes) e `v03` (29) são controles inalterados; o GLB v04 (41) não foi reexportado.

Abrir `http://localhost:5180/laboratorio-varrisco.html?modelo=v04`; escolher **IA V05 — 6 comportamentos em duelo (41 clipes)** para testar a simulação física com dois Varriscos. O cenário força a fase de duelo, **mas não concede ataques, danos, acertos ou esquivas**; tudo isso continua com o motor ecológico.

## Seis comportamentos implementados

1. **Finta:** IA pode realizar preparo falsificado, exibido como `preparo` e depois `recuperacao`, sem criar `a.golpe` ou hitbox. Visão e reconhecimento do oponente são necessários. Oponentes podem reagir. Fintas curtas observadas repetidamente fazem o adversário exigir preparo persistente antes de esquivar — mas não o tornam imune.
2. **Esquiva direcional:** a IA avalia o cone e distância do golpe visto, mobilidade, próprio cansaço, possibilidade de caminho em ambos os lados e histórico do rival. Só se moverá por impulso físico `esquiva_tatica` quando houver trecho seguro; sem invulnerabilidade. O sucesso é contado somente se o golpe real não alcança.
3. **Agarrão:** exige contato real na mandíbula e região adequada; o vínculo mantém o alvo fisicamente preso. Compara força, massa, dor, energia e recuperação; realiza disputas regulares e pode soltar por força, fadiga, derrota, interrupção ou morte. Nunca atravessa terreno entre a posição da presa e a boca. Clipes `grab_start/hold/release` são meramente visuais.
4. **Ferimentos:** lesões de pernas, cabeça, cauda e braços restringem golpes específicos, provocam recuo defensivo e `hurt_head/leg`. Queda usa `fall`, e o personagem cumpre um tempo de `get_up` sem poder atacar, mesmo se perder de vista o adversário.
5. **Combos:** só existe abertura quando um golpe real conectou, e o segundo golpe passa **novamente** por testes de alcance, recarga, energia, ângulo, lesão e colisão; nenhuma animação concede dano adicional por si.
6. **Adaptação intra-luta:** memória de até oito oponentes (mapa compacto em JSON) alimentada por percepção visual de preparos, esquivas e resultados próprios. Um oponente que escapa repetidamente penaliza a prioridade de golpes com preparo longo. Persistência de mundo mantém a memória; histórico ausente é tratado como desconhecido.

## Arquivos

- `src/eco/combate-avancado.js`: política e memória de luta.
- `src/eco/combate.js`: acertos físicos, agarrões, combos, escolhas de ataque e sinalização de ferimentos.
- `src/eco/tatica.js`: aviso físico/visual de preparação e finta.
- `src/eco/percepcao.js`: sinais visíveis reconhecíveis.
- `src/eco/mundo.js`: recuperação de quedas e liberação segura após morte.
- `src/web3d/animador.js`: reproduz somente clipes nomeados do GLB real; nunca altera HP, física ou IA.
- `src/web3d/app-lab.js`: modo v04 e duelo controlado com telemetria.
- `test/combate-v05-avancado.test.mjs`: testes das seis capacidades + restrições e determinismo.
- `scripts/testar-varrisco-v05-navegador.mjs`: Playwright/Chromium, 41 clipes e confronto real, captura no CI.

## Verificações

```bash
cd labs/ia-criaturas
npm test
npm run build
npm run demo-hospedada
node scripts/testar-varrisco-v05-navegador.mjs  # requer Playwright + Chromium
```

Na PR, o GitHub Actions gera o GLB v04 no checkout da PR, executa os testes, build e smoke da Oficina; então abre uma bancada Three.js real e captura o duelo em PNG. O artefato, quando gerado, pode ser baixado do workflow.

## Condições técnicas

Fintas não causam dano, nem gastam hitboxes, e podem ou não provocar esquiva. Esquiva não assegura invulnerabilidade. Agarrões e combos podem falhar ou ser interrompidos. Aprendizado **não é rede neural**: é atualização determinística de estimativas observadas durante a luta, sem informação privilegiada. Clipes v04 são animações procedurais experimentais e precisam de revisão artística em cenas reais.

**Somente validar como concluído após conferir os testes específicos e o browser smoke em GitHub Actions.** Merge, integração na Alpha, otimização final dos 41 clipes e aprovação artística são etapas separadas.
