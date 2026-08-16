import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import {
  getAllUserMedia,
  getMediaInsights,
  PermissionError,
  type InstagramMedia,
} from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import {
  ensureFollowerHistory,
  getFollowerHistory,
  type FollowerHistoryPoint,
} from "@/lib/reports/follower-history";

// Allow time for paginated media + per-post insight calls on larger accounts.
export const maxDuration = 60;

// Safety ceiling for "all time": bounds pagination and the number of
// per-media insight requests so we can't hammer the API or time out.
const MAX_POSTS = 500;

// How many insight requests to run at once.
const INSIGHTS_CONCURRENCY = 8;

/** Map over items with a bounded number of in-flight async operations. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Sum only the posts that actually reported a value. Returns null — never 0 —
 * when no post did, so "unknown" is never rendered as a factual zero.
 */
function sumOrNull(values: Array<number | null>): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

export interface OverviewPost {
  id: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaType: string;
  timestamp: string;
  views: number | null;
  reach: number | null;
  likes: number;
  comments: number;
  saved: number | null;
  shares: number | null;
}

export interface OverviewResponse {
  account: { id: string; username: string };
  accounts: Array<{ id: string; username: string }>;
  requestedCount: "all" | number;
  truncated: boolean;
  /**
   * True only when every selected post returned insight data. Anything less —
   * a denied scope, or a partial answer — is false, so the UI never presents
   * an under-reported total as complete.
   */
  insightsAvailable: boolean;
  /** Current follower total, or null if Instagram did not return it. */
  followers: number | null;
  /**
   * Follower total per day, ascending. Independent of the selected post range —
   * limited to what has been snapshotted plus any 30-day insights backfill.
   */
  followerHistory: FollowerHistoryPoint[];
  /**
   * Summed over the selected posts. The insight-backed metrics are null when
   * no post reported them — the UI renders that as "—", not as 0. Likes and
   * comments come from basic media fields and are always numbers.
   */
  totals: {
    posts: number;
    views: number | null;
    reach: number | null;
    likes: number;
    comments: number;
    saved: number | null;
    shares: number | null;
  };
  /** Ordered by the ranking below: most-commented post first. */
  posts: OverviewPost[];
}

function isVideoLike(media: InstagramMedia): boolean {
  return (
    media.media_product_type === "REELS" || media.media_type === "VIDEO"
  );
}

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );

  if (!account) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Instagram account not connected. Please connect your account first.",
      },
      { status: 400 }
    );
  }

  try {
    const accessToken = decryptToken(account.accessToken);

    // `count` is either "all" or a positive integer (last N posts).
    const countParam = request.nextUrl.searchParams.get("count");
    const isAll = countParam === "all";
    const parsedCount = countParam ? Number.parseInt(countParam, 10) : NaN;
    const requestedCount: "all" | number = isAll
      ? "all"
      : Number.isFinite(parsedCount)
        ? Math.max(parsedCount, 1)
        : 50;

    const target = isAll
      ? MAX_POSTS
      : Math.min(requestedCount as number, MAX_POSTS);

    const media = await getAllUserMedia(accessToken, target);
    const truncated = media.length >= MAX_POSTS;

    // Likes and comments come free with basic media fields. Views / reach /
    // saved / shares require the insights permission, so fetch them per media
    // (bounded concurrency) and degrade gracefully if the token was granted
    // before that scope.
    const insights = await mapWithConcurrency(
      media,
      INSIGHTS_CONCURRENCY,
      async (m) => {
        const metrics = isVideoLike(m)
          ? ["views", "reach", "saved", "shares", "total_interactions"]
          : ["reach", "saved", "shares", "total_interactions"];
        try {
          return await getMediaInsights(accessToken, m.id, metrics);
        } catch (err) {
          if (!(err instanceof PermissionError)) {
            console.warn(
              "[Instagram Overview] Insights unavailable for media:",
              m.id,
              err instanceof Error ? err.message : err
            );
          }
          return null;
        }
      }
    );

    // Insights "worked" only if every post came back with data. A rejected
    // call returns null, and a missing scope can also resolve with an empty
    // payload — neither counts, so one lucky post can't hide the warning.
    const insightsAvailable = insights.every(
      (ins) => ins !== null && Object.keys(ins).length > 0
    );

    const posts: OverviewPost[] = media.map((m, i) => {
      const ins = insights[i];
      const likes = m.like_count ?? 0;
      const comments = m.comments_count ?? 0;
      return {
        id: m.id,
        caption: m.caption?.trim().slice(0, 120) ?? null,
        permalink: m.permalink ?? null,
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
        mediaType: m.media_product_type ?? m.media_type,
        timestamp: m.timestamp,
        views: ins?.views ?? null,
        reach: ins?.reach ?? null,
        likes,
        comments,
        saved: ins?.saved ?? null,
        shares: ins?.shares ?? null,
      };
    });

    // Rank by the conversation signal we have without the insights scope:
    // comments first, likes as the tiebreak, then newest, then id — the last
    // two make the order total, so two loads can never disagree.
    posts.sort(
      (a, b) =>
        b.comments - a.comments ||
        b.likes - a.likes ||
        b.timestamp.localeCompare(a.timestamp) ||
        a.id.localeCompare(b.id)
    );

    const totals = {
      posts: posts.length,
      views: sumOrNull(posts.map((p) => p.views)),
      reach: sumOrNull(posts.map((p) => p.reach)),
      likes: posts.reduce((n, p) => n + p.likes, 0),
      comments: posts.reduce((n, p) => n + p.comments, 0),
      saved: sumOrNull(posts.map((p) => p.saved)),
      shares: sumOrNull(posts.map((p) => p.shares)),
    };

    const accounts = await prisma.instagramAccount.findMany({
      where: { workspaceId },
      orderBy: { connectedAt: "desc" },
      select: { id: true, username: true },
    });

    // Followers is a point-in-time figure and deliberately not part of
    // `totals`, which sums over the selected posts. A failure here must not
    // take down the rest of the overview.
    let followers: number | null = null;
    let followerHistory: FollowerHistoryPoint[] = [];
    try {
      followers = await ensureFollowerHistory(
        { id: account.id, instagramId: account.instagramId },
        accessToken
      );
      followerHistory = await getFollowerHistory(account.id);
    } catch (err) {
      console.warn(
        "[Instagram Overview] Follower history unavailable:",
        err instanceof Error ? err.message : err
      );
    }

    const data: OverviewResponse = {
      account: { id: account.id, username: account.username },
      accounts,
      requestedCount,
      truncated,
      insightsAvailable,
      followers,
      followerHistory,
      totals,
      posts,
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[Instagram Overview] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load Instagram overview" },
      { status: 500 }
    );
  }
}
