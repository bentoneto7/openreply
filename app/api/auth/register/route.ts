import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/password-auth";
import { normalizeWhatsapp } from "@/lib/utils/phone";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  whatsapp: z.string().max(30).transform((value, ctx) => {
    const normalized = normalizeWhatsapp(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "WhatsApp inválido" });
      return z.NEVER;
    }
    return normalized;
  }),
  password: z.string().min(8).max(128).regex(/[A-Za-z]/, "A senha precisa ter uma letra").regex(/\d/, "A senha precisa ter um número"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Confira nome, e-mail, WhatsApp com DDD e senha. A senha precisa de pelo menos 8 caracteres, uma letra e um número." }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) return NextResponse.json({ success: false, error: "Este e-mail já possui uma conta. Entre pela tela de login." }, { status: 409 });

  const passwordHash = await hashPassword(parsed.data.password);
  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, whatsapp: parsed.data.whatsapp, emailVerified: new Date(), passwordHash } });
      await tx.workspace.create({ data: { name: `${parsed.data.name} — Comentou`, ownerId: user.id, members: { create: { userId: user.id, role: "OWNER" } } } });
      await tx.session.create({ data: { sessionToken, userId: user.id, expires } });
    });
  } catch (error) {
    console.error("Registration failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Não foi possível criar a conta. Tente novamente." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  cookieStore.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken, {
    httpOnly: true, sameSite: "lax", secure, path: "/", expires,
  });
  return NextResponse.json({ success: true });
}
