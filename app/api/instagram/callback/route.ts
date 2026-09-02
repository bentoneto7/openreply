import { NextRequest, NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getRequestBaseUrl } from "@/lib/env";
import { canConnectInstagramAccount } from "@/lib/instagram-accounts";
import { getLongLivedToken, getUserInfo, subscribeInstagramAccountToWebhooks } from "@/lib/meta/client";
import {
  encryptToken,
  exchangeCodeForToken,
  verifyOAuthState,
} from "@/lib/meta/oauth";
import { canManageWorkspace } from "@/lib/workspace-access";
import {
  logServerError,
  logServerWarning,
} from "@/lib/security/safe-error";

async function runInstagramStep<T>(step: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`${step}: ${message}`);
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = verifyOAuthState(request.nextUrl.searchParams.get("state"));
  const baseUrl = getRequestBaseUrl(request);

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?instagram=denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/settings?instagram=invalid`);
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: state.workspaceId,
      userId: user.id,
    },
  });

  if (!membership || !canManageWorkspace(membership.role)) {
    return NextResponse.redirect(`${baseUrl}/settings?instagram=forbidden`);
  }

  let grantedLabel = "(exchange not reached)";

  try {
    const redirectUri = `${baseUrl}/api/instagram/callback`;
    const {
      accessToken: shortLivedToken,
      expiresIn: exchangeExpiresIn,
      grantedScopes,
    } = await runInstagramStep("code exchange", () =>
      exchangeCodeForToken(code, redirectUri)
    );
    // What Meta actually granted, as opposed to what we asked for. A narrower
    // grant produces a token that authenticates but can call nothing, and that
    // is indistinguishable from a routing bug unless it is stated outright.
    grantedLabel = grantedScopes.length
      ? grantedScopes.map((s) => s.replace("instagram_business_", "")).join("+")
      : "(none reported)";
    const { accessToken: longLivedToken, expiresIn: exchangedExpiresIn } =
      await runInstagramStep("long-lived token", () =>
        getLongLivedToken(shortLivedToken)
      );
    // Business Login hands back an already-long-lived token, in which case
    // getLongLivedToken returns it unchanged and the authoritative lifetime is
    // the one the code exchange reported. Prefer that over the 60-day default.
    const expiresIn =
      longLivedToken === shortLivedToken && exchangeExpiresIn
        ? exchangeExpiresIn
        : exchangedExpiresIn;
    const userInfo = await runInstagramStep("profile lookup", () =>
      getUserInfo(longLivedToken)
    );
    // Webhooks and the messaging API key off the professional account ID
    // (user_id), not the app-scoped `id`. Store user_id so comment webhooks
    // can be matched back to this account. Fall back to id if user_id is
    // ever absent.
    const instagramId = userInfo.user_id ?? userInfo.id;
    const connection = await canConnectInstagramAccount({
      workspaceId: state.workspaceId,
      instagramId,
    });

    if (!connection.allowed) {
      return NextResponse.redirect(
        `${baseUrl}/settings?instagram=already_connected`
      );
    }

    const encryptedToken = encryptToken(longLivedToken);
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    let webhookSubscribed = false;
    try {
      const subscription = await subscribeInstagramAccountToWebhooks(
        instagramId,
        longLivedToken
      );
      webhookSubscribed = Boolean(subscription.success);
    } catch (subscriptionError) {
      logServerWarning(
        "[Instagram Callback] Webhook subscription failed",
        subscriptionError
      );
    }

    await prisma.instagramAccount.upsert({
      where: { instagramId },
      create: {
        workspaceId: state.workspaceId,
        instagramId,
        username: userInfo.username,
        name: userInfo.name,
        accessToken: encryptedToken,
        tokenExpiresAt,
        webhookSubscribed,
      },
      update: {
        workspaceId: state.workspaceId,
        username: userInfo.username,
        name: userInfo.name,
        accessToken: encryptedToken,
        tokenExpiresAt,
        webhookSubscribed,
      },
    });

    return NextResponse.redirect(`${baseUrl}/onboarding?connected=true`);
  } catch (err) {
    const message = `[scopes ${grantedLabel}] ${
      err instanceof Error ? err.message : "Unknown error"
    }`;
    logServerError("[Instagram Callback] Error", err);
    // The message is the only diagnostic a self-hoster gets for a failed
    // connect, so persist it alongside the other operational events rather
    // than leaving it in server logs they may not be able to reach.
    await prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "ERROR",
          workspaceId: state.workspaceId,
          message: "Instagram connection failed",
          payload: { reason: message },
        },
      })
      .catch(() => {});

    return NextResponse.redirect(
      `${baseUrl}/settings?instagram=failed&reason=${encodeURIComponent(
        message.slice(0, 200)
      )}`
    );
  }
}
