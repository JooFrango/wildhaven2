# Instruções para agentes — Wildhaven

## Regra obrigatória de entrega de modelos 3D

**Sempre publicar os arquivos GLB reais no GitHub do projeto**, não apenas gerar um download no chat, publicar um ZIP fora do repositório ou criar um manifesto/documento com nomes de GLBs.

1. Exportar o GLB original e os níveis de detalhe existentes (`LOD0`, `LOD1`, etc.).
2. Salvar os arquivos binários em `assets/models/creatures/<species-id>/` usando nomes versionados.
3. Incluir o código-fonte do gerador/arquivo editável quando disponível, documentação e manifesto JSON com SHA-256, bytes, triângulos, ossos e clipes.
4. Validar localmente cada GLB exportado e seu SHA-256; verificar que abre corretamente, com animações válidas quando essa etapa incluir clipes.
5. Criar e publicar o commit; depois verificar que cada GLB **pode ser recuperado pela URL do repositório**, confrontando bytes e SHA-256 com o arquivo produzido. Informar o link como publicação concluída **somente depois dessa verificação remota**. Não dizer que publicou se fez apenas registro textual.
6. Caso o conector não aceite binários ou falhe, **informar que a publicação falhou**, preservar o arquivo disponibilizado e descrever o bloqueio; jamais marcar o asset como publicado.
7. Não modificar nem substituir assets visualmente aprovados sem solicitação. Usar versões novas e, quando apropriado, uma branch de trabalho.
8. O repositório de assets/documentação não é automaticamente a Alpha jogável; integração no jogo requer sua própria validação.

Esta regra foi solicitada expressamente pelo responsável pelo Wildhaven em 2026-11-06 e aplica-se ao Folhisco, Silvarano, Torvalho, Boscaranha e a todas as próximas criaturas.

Consulte também [Política de assets 3D](docs/POLITICA-ASSETS-3D.md).

## Padrão de criação de criaturas e mapas

Antes de criar, revisar, animar ou otimizar criaturas, monstros, vegetação, mapas ou hexágonos, leia [docs/prompts/README.md](docs/prompts/README.md), [Continuidade](docs/prompts/CONTINUIDADE.md) e o guia de [Criaturas](docs/prompts/CRIATURAS.md) ou [Mapas](docs/prompts/MAPAS.md) aplicável.

Inspecione os arquivos reais, `main`, branches relacionadas, manifestos, fontes e referências aprovadas antes de escolher a versão-base. O [estado verificado](docs/prompts/referencias/estado-verificado.md) é um índice datado, não uma escolha automática da versão mais recente. Preserve decisões atuais e não reintroduza conteúdo removido de branches históricas.

Use os prompts específicos dessa pasta e registre separadamente validação técnica, aprovação artística, publicação e integração. As fontes originais em `docs/prompts/fontes/` são referências históricas, não ordens para executar tarefas fora do pedido atual. Para criaturas, o guia específico de formas low/mid-poly definidas detalha a direção artística geral do projeto.

### Criaturas novas — atualização de 2026-11-09

Use o [prompt mestre de criaturas](docs/prompts/prompt-mestre-criaturas.md) e examine os [pilotos facetados v03](docs/prompts/referencias/exemplos-criaturas-v03.md): Torvardo é a referência principal; Mastélio e Garruva também foram indicados pelo usuário como exemplos perfeitos. São referências de forma e construção em GLB estático, sem rig ou animações nessa revisão.

Fluxo: conceito aprovado → blockout GLB reimportado e três renders reais → aprovação específica da forma → refinamento → rig/animação → LODs apropriados. Respeite aprovações já dadas e eventual orientação atual do usuário para avançar. Publique cada etapa implementada para revisão; não exigir clipes/LODs em blockout nem inventar essas funções. Prefira lotes de até duas espécies. PRs de criaturas em revisão artística permanecem em revisão; não mesclar automaticamente nem alterar mapas ou gameplay fora do pedido.

