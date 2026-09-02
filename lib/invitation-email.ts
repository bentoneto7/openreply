interface InvitationEmailInput {
  inviteUrl: string;
  workspaceName: string;
  inviterName: string;
  role: "ADMIN" | "MEMBER";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function buildInvitationEmail(input: InvitationEmailInput) {
  const role = input.role === "ADMIN" ? "Administrador" : "Membro";
  const workspace = escapeHtml(input.workspaceName);
  const inviter = escapeHtml(input.inviterName);
  const url = escapeHtml(input.inviteUrl);
  return {
    subject: `Convite para acessar ${input.workspaceName} na Comentou`,
    text: `${input.inviterName} convidou você para acessar ${input.workspaceName} como ${role}. Aceite o convite: ${input.inviteUrl}\n\nO link expira em 14 dias.`,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f9fc;font-family:Arial,sans-serif;color:#111827"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px"><tr><td style="padding:32px"><p style="margin:0 0 24px;color:#2563eb;font-weight:700;font-size:20px">Comentou</p><h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">Você recebeu um convite</h1><p style="margin:0 0 24px;color:#64748b;line-height:1.6"><strong>${inviter}</strong> convidou você para acessar <strong>${workspace}</strong> como ${role}.</p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px">Aceitar convite</a><p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6">Este link expira em 14 dias. Se você não esperava este convite, pode ignorar esta mensagem.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

export async function sendWorkspaceInvitationEmail(to: string, input: InvitationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("RESEND_NOT_CONFIGURED");
  const content = buildInvitationEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], ...content }),
  });
  if (!response.ok) {
    console.error("Resend invitation failed", { status: response.status });
    throw new Error("INVITATION_EMAIL_FAILED");
  }
}
