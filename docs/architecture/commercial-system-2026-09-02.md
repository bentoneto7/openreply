# Comentou — arquitetura do sistema comercial

Status: proposta versionável baseada no código local em 2 de setembro de 2026.

> Nota de implementação — a entrega de 2 de setembro mantém `Lead` como o
> registro canônico da oportunidade. Campos comerciais, eventos de transição e
> vendas confirmadas foram adicionados de forma compatível ao modelo existente;
> criar uma entidade `Opportunity` separada permanece uma opção futura. Essa
> decisão evita duplicar identidade e exigir backfill arriscado nesta migração.

## 1. Objetivo e fronteiras

Este documento transforma o inventário do produto atual em um contrato de
evolução para a Comentou como **sistema comercial do Instagram**:

> comentário com intenção → Direct iniciado → contato identificado →
> oportunidade priorizada → atendimento humano → ganho ou perda registrado

Ele descreve o que existe, o que ainda falta e a ordem segura de implementação.
Não afirma que o ambiente de produção, a conta Meta, a cobrança Stripe ou os
webhooks reais estejam saudáveis. A inspeção foi estática e não enviou
mensagens, não ativou campanhas e não alterou dados.

Princípios que valem para todas as fases:

- Clique, DM enviada, resposta e venda são eventos diferentes.
- `0` significa valor medido igual a zero; `null` ou `—` significa dado
  indisponível ou ainda não medido.
- Temperatura é calculada a partir de sinais; etapa comercial é declarada por
  uma pessoa ou integração identificada.
- Campanha nova nasce pausada. Ativação é uma ação separada, explícita,
  autorizada e auditável.
- Toda leitura e escrita privada é isolada por `workspaceId`.
- Valores monetários são inteiros na menor unidade da moeda.
- Segredos e tokens nunca entram em respostas de API, cliente, eventos de
  produto ou logs de diagnóstico.
- A API oficial da Meta é a única integração permitida com Instagram.
- IA pode sugerir; não ativa campanha nem envia mensagem sem aprovação humana.

### 1.1 Evidência e limites desta leitura

- Branch observada: `main`, acompanhando `origin/main`.
- Alteração preexistente preservada:
  `docs/audit/gaio-dna-comercial-operacional-2026-09-02.md` estava não
  rastreada e não foi modificada.
- Fontes principais: `AGENTS.md`, `CLAUDE.md`, `README.md`,
  `design-system/MASTER.md`, `design-system/brand/logo-guidelines.md`,
  `prisma/schema.prisma`, rotas em `app/`, componentes em `components/`,
  serviços em `lib/`, worker em `worker/` e auditorias em `docs/audit/`.
- A home já tinha uma captura aceita em `docs/audit/01-home.png`; a área
  autenticada não foi executada nesta leitura.
- As conclusões sobre a Gaio limitam-se à superfície pública documentada em
  `docs/audit/gaio-dna-comercial-operacional-2026-09-02.md`.

## 2. Fluxo atual ponta a ponta

### 2.1 Sequência real hoje

