export type HeatmapPeriod = "24h" | "7d" | "30d" | "90d";

export interface HeatmapLog {
  id: string;
  instagramAccountId: string;
  commenterId: string;
  commenterName: string | null;
  commentId: string;
  commentText: string;
  matchedKeyword: string | null;
  status: string;
  createdAt: Date;
  automation: { name: string };
  instagramAccount: { username: string };
}

export interface HeatmapQueueItem {
  key: string;
  instagramAccountId: string;
  instagramUsername: string;
  commenterId: string;
  commenterName: string | null;
  latestComment: string;
  latestKeyword: string | null;
  automationName: string;
  lastSeenAt: string;
  signalCount: number;
  sentCount: number;
  priorityLabel: "Revisar primeiro" | "Revisar em seguida" | "Recente";
  reasons: string[];
}

const PERIOD_HOURS: Record<HeatmapPeriod, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30, "90d": 24 * 90 };

export function periodStart(period: HeatmapPeriod, now = new Date()) {
  return new Date(now.getTime() - PERIOD_HOURS[period] * 60 * 60 * 1000);
}

export function isHeatmapPeriod(value: string | null): value is HeatmapPeriod {
  return value === "24h" || value === "7d" || value === "30d" || value === "90d";
}

export function buildHeatmapQueue(logs: HeatmapLog[], now = new Date()): HeatmapQueueItem[] {
  const groups = new Map<string, HeatmapLog[]>();
  for (const log of logs) {
    if (log.commentId.startsWith("dm:") || log.commentId.startsWith("reveal:")) continue;
    const key = `${log.instagramAccountId}:${log.commenterId}`;
    groups.set(key, [...(groups.get(key) ?? []), log]);
  }

  return [...groups.entries()].map(([key, group]) => {
    const ordered = [...group].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = ordered[0];
    const distinctComments = new Set(group.map((item) => item.commentId)).size;
    const keywordCount = group.filter((item) => Boolean(item.matchedKeyword)).length;
    const ageHours = Math.max(0, (now.getTime() - latest.createdAt.getTime()) / 3_600_000);
    const weight = (keywordCount > 0 ? 40 : 0) + Math.min(20, (distinctComments - 1) * 10) + (ageHours <= 24 ? 30 : ageHours <= 168 ? 15 : 5);
    const reasons = [
      keywordCount > 0 ? `${keywordCount} sinal(is) com palavra-chave` : "comentário que acionou automação",
      `${distinctComments} comentário${distinctComments === 1 ? "" : "s"} distinto${distinctComments === 1 ? "" : "s"} observado${distinctComments === 1 ? "" : "s"}`,
      ageHours <= 24 ? "interação nas últimas 24 horas" : "interação recente no período",
    ];
    const priorityLabel: HeatmapQueueItem["priorityLabel"] = weight >= 70 ? "Revisar primeiro" : weight >= 45 ? "Revisar em seguida" : "Recente";
    return {
      key, instagramAccountId: latest.instagramAccountId, instagramUsername: latest.instagramAccount.username,
      commenterId: latest.commenterId, commenterName: latest.commenterName, latestComment: latest.commentText,
      latestKeyword: latest.matchedKeyword, automationName: latest.automation.name,
      lastSeenAt: latest.createdAt.toISOString(), signalCount: distinctComments,
      sentCount: group.filter((item) => item.status === "SENT").length,
      priorityLabel,
      reasons, _weight: weight,
    };
  }).sort((a, b) => b._weight - a._weight || new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
    .map((item) => ({
      key: item.key, instagramAccountId: item.instagramAccountId, instagramUsername: item.instagramUsername,
      commenterId: item.commenterId, commenterName: item.commenterName, latestComment: item.latestComment,
      latestKeyword: item.latestKeyword, automationName: item.automationName, lastSeenAt: item.lastSeenAt,
      signalCount: item.signalCount, sentCount: item.sentCount, priorityLabel: item.priorityLabel, reasons: item.reasons,
    }));
}
