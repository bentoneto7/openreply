import { describe, expect, it } from "vitest";
import { buildInvitationEmail } from "@/lib/invitation-email";

describe("workspace invitation email", () => {
  it("builds a branded Portuguese email and escapes untrusted content", () => {
    const email = buildInvitationEmail({
      inviteUrl: "https://app.comentou.com.br/invite/token",
      workspaceName: "Loja <script>",
      inviterName: "Bento & equipe",
      role: "ADMIN",
    });

    expect(email.subject).toBe("Convite para acessar Loja <script> na Comentou");
    expect(email.text).toContain("Administrador");
    expect(email.text).toContain("https://app.comentou.com.br/invite/token");
    expect(email.html).toContain("Loja &lt;script&gt;");
    expect(email.html).toContain("Bento &amp; equipe");
    expect(email.html).not.toContain("<script>");
  });
});