| Passo | Comportamento atual | Persistência e evidência | Limite relevante |
| --- | --- | --- | --- |
| 1. Aquisição | A home promete comentários que viram conversas, plano único de R$ 87/mês e usa números explicitamente ilustrativos. | `app/page.tsx:6-14`, `app/page.tsx:45-70`, `app/page.tsx:91-96` | O posicionamento do `README.md` ainda descreve principalmente uma alternativa open source ao ManyChat. |
| 2. Cadastro | Nome, e-mail, WhatsApp e senha criam usuário, workspace com papel `OWNER` e sessão de 30 dias. | `app/cadastro/page.tsx:13-21`, `app/api/auth/register/route.ts:23-48`, `prisma/schema.prisma:12-31`, `prisma/schema.prisma:72-102` | Não pergunta objetivo, não mostra progresso e não cria um estado de onboarding. |
| 3. Guarda inicial | Ao abrir uma rota paga, a aplicação exige sessão e workspace. Se a cobrança estiver sendo aplicada, redireciona primeiro para conexão do Instagram e depois para assinatura. | `app/(dashboard)/layout.tsx:12-35`, `app/(dashboard)/(paid)/layout.tsx:18-37`, `lib/billing/subscription.ts:22-43` | Com o enforcement desligado, conexão e assinatura não bloqueiam nenhuma tela; isso é útil como kill switch, mas o estado não fica claro no produto. |
| 4. Conexão do Instagram | `OWNER` ou `ADMIN` inicia OAuth, o callback valida state e associação ao workspace, troca o código, busca `user_id`, criptografa o token e tenta assinar webhooks. | `app/api/instagram/connect/route.ts:6-31`, `app/api/instagram/callback/route.ts:23-138`, `prisma/schema.prisma:157-177` | A conta precisa de acesso permitido pela Meta. O callback tolera falha na inscrição do webhook e ainda salva a conta com `webhookSubscribed=false`. |
| 5. Assinatura | O owner abre Checkout ou Portal Stripe; eventos sincronizam status de assinatura no workspace. `ACTIVE` e `TRIALING` liberam acesso. | `app/(dashboard)/billing/page.tsx:15-88`, `components/billing-actions.tsx:5-48`, `lib/billing/subscription.ts:6-76`, `app/api/billing/*` | O preço configurado no Stripe não foi confirmado nesta inspeção. |
| 6. Criação de campanha | O editor apresenta quatro etapas: Publicação, Gatilho, Abordagem e Entrega. Permite publicação específica, qualquer publicação ou próximo reel; palavras específicas ou qualquer comentário; gatilho por DM; resposta pública; DM de abertura; follow gate; até dois links; e follow-up. | `components/campaign-builder.tsx:28-37`, `components/campaign-builder.tsx:734-1077`, `prisma/schema.prisma:199-249` | Não existe objetivo como primeira decisão, rascunho persistido, revisão final, checklist ou modo avançado separado. |
| 7. Ativação | O mesmo submit que cria a campanha envia `isActive=true`; o schema da API também assume `true`. Pausar e reativar são `PATCH`. | `components/campaign-builder.tsx:149-155`, `components/campaign-builder.tsx:396-467`, `components/campaign-builder.tsx:640-647`, `components/campaign-builder.tsx:1099-1110`, `app/api/automations/route.ts:18-81`, `app/api/automations/route.ts:386-440` | A campanha pode entrar em produção sem uma etapa explícita de revisão. A ativação não gera evento de auditoria. |
| 8. Entrada de comentário | O webhook verifica assinatura, persiste o payload em `WebhookEvent` e enfileira comentário com `jobId` determinístico. O worker também executa uma reconciliação periódica para comentários perdidos. | `app/api/webhook/route.ts:32-115`, `lib/meta/webhook.ts:104-143`, `worker/dm-worker.ts:6-44`, `lib/polling/comment-reconciler.ts:63-104` | Entrega depende de webhook, permissões, token, Redis e worker. Comentários escondidos pela Meta podem continuar invisíveis. |
| 9. Correspondência | O worker considera apenas campanhas ativas daquela conta e daquele post, ou campanhas de qualquer post. Em seguida aplica qualquer comentário ou `matchKeywords`. | `lib/queue/dm-worker.ts:191-238`, `lib/utils/keyword-matcher.ts` | Ainda não há taxonomia comercial explicável como preço, compra, objeção ou urgência; há apenas correspondência de palavras e score determinístico. |
| 10. Resposta pública e primeira DM | O worker cria ou atualiza `DmLog`, tenta a resposta pública de forma independente e envia uma única private reply por comentário. A abertura, o follow gate e o link usam botões e postbacks quando configurados. | `lib/queue/dm-worker.ts:240-425`, `lib/queue/dm-worker.ts:524-672`, `prisma/schema.prisma:282-316` | A entrega é condicionada pela Meta. `SENT` significa aceite da chamada, não leitura nem compra. |
| 11. DM recebida e follow-up | Webhooks de mensagens podem acionar campanha por palavra. Postback revela o link; um job atrasado envia follow-up. | `app/api/webhook/route.ts:117-228`, `lib/meta/webhook.ts:145-252`, `lib/queue/dm-worker.ts:681-1179` | O follow-up e a resposta humana do inbox não viram eventos persistidos equivalentes a uma linha de conversa auditável. |
| 12. Clique | `/r/[slug]` grava um `LinkClick` e redireciona para o destino. | `app/r/[slug]/route.ts:9-43`, `prisma/schema.prisma:334-374` | O slug é da campanha/link, não da entrega por contato. O clique não pode ser atribuído a uma pessoa ou `DmLog`. |
| 13. Identificação do lead | A fila lê conversas recentes ao vivo da Meta, seleciona threads cuja última mensagem é da pessoa e calcula prioridade. Um lead inexistente aparece virtualmente como `NOVO`. | `app/api/leads/queue/route.ts:18-92`, `lib/leads/dm-queue.ts`, `app/(dashboard)/(paid)/heatmap/page.tsx:98-205` | O `Lead` só é persistido quando alguém muda seu estado pela API. Comentário ou DM, sozinhos, não garantem registro de lead. |
| 14. Atendimento humano | “Oportunidades” lista conversas da Meta, consulta as 20 mensagens mais recentes, atualiza a cada 12 s e permite enviar uma resposta manual. | `app/(dashboard)/(paid)/inbox/page.tsx:20-26`, `app/(dashboard)/(paid)/inbox/page.tsx:92-251`, `app/api/instagram/conversations/route.ts:27-152`, `app/api/instagram/conversations/[id]/route.ts:21-67` | O histórico vem da Meta, não do banco. Resposta manual não registra ator, oportunidade, estado anterior/posterior ou evento local. |
| 15. Etapa comercial | A UI permite mudar o estado entre `NOVO`, `ABORDADO`, `RESPONDEU`, `NEGOCIANDO`, `GANHO` e `PERDIDO`. A API faz upsert do `Lead`. | `lib/crm/lead-status.ts:1-26`, `components/lead-temperature-panel.tsx:105-124`, `components/lead-temperature-panel.tsx:189-220`, `app/api/leads/route.ts:9-41` | O estado fica no contato, sem histórico, responsável, oportunidade, valor, produto, próxima ação, prazo ou motivo da perda. |
| 16. Resultado e relatório | Dashboard e relatórios agregam comentários acionados, DMs, falhas e cliques. Existe relatório público por slug. | `app/api/dashboard/stats/route.ts:36-97`, `lib/reports/data.ts:28-186`, `app/reports/[shareSlug]/page.tsx` | Não há venda nem receita persistida. O relatório compartilhável não possui entrada de navegação e sua UI está em inglês. |
| 17. Diagnóstico | Há health check de banco, Redis, fila e heartbeat do worker, além de falhas de webhook, token e DM. | `app/api/health/route.ts:18-89`, `app/api/admin/diagnostics/route.ts:9-105`, `app/(dashboard)/(paid)/diagnostics/page.tsx` | A tela não orienta impacto, causa provável e correção. Contagens/alertas do Redis são globais, e eventos com `workspaceId=null` são mostrados a qualquer workspace. |

### 2.2 Estados persistidos hoje

- Assinatura: `NONE`, `INCOMPLETE`, `TRIALING`, `ACTIVE`, `PAST_DUE`,
  `UNPAID`, `PAUSED`, `CANCELED`.
- Convite: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.
- Lead: `NOVO`, `ABORDADO`, `RESPONDEU`, `NEGOCIANDO`, `GANHO`,
  `PERDIDO`.
- DM: `PENDING`, `SENT`, `FAILED`, `SKIPPED_DEDUP`,
  `SKIPPED_RATE_LIMIT`, `SKIPPED_PLAN_LIMIT`, `SKIPPED_NO_MATCH`.
- Webhook: `PENDING`, `PROCESSED`, `FAILED`.
- Campanha: somente `isActive: boolean`.

Fonte: `prisma/schema.prisma:410-470`.

## 3. Matriz de capacidades

As classes abaixo são mutuamente exclusivas para facilitar priorização. Quando
uma capacidade funcional depende da Meta, a classe usada é
**dependente de permissão da Meta**, mesmo que parte do código já exista.

