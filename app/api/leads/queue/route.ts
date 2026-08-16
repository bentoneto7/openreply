import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { getConversations, getUserFollowStatus, MetaApiError } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { buildDmQueue, selectInboundThreads, DmQueueAccountIdentityError } from "@/lib/leads/dm-queue";

export const dynamic = "force-dynamic";

/**
 * Vocabulário mínimo para quando o workspace ainda não tem automação nenhuma —
 * é exatamente o caso que esta fila existe para atender. Serve só como reforço
 * de desempate; nada entra ou sai da fila por causa dele.
 */
const DEFAULT_KEYWORDS = ["preço", "preco", "valor", "quanto", "comprar", "link", "quero", "orçamento", "orcamento"];

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );
  if (!account) {
    return NextResponse.json({ success: false, error: "Nenhuma conta do Instagram conectada." }, { status: 400 });
  }

  try {
    const accessToken = decryptToken(account.accessToken);
    const [conversations, automations] = await Promise.all([
      getConversations(accessToken, account.instagramId),
      prisma.automation.findMany({
        where: { workspaceId, instagramAccountId: account.id },
        select: { keywords: true },
      }),
    ]);

    const ownKeywords = [...new Set(automations.flatMap((automation) => automation.keywords))];
    const keywords = ownKeywords.length > 0 ? ownKeywords : DEFAULT_KEYWORDS;

    const inbound = selectInboundThreads(conversations, account.instagramId);

    // ponytail: um GET por conversa recebida (teto de 50, que é o limite da
    // listagem). Se pesar, guardar is_user_follow_business no Lead e revalidar
    // por lá.
    const followStatus = Object.fromEntries(
      await Promise.all(
        inbound.map(async (thread) => [
          thread.commenterId,
          await getUserFollowStatus(accessToken, thread.commenterId),
        ] as const)
      )
    );

    const queue = buildDmQueue(inbound, {
      instagramAccountId: account.id,
      keywords,
      followStatus,
    });

    // Só os leads de quem está na fila, como no mapa de calor.
    const leads = queue.length === 0 ? [] : await prisma.lead.findMany({
      where: { instagramAccountId: account.id, commenterId: { in: queue.map((item) => item.commenterId) } },
      select: { commenterId: true, status: true, note: true, lastContactedAt: true },
    });
    const leadById = new Map(leads.map((lead) => [lead.commenterId, lead]));

    return NextResponse.json(
      {
        success: true,
        data: {
          account: { id: account.id, username: account.username },
          // Rótulos honestos: a fila é feita de DMs recebidas e do prazo da
          // janela de 24h. Nenhum sinal de comentário existe aqui.
          source: "instagram_dm_conversations",
          keywordSource: ownKeywords.length > 0 ? "automations" : "default",
          conversationsScanned: conversations.length,
          queue: queue.map((item) => {
            const lead = leadById.get(item.commenterId);
            return {
              ...item,
              leadStatus: lead?.status ?? "NOVO",
              leadNote: lead?.note ?? null,
              lastContactedAt: lead?.lastContactedAt?.toISOString() ?? null,
            };
          }),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    // A conta não foi reconhecida nas próprias conversas: a fila sairia
    // invertida. Falhar visível, com o que precisa ser feito.
    if (err instanceof DmQueueAccountIdentityError) {
      return NextResponse.json(
        { success: false, error: err.message, code: "account_identity_unverified" },
        { status: 409 }
      );
    }
    console.error("[LeadsQueue] Error:", err);
    const message = err instanceof MetaApiError ? err.message : "Falha ao montar a fila de leads";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
