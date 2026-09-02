# Relatório de entrega — sistema comercial do Instagram

Data: 2 de setembro de 2026

Este relatório registra o estado verificável da transformação do Comentou. O
núcleo comercial foi implementado, mas a entrega não é apresentada como uma
validação de produção da Meta nem como conclusão das capacidades avançadas.

## Implementado

- Posicionamento principal: **“Comentou transforma intenção no Instagram em
  vendas acompanháveis”**, com promessa curta, limites de automação e uso
  exclusivo da API oficial da Meta explícitos na landing page.
- Navegação orientada ao trabalho comercial: Agora, Oportunidades, Conversas,
  Campanhas, Conteúdo, Resultados, Relatórios, Diagnóstico e Configurações.
- Onboarding de prontidão e wizard de campanha em sete etapas, com seis
  objetivos, templates editáveis, rascunho local, modo avançado, revisão da
  jornada e criação sempre pausada. Ativação é uma operação separada e exige
  confirmação explícita.
- Bloqueio no cliente e no servidor quando uma mensagem usa `{link}` sem URL
  HTTP(S). O segundo link só é validado e enviado quando estiver habilitado.
- Simulação local sem envio, descrevendo comentário/Direct, DM, clique como
  sinal — nunca como venda —, oportunidade persistida e entrada na fila
  comercial.
- Central Agora com contagens exatas por workspace e fila priorizada. Quando a
  lista visual excede 100 itens, a cobertura parcial é informada em vez de
  apresentar a amostra como total.
- Oportunidade comercial persistida sobre a entidade canônica `Lead`, com
  origem, intenção explicável, responsável, etapa, valor estimado, próxima
  ação, histórico, versionamento e comandos idempotentes.
- Pipeline em lista e kanban, busca, filtros, paginação, ações em lote e detalhe
  editável. Ganho com venda confirmada e perda são estados terminais; venda
  confirmada não pode ser duplicada nem removida por uma edição de etapa.
- Inbox com seleção exata por conta e contato, contexto comercial, estados de
  carregamento/erro/vazio, resposta humana e copiloto determinístico. O
  copiloto preenche apenas o rascunho e nunca envia automaticamente.
- Radar de intenção com dez categorias, sinais explicáveis, correção humana e
  fallback local independente de IA externa.
- Atribuição que mantém comentário/Direct, campanha, conta e contato. Clique,
  oportunidade e venda confirmada permanecem eventos distintos.
- Resultados com períodos de 30/90/365 dias, filtros por conta e campanha,
  coortes consistentes, vendas confirmadas e moedas separadas. Zero medido é
  diferente de dado indisponível.
- Relatórios compartilháveis privados por padrão e campanhas importadas ou
  criadas pausadas por padrão.
- Diagnóstico técnico separado de resultado comercial. Telemetria global da
  fila não é exposta como se fosse isolada por workspace.
- Isolamento multi-tenant reforçado em APIs, membros, convites, Inbox,
  oportunidades, resultados e eventos. Tokens sensíveis usam transporte por
  cabeçalho e logs sanitizados.
- Webhook, worker e retries com idempotência, prevenção de regressão de estado,
  limites de taxa e parada segura antes do envio quando o registro comercial
  não puder ser persistido.
- Migration e rollback versionados para o núcleo comercial, com chaves
  compostas de workspace, constraints e índice único parcial para uma única
  venda confirmada por oportunidade.

## Validado

- `npm test`: **44 arquivos e 313 testes aprovados**.
- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado com Next.js 16.3.1 e **63 rotas**.
- Prisma format e validate: aprovados; o format manteve o hash do schema.
- Prisma migrate diff de schema vazio para o schema atual: gerado com 534
  linhas para inspeção estática.
- Migration e rollback: **9 de 9 verificações SQL estáticas aprovadas**.
- `git diff --check`: aprovado; somente avisos de normalização LF/CRLF.
- React Doctor: 40/100, 62 achados heurísticos e nenhum erro de correctness ou
  acessibilidade. Permanecem bailouts do React Compiler e alertas estruturais
  de manutenção/performance que não foram mascarados neste relatório.
- QA visual da landing pública no navegador interno do Codex, em desktop e
  mobile 390 × 844, cobrindo topo, seções centrais, preço e rodapé. A promessa
  exata, hierarquia, responsividade e CTAs ficaram legíveis, sem corte visual
  observado.
- Servidor local: `http://localhost:3000/` respondeu HTTP 200 e contém a
  promessa principal exata.
- O arquivo de auditoria fornecido pelo usuário permaneceu intocado; SHA-256
  antes/depois:
  `0D3BFEE0417DDA788F3E56A67CE2F6A48F5C91361D82117248FE8D38E9A01F31`.
- Nenhuma mensagem real foi enviada e nenhuma campanha real foi ativada.

## Pendente

- Executar migration e rollback em PostgreSQL real. Não havia `DATABASE_URL`,
  serviço na porta 5432 nem Docker disponível para a validação dinâmica.
- QA visual autenticada do onboarding, Agora, Pipeline, Inbox, Campanhas,
  Resultados e Diagnóstico com banco populado e sessão real.
- Outbox/reconciliação para o caso extremo em que a Meta aceita um envio, mas a
  persistência local posterior falha.
- Evento local durável para todo envio humano realizado pela Inbox.
- Receita influenciada e cortes de resultado por publicação, palavra-chave e
  responsável.
- SLA configurável, menções, visão consolidada de agência e troca explícita de
  workspace/cliente.
- Telemetria de fila, rate limit e retries agregada por workspace.
- Aprendizado persistente do tom da marca para o copiloto.
- Revisão dos alertas estruturais restantes do React Doctor e do design audit
  em uma refatoração separada, para não misturar estabilização com mudança de
  arquitetura.

## Dependente da Meta

- OAuth e reconexão com uma conta profissional real, permissões aprovadas,
  listagem real de posts/reels e assinatura de webhooks.
- Entrega e recebimento reais de Direct, resposta pública, follow gate e
  follow-up dentro das capacidades e políticas vigentes da API oficial.
- Validação de rate limits, expiração/renovação de token e payloads reais de
  webhook em ambiente Meta Live.
- Ativação de campanha real e teste ponta a ponta comentário → DM →
  oportunidade → atendimento → venda confirmada. Essas ações não foram
  executadas sem autorização explícita.

## Hipóteses não comprovadas

- O limite de três dias usado para classificar negociação parada ainda precisa
  ser calibrado com a operação comercial real.
- As categorias e prioridades do radar de intenção são uma base determinística
  auditável, não uma comprovação de acurácia para todos os segmentos.
- A atribuição atual privilegia a origem persistida da oportunidade; regras de
  first-touch, last-touch ou influência multicanal precisam de decisão de
  negócio antes de qualquer alegação adicional de receita.
- A entidade `Lead` permanece como registro canônico de oportunidade nesta
  etapa para preservar compatibilidade. Separá-la em outra entidade só deve
  ocorrer se os requisitos operacionais justificarem a migration adicional.
- A clareza do onboarding e do novo fluxo foi avaliada localmente, mas ainda
  precisa ser confirmada com usuários reais e contas Meta reais.

Arquitetura e critérios detalhados: `docs/architecture/commercial-system-2026-09-02.md`.
