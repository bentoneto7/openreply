export type CampaignMutation = {
  method: "POST" | "PATCH";
  url: string;
  body: Record<string, unknown>;
};

export type CampaignActivationState = {
  hasTarget: boolean;
  hasTrigger: boolean;
  dmMessage: string;
  hasTrackedLink: boolean;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessages: string[];
  requireFollow: boolean;
  followPromptMessage: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
};

export type CampaignLinkConfiguration = {
  dmMessage: string;
  primaryUrl: string;
  secondaryLinkEnabled: boolean;
  secondaryUrl: string;
};

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getCampaignLinkIssue({
  dmMessage,
  primaryUrl,
  secondaryLinkEnabled,
  secondaryUrl,
}: CampaignLinkConfiguration) {
  const primary = primaryUrl.trim();
  const secondary = secondaryUrl.trim();

  if (/\{link\}/i.test(dmMessage) && !primary) {
    return "A mensagem usa {link}, mas o link principal não foi informado";
  }
  if (primary && !isHttpUrl(primary)) {
    return "Informe um link principal válido, começando com http:// ou https://";
  }
  if (secondaryLinkEnabled && !secondary) {
    return "Informe o segundo link ou desative essa opção";
  }
  if (secondaryLinkEnabled && !isHttpUrl(secondary)) {
    return "Informe um segundo link válido, começando com http:// ou https://";
  }
  return null;
}

export function getCampaignActivationIssue(state: CampaignActivationState) {
  if (!state.hasTarget) return "Defina qual publicação inicia a campanha";
  if (!state.hasTrigger) return "Defina ao menos um gatilho de intenção";
  if (!state.dmMessage.trim()) return "Defina a mensagem principal da campanha";
  if (state.dmMessage.includes("{link}") && !state.hasTrackedLink) {
    return "A mensagem usa {link}, mas nenhum link de destino foi configurado";
  }
  if (
    state.openingDmEnabled &&
    (!state.openingDmMessage?.trim() || !state.openingDmButtonLabel?.trim())
  ) {
    return "Complete a mensagem e o botão da abertura por DM";
  }
  if (
    state.publicReplyEnabled &&
    !state.publicReplyMessages.some((message) => message.trim())
  ) {
    return "Adicione ao menos uma resposta pública";
  }
  if (state.requireFollow && !state.followPromptMessage?.trim()) {
    return "Complete a solicitação para seguir o perfil";
  }
  if (state.followUpEnabled && !state.followUpMessage?.trim()) {
    return "Complete a mensagem de acompanhamento";
  }
  return null;
}

/**
 * A full campaign save is deliberately fail-safe: it always writes a paused
 * campaign. Activation is a separate request that callers may only execute
 * after the user confirms the activation checklist.
 */
export function buildPausedCampaignMutation({
  mode,
  campaignId,
  payload,
}: {
  mode: "new" | "edit";
  campaignId?: string;
  payload: Record<string, unknown>;
}): CampaignMutation {
  if (mode === "edit" && !campaignId) {
    throw new Error("Campaign ID is required when editing");
  }

  return {
    method: mode === "new" ? "POST" : "PATCH",
    url: mode === "new" ? "/api/automations" : `/api/automations?id=${campaignId}`,
    body: { ...payload, isActive: false },
  };
}

export function buildActivationMutation(campaignId: string): CampaignMutation {
  if (!campaignId) throw new Error("Campaign ID is required for activation");

  return {
    method: "PATCH",
    url: `/api/automations?id=${campaignId}`,
    body: { isActive: true, activationConfirmed: true },
  };
}