| Capacidade | Classe | Evidência | Decisão de arquitetura |
| --- | --- | --- | --- |
| Cadastro com senha, sessão e workspace | Implementada e utilizável | `app/api/auth/register/route.ts`, `prisma/schema.prisma:12-31`, `prisma/schema.prisma:72-102` | Manter e inserir no novo onboarding. |
| Login por senha e magic link | Implementada e utilizável | `app/login/page.tsx`, `app/api/auth/password-login/route.ts`, `lib/auth.ts` | Manter os dois caminhos e unificar mensagens. |
| Guarda conexão → assinatura → produto | Implementada e utilizável | `app/(dashboard)/(paid)/layout.tsx`, `lib/billing/subscription.ts:22-43` | Reutilizar como regra de acesso; expor o estado no onboarding. |
| Checkout, portal e sincronização Stripe | Implementada e utilizável | `components/billing-actions.tsx`, `app/api/billing/*`, `lib/billing/subscription.ts` | Confirmar configuração real do price antes de comunicar cobrança validada. |
| Workspaces, papéis e convites | Implementada, mas mal exposta | `prisma/schema.prisma:72-155`, `app/api/workspace/*`, `app/(dashboard)/settings/page.tsx:251-353` | Traduzir, esclarecer permissões e separar equipe de conexão. |
| OAuth e conexão de conta profissional | Dependente de permissão da Meta | `app/api/instagram/connect/route.ts`, `app/api/instagram/callback/route.ts` | Tratar acesso padrão, escopos concedidos e webhook como estados visíveis. |
| Estado completo da conexão (permissões, token, webhook, worker, posts) | Parcial | `app/(dashboard)/settings/page.tsx:143-248`, `app/api/health/route.ts` | Criar um contrato agregado sem devolver segredos. |
| Seleção de conta e publicação real | Dependente de permissão da Meta | `components/account-select.tsx`, `components/post-picker.tsx`, `app/api/instagram/posts/route.ts` | Reutilizar no onboarding e no wizard. |
| Campanha para post específico, qualquer post ou próximo reel | Dependente de permissão da Meta | `components/campaign-builder.tsx:765-794`, `app/api/cron/attach-next-reel/route.ts` | Preservar os três escopos com copy de consequência. |
| Correspondência exata/parcial e qualquer comentário | Implementada e utilizável | `prisma/schema.prisma:210-233`, `lib/utils/keyword-matcher.ts`, `components/campaign-builder.tsx:797-837` | Expor claramente `wholeWordMatch`, hoje pouco visível no wizard. |
| Wizard guiado por objetivo | Parcial | `components/campaign-builder.tsx:28-37`, campo `Automation.goal` em `prisma/schema.prisma:204-206` | O wizard existe, mas objetivo, templates por objetivo e revisão ainda não governam o fluxo. |
| Rascunho persistido e retomada | Inexistente | `Automation` não possui status de rascunho; o builder só salva ao criar/ativar | Introduzir estado `DRAFT` e autosave versionado. |
| Revisão e checklist antes da ativação | Inexistente | O submit cria com `isActive=true` | Separar salvar, validar e ativar. |
| Pausa e retomada de campanha | Implementada e utilizável | `app/api/automations/route.ts:448-608`, `app/(dashboard)/(paid)/campaigns/page.tsx:200-226` | Manter, adicionando motivo e evento de auditoria. |
| Resposta pública automática | Dependente de permissão da Meta | `lib/queue/dm-worker.ts:352-393` | Continuar independente da perna de DM e exibir falhas separadamente. |
| Private reply, DM inicial e revelação por botão | Dependente de permissão da Meta | `lib/queue/dm-worker.ts:524-672`, `lib/meta/client.ts` | Preservar deduplicação e representar estados no simulador. |
| Follow gate | Dependente de permissão da Meta | `lib/queue/dm-worker.ts:532-574`, `lib/queue/dm-worker.ts:681-880` | Exibir resposta `sim`, `não` e `indisponível`; documentar fail-open/fail-closed. |
| Gatilho por DM | Dependente de permissão da Meta | `lib/meta/webhook.ts:178-222`, `lib/queue/dm-worker.ts:930-1179` | Manter como opção avançada, com alerta para “qualquer conteúdo”. |
| Follow-up | Parcial | `lib/queue/dm-worker.ts:805-825`, `lib/queue/dm-worker.ts:887-928` | O envio existe, mas não há registro completo de sucesso/falha nem cancelamento por contexto. |
| Preview da campanha | Parcial | `components/campaign-preview.tsx`, `components/campaign-builder.tsx:1119-1146` | Evoluir para simulador de toda a jornada, com falhas, tempos e teste interno seguro. |
| Webhook assinado e evento bruto | Dependente de permissão da Meta | `app/api/webhook/route.ts:32-79`, `lib/meta/webhook.ts:3-33` | Manter assinatura obrigatória; remover preview de payload de logs persistidos. |
| Fila, retry, deduplicação e rate limit | Implementada e utilizável | `lib/queue/client.ts:84-107`, `lib/queue/dm-worker.ts:400-520`, `lib/utils/rate-limiter.ts` | Manter e instrumentar por workspace sem expor identificadores externos. |
| Reconciliação de comentários perdidos | Dependente de permissão da Meta | `lib/polling/comment-reconciler.ts`, `worker/dm-worker.ts:33-44` | Manter como rede de segurança, com cobertura e atraso observáveis. |
| Log de DMs automáticas | Implementada e utilizável | `prisma/schema.prisma:282-316`, `app/api/logs/route.ts` | Renomear para eventos de automação e traduzir filtros/estados. |
| Conversas e resposta humana | Dependente de permissão da Meta | `app/(dashboard)/(paid)/inbox/page.tsx`, `app/api/instagram/conversations/*` | Tornar “Conversas” e registrar localmente autoria e resultado do envio. |
| Contato/lead persistente | Parcial | `prisma/schema.prisma:251-280`, `app/api/leads/route.ts` | Persistir no primeiro sinal idempotente; não esperar uma mudança manual de etapa. |
| Nota comercial | Implementada, mas mal exposta | `Lead.note` e payload de `PATCH /api/leads`; a UI só altera status | Adicionar edição de nota com autor e evento. |
| Pipeline em lista e kanban | Inexistente | Não existe rota ou componente de pipeline | Criar sobre `Opportunity`, não sobre conversas ao vivo. |
| Responsável, SLA e próxima ação | Inexistente | Não existem campos nem eventos correspondentes | Introduzir em oportunidade e derivar filas da Central Agora. |
| Ganho/perda como rótulo manual | Parcial | `LeadStatus` e seletor no `LeadTemperaturePanel` | Não chamar de venda até existir oportunidade, evento, origem e valor confirmado. |
| Atribuição de clique ao contato | Inexistente | `LinkClick` não possui `leadId`, `dmLogId` ou token de entrega | Criar link por entrega e manter slug de campanha como fallback não atribuível. |
| Receita confirmada e influenciada | Inexistente | Não existem `Opportunity`, `Sale` ou evento financeiro comercial | Implementar somente após persistência e regras de atribuição. |
| Central “Agora” | Parcial | `/dashboard` mostra métricas; `/heatmap` mostra urgência ao vivo | Unir prioridade comercial, próximos passos e alertas; mover métricas para Resultados. |
| Radar de intenção explicável | Parcial | `lib/heatmap/priority.ts` calcula score e razões determinísticas | Adicionar classes comerciais, correção humana e feedback; score nunca é verdade absoluta. |
| Copiloto comercial | Inexistente | Nenhum modelo, endpoint ou componente de IA | Implementar por último e sempre com aprovação humana. |
| Resultados de conteúdo | Dependente de permissão da Meta | `app/(dashboard)/(paid)/overview/page.tsx`, `app/api/instagram/overview/route.ts` | Manter `null` para métricas sem permissão e separar de resultado comercial. |
| Relatório compartilhável | Implementada, mas mal exposta | `lib/reports/data.ts`, `app/reports/[shareSlug]/page.tsx`; `reportUrl` não é usado na UI | Criar índice “Relatórios”, tradução e revogação explícita. |
| Saúde técnica | Parcial | `app/api/health/route.ts`, `app/api/admin/diagnostics/route.ts`, `app/(dashboard)/(paid)/diagnostics/page.tsx` | Separar escopo global/tenant e acrescentar impacto, causa provável e ação. |
| Saúde comercial | Parcial | contagens de fila e estados em `/heatmap` | Derivar de oportunidades persistidas, responsável, SLA e próxima ação. |

