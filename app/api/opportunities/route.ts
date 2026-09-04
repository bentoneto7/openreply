import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { opportunityListQuerySchema, type OpportunitySort } from "@/lib/crm/contracts";
import { opportunityListSelect, toOpportunityListDto } from "@/lib/crm/opportunity-dto";
import { decodeOpportunityCursor, encodeOpportunityCursor } from "@/lib/crm/opportunity";
import {
  buildEngagementIndex,
  decodeEngagementCursor,
  encodeEngagementCursor,
  engagementWindowStart,
  ENGAGEMENT_PERIOD,
  ENGAGEMENT_SIGNAL_SAMPLE,
  isAfterEngagementCursor,
  rankByEngagement,
} from "@/lib/crm/opportunity-engagement";
import { intentCommentFilter, SIGNAL_PREFIXES } from "@/lib/tracking/analytics";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ListWindow = {
  period: typeof ENGAGEMENT_PERIOD;
  since: string;
  /** A amostra de sinais bateu no teto: a ordem pode estar incompleta. */
  truncated: boolean;
};

function emptyPage(limit: number, sort: OpportunitySort, window: ListWindow | null) {
  return NextResponse.json(
    {
      success: true,
      data: {
        items: [],
        page: { limit, hasMore: false, nextCursor: null },
        sort,
        window,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  const parsed = opportunityListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Filtros inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { sort, limit } = parsed.data;

  if (parsed.data.instagramAccountId) {
    const instagramAccount = await prisma.instagramAccount.findFirst({
      where: {
        id: parsed.data.instagramAccountId,
        workspaceId: context.workspaceId,
      },
      select: { id: true },
    });

    // Uma conta ausente e uma conta de outro workspace produzem o mesmo recorte
    // vazio. Isso preserva o contrato da listagem sem revelar a existência de
    // recursos de outro cliente.
    if (!instagramAccount) {
      return emptyPage(limit, sort, null);
    }
  }

  // Filtros que valem para as duas ordens. O recorte do cursor fica de fora
  // porque cada ordem pagina pela própria chave.
  const filters: Prisma.LeadWhereInput = {
    workspaceId: context.workspaceId,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.instagramAccountId
      ? { instagramAccountId: parsed.data.instagramAccountId }
      : {}),
    ...(parsed.data.commenterId ? { commenterId: parsed.data.commenterId } : {}),
    ...(parsed.data.assigneeMemberId ? { assigneeMemberId: parsed.data.assigneeMemberId } : {}),
    ...(parsed.data.intentCategory ? { intentCategory: parsed.data.intentCategory } : {}),
    ...(parsed.data.sourceAutomationId ? { sourceAutomationId: parsed.data.sourceAutomationId } : {}),
    ...(parsed.data.q
      ? {
          OR: [
            { commenterName: { contains: parsed.data.q, mode: "insensitive" } },
            { commenterId: { contains: parsed.data.q, mode: "insensitive" } },
            { productOffer: { contains: parsed.data.q, mode: "insensitive" } },
            { originKeyword: { contains: parsed.data.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  if (sort === "engagement") {
    return listByEngagement({
      workspaceId: context.workspaceId,
      instagramAccountId: parsed.data.instagramAccountId,
      filters,
      limit,
      cursor: parsed.data.cursor,
    });
  }

  const cursor = parsed.data.cursor ? decodeOpportunityCursor(parsed.data.cursor) : null;
  if (parsed.data.cursor && !cursor) {
    return NextResponse.json({ success: false, error: "Cursor inválido" }, { status: 400 });
  }

  const where: Prisma.LeadWhereInput = {
    ...filters,
    ...(cursor
      ? {
          AND: [
            {
              OR: [
                { updatedAt: { lt: new Date(cursor.updatedAt) } },
                { updatedAt: new Date(cursor.updatedAt), id: { lt: cursor.id } },
              ],
            },
          ],
        }
      : {}),
  };

  const rows = await prisma.lead.findMany({
    where,
    select: opportunityListSelect,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows.at(-1);

  return NextResponse.json(
    {
      success: true,
      data: {
        items: pageRows.map((row) => toOpportunityListDto(row)),
        page: {
          limit,
          hasMore,
          nextCursor:
            hasMore && last
              ? encodeOpportunityCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
              : null,
        },
        sort: "recent" satisfies OpportunitySort,
        window: null,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/**
 * Fila do mais engajado para o menos engajado, dentro dos últimos 7 dias.
 *
 * A ordem sai dos sinais observados (DmLog), não de colunas do Lead, então ela
 * não pode ser um `orderBy` do Prisma: os sinais são pontuados e agregados por
 * pessoa antes de virarem posição. O recorte de 7 dias é o que mantém isso
 * barato — a amostra de sinais é limitada e as oportunidades buscadas são só as
 * das pessoas que apareceram nela.
 */
async function listByEngagement(
  input: {
    workspaceId: string;
    instagramAccountId?: string;
    filters: Prisma.LeadWhereInput;
    limit: number;
    cursor?: string;
  }
) {
  const cursor = input.cursor ? decodeEngagementCursor(input.cursor) : null;
  if (input.cursor && !cursor) {
    return NextResponse.json({ success: false, error: "Cursor inválido" }, { status: 400 });
  }

  const since = engagementWindowStart();
  const window: ListWindow = {
    period: ENGAGEMENT_PERIOD,
    since: since.toISOString(),
    truncated: false,
  };

  const signalWindow = {
    workspaceId: input.workspaceId,
    createdAt: { gte: since },
    ...(input.instagramAccountId ? { instagramAccountId: input.instagramAccountId } : {}),
  };
  const include = {
    automation: { select: { name: true } },
    instagramAccount: { select: { username: true } },
  };

  // Comentários e sinais de DM em janelas separadas, como no mapa de calor: numa
  // query só, uma conta com muitas DMs empurraria os comentários para fora da
  // amostra e mudaria a ordem sem aviso.
  const [comments, dmSignals] = await Promise.all([
    prisma.dmLog.findMany({
      where: { ...signalWindow, ...intentCommentFilter },
      orderBy: { createdAt: "desc" },
      take: ENGAGEMENT_SIGNAL_SAMPLE,
      include,
    }),
    prisma.dmLog.findMany({
      where: {
        ...signalWindow,
        OR: SIGNAL_PREFIXES.map((prefix) => ({ commentId: { startsWith: prefix } })),
      },
      orderBy: { createdAt: "desc" },
      take: ENGAGEMENT_SIGNAL_SAMPLE,
      include,
    }),
  ]);

  window.truncated =
    comments.length === ENGAGEMENT_SIGNAL_SAMPLE || dmSignals.length === ENGAGEMENT_SIGNAL_SAMPLE;

  const logs = [...comments, ...dmSignals];
  if (logs.length === 0) return emptyPage(input.limit, "engagement", window);

  const engagementIndex = buildEngagementIndex(logs);
  const commenterIds = [...new Set(logs.map((log) => log.commenterId))];

  // Só as oportunidades de quem teve sinal no período. Sem esse recorte a
  // consulta cresceria com o CRM inteiro para depois descartar quase tudo.
  const rows = await prisma.lead.findMany({
    where: { ...input.filters, commenterId: { in: commenterIds } },
    select: opportunityListSelect,
  });

  const ranked = rankByEngagement(rows, engagementIndex);
  const page = (cursor ? ranked.filter((item) => isAfterEngagementCursor(item, cursor)) : ranked).slice(
    0,
    input.limit + 1
  );
  const hasMore = page.length > input.limit;
  const pageItems = hasMore ? page.slice(0, input.limit) : page;
  const last = pageItems.at(-1);

  return NextResponse.json(
    {
      success: true,
      data: {
        items: pageItems.map((item) => toOpportunityListDto(item.row, item.engagement)),
        page: {
          limit: input.limit,
          hasMore,
          nextCursor:
            hasMore && last
              ? encodeEngagementCursor({
                  score: last.engagement.score,
                  lastSeenAt: last.engagement.lastSeenAt,
                  id: last.row.id,
                })
              : null,
        },
        sort: "engagement" satisfies OpportunitySort,
        window,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
