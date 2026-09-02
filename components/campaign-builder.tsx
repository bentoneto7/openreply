"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import PostPicker from "@/components/post-picker";
import {
  buildActivationMutation,
  buildPausedCampaignMutation,
  getCampaignLinkIssue,
  type CampaignMutation,
} from "@/lib/campaign-activation";
import { readCache, writeCache } from "@/lib/client-cache";
import {
  IMPORT_ACCOUNT_KEY,
  IMPORT_QUEUE_KEY,
  type ImportRow,
} from "@/lib/import-queue";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";

type TriggerScope = "specific" | "any" | "next";
type MatchMode = "specific" | "any";
type FunnelStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type ObjectiveId =
  | "deliver"
  | "capture"
  | "sell"
  | "whatsapp"
  | "followers"
  | "faq"
  | "custom";
type SaveOutcome = "paused" | "active" | null;

const DRAFT_KEY = "comentou:campaign-builder:draft:v1";

const FUNNEL_STEPS = [
  { title: "Objetivo", description: "Resultado esperado" },
  { title: "Conexão", description: "Conta do Instagram" },
  { title: "Publicação", description: "Onde começa" },
  { title: "Intenção", description: "Quem entra" },
  { title: "Experiência", description: "Mensagens e entrega" },
  { title: "Revisão", description: "Jornada completa" },
  { title: "Ativação", description: "Confirmação segura" },
] as const;

const OBJECTIVES: {
  id: Exclude<ObjectiveId, "custom">;
  label: string;
  description: string;
  goal: string;
  defaultName: string;
  keywords: string[];
  dmMessage: string;
}[] = [
  {
    id: "deliver",
    label: "Entregar um link",
    description: "Envie catálogo, guia, aula ou página prometida.",
    goal: "Entregar um link",
    defaultName: "Entrega de link pelo Instagram",
    keywords: ["QUERO", "LINK", "GUIA"],
    dmMessage: "Olá, {username}! Aqui está o material que você pediu: {link}",
  },
  {
    id: "capture",
    label: "Captar interessados",
    description: "Leve pessoas com intenção para um formulário ou conversa.",
    goal: "Captar interessados",
    defaultName: "Captação de interessados",
    keywords: ["QUERO", "DETALHES", "INFORMAÇÕES"],
    dmMessage: "Olá, {username}! Separei os detalhes para você: {link}",
  },
  {
    id: "sell",
    label: "Vender um produto",
    description: "Responda preço, disponibilidade e acesso ao produto.",
    goal: "Vender um produto",
    defaultName: "Pedidos pelo Instagram",
    keywords: ["PREÇO", "COMPRAR", "QUERO"],
    dmMessage: "Olá, {username}! Confira preço e disponibilidade aqui: {link}",
  },
  {
    id: "whatsapp",
    label: "Levar pessoas para o WhatsApp",
    description: "Continue o atendimento ou orçamento em uma conversa no WhatsApp.",
    goal: "Levar pessoas para o WhatsApp",
    defaultName: "Atendimento pelo WhatsApp",
    keywords: ["WHATSAPP", "ATENDIMENTO", "FALAR"],
    dmMessage: "Olá, {username}! Continue o atendimento no WhatsApp: {link}",
  },
  {
    id: "followers",
    label: "Crescer seguidores",
    description: "Convide pessoas interessadas a acompanhar os próximos conteúdos.",
    goal: "Crescer seguidores",
    defaultName: "Crescimento de seguidores",
    keywords: ["SEGUIR", "QUERO", "CONTEÚDO"],
    dmMessage: "Olá, {username}! Obrigado pelo interesse. Siga o perfil para acompanhar os próximos conteúdos.",
  },
  {
    id: "faq",
    label: "Responder uma dúvida frequente",
    description: "Prepare uma resposta inicial para uma pergunta recorrente.",
    goal: "Responder uma dúvida frequente",
    defaultName: "Dúvida frequente pelo Instagram",
    keywords: ["DÚVIDA", "COMO", "AJUDA"],
    dmMessage: "Olá, {username}! Qual dúvida você quer resolver por aqui?",
  },
];

const TEMPLATE_OBJECTIVES: Record<string, Exclude<ObjectiveId, "custom">> = {
  "dtc-product-link": "sell",
  "real-estate-lead-form": "capture",
  "fitness-plan": "deliver",
  "course-webinar": "capture",
  "beauty-price-list": "whatsapp",
  "restaurant-menu": "whatsapp",
  "event-rsvp": "capture",
  "creator-media-kit": "capture",
};

const LEGACY_OBJECTIVES: Record<string, ObjectiveId> = {
  book: "whatsapp",
  launch: "capture",
};

const LEGACY_GOALS: Record<string, ObjectiveId> = {
  "Entregar link ou material": "deliver",
  "Captar contatos interessados": "capture",
  "Gerar pedidos de compra": "sell",
  "Gerar agendamentos": "whatsapp",
  "Divulgar lançamento ou evento": "capture",
};

function normalizeObjectiveId(value: unknown): ObjectiveId {
  if (typeof value !== "string") return "custom";
  if (OBJECTIVES.some((objective) => objective.id === value)) {
    return value as Exclude<ObjectiveId, "custom">;
  }
  return LEGACY_OBJECTIVES[value] ?? "custom";
}

function objectiveIdForGoal(goal: string | null) {
  if (!goal) return "custom" as const;
  return OBJECTIVES.find((objective) => objective.goal === goal)?.id ?? LEGACY_GOALS[goal] ?? "custom";
}

interface LoadedCampaign {
  id: string;
  name: string;
  goal: string | null;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmTriggerEnabled: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  isActive: boolean;
  instagramAccountId: string;
  trackedLinks?: { destinationUrl: string; label?: string | null }[];
}

interface DraftSnapshot {
  version: 1;
  updatedAt: string;
  objectiveId: ObjectiveId;
  goal: string;
  name: string;
  selectedAccountId: string;
  triggerScope: TriggerScope;
  postId: string | null;
  postUrl: string | null;
  postThumb: string | null;
  postCaption: string;
  matchMode: MatchMode;
  keywordText: string;
  dmTriggerEnabled: boolean;
  publicReplyEnabled: boolean;
  publicReplyMessages: string[];
  openingDmEnabled: boolean;
  openingDmMessage: string;
  openingDmButtonLabel: string;
  dmMessage: string;
  linkOpen: boolean;
  trackedDestinationUrl: string;
  linkButtonLabel: string;
  secondLinkOpen: boolean;
  secondaryDestinationUrl: string;
  secondaryButtonLabel: string;
  requireFollow: boolean;
  followPromptMessage: string;
  followPromptButtonLabel: string;
  followUpEnabled: boolean;
  followUpMessage: string;
  followUpDelayMinutes: number;
  advancedMode: boolean;
  currentStep: FunnelStep;
}