## 4. Nomenclatura e navegação canônicas

### 4.1 Entidades

| Termo canônico | Definição | Não usar como sinônimo |
| --- | --- | --- |
| Campanha | Configuração que observa um gatilho e executa uma experiência de comentário/DM. | “Automação” na UI. Pode permanecer como nome técnico legado durante a migração. |
| Contato | Pessoa identificada por `instagramAccountId + commenterId`. O modelo `Lead` atual exerce parcialmente esse papel. | Oportunidade ou venda. |
| Sinal | Evento observado: comentário, DM recebida, abertura/revelação ou clique. | Intenção confirmada. |
| Intenção | Classificação explicável derivada de um ou mais sinais e corrigível por pessoa. | Score misterioso ou previsão de compra. |
| Oportunidade | Processo comercial persistido para um contato, com etapa, responsável, origem, valor e histórico. | Thread de DM ou comentário isolado. |
| Conversa | Histórico de mensagens entre a conta e o contato. | Oportunidade. Uma conversa pode apoiar mais de uma oportunidade. |
| Temperatura | Prioridade calculada e datada a partir de sinais disponíveis. | Etapa comercial. |
| Etapa comercial | Situação declarada da oportunidade: novo, abordado, respondeu, negociando, ganho ou perdido. | Status técnico da DM. |
| Ganho | Encerramento comercial registrado por pessoa ou integração identificada. | Clique, DM enviada ou resposta. |
| Receita confirmada | Soma de valores ganhos explicitamente registrados. | Receita influenciada ou potencial. |
| Receita influenciada | Valor ganho cuja cadeia de origem inclui uma campanha da Comentou, segundo regra de atribuição publicada. | Receita confirmada total. |

### 4.2 Navegação principal

Ordem canônica:

1. **Agora** — ações que precisam de atenção, não um painel genérico.
2. **Oportunidades** — pipeline em lista/kanban, filtros, SLA e responsáveis.
3. **Conversas** — inbox e contexto do contato.
4. **Campanhas** — criar, revisar, ativar, pausar e analisar campanhas.
5. **Conteúdo** — publicações/reels e os sinais/campanhas ligados a eles.
6. **Resultados** — funil comercial e desempenho de conteúdo com denominadores
   explícitos.
7. **Relatórios** — relatórios internos e compartilháveis.
8. **Diagnóstico** — saúde técnica e incidentes acionáveis.
9. **Configurações** — contas Instagram, equipe, assinatura e preferências.

Mapeamento de transição:

| Atual | Canônico | Tratamento |
| --- | --- | --- |
| `/dashboard` “Central de vendas” | Agora | Manter URL e trocar a função da tela. |
| `/heatmap` “Mapa de Calor” | Parte de Agora | Incorporar a fila; manter redirect temporário. |
| `/inbox` “Oportunidades” | Conversas | Renomear primeiro; preservar URL ou criar redirect estável. |
| `/campaigns` “Automações” | Campanhas | Padronizar copy; manter `/automations` apenas como alias legado. |
| `/logs` “Atividade” | Diagnóstico > Eventos de automação | Remover da navegação principal após a absorção. |
| `/overview` “Resultados” | Resultados | Manter e ampliar quando houver eventos comerciais. |
| Relatório público sem entrada | Relatórios | Criar índice autenticado e controle de compartilhamento. |
| `/billing` | Configurações > Assinatura | Manter rota por compatibilidade e remover item principal. |

### 4.3 Inconsistências a eliminar

- `Team`, `Pending invites`, `Copy`, `Revoke`, `Usage` e textos de uso em
  `app/(dashboard)/settings/page.tsx:251-369`.
