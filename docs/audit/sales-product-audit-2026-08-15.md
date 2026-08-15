# Auditoria final — Comentou

Data: 15 de agosto de 2026

## Resultado executivo

A superfície SaaS está coerente com a marca Comentou, o plano de R$ 87/mês e a proposta de transformar comentários com intenção em conversas comerciais. O dashboard agora separa indicadores comerciais comprováveis da saúde operacional.

Métrica norte recomendada: **quantidade semanal de comentários com intenção que avançam para uma conversa comercial**.

## Funil disponível hoje

1. Comentários com intenção — saudável. Definido de forma verificável como `DmLog` com palavra-chave correspondente.
2. Contatos únicos — saudável com ressalva. Pessoas distintas entre os comentários com intenção no período.
3. DMs entregues — saudável. O status de entrega é persistido e auditável.
4. Cliques — saudável como indicador intermediário. Não equivale a oportunidade ou venda.
5. Abordagem 1:1 — parcial. A caixa de entrada permite conversar, mas a ação humana não é persistida como etapa comercial.
6. Oportunidade e venda — não implementado. Ainda não há estágio, responsável, valor, ganho/perda ou receita atribuída.

## Mudanças validadas

- Marca oficial Comentou e paleta azul aplicadas.
- Plus Jakarta Sans e ícones Lucide incorporados ao shell.
- Home reposicionada integralmente em português.
- Oferta única de R$ 87/mês com leads ilimitados comunicada com ressalvas.
- Dashboard reestruturado para crescimento de comentários com intenção.
- Comparação com período anterior adicionada.
- Saúde de entrega separada dos resultados comerciais.
- Dependências atualizadas e auditoria de segurança zerada.

## Prioridades seguintes

### P0

- Persistir `Lead`, `LeadEvent` e `Opportunity`.
- Registrar abordagem humana, resposta, ganho, perda e valor da venda.
- Vincular clique ao contato e à interação que o originou.
- Confirmar no Stripe que `STRIPE_PRICE_ID` aponta para BRL 8.700 recorrente mensal.

### P1

- Criar fila comercial com responsável, prioridade e SLA.
- Permitir marcar uma oportunidade como ganha ou perdida.
- Exibir vendas, receita e taxa de fechamento somente depois desses eventos existirem.
- Persistir série histórica de comentários capturados e qualificados.

### P2

- Integrar CRM ou checkout para atribuição automática.
- Criar scoring de intenção e ranking por receita.
- Adicionar metas comerciais e previsão de pipeline.

## Evidência visual

Captura aceita: `docs/audit/01-home.png`.

A home foi inspecionada renderizada em navegador. O dashboard autenticado não pôde ser capturado localmente sem uma sessão de usuário e sua avaliação visual ficou limitada à revisão de código e build.

## Disclaimer recomendado

A Comentou automatiza a identificação e o primeiro contato com pessoas que interagem no Instagram. Resultados de vendas variam conforme oferta, conteúdo, atendimento e mercado. A plataforma não garante faturamento e depende da disponibilidade, permissões e limites da API oficial da Meta. “Leads ilimitados” significa que a Comentou não aplica limite contratual de leads no plano; limites técnicos e políticas da Meta continuam válidos. Comentários com intenção, DMs e cliques são indicadores de avanço no funil e não comprovam, isoladamente, oportunidade ou venda concluída.

final result: passed with documented product-data limitations