interface CampaignBuilderProps {
  mode: "new" | "edit";
  campaignId?: string;
  templateSlug?: string | null;
}

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Radio({ name, checked, onSelect, children }: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${checked ? "border-accent bg-accent/5" : "border-border hover:border-border-hover"}`}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="h-4 w-4 accent-blue-600" />
      <span className="flex-1 text-foreground">{children}</span>
    </label>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-zinc-300"}`}>
      <span aria-hidden="true" className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

async function executeMutation(mutation: CampaignMutation) {
  const response = await fetch(mutation.url, {
    method: mutation.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mutation.body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
    const firstField = fieldErrors && Object.keys(fieldErrors)[0];
    throw new Error(firstField ? `${firstField}: ${fieldErrors[firstField]?.[0] ?? "valor inválido"}` : data?.error ?? "Não foi possível salvar a campanha");
  }
  return data.data as { id: string };
}

export default function CampaignBuilder({ mode, campaignId, templateSlug }: CampaignBuilderProps) {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome>(null);
  const [outcomeDetail, setOutcomeDetail] = useState<string | null>(null);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);
  const [objectiveId, setObjectiveId] = useState<ObjectiveId>("deliver");
  const [goal, setGoal] = useState(OBJECTIVES[0].goal);
  const [name, setName] = useState(OBJECTIVES[0].defaultName);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsStatus, setAccountsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [triggerScope, setTriggerScope] = useState<TriggerScope>("specific");
  const [postId, setPostId] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState("");
  const [usedPosts, setUsedPosts] = useState<Record<string, string>>({});
  const [matchMode, setMatchMode] = useState<MatchMode>("specific");
  const [keywordText, setKeywordText] = useState(OBJECTIVES[0].keywords.join(", "));
  const [dmTriggerEnabled, setDmTriggerEnabled] = useState(false);
  const [publicReplyEnabled, setPublicReplyEnabled] = useState(false);
  const [publicReplyMessages, setPublicReplyMessages] = useState<string[]>([""]);
  const [openingDmEnabled, setOpeningDmEnabled] = useState(false);
  const [openingDmMessage, setOpeningDmMessage] = useState("");
  const [openingDmButtonLabel, setOpeningDmButtonLabel] = useState("");
  const [dmMessage, setDmMessage] = useState(OBJECTIVES[0].dmMessage);
  const [linkOpen, setLinkOpen] = useState(true);
  const [trackedDestinationUrl, setTrackedDestinationUrl] = useState("");
  const [linkButtonLabel, setLinkButtonLabel] = useState("Abrir link");
  const [secondLinkOpen, setSecondLinkOpen] = useState(false);
  const [secondaryDestinationUrl, setSecondaryDestinationUrl] = useState("");
  const [secondaryButtonLabel, setSecondaryButtonLabel] = useState("Abrir link");
  const [requireFollow, setRequireFollow] = useState(false);
  const [followPromptMessage, setFollowPromptMessage] = useState("");
  const [followPromptButtonLabel, setFollowPromptButtonLabel] = useState("Já estou seguindo");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpDelayMinutes, setFollowUpDelayMinutes] = useState(0);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");
  const [currentStep, setCurrentStep] = useState<FunnelStep>(0);
  const [reviewedCopy, setReviewedCopy] = useState(false);
  const [verifiedAudience, setVerifiedAudience] = useState(false);
  const [acceptedMetaDependency, setAcceptedMetaDependency] = useState(false);
  const [importQueue, setImportQueue] = useState<ImportRow[] | null>(null);
  const [importTotal, setImportTotal] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [autosaveLabel, setAutosaveLabel] = useState("Preparando rascunho local…");

  const keywords = useMemo(() => keywordText.split(",").map((keyword) => keyword.trim()).filter(Boolean), [keywordText]);
  const username = accounts.find((account) => account.id === selectedAccountId)?.username ?? "suamarca";

  function applyObjectiveTemplate(id: Exclude<ObjectiveId, "custom">, options?: { keywords?: string[]; name?: string }) {
    const objective = OBJECTIVES.find((item) => item.id === id);
    if (!objective) return;
    setObjectiveId(id);
    setGoal(objective.goal);
    setName(options?.name ?? objective.defaultName);
    setKeywordText((options?.keywords ?? objective.keywords).join(", "));
    setDmMessage(objective.dmMessage);
    const needsLink = objective.dmMessage.includes("{link}");
    setLinkOpen(needsLink);
    if (!needsLink) {
      setTrackedDestinationUrl("");
      setSecondLinkOpen(false);
      setSecondaryDestinationUrl("");
    }
    setTemplateNotice("Modelo aplicado. Todos os campos continuam editáveis.");
  }

  function prefillFromRow(row: ImportRow) {
    setObjectiveId("deliver");
    setGoal(OBJECTIVES[0].goal);
    setName(row.name ?? "");
    setTriggerScope("specific");
    setPostId(null);
    setPostUrl(null);
    setPostThumb(null);
    setPostCaption("");
    setMatchMode("specific");
    setKeywordText((row.keywords ?? []).join(", "));
    setDmMessage(row.dmMessage ?? "");
    setPublicReplyEnabled(Boolean(row.publicReply));
    setPublicReplyMessages(row.publicReply ? [row.publicReply] : [""]);
    const hasOpening = Boolean(row.openingDmMessage);
    setOpeningDmEnabled(hasOpening);
    setOpeningDmMessage(row.openingDmMessage ?? "");
    setOpeningDmButtonLabel(row.openingDmButtonLabel || (hasOpening ? "Enviar link" : ""));
    const link = row.trackedUrl ?? "";
    setTrackedDestinationUrl(link);
    setLinkOpen(Boolean(link));
    setAdvancedMode(hasOpening || Boolean(row.publicReply));
    setError(null);
  }

  function restoreDraft(draft: Partial<DraftSnapshot>) {
    if (draft.version !== 1) return;
    if (draft.objectiveId) setObjectiveId(normalizeObjectiveId(draft.objectiveId));
    if (typeof draft.goal === "string") {
      const migratedObjectiveId = LEGACY_GOALS[draft.goal];
      setGoal(
        migratedObjectiveId
          ? OBJECTIVES.find((objective) => objective.id === migratedObjectiveId)?.goal ?? draft.goal
          : draft.goal
      );
    }
    if (typeof draft.name === "string") setName(draft.name);
    if (typeof draft.selectedAccountId === "string") setSelectedAccountId(draft.selectedAccountId);
    if (draft.triggerScope) setTriggerScope(draft.triggerScope);
    if (draft.postId === null || typeof draft.postId === "string") setPostId(draft.postId);
    if (draft.postUrl === null || typeof draft.postUrl === "string") setPostUrl(draft.postUrl);
    if (draft.postThumb === null || typeof draft.postThumb === "string") setPostThumb(draft.postThumb);
    if (typeof draft.postCaption === "string") setPostCaption(draft.postCaption);
    if (draft.matchMode) setMatchMode(draft.matchMode);
    if (typeof draft.keywordText === "string") setKeywordText(draft.keywordText);
    if (typeof draft.dmTriggerEnabled === "boolean") setDmTriggerEnabled(draft.dmTriggerEnabled);
    if (typeof draft.publicReplyEnabled === "boolean") setPublicReplyEnabled(draft.publicReplyEnabled);
    if (Array.isArray(draft.publicReplyMessages)) setPublicReplyMessages(draft.publicReplyMessages);
    if (typeof draft.openingDmEnabled === "boolean") setOpeningDmEnabled(draft.openingDmEnabled);
    if (typeof draft.openingDmMessage === "string") setOpeningDmMessage(draft.openingDmMessage);
    if (typeof draft.openingDmButtonLabel === "string") setOpeningDmButtonLabel(draft.openingDmButtonLabel);
    if (typeof draft.dmMessage === "string") setDmMessage(draft.dmMessage);
    if (typeof draft.linkOpen === "boolean") setLinkOpen(draft.linkOpen);
    if (typeof draft.trackedDestinationUrl === "string") setTrackedDestinationUrl(draft.trackedDestinationUrl);
    if (typeof draft.linkButtonLabel === "string") setLinkButtonLabel(draft.linkButtonLabel);
    if (typeof draft.secondLinkOpen === "boolean") setSecondLinkOpen(draft.secondLinkOpen);
    if (typeof draft.secondaryDestinationUrl === "string") setSecondaryDestinationUrl(draft.secondaryDestinationUrl);
    if (typeof draft.secondaryButtonLabel === "string") setSecondaryButtonLabel(draft.secondaryButtonLabel);
    if (typeof draft.requireFollow === "boolean") setRequireFollow(draft.requireFollow);
    if (typeof draft.followPromptMessage === "string") setFollowPromptMessage(draft.followPromptMessage);
    if (typeof draft.followPromptButtonLabel === "string") setFollowPromptButtonLabel(draft.followPromptButtonLabel);
    if (typeof draft.followUpEnabled === "boolean") setFollowUpEnabled(draft.followUpEnabled);
    if (typeof draft.followUpMessage === "string") setFollowUpMessage(draft.followUpMessage);
    if (typeof draft.followUpDelayMinutes === "number") setFollowUpDelayMinutes(draft.followUpDelayMinutes);
    if (typeof draft.advancedMode === "boolean") setAdvancedMode(draft.advancedMode);
    if (typeof draft.currentStep === "number" && draft.currentStep >= 0 && draft.currentStep <= 6) setCurrentStep(draft.currentStep as FunnelStep);
    setTemplateNotice("Rascunho local recuperado deste navegador.");
  }

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) throw new Error("accounts unavailable");
        const next: AccountOption[] = payload.data.instagramAccounts ?? [];
        setAccounts(next);
        setSelectedAccountId((previous) => previous || payload.data.selectedInstagramAccountId || next[0]?.id || "");
        setAccountsStatus("ready");
      })
      .catch(() => {
        setAccounts([]);
        setAccountsStatus("error");
      });
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    const cacheKey = `ig-avatar:${selectedAccountId}`;
    const cached = readCache<string | null>(cacheKey, 30 * 60 * 1000);
    // Hydration from the cache is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached.data !== null) setAvatarUrl(cached.data);
    const params = new URLSearchParams({ instagramAccountId: selectedAccountId });
    fetch(`/api/instagram/profile?${params}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const url = payload.success ? payload.data.profilePictureUrl ?? null : null;
        setAvatarUrl(url);
        writeCache(cacheKey, url);
      })
      .catch(() => {
        if (!cancelled && cached.data === null) setAvatarUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  useEffect(() => {
    if (mode !== "edit" || !campaignId) return;
    fetch("/api/automations", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) return setNotFound(true);
        const campaign = (payload.data as LoadedCampaign[]).find((item) => item.id === campaignId);
        if (!campaign) return setNotFound(true);
        const restoredObjectiveId = objectiveIdForGoal(campaign.goal);
        setName(campaign.name);
        setGoal(
          campaign.goal && LEGACY_GOALS[campaign.goal] && restoredObjectiveId !== "custom"
            ? OBJECTIVES.find((objective) => objective.id === restoredObjectiveId)?.goal ?? campaign.goal
            : campaign.goal ?? "Objetivo personalizado"
        );
        setObjectiveId(restoredObjectiveId);
        setSelectedAccountId(campaign.instagramAccountId);
        setTriggerScope(campaign.matchAnyPost ? "any" : campaign.pendingNextReel ? "next" : "specific");
        setPostId(campaign.postId);
        setPostUrl(campaign.postUrl);
        setMatchMode(campaign.matchAnyWord ? "any" : "specific");
        setKeywordText(campaign.keywords.join(", "));
        setDmTriggerEnabled(campaign.dmTriggerEnabled ?? false);
        setPublicReplyEnabled(campaign.publicReplyEnabled);
        setPublicReplyMessages(
          campaign.publicReplyMessages?.length
            ? campaign.publicReplyMessages
            : campaign.publicReplyMessage
              ? [campaign.publicReplyMessage]
              : [""]
        );
        setOpeningDmEnabled(campaign.openingDmEnabled);
        setOpeningDmMessage(campaign.openingDmMessage ?? "");
        setOpeningDmButtonLabel(campaign.openingDmButtonLabel ?? "");
        setDmMessage(campaign.dmMessage);
        setLinkButtonLabel(campaign.linkButtonLabel ?? "Abrir link");
        setIsActive(campaign.isActive);
        const firstLink = campaign.trackedLinks?.[0]?.destinationUrl ?? "";
        const secondLink = campaign.trackedLinks?.[1];
        setTrackedDestinationUrl(firstLink);
        setLinkOpen(Boolean(firstLink));
        setSecondaryDestinationUrl(secondLink?.destinationUrl ?? "");
        setSecondaryButtonLabel(secondLink?.label ?? "Abrir link");
        setSecondLinkOpen(Boolean(secondLink?.destinationUrl));
        setRequireFollow(campaign.requireFollow ?? false);
        setFollowPromptMessage(campaign.followPromptMessage ?? "");
        setFollowPromptButtonLabel(campaign.followPromptButtonLabel ?? "Já estou seguindo");
        setFollowUpEnabled(campaign.followUpEnabled ?? false);
        setFollowUpMessage(campaign.followUpMessage ?? "");
        setFollowUpDelayMinutes(campaign.followUpDelayMinutes ?? 0);
        setAdvancedMode(Boolean(campaign.dmTriggerEnabled || campaign.openingDmEnabled || campaign.requireFollow || campaign.followUpEnabled || secondLink?.destinationUrl));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [mode, campaignId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    fetch("/api/automations", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload.success) return;
        const map: Record<string, string> = {};
        for (const automation of payload.data as LoadedCampaign[]) {
          if (!automation.postId || automation.instagramAccountId !== selectedAccountId) continue;
          if (mode === "edit" && automation.id === campaignId) continue;
          map[automation.postId] = automation.name;
        }
        setUsedPosts(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, mode, campaignId]);

  /* Hydration from an import, explicit template, or local draft is client-only. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "new") return;
    try {
      const rawQueue = window.localStorage.getItem(IMPORT_QUEUE_KEY);
      const queuedAccount = window.localStorage.getItem(IMPORT_ACCOUNT_KEY);
      if (rawQueue) {
        const queue = JSON.parse(rawQueue) as ImportRow[];
        if (Array.isArray(queue) && queue.length > 0) {
          setImportQueue(queue);
          setImportTotal(queue.length);
          if (queuedAccount) setSelectedAccountId(queuedAccount);
          prefillFromRow(queue[0]);
          setDraftReady(true);
          return;
        }
      }

      if (templateSlug) {
        const template = getCampaignTemplate(templateSlug);
        const objective = TEMPLATE_OBJECTIVES[templateSlug];
        if (template && objective) {
          applyObjectiveTemplate(objective, {
            keywords: template.keywords,
            name: OBJECTIVES.find((item) => item.id === objective)?.defaultName,
          });
        } else {
          setTemplateNotice("O modelo informado não existe mais. Escolha um objetivo para começar.");
        }
      } else {
        const rawDraft = window.localStorage.getItem(DRAFT_KEY);
        if (rawDraft) restoreDraft(JSON.parse(rawDraft) as Partial<DraftSnapshot>);
      }
    } catch {
      setTemplateNotice("Não foi possível recuperar o rascunho local.");
    } finally {
      setDraftReady(true);
    }
  }, [mode, templateSlug]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (mode !== "new" || !draftReady || outcome) return;
    const timeout = window.setTimeout(() => {
      const draft: DraftSnapshot = {
        version: 1,
        updatedAt: new Date().toISOString(),
        objectiveId,
        goal,
        name,
        selectedAccountId,
        triggerScope,
        postId,
        postUrl,
        postThumb,
        postCaption,
        matchMode,
        keywordText,
        dmTriggerEnabled,
        publicReplyEnabled,
        publicReplyMessages,
        openingDmEnabled,
        openingDmMessage,
        openingDmButtonLabel,
        dmMessage,
        linkOpen,
        trackedDestinationUrl,
        linkButtonLabel,
        secondLinkOpen,
        secondaryDestinationUrl,
        secondaryButtonLabel,
        requireFollow,
        followPromptMessage,
        followPromptButtonLabel,
        followUpEnabled,
        followUpMessage,
        followUpDelayMinutes,
        advancedMode,
        currentStep,
      };
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setAutosaveLabel("Rascunho salvo somente neste navegador");
      } catch {
        setAutosaveLabel("Rascunho local indisponível");
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [mode, draftReady, outcome, objectiveId, goal, name, selectedAccountId, triggerScope, postId, postUrl, postThumb, postCaption, matchMode, keywordText, dmTriggerEnabled, publicReplyEnabled, publicReplyMessages, openingDmEnabled, openingDmMessage, openingDmButtonLabel, dmMessage, linkOpen, trackedDestinationUrl, linkButtonLabel, secondLinkOpen, secondaryDestinationUrl, secondaryButtonLabel, requireFollow, followPromptMessage, followPromptButtonLabel, followUpEnabled, followUpMessage, followUpDelayMinutes, advancedMode, currentStep]);

  function handlePostSelect(id: string, url?: string, thumb?: string, caption?: string) {
    setPostId(id);
    setPostUrl(url ?? null);
    setPostThumb(thumb ?? null);
    setPostCaption(caption ?? "");
  }

  function ensureLinkToken() {
    if (!trackedDestinationUrl.trim()) return;
    setDmMessage((current) => current.includes("{link}") ? current : `${current.trim()} {link}`.trim());
  }

  function getFirstIssue(maxStep: number) {
    if (maxStep >= 0 && !goal.trim()) return { step: 0 as FunnelStep, message: "Escolha ou descreva o objetivo da campanha." };
    if (maxStep >= 1 && !selectedAccountId) return { step: 1 as FunnelStep, message: "Conecte e selecione uma conta do Instagram." };
    if (maxStep >= 2 && triggerScope === "specific" && !postId) return { step: 2 as FunnelStep, message: "Escolha uma publicação ou reel para iniciar a campanha." };
    if (maxStep >= 3 && matchMode === "specific" && keywords.length === 0) return { step: 3 as FunnelStep, message: "Adicione ao menos uma palavra-chave ou selecione qualquer palavra." };
    if (maxStep >= 4 && !dmMessage.trim()) return { step: 4 as FunnelStep, message: "Escreva a mensagem principal enviada por DM." };
    if (maxStep >= 4) {
      const linkIssue = getCampaignLinkIssue({
        dmMessage,
        primaryUrl: linkOpen ? trackedDestinationUrl : "",
        secondaryLinkEnabled: linkOpen && secondLinkOpen,
        secondaryUrl: secondaryDestinationUrl,
      });
      if (linkIssue) return { step: 4 as FunnelStep, message: `${linkIssue}.` };
    }
    if (maxStep >= 4 && openingDmEnabled && (!openingDmMessage.trim() || !openingDmButtonLabel.trim())) return { step: 4 as FunnelStep, message: "A DM inicial precisa de mensagem e texto do botão." };
    if (maxStep >= 4 && publicReplyEnabled && !publicReplyMessages.some((message) => message.trim())) return { step: 4 as FunnelStep, message: "Adicione ao menos uma resposta pública." };
    if (maxStep >= 4 && requireFollow && !followPromptMessage.trim()) return { step: 4 as FunnelStep, message: "Escreva a solicitação para seguir o perfil." };
    if (maxStep >= 4 && followUpEnabled && !followUpMessage.trim()) return { step: 4 as FunnelStep, message: "Escreva a mensagem de acompanhamento." };
    return null;
  }

  function showIssue(issue: { step: FunnelStep; message: string }) {
    setCurrentStep(issue.step);
    setError(issue.message);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }

  function moveToStep(next: FunnelStep) {
    if (next > currentStep) {
      const issue = getFirstIssue(next - 1);
      if (issue) return showIssue(issue);
    }
    setError(null);
    setCurrentStep(next);
  }

  function buildPayload() {
    return {
      name: name.trim() || `Campanha para @${username}`,
      goal: goal.trim(),
      instagramAccountId: selectedAccountId,
      postId: triggerScope === "specific" ? postId : null,
      postUrl: triggerScope === "specific" ? postUrl : null,
      matchAnyPost: triggerScope === "any",
      pendingNextReel: triggerScope === "next",
      matchAnyWord: matchMode === "any",
      keywords: matchMode === "any" ? [] : keywords,
      dmTriggerEnabled,
      dmMessage: dmMessage.trim(),
      openingDmEnabled,
      openingDmMessage: openingDmEnabled ? openingDmMessage.trim() : null,
      openingDmButtonLabel: openingDmEnabled ? openingDmButtonLabel.trim() : null,
      publicReplyEnabled,
      publicReplyMessages: publicReplyEnabled ? publicReplyMessages.map((message) => message.trim()).filter(Boolean) : [],
      trackedDestinationUrl: linkOpen ? trackedDestinationUrl.trim() : "",
      linkButtonLabel: linkButtonLabel.trim() || "Abrir link",
      secondaryDestinationUrl: linkOpen && secondLinkOpen ? secondaryDestinationUrl.trim() : "",
      secondaryButtonLabel: secondaryButtonLabel.trim() || "Abrir link",
      requireFollow,
      followPromptMessage: requireFollow ? followPromptMessage.trim() : "",
      followPromptButtonLabel: requireFollow ? followPromptButtonLabel.trim() || "Já estou seguindo" : "",
      followUpEnabled,
      followUpMessage: followUpEnabled ? followUpMessage.trim() : "",
      followUpDelayMinutes: followUpEnabled ? followUpDelayMinutes : 0,
    };
  }

  function advanceImportQueue(savedName: string) {
    if (!importQueue) return false;
    if (triggerScope === "specific" && postId) setUsedPosts((previous) => ({ ...previous, [postId]: savedName }));
    if (importQueue.length > 1) {
      const remaining = importQueue.slice(1);
      window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(remaining));
      setImportQueue(remaining);
      prefillFromRow(remaining[0]);
      setCurrentStep(0);
      setSaving(false);
      window.scrollTo({ top: 0 });
      return true;
    }
    window.localStorage.removeItem(IMPORT_QUEUE_KEY);
    window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
    return false;
  }

  async function saveCampaign(action: "paused" | "activate") {
    setError(null);
    const issue = getFirstIssue(4);
    if (issue) return showIssue(issue);
    if (action === "activate" && (!reviewedCopy || !verifiedAudience || !acceptedMetaDependency)) {
      return showIssue({ step: 6, message: "Confirme os três itens do checklist antes de ativar." });
    }

    setSaving(true);
    const payload = buildPayload();
    let persistedId = campaignId;
    try {
      const saved = await executeMutation(buildPausedCampaignMutation({ mode, campaignId, payload }));
      persistedId = saved.id || campaignId;
      if (!persistedId) throw new Error("A API não retornou o identificador da campanha.");
      setIsActive(false);

      if (action === "activate") {
        try {
          await executeMutation(buildActivationMutation(persistedId));
          setIsActive(true);
        } catch {
          if (mode === "new") window.localStorage.removeItem(DRAFT_KEY);
          setSavedCampaignId(persistedId);
          setOutcomeDetail("A ativação não foi concluída. A campanha permaneceu pausada e nada será enviado até uma nova confirmação na edição da campanha.");
          setOutcome("paused");
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      if (mode === "new") window.localStorage.removeItem(DRAFT_KEY);
      if (advanceImportQueue(payload.name)) return;
      setSavedCampaignId(persistedId);
      setOutcomeDetail(null);
      setOutcome(action === "activate" ? "active" : "paused");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a campanha.");
      window.requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  function skipRow() {
    if (!importQueue) return;
    if (importQueue.length > 1) {
      const remaining = importQueue.slice(1);
      window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(remaining));
      setImportQueue(remaining);
      prefillFromRow(remaining[0]);
      setCurrentStep(0);
      window.scrollTo({ top: 0 });
      return;
    }
    window.localStorage.removeItem(IMPORT_QUEUE_KEY);
    window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
    router.push("/campaigns");
    router.refresh();
  }

  if (loading) {
    return <div className="panel h-64 animate-pulse rounded-xl" role="status" aria-label="Carregando campanha" />;
  }

  if (notFound) {
    return (
      <div className="panel rounded-xl p-8 text-center">
        <p className="text-sm text-muted">Campanha não encontrada.</p>
        <Link href="/campaigns" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm text-muted hover:text-foreground">Voltar para campanhas</Link>
      </div>
    );
  }

  if (outcome) {
    return (
      <div className="panel mx-auto max-w-2xl rounded-xl p-6 sm:p-8" role="status">
        <div className="flex items-start gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${outcome === "active" ? "bg-success/15 text-success" : "bg-zinc-100 text-muted"}`}>
            {outcome === "active" ? <CircleCheck className="h-6 w-6" aria-hidden="true" /> : <ShieldCheck className="h-6 w-6" aria-hidden="true" />}
          </span>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{outcome === "active" ? "Campanha ativada" : "Campanha salva pausada"}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {outcomeDetail ?? (outcome === "active"
                ? "A automação está pronta para novos comentários que atendam às regras. Nenhuma mensagem de teste foi enviada durante a configuração."
                : "A configuração foi salva, mas nenhuma resposta automática será enviada até você revisar e ativar a campanha.")}
            </p>
            {savedCampaignId && <p className="mt-3 text-xs text-muted">Identificador: {savedCampaignId}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              {outcome === "paused" && savedCampaignId && (
                <Link href={`/campaigns/${savedCampaignId}/edit`} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Revisar campanha</Link>
              )}
              <Link href="/campaigns" className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Ver campanhas</Link>
              <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-muted hover:text-foreground">Ir para Agora</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const journey = [
    triggerScope === "specific"
      ? "A pessoa comenta na publicação selecionada"
      : triggerScope === "next"
        ? "A pessoa comenta na próxima publicação ou reel"
        : "A pessoa comenta em qualquer publicação ou reel",
    matchMode === "any"
      ? "Qualquer texto no comentário atende ao gatilho"
      : `O comentário contém: ${keywords.join(", ") || "palavras ainda não definidas"}`,
    ...(publicReplyEnabled ? ["A pessoa recebe uma resposta pública"] : []),
    ...(openingDmEnabled ? ["Uma DM inicial pede a confirmação pelo botão"] : []),
    ...(requireFollow ? ["O perfil solicita que a pessoa siga a conta"] : []),
    linkOpen && trackedDestinationUrl.trim()
      ? "A DM principal fica preparada com o link rastreado; a entrega real depende da Meta"
      : "A DM principal fica preparada; a entrega real depende da Meta",
    ...(linkOpen && trackedDestinationUrl.trim()
      ? ["Um clique no link é registrado como sinal de interesse, não como venda"]
      : []),
    "O comentário ou Direct observado cria ou atualiza uma oportunidade persistida",
    "A oportunidade entra na fila comercial para acompanhamento humano",
    ...(followUpEnabled ? ["Uma mensagem de acompanhamento é preparada"] : []),
    "Uma pessoa da equipe pode assumir a abordagem na Inbox",
  ];

  return (
    <div className="space-y-6">
      {importQueue && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm" role="status">
          <span className="font-medium text-foreground">Importando {importTotal - importQueue.length + 1} de {importTotal}.</span>{" "}
          <span className="text-muted">Revise os campos e salve para continuar.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{mode === "edit" ? name || "Campanha sem nome" : "Nova campanha"}</p>
          <p className="mt-1 text-xs text-muted" aria-live="polite">{mode === "new" ? autosaveLabel : isActive ? "Ativa no momento" : "Pausada no momento"}</p>
        </div>
        <div className="flex items-center gap-2">
          {importQueue && (
            <button type="button" onClick={skipRow} disabled={saving} className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50">{importQueue.length > 1 ? "Pular item" : "Pular e concluir"}</button>
          )}
          <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-foreground">Modo avançado</span>
            <Toggle on={advancedMode} onToggle={() => setAdvancedMode((value) => !value)} label="Ativar modo avançado" />
          </div>
        </div>
      </div>

      <div className="panel overflow-x-auto rounded-xl p-2 sm:p-3">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Decisões da campanha">
          {FUNNEL_STEPS.map((step, index) => {
            const stepIndex = index as FunnelStep;
            const isCurrent = currentStep === stepIndex;
            const isComplete = currentStep > stepIndex;
            return (
              <button
                key={step.title}
                id={`campaign-step-${index}`}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-controls={`campaign-panel-${index}`}
                tabIndex={isCurrent ? 0 : -1}
                onClick={() => moveToStep(stepIndex)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") moveToStep(Math.min(6, index + 1) as FunnelStep);
                  if (event.key === "ArrowLeft") moveToStep(Math.max(0, index - 1) as FunnelStep);
                }}
                className={`flex min-h-12 min-w-36 items-center gap-2 rounded-lg px-3 text-left transition-colors ${isCurrent ? "bg-accent text-white" : "text-muted hover:bg-surface-hover hover:text-foreground"}`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isCurrent ? "bg-white text-accent" : isComplete ? "bg-success/15 text-success" : "bg-zinc-100 text-muted"}`}>
                  {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{step.title}</span>
                  <span className={`block text-[11px] ${isCurrent ? "text-blue-100" : "text-muted"}`}>{step.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,600px)_1fr] lg:gap-8">
        <div className="panel rounded-xl p-4 sm:p-6">
          {error && (
            <div ref={errorRef} tabIndex={-1} role="alert" className="mb-5 flex gap-2 rounded-lg border border-error/20 bg-error/10 p-3 text-sm text-error">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Decisão {currentStep + 1} de {FUNNEL_STEPS.length}</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{FUNNEL_STEPS[currentStep].title}</h2>
            <p className="mt-1 text-sm text-muted">
              {currentStep === 0 && "Comece pelo resultado que esta campanha precisa gerar."}
              {currentStep === 1 && "Escolha a conta profissional que executará a automação."}
              {currentStep === 2 && "Defina em qual conteúdo a jornada começa."}
              {currentStep === 3 && "Defina o sinal que identifica a intenção da pessoa."}
              {currentStep === 4 && "Configure exatamente o que a pessoa verá e receberá."}
              {currentStep === 5 && "Confira a sequência completa sem enviar mensagens reais."}
              {currentStep === 6 && "A ativação exige uma confirmação separada e explícita."}
            </p>
          </div>

          <div id={`campaign-panel-${currentStep}`} role="tabpanel" aria-labelledby={`campaign-step-${currentStep}`}>
            {currentStep === 0 && (
              <div className="space-y-6">
                {templateNotice && <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm text-muted" role="status">{templateNotice}</div>}
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">Escolha o objetivo</legend>
                  {OBJECTIVES.map((objective) => (
                    <button key={objective.id} type="button" aria-pressed={objectiveId === objective.id} onClick={() => applyObjectiveTemplate(objective.id)} className={`min-h-28 rounded-lg border p-4 text-left transition-colors ${objectiveId === objective.id ? "border-accent bg-accent/5" : "border-border hover:border-border-hover"}`}>
                      <span className="block text-sm font-semibold text-foreground">{objective.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">{objective.description}</span>
                    </button>
                  ))}
                </fieldset>
                {objectiveId === "custom" && (
                  <div className="space-y-2">
                    <p className="text-xs leading-5 text-muted">Este rascunho ou campanha usa um objetivo anterior. Você pode preservá-lo abaixo ou migrar escolhendo uma das seis opções.</p>
                    <label htmlFor="campaign-goal" className="text-sm font-semibold text-foreground">Objetivo personalizado</label>
                    <input id="campaign-goal" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={120} placeholder="Ex.: qualificar pedidos de orçamento" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" />
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="campaign-name" className="text-sm font-semibold text-foreground">Nome da campanha <span className="font-normal text-muted">(opcional)</span></label>
                  <input id="campaign-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Ex.: Guia do lançamento" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" />
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-5">
                {accountsStatus === "loading" && <div className="h-24 animate-pulse rounded-lg bg-surface" role="status" aria-label="Verificando contas conectadas" />}
                {accountsStatus === "error" && (
                  <div className="rounded-lg border border-error/20 bg-error/10 p-4"><p className="text-sm font-semibold text-foreground">Não foi possível verificar as contas agora.</p><p className="mt-1 text-xs text-muted">Tente novamente pela página de configurações antes de ativar.</p><Link href="/settings" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">Abrir configurações</Link></div>
                )}
                {accountsStatus === "ready" && accounts.length === 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-4"><p className="text-sm font-semibold text-foreground">Nenhuma conta profissional conectada</p><p className="mt-1 text-xs leading-relaxed text-muted">A disponibilidade de permissões, webhooks e publicações depende da aprovação e da resposta da Meta.</p><a href="/api/instagram/connect" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">Conectar Instagram</a></div>
                )}
                {accountsStatus === "ready" && accounts.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/10 p-4"><CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" /><div><p className="text-sm font-semibold text-foreground">Conta conectada ao Comentou</p><p className="mt-1 text-xs leading-relaxed text-muted">A conexão foi encontrada. A entrega ainda depende de token válido, permissões e disponibilidade da Meta no momento do evento.</p></div></div>
                    <AccountSelect accounts={accounts} value={selectedAccountId} onChange={(id) => { setSelectedAccountId(id); setPostId(null); setPostUrl(null); setPostThumb(null); }} includeAll={false} label="Conta que executará a campanha" />
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <Section title="Quando alguém comentar em">
                <fieldset className="space-y-3"><legend className="sr-only">Escopo da publicação</legend>
                  <Radio name="trigger-scope" checked={triggerScope === "specific"} onSelect={() => setTriggerScope("specific")}>uma publicação ou reel específico</Radio>
                  {triggerScope === "specific" && <div className="rounded-lg border border-border p-2"><PostPicker selectedPostId={postId} instagramAccountId={selectedAccountId} usedPostIds={usedPosts} onSelect={handlePostSelect} /></div>}
                  <Radio name="trigger-scope" checked={triggerScope === "any"} onSelect={() => setTriggerScope("any")}>qualquer publicação ou reel</Radio>
                  <Radio name="trigger-scope" checked={triggerScope === "next"} onSelect={() => setTriggerScope("next")}>a próxima publicação ou reel</Radio>
                </fieldset>
              </Section>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <Section title="O comentário precisa conter">
                  <fieldset className="space-y-3"><legend className="sr-only">Regra de intenção</legend>
                    <Radio name="match-mode" checked={matchMode === "specific"} onSelect={() => setMatchMode("specific")}>uma ou mais palavras específicas</Radio>
                    {matchMode === "specific" && <div className="space-y-2"><label htmlFor="campaign-keywords" className="text-sm font-medium text-foreground">Palavras-chave</label><input id="campaign-keywords" value={keywordText} onChange={(event) => setKeywordText(event.target.value)} placeholder="QUERO, LINK, PREÇO" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" /><p className="text-xs text-muted">Separe por vírgulas. Use palavras que indiquem uma ação clara.</p></div>}
                    <Radio name="match-mode" checked={matchMode === "any"} onSelect={() => setMatchMode("any")}>qualquer texto no comentário</Radio>
                  </fieldset>
                </Section>
                {advancedMode && <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"><div><p className="text-sm font-medium text-foreground">Usar as mesmas palavras em DMs recebidas</p><p className="mt-1 text-xs text-muted">Uma DM compatível pode iniciar a resposta sem comentário.</p></div><Toggle on={dmTriggerEnabled} onToggle={() => setDmTriggerEnabled((value) => !value)} label="Responder também a mensagens diretas compatíveis" /></div>}
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-7">
                <Section title="Mensagem principal por DM" description="Use {username} para personalizar e {link} para inserir o link rastreado.">
                  <label htmlFor="campaign-dm" className="sr-only">Mensagem principal por DM</label>
                  <textarea id="campaign-dm" value={dmMessage} onChange={(event) => setDmMessage(event.target.value)} rows={4} maxLength={1000} placeholder="Olá, {username}! Aqui está o que você pediu: {link}" className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" />
                  {linkOpen ? (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <label htmlFor="campaign-link" className="text-sm font-medium text-foreground">Link de destino <span className="font-normal text-muted">(opcional)</span></label>
                      <input id="campaign-link" type="url" value={trackedDestinationUrl} onChange={(event) => setTrackedDestinationUrl(event.target.value)} onBlur={ensureLinkToken} placeholder="https://suaempresa.com/oferta" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" />
                      <label htmlFor="campaign-link-label" className="text-sm font-medium text-foreground">Texto do botão</label>
                      <input id="campaign-link-label" value={linkButtonLabel} onChange={(event) => setLinkButtonLabel(event.target.value)} maxLength={20} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-accent/40 focus:outline-none" />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setLinkOpen(true)} className="min-h-11 w-full rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground">Adicionar link rastreado</button>
                  )}
                </Section>

                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div><p className="text-sm font-medium text-foreground">Responder publicamente</p><p className="mt-1 text-xs text-muted">Confirma no comentário que a DM foi enviada.</p></div>
                    <Toggle on={publicReplyEnabled} onToggle={() => setPublicReplyEnabled((value) => !value)} label="Ativar resposta pública" />
                  </div>
                  {publicReplyEnabled && (
                    <div className="mt-3 space-y-2">
                      {publicReplyMessages.map((message, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <label htmlFor={`public-reply-${index}`} className="sr-only">Resposta pública {index + 1}</label>
                          <input id={`public-reply-${index}`} value={message} onChange={(event) => setPublicReplyMessages((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} maxLength={1000} placeholder="Enviei os detalhes por DM." className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" />
                          {publicReplyMessages.length > 1 && <button type="button" onClick={() => setPublicReplyMessages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-error/10 hover:text-error" aria-label={`Remover resposta pública ${index + 1}`}><X className="h-4 w-4" aria-hidden="true" /></button>}
                        </div>
                      ))}
                      {publicReplyMessages.length < 10 && <button type="button" onClick={() => setPublicReplyMessages((current) => [...current, ""])} className="min-h-11 text-sm font-medium text-accent hover:underline">Adicionar variação</button>}
                    </div>
                  )}
                </div>

                {advancedMode && (
                  <div className="space-y-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />Opções avançadas</div>

                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-4"><span className="text-sm text-foreground">Pedir confirmação antes da mensagem principal</span><Toggle on={openingDmEnabled} onToggle={() => setOpeningDmEnabled((value) => !value)} label="Ativar DM inicial com confirmação" /></div>
                      {openingDmEnabled && <div className="mt-3 space-y-2"><label htmlFor="opening-message" className="sr-only">Mensagem inicial</label><textarea id="opening-message" value={openingDmMessage} onChange={(event) => setOpeningDmMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Olá! Posso enviar o material por aqui?" className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" /><label htmlFor="opening-label" className="sr-only">Texto do botão de confirmação</label><input id="opening-label" value={openingDmButtonLabel} onChange={(event) => setOpeningDmButtonLabel(event.target.value)} maxLength={64} placeholder="Quero receber" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" /></div>}
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-4"><span className="text-sm text-foreground">Solicitar que a pessoa siga o perfil</span><Toggle on={requireFollow} onToggle={() => setRequireFollow((value) => !value)} label="Solicitar que a pessoa siga o perfil" /></div>
                      {requireFollow && <div className="mt-3 space-y-2"><label htmlFor="follow-message" className="sr-only">Mensagem para seguir o perfil</label><textarea id="follow-message" value={followPromptMessage} onChange={(event) => setFollowPromptMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Siga nosso perfil e confirme no botão para continuar." className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" /><label htmlFor="follow-label" className="sr-only">Texto do botão de confirmação de seguidor</label><input id="follow-label" value={followPromptButtonLabel} onChange={(event) => setFollowPromptButtonLabel(event.target.value)} maxLength={20} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-accent/40 focus:outline-none" /><p className="text-xs text-muted">Se a Meta não permitir verificar o vínculo, o fluxo poderá liberar a mensagem conforme a regra atual do sistema.</p></div>}
                    </div>

                    {linkOpen && (secondLinkOpen ? (
                      <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                        <label htmlFor="second-link" className="text-sm font-medium text-foreground">Segundo link</label>
                        <input id="second-link" type="url" value={secondaryDestinationUrl} onChange={(event) => setSecondaryDestinationUrl(event.target.value)} placeholder="https://suaempresa.com/alternativa" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" />
                        <label htmlFor="second-label" className="text-sm font-medium text-foreground">Texto do segundo botão</label>
                        <input id="second-label" value={secondaryButtonLabel} onChange={(event) => setSecondaryButtonLabel(event.target.value)} maxLength={20} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-accent/40 focus:outline-none" />
                      </div>
                    ) : <button type="button" onClick={() => setSecondLinkOpen(true)} className="min-h-11 w-full rounded-lg border border-border bg-background text-sm font-medium text-muted hover:text-foreground">Adicionar segundo link</button>)}

                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-4"><span className="text-sm text-foreground">Enviar acompanhamento após o link</span><Toggle on={followUpEnabled} onToggle={() => setFollowUpEnabled((value) => !value)} label="Ativar mensagem de acompanhamento" /></div>
                      {followUpEnabled && <div className="mt-3 space-y-2"><label htmlFor="follow-up-message" className="sr-only">Mensagem de acompanhamento</label><textarea id="follow-up-message" value={followUpMessage} onChange={(event) => setFollowUpMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Conseguiu acessar? Se precisar, responda por aqui." className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none" /><label htmlFor="follow-up-delay" className="text-xs text-muted">Minutos depois do link</label><input id="follow-up-delay" type="number" min={0} max={1440} value={followUpDelayMinutes} onChange={(event) => setFollowUpDelayMinutes(Math.max(0, Math.min(1440, Math.floor(Number(event.target.value) || 0))))} className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent/40 focus:outline-none" /><p className="text-xs text-muted">Máximo de 24 horas para respeitar a janela de mensagens.</p></div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-5">
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-4"><p className="text-sm font-semibold text-foreground">Teste interno seguro e local</p><p className="mt-1 text-xs leading-relaxed text-muted">A prévia usa dados de exemplo somente neste navegador. Ela não comenta, não abre uma conversa e não envia nenhuma mensagem ao Instagram.</p></div>
                <ol className="space-y-3" aria-label="Jornada da campanha">
                  {journey.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3 rounded-lg border border-border p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-bold text-accent">{index + 1}</span><span className="pt-1 text-sm text-foreground">{item}</span></li>)}
                </ol>
                <div className="grid gap-3 sm:grid-cols-2" aria-label="Estados do teste local">
                  <div className="rounded-lg border border-success/20 bg-success/10 p-3"><p className="text-sm font-semibold text-foreground">Prévia local pronta</p><p className="mt-1 text-xs leading-5 text-muted">Os campos obrigatórios foram suficientes para montar a jornada, sem testar entrega real.</p></div>
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3"><p className="text-sm font-semibold text-foreground">Falha de configuração</p><p className="mt-1 text-xs leading-5 text-muted">Se mensagem, gatilho ou link obrigatório faltar, o wizard bloqueia o avanço e indica o campo a revisar.</p></div>
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-5">
                <div className="flex gap-3 rounded-lg border border-success/20 bg-success/10 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" /><div><p className="text-sm font-semibold text-foreground">Proteção de ativação</p><p className="mt-1 text-xs leading-relaxed text-muted">Primeiro salvamos a campanha pausada. Somente após sua confirmação fazemos uma segunda solicitação para ativá-la.</p></div></div>
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold text-foreground">Checklist antes de enviar respostas automáticas</legend>
                  <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-border p-3"><input type="checkbox" checked={reviewedCopy} onChange={(event) => setReviewedCopy(event.target.checked)} className="mt-0.5 h-5 w-5 accent-blue-600" /><span className="text-sm text-foreground">Revisei as palavras-chave, mensagens, botões e links.</span></label>
                  <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-border p-3"><input type="checkbox" checked={verifiedAudience} onChange={(event) => setVerifiedAudience(event.target.checked)} className="mt-0.5 h-5 w-5 accent-blue-600" /><span className="text-sm text-foreground">Confirmei a conta e o conteúdo que receberão a automação.</span></label>
                  <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-border p-3"><input type="checkbox" checked={acceptedMetaDependency} onChange={(event) => setAcceptedMetaDependency(event.target.checked)} className="mt-0.5 h-5 w-5 accent-blue-600" /><span className="text-sm text-foreground">Entendo que a entrega depende de permissões, token, webhook e disponibilidade da Meta.</span></label>
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => saveCampaign("paused")} disabled={saving} className="min-h-12 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-surface-hover disabled:opacity-50">{saving ? "Salvando…" : "Salvar pausada"}</button>
                  <button type="button" onClick={() => saveCampaign("activate")} disabled={saving || !reviewedCopy || !verifiedAudience || !acceptedMetaDependency} className="min-h-12 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Salvando…" : "Salvar e ativar"}</button>
                </div>
                <p className="text-center text-xs text-muted">A prévia não enviou mensagens. A opção pausada também não enviará respostas automáticas.</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <button type="button" onClick={() => moveToStep(Math.max(0, currentStep - 1) as FunnelStep)} disabled={currentStep === 0 || saving} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-4 text-sm font-medium text-muted hover:text-foreground disabled:invisible"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Voltar</button>
            {currentStep < 6 && <button type="button" onClick={() => moveToStep((currentStep + 1) as FunnelStep)} disabled={saving} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">Próxima decisão<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>}
          </div>
        </div>

        <aside aria-label="Prévia da campanha">
          <p className="mb-4 text-sm text-muted">Prévia local</p>
          <div className="flex justify-center lg:sticky lg:top-6 lg:block">
            <CampaignPreview
              tab={previewTab}
              onTabChange={setPreviewTab}
              username={username}
              avatarUrl={avatarUrl}
              postThumb={postThumb}
              caption={postCaption}
              sampleComment={keywords[0] ?? ""}
              dmTriggerEnabled={dmTriggerEnabled}
              publicReplyEnabled={publicReplyEnabled}
              publicReplyMessage={publicReplyMessages.find((message) => message.trim()) ?? ""}
              openingDmEnabled={openingDmEnabled}
              openingDmMessage={openingDmMessage}
              openingDmButtonLabel={openingDmButtonLabel}
              revealMessage={dmMessage}
              hasLink={Boolean(trackedDestinationUrl.trim())}
              linkButtonLabel={linkButtonLabel || "Abrir link"}
              linkUrl={trackedDestinationUrl.trim() || undefined}
              hasSecondLink={secondLinkOpen && Boolean(secondaryDestinationUrl.trim())}
              secondLinkButtonLabel={secondaryButtonLabel || "Abrir link"}
              requireFollow={requireFollow}
              followPromptMessage={followPromptMessage}
              followPromptButtonLabel={followPromptButtonLabel || "Já estou seguindo"}
              followUpEnabled={followUpEnabled}
              followUpMessage={followUpMessage}
              followUpDelayMinutes={followUpDelayMinutes}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
