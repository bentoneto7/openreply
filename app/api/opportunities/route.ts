import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { opportunityListQuerySchema } from "@/lib/crm/contracts";
import { opportunityListSelect, toOpportunityListDto } from "@/lib/crm/opportunity-dto";
import { decodeOpportunityCursor, encodeOpportunityCursor } from "@/lib/crm/opportunity";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const cursor = parsed.data.cursor ? decodeOpportunityCursor(parsed.data.cursor) : null;
  if (parsed.data.cursor && !cursor) {
    return NextResponse.json({ success: false, error: "Cursor inválido" }, { status: 400 });
  }

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
      return NextResponse.json(
        {
          success: true,
          data: {
            items: [],
            page: {
              limit: parsed.data.limit,
              hasMore: false,
              nextCursor: null,
            },
          },
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
  }

  const where: Prisma.LeadWhereInput = {
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
    take: parsed.data.limit + 1,
  });
  const hasMore = rows.length > parsed.data.limit;
  const pageRows = hasMore ? rows.slice(0, parsed.data.limit) : rows;
  const last = pageRows.at(-1);

  return NextResponse.json(
    {
      success: true,
      data: {
        items: pageRows.map(toOpportunityListDto),
        page: {
          limit: parsed.data.limit,
          hasMore,
          nextCursor:
            hasMore && last
              ? encodeOpportunityCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
              : null,
        },
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
