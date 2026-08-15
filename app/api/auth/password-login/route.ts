import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/password-auth";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "E-mail ou senha incorretos." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, passwordHash: true } });
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ success: false, error: "E-mail ou senha incorretos." }, { status: 401 });
  }
  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });
  const cookieStore = await cookies();
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  cookieStore.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken, { httpOnly: true, sameSite: "lax", secure, path: "/", expires });
  return NextResponse.json({ success: true });
}
