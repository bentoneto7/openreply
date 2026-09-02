import { describe, expect, it } from "vitest";
import {
  buildActivationMutation,
  buildPausedCampaignMutation,
  getCampaignActivationIssue,
  getCampaignLinkIssue,
} from "../lib/campaign-activation";

describe("campaign activation safety", () => {
  it("creates every new campaign paused, even when the draft says active", () => {
    expect(
      buildPausedCampaignMutation({
        mode: "new",
        payload: { name: "Lançamento", isActive: true },
      })
    ).toEqual({
      method: "POST",
      url: "/api/automations",
      body: { name: "Lançamento", isActive: false },
    });
  });

  it("pauses a full edit before a separate activation", () => {
    expect(
      buildPausedCampaignMutation({
        mode: "edit",
        campaignId: "campaign-1",
        payload: { name: "Lançamento", isActive: true },
      })
    ).toMatchObject({
      method: "PATCH",
      url: "/api/automations?id=campaign-1",
      body: { isActive: false },
    });

    expect(buildActivationMutation("campaign-1")).toEqual({
      method: "PATCH",
      url: "/api/automations?id=campaign-1",
      body: { isActive: true, activationConfirmed: true },
    });
  });

  it("blocks activation when a link token has no persisted destination", () => {
    expect(
      getCampaignActivationIssue({
        hasTarget: true,
        hasTrigger: true,
        dmMessage: "Veja aqui: {link}",
        hasTrackedLink: false,
        openingDmEnabled: false,
        openingDmMessage: null,
        openingDmButtonLabel: null,
        publicReplyEnabled: false,
        publicReplyMessages: [],
        requireFollow: false,
        followPromptMessage: null,
        followUpEnabled: false,
        followUpMessage: null,
      })
    ).toMatch(/nenhum link de destino/i);
  });

  it("blocks save when {link} has no primary destination", () => {
    expect(
      getCampaignLinkIssue({
        dmMessage: "Veja aqui: {link}",
        primaryUrl: "",
        secondaryLinkEnabled: false,
        secondaryUrl: "",
      })
    ).toMatch(/link principal não foi informado/i);
  });

  it("requires and validates the second URL only while the option is enabled", () => {
    const base = {
      dmMessage: "Posso ajudar por aqui.",
      primaryUrl: "https://comentou.app/oferta",
    };

    expect(
      getCampaignLinkIssue({
        ...base,
        secondaryLinkEnabled: true,
        secondaryUrl: "",
      })
    ).toMatch(/segundo link ou desative/i);
    expect(
      getCampaignLinkIssue({
        ...base,
        secondaryLinkEnabled: true,
        secondaryUrl: "javascript:alert(1)",
      })
    ).toMatch(/segundo link válido/i);
    expect(
      getCampaignLinkIssue({
        ...base,
        secondaryLinkEnabled: false,
        secondaryUrl: "javascript:alert(1)",
      })
    ).toBeNull();
  });

  it("refuses edit and activation requests without an id", () => {
    expect(() =>
      buildPausedCampaignMutation({ mode: "edit", payload: {} })
    ).toThrow("Campaign ID is required when editing");
    expect(() => buildActivationMutation("")).toThrow(
      "Campaign ID is required for activation"
    );
  });
});