- Detalhe de campanha quase todo em inglês em
  `app/(dashboard)/(paid)/campaigns/[id]/page.tsx:130-373`.
- `Conversations`, `Loading`, `No conversations`, `Back`, `unknown` e placeholder
  em inglês em `app/(dashboard)/(paid)/inbox/page.tsx:286-405`.
- Filtros, colunas e paginação em inglês em
  `app/(dashboard)/(paid)/logs/page.tsx:100-233`.
- Diagnóstico e relatório público misturam português e inglês em
  `app/(dashboard)/(paid)/diagnostics/page.tsx` e
  `app/reports/[shareSlug]/page.tsx`.
- Erros de APIs públicas ao frontend alternam entre português e inglês.
- `Campaign`, `Automation`, “campanha” e “automação” designam a mesma entidade.
- A rota `/api/heatmap/overview` agrega sinais persistidos, mas as telas de
  Heatmap e inbox consomem `/api/leads/queue`; o comentário de
  `app/api/leads/route.ts:17-18` está desatualizado.
- O relatório público renderiza `${ctr}%`; quando `ctr` é `null`, pode mostrar
  `null%` em vez de `—` (`app/reports/[shareSlug]/page.tsx:139-148`).

O sistema visual permanece regido por `design-system/MASTER.md`: logo oficial
imutável, azul `#2563EB`, Plus Jakarta Sans, ícones Lucide e interface clara,
compacta e sem efeitos decorativos concorrentes.

## 5. Modelo proposto de estados e transições

### 5.1 Onboarding e prontidão

Estados derivados, sem guardar segredos:

```text
CONTA_CRIADA
  -> INSTAGRAM_PENDENTE
  -> INSTAGRAM_CONECTANDO
  -> INSTAGRAM_CONECTADO
  -> ASSINATURA_PENDENTE
  -> PRONTO_PARA_CRIAR
  -> PRIMEIRA_CAMPANHA_EM_RASCUNHO
  -> PRIMEIRA_CAMPANHA_ATIVA
```

Exceções visíveis:

- `BLOQUEADO_PERMISSAO_META`
- `WEBHOOK_PENDENTE`
- `TOKEN_EXPIRADO_OU_REVOGADO`
- `WORKER_INDISPONIVEL`
- `FILA_INDISPONIVEL`
- `PAGAMENTO_PENDENTE`

Cada exceção precisa informar impacto, causa provável, ação e link de correção.

### 5.2 Campanha

```text
DRAFT -> IN_REVIEW -> PAUSED -> ACTIVE
  ^          |          ^         |
  |          v          |         v
  +------ NEEDS_FIX -----+------ PAUSED

PAUSED -> ARCHIVED
```

Regras:

- `POST /campaigns` sempre cria `DRAFT`, ignorando tentativa de ativação no
  payload.
- `DRAFT` e `NEEDS_FIX` aceitam edição livre.
- `IN_REVIEW` representa validação do checklist, não aprovação humana externa.
- `PAUSED -> ACTIVE` exige ação explícita, papel `OWNER` ou `ADMIN`, versão
  esperada e chave de idempotência.
- Ativação falha fechada se conta, token, webhook, worker, gatilho ou conteúdo
  obrigatório estiverem inválidos.
- Toda transição gera `CampaignEvent` imutável com ator, origem, data, estado
  anterior e novo.
- Durante a compatibilidade, `Automation.isActive` é espelhado de `status` e só
  é removido em uma migration posterior.

### 5.3 Oportunidade

Fluxo principal baseado no enum existente:

```text
NOVO -> ABORDADO -> RESPONDEU -> NEGOCIANDO -> GANHO
  |         |           |            |
  +---------+-----------+------------+-> PERDIDO
```

Transições de retorno são permitidas, mas auditadas:

- `RESPONDEU -> ABORDADO` quando a resposta não abriu negociação.
- `NEGOCIANDO -> RESPONDEU` quando falta qualificação.
- `GANHO` ou `PERDIDO -> NEGOCIANDO` somente por ação `REOPEN`, com motivo.
- Salto direto para `GANHO` ou `PERDIDO` exige motivo e ator.

Invariantes:

- Uma oportunidade pertence a um workspace e a um contato.
- Origem guarda, quando conhecida, campanha, publicação, palavra-chave e
  primeiro evento; ausência é `null`, nunca um identificador inventado.
- `GANHO` registra `wonAt`; `PERDIDO` registra `lostAt` e `lostReason`.
- Receita confirmada inclui somente oportunidades `GANHO` com
  `wonValueCents != null` e moeda conhecida.
- Mudança de etapa não sobrescreve história: adiciona `OpportunityEvent`.

### 5.4 Entrega e conversa

O estado técnico continua separado do comercial:

```text
QUEUED -> PROCESSING -> SENT
   |          |          |
   |          v          +-> READ_OR_OPENED (somente se comprovado)
   +------> FAILED
   +------> SKIPPED(reason)
```

- `SENT` não altera automaticamente oportunidade para `RESPONDEU`.
- DM recebida pode gerar o evento `INBOUND_MESSAGE` e então sugerir ou aplicar
  `RESPONDEU`, conforme regra determinística documentada.
- Mensagem manual registra rascunho, ator e resultado do envio; texto gerado por
  IA é diferente de texto aprovado e de texto enviado.
- Follow-up possui evento de agendamento, cancelamento, envio e falha.

### 5.5 Conexão e saúde

Conexão é um estado composto:

- `oauth`: conectado, ausente, expirado, revogado ou desconhecido;
- `permissions`: concedidas, ausentes ou desconhecidas;
- `webhook`: inscrito, pendente ou falhando;
- `worker`: saudável, atrasado ou indisponível;
- `queue`: saudável, acumulada ou indisponível;
- `posts`: acessíveis, vazios ou sem permissão.

“Conectado” só deve ser apresentado como “pronto para operar” quando todos os
componentes obrigatórios estiverem saudáveis.

## 6. Contratos propostos

