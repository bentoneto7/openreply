import NextAuth, { type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser, getPrimaryWorkspace } from "@/lib/workspace";
import { cookies } from "next/headers";

type AdapterPrismaClient = Parameters<typeof PrismaAdapter>[0];

export const authConfig = {
  adapter: PrismaAdapter(prisma as unknown as AdapterPrismaClient),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "missing-resend-api-key",
      from: process.env.EMAIL_FROM ?? "Comentou <login@example.com>",
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureWorkspaceForUser(user.id, user.email);
      }
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
  },
  session: {
    strategy: "database",
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getCurrentSessionUser(): Promise<{ id: string; email: string | null; name: string | null } | null> {
  const nextAuthSession = await auth();
  if (nextAuthSession?.user?.id) {
    return { id: nextAuthSession.user.id, email: nextAuthSession.user.email ?? null, name: nextAuthSession.user.name ?? null };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("__Secure-authjs.session-token")?.value
    ?? cookieStore.get("authjs.session-token")?.value
    ?? cookieStore.get("__Secure-next-auth.session-token")?.value
    ?? cookieStore.get("next-auth.session-token")?.value;
  if (!sessionToken) return null;

  const databaseSession = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!databaseSession || databaseSession.expires <= new Date()) return null;
  return databaseSession.user;
}

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentSessionUser())?.id ?? null;
}

export async function getCurrentWorkspaceId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const workspace = await getPrimaryWorkspace(userId);
  if (workspace) return workspace.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const createdWorkspace = await ensureWorkspaceForUser(userId, user?.email);
  return createdWorkspace.id;
}