Os nomes abaixo são contratos-alvo. Durante a migração, as rotas legadas
`/api/automations` podem adaptar o novo domínio sem quebrar clientes internos.

### 6.1 Convenções comuns

- Resposta de sucesso: `{ success: true, data, meta? }`.
- Resposta de erro: `{ success: false, error: { code, message, fieldErrors?, retryable? } }`.
- Datas em UTC ISO 8601; apresentação converte para o fuso do usuário.
- Paginação por cursor para eventos, conversas persistidas e oportunidades.
- Escritas críticas recebem `Idempotency-Key` e `expectedVersion`.
- Toda query privada recebe o `workspaceId` da sessão; nunca aceita
  `workspaceId` do corpo.
- `OWNER` e `ADMIN` gerenciam conexão, campanha, equipe e cobrança conforme a
  regra atual. `MEMBER` atende oportunidades permitidas, mas não ativa campanha
  nem altera integração.

### 6.2 Onboarding

`GET /api/onboarding/status`

```ts
type OnboardingStatus = {
  currentStep:
    | "OBJECTIVE"
    | "INSTAGRAM"
    | "BILLING"
    | "CAMPAIGN"
    | "READY";
  objective: CampaignGoal | null;
  instagram: {
    accountId: string | null;
    username: string | null;
    oauth: "READY" | "MISSING" | "EXPIRED" | "REVOKED" | "UNKNOWN";
    permissions: Record<string, "GRANTED" | "MISSING" | "UNKNOWN">;
    webhook: "READY" | "PENDING" | "FAILED" | "UNKNOWN";
    worker: "READY" | "DEGRADED" | "UNKNOWN";
    postsFound: number | null;
  };
  billing: { required: boolean; status: SubscriptionStatus };
  blockers: Array<{ code: string; impact: string; actionHref: string }>;
};
```

### 6.3 Campanhas

- `POST /api/campaigns` cria `DRAFT`.
- `PATCH /api/campaigns/:id` edita configuração e exige `expectedVersion`.
- `POST /api/campaigns/:id/review` executa validação sem enviar mensagem.
- `POST /api/campaigns/:id/activate` ativa após checklist, autorização e
  idempotência.
- `POST /api/campaigns/:id/pause` pausa e registra motivo.
- `POST /api/campaigns/:id/test` aceita apenas destinatário/conta de teste
  permitidos e nunca reutiliza o caminho de produção sem uma marca de teste.

Checklist mínimo de ativação:

- conta pertence ao workspace e token pode ser descriptografado;
- permissões e webhook exigidos estão prontos ou a limitação está bloqueando;
- worker e fila respondem;
- publicação/escopo e gatilho são válidos;
- mensagens e botões respeitam limites;
- links usam `https` e foram revisados;
- impacto de “qualquer comentário” e “qualquer DM” foi confirmado;
- preview foi gerado a partir do mesmo payload validado pelo servidor.

### 6.4 Contatos, sinais e oportunidades

- `GET /api/opportunities?stage=&assignee=&account=&campaign=&due=&cursor=`
- `POST /api/opportunities` cria oportunidade manual com contato obrigatório.
- `PATCH /api/opportunities/:id` altera campos mutáveis com versão esperada.
- `POST /api/opportunities/:id/transition` recebe `to`, `reason?`, valores e
  cria evento atômico.
- `POST /api/opportunities/:id/notes` cria nota imutável com autor.
- `GET /api/contacts/:id/timeline` combina sinais, mensagens e eventos
  comerciais em ordem cronológica.
- `POST /api/opportunities/:id/assign` atribui responsável e registra evento.

Exemplo de ganho:

```ts
type WinOpportunityInput = {
  expectedVersion: number;
  wonValueCents: number | null;
  currency: "BRL";
  productOrOffer: string | null;
  note?: string;
};
```

Se `wonValueCents` for `null`, a oportunidade conta como ganho, mas não entra em
receita confirmada.

### 6.5 Agora

`GET /api/now?instagramAccountId=&cursor=` devolve itens de ação, não cards
genéricos:

```ts
type NowItem = {
  id: string;
  kind:
    | "NEW_INTENT"
    | "FIRST_APPROACH_DUE"
    | "HOT_LEAD"
    | "FOLLOW_UP_OVERDUE"
    | "STALE_NEGOTIATION"
    | "CAMPAIGN_FAILURE"
    | "CONNECTION_ALERT";
  priority: number;
  reason: string[];
  dueAt: string | null;
  opportunityId: string | null;
  contactId: string | null;
  action: { label: string; href: string };
  dataFreshness: { observedAt: string; source: "DATABASE" | "META" };
};
```

### 6.6 Conversas e envio humano

- A leitura pode continuar vindo da Meta no primeiro ciclo, mas cada envio
  humano cria um evento local com ator, contato e oportunidade antes/depois da
  chamada.
- A resposta da API diferencia `QUEUED`, `SENT`, `FAILED`,
  `WINDOW_CLOSED` e `PERMISSION_MISSING`.
- Sugestão de IA retorna `suggestionId`; enviar exige novo request com texto
  final e confirmação humana. O servidor nunca interpreta “gerar” como
  “enviar”.

### 6.7 Atribuição

- Cada link enviado usa um token opaco de entrega associado a `DmLog`, contato
  e oportunidade quando conhecidos.
- `LinkClick.deliveryId` é opcional para preservar cliques legados.
- Clique sem token de entrega permanece como clique bruto de campanha e nunca
  é promovido para venda.
- Receita influenciada exige uma janela e regra de atribuição versionadas.

## 7. Plano de migration aditiva e rollback

### 7.1 Migration A — estados de campanha e auditoria

Adicionar, sem remover `isActive`:

- enum `CampaignStatus`: `DRAFT`, `IN_REVIEW`, `NEEDS_FIX`, `PAUSED`, `ACTIVE`,
  `ARCHIVED`;
- `Automation.status` inicialmente nullable;
- `Automation.version`, `activatedAt`, `activatedByUserId`;
- `CampaignEvent` com workspace, campanha, ator, tipo, estado anterior/novo,
  payload sanitizado e data.

Backfill: `isActive=true -> ACTIVE`; `false -> PAUSED`. Depois do deploy com
dual-read, tornar `status` obrigatório. `isActive` continua espelhado até uma
migration futura específica.

Rollback de código: voltar a ler `isActive`, mantendo colunas/tabela novas.
Rollback destrutivo só é permitido antes de haver eventos reais; depois disso,
preservar os dados órfãos é preferível a apagá-los.

### 7.2 Migration B — oportunidade e histórico

Adicionar:

- `Opportunity` com `workspaceId`, `leadId`, `instagramAccountId`,
  `automationId?`, `sourceDmLogId?`, `sourcePostId?`, `sourceKeyword?`, status,
  responsável, produto/oferta, valores, moeda, próxima ação, prazo, motivo de
  perda, datas de ganho/perda/entrada na etapa, versão e timestamps;
- `OpportunityEvent` imutável com ator, tipo, estados anterior/novo e payload;
- índices por `(workspaceId, status)`, `(workspaceId, assignedToUserId)`,
  `(workspaceId, nextActionAt)` e `(workspaceId, updatedAt)`.

Backfill: não fabricar oportunidades ganhas a partir de cliques ou `Lead.status`.
Criar oportunidade legada apenas para `Lead` já persistido e marcar
`backfilled=true`, com origem desconhecida. `GANHO` legado tem valor `null` e
não entra em receita.

Rollback de código: parar dual-write e ocultar as telas novas. Tabelas ficam
preservadas. Um down migration só pode ser usado em ambiente sem dados.

### 7.3 Migration C — timeline e atribuição por entrega

Adicionar:

- `CommercialEvent` para comentário, DM recebida, DM automática, mensagem
  humana, follow-up, clique e correção de intenção;
- chave externa idempotente por conta/tipo/evento;
- `TrackedDelivery` com token opaco, `trackedLinkId`, `dmLogId`, `leadId?` e
  `opportunityId?`;
- `LinkClick.trackedDeliveryId?` e `LinkClick.leadId?`;
- relações opcionais em `DmLog` para lead/oportunidade.

Backfill: cliques legados continuam sem contato. Não tentar inferir pessoa por
IP, user-agent ou proximidade temporal.

Rollback de código: voltar ao slug de campanha; preservar entregas e eventos
já capturados. Nunca remover dados de atribuição para simplificar rollback.

### 7.4 Regras de migration

- Schema/migration entra em PR separado do comportamento.
- Toda migration é testada numa base vazia e numa cópia sanitizada com dados
  legados.
- Foreign keys de novas relações começam opcionais quando houver legado.
- Backfills são idempotentes, observáveis e executáveis em lotes.
- Nenhuma migration renomeia ou remove campos no mesmo deploy que muda a
  leitura.
- Valores monetários usam `BigInt`/inteiro em centavos e moeda explícita.

## 8. Fases pequenas e atômicas

| Fase | Unidade revertível | Entrega | Critério de saída |
| --- | --- | --- | --- |
| 0 | Vocabulário e rotas | Padronizar labels para pt-BR e Campanhas/Conversas/Agora; sem alterar dados. | Nenhum texto principal em inglês; links antigos continuam funcionando. |
| 1 | Segurança de ativação | Campanha nova salva pausada; revisão e ação de ativar ficam separadas e auditadas. | Nenhum `POST` cria campanha ativa; teste prova idempotência e autorização. |
| 2 | Fundação de dados | Aplicar somente Migration A e B, sem telas novas. | Migration sobe em base vazia/legada; rollback de código funciona; dados existentes preservados. |
| 3 | Captura comercial | Criar lead no primeiro sinal e dual-write de eventos/opportunity sem mudar UI. | Reprocessar o mesmo webhook não duplica contato, oportunidade ou evento. |
| 4 | Oportunidades | API, lista e kanban com etapa, responsável, filtros, nota, próxima ação e SLA. | Toda transição aparece na timeline e respeita workspace/papel. |
| 5 | Agora | Substituir o painel inicial por fila de ações agregada; absorver Heatmap. | Cada item explica prioridade e leva à ação correta; indisponível não vira zero. |
| 6 | Conversas contextuais | Renomear inbox, anexar origem/campanha/etapa/responsável/notas e persistir envio humano. | Resposta enviada registra ator e resultado; janela fechada tem recuperação clara. |
| 7 | Onboarding | Objetivo, conexão, publicação, intenção, experiência, revisão e ativação. | Usuário chega à primeira campanha pausada sem documentação externa. |
| 8 | Simulador e teste | Preview passa a mostrar sequência, tempos, sucesso/falha e teste interno seguro. | Payload do preview é o mesmo validado pelo servidor; teste não atinge público real. |
| 9 | Radar de intenção | Classes determinísticas, sinais explicados, correção e feedback humano. | Cada classificação mostra razões; fallback funciona sem IA. |
| 10 | Atribuição e resultados | Migration C, links por entrega, funil e receita confirmada/influenciada separadas. | Cada número tem definição, origem e denominador; clique nunca conta como venda. |
| 11 | Equipes e agências | Filas por responsável, SLA, visão por cliente, alertas e permissões. | Testes de isolamento e papel cobrem leituras e mutações. |
| 12 | Saúde operacional | Separar saúde técnica/comercial com impacto, causa, ação e links. | Métricas globais não vazam entre workspaces; cada alerta é acionável. |
| 13 | Copiloto | Resumo, sugestão, objeção e próxima ação, sem envio automático. | Produto opera sem IA; sugestão, aprovação e envio são eventos distintos. |

Cada fase deve ter seu próprio conjunto de testes e não misturar refatoração
ampla com comportamento novo.

## 9. Critérios de aceite rastreáveis

| ID | Critério | Verificação mínima |
| --- | --- | --- |
| AC-ONB-01 | Novo usuário conecta Instagram e prepara a primeira campanha sem documentação externa. | Teste E2E com conta sandbox/tester, desktop e mobile. |
| AC-NEXT-01 | Cada etapa mostra o próximo passo ou bloqueio acionável. | Revisão de todos os estados `loading`, vazio, erro e permissão. |
| AC-ACT-01 | Nenhuma campanha é ativada acidentalmente. | Testes de API e UI provam criação `DRAFT/PAUSED`, confirmação e idempotência. |
| AC-SIM-01 | Preview representa exatamente o payload validado e a sequência executável. | Testes de contrato + inspeção visual comentário/DM/follow/link/follow-up. |
| AC-LEAD-01 | Cada contato tem origem e timeline identificáveis quando a origem existe. | Reprocessamento idempotente de webhook e consulta de timeline. |
| AC-WIN-01 | Cada ganho pertence a oportunidade e contato; associação de campanha é explícita ou indisponível. | Teste de transição `GANHO` e leitura do evento. |
| AC-METRIC-01 | Clique nunca é apresentado como venda. | Testes de agregação e cópia em Agora, Resultados e Relatórios. |
| AC-HEALTH-01 | Falhas técnicas e resultados comerciais ficam em seções e contratos distintos. | Testes de resposta e inspeção de navegação. |
| AC-RESP-01 | Fluxos principais funcionam em 390, 768, 1440 e 1680 px sem overflow horizontal indevido. | QA visual com `scrollWidth/clientWidth`. |
| AC-STATE-01 | Vazio, loading, erro, retry e falta de permissão são tratados. | Matriz de estados por tela e testes de componentes/rotas. |
| AC-AI-01 | Produto segue útil quando IA está indisponível. | Desligar provider/flag e concluir fluxo determinístico. |
| AC-TENANT-01 | Dados de um workspace nunca aparecem em outro. | Testes de integração com dois workspaces em toda rota privada nova e alterada. |
| AC-SECRET-01 | Nenhum segredo aparece em cliente, resposta ou log. | Busca automatizada, teste de serialização e revisão de payloads de erro. |
| AC-REG-01 | Testes existentes continuam passando. | `npm test`, `npm run lint`, `npm run typecheck` e `npm run build`. |
| AC-MIG-01 | Migrations funcionam em base vazia e com dados legados. | Deploy/down em base temporária e validação de contagens. |
| AC-A11Y-01 | Jornada é operável por teclado, com foco e nomes acessíveis. | Teste de tabulação e auditoria dos switches, tabs, modais e formulários. |
| AC-AUDIT-01 | Ativação, transição, atribuição e envio humano registram ator e data. | Testes de eventos imutáveis e leitura cronológica. |
| AC-MONEY-01 | Receita confirmada e influenciada não se confundem. | Fixtures com ganho sem valor, ganho sem campanha e ganho atribuído. |

Observação de acessibilidade atual: o toggle compartilhado do builder é um
`button` sem `role="switch"`, `aria-checked` ou nome próprio
(`components/campaign-builder.tsx:117-138`). A correção pertence à fase que
alterar o wizard, com teste de teclado e leitor de tela.

## 10. Itens dependentes da Meta

Não marcar como concluído sem evidência em conta tester/sandbox autorizada:

- Advanced Access ou papel de tester para
  `instagram_business_basic`, `instagram_business_manage_comments` e
  `instagram_business_manage_messages`.
- OAuth completo, escopos efetivamente concedidos e armazenamento do
  `user_id` profissional.
- Assinatura de webhook para `comments` e `messages`.
- Entrega real de comentário, postback, read receipt e DM recebida.
- Private reply por comentário e limite de uma resposta privada.
- Resposta pública, templates com botão e fallback aceito pela API.
- Consulta `is_user_follow_business` e comportamento quando a resposta é
  indisponível.
- Janela de 24 horas para respostas humanas e follow-ups.
- Listagem de posts, próximo reel, insights e histórico de conversas.
- Rate limits, erro 368, retries e cobertura real do reconciliador.
- App em modo Live e revisão para contas fora do conjunto de testers.
- Limitações de comentários ocultos, spam e dados que a API não devolve.

Estados de Meta devem registrar a última observação e nunca transformar ausência
de resposta em “sem permissão” ou zero.

## 11. Hipóteses não comprovadas

1. `STRIPE_PRICE_ID` aponta para BRL 8.700 recorrente mensal.
2. Billing enforcement está ligado no ambiente que atende usuários reais.
3. O app Meta está Live e possui Advanced Access; a UI atual indica que pode
   estar em Acesso Padrão/tester.
4. Webhooks reais chegam ao domínio primário sem redirecionamento.
5. O worker e Redis de produção compartilham configuração com a aplicação web.
6. A taxa de sucesso do polling cobre comentários perdidos em volume real.
7. `is_user_follow_business` é disponível e estável para as contas-alvo.
8. Os 20 eventos de conversa devolvidos pela Meta são suficientes para contexto
   comercial; hoje não há histórico local complementar.
9. O score atual melhora a ordem de atendimento; não há calibração com ganhos.
10. Usuários entendem “Mapa de Calor”, “Oportunidades” e “Central de vendas” do
    mesmo modo que o código pretende.
11. O relatório público por slug atende ao nível de privacidade esperado e o
    slug nunca foi compartilhado indevidamente.
12. Ganhos/perdas já marcados no `Lead` representam decisões comerciais reais;
    não há histórico para comprovar quem marcou ou por quê.
13. Números e alegações públicas da Gaio representam uso real; a auditoria local
    não verificou sua área autenticada nem seus resultados.
14. A home e as telas autenticadas mantêm o sistema visual aprovado em todos os
    breakpoints; somente a home possui captura documentada no repositório.

## 12. Gate de conclusão por fase

Uma fase só pode ser chamada de concluída quando houver, proporcionalmente ao
risco:

- testes de regra e integração novos;
- regressão dos testes existentes;
- lint, typecheck e build;
- migration testada, quando aplicável;
- revisão de autorização e isolamento por workspace;
- inspeção em desktop e mobile;
- navegação por teclado, foco e nomes acessíveis;
- estados vazio, loading, erro, retry e falta de permissão;
- React Doctor para mudanças React;
- evidência Meta separada da evidência local;
- relatório final separado em implementado, validado, pendente, dependente da
  Meta e hipótese não comprovada.

Build verde, isoladamente, não prova prontidão operacional ou comercial.
