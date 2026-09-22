import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { memberships, sessions, tenantSettings, tenants, users } from "../db/schema";
import { VigilError } from "../security/errors";
import { randomBytes } from "node:crypto";
import { newId, rateLimit, requireSessionSecret, sha256 } from "../security/crypto";

export const COOKIE_NAME = "vigil_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
  displayName: z.string().min(1).max(120).optional(),
  tenantName: z.string().min(1).max(120).optional(),
});

export type SessionContext = {
  sessionId: string;
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: string;
};

function cookieOptions(maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function buildSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieOptions(Math.floor(SESSION_TTL_MS / 1000))}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; ${cookieOptions(0)}`;
}

export function readSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${COOKIE_NAME}=`)) {
      return decodeURIComponent(part.slice(COOKIE_NAME.length + 1));
    }
  }
  return null;
}

export async function registerUser(input: z.infer<typeof credentialsSchema>): Promise<{
  ctx: SessionContext;
  setCookie: string;
}> {
  requireSessionSecret();
  if (!rateLimit(`register:${input.email.toLowerCase()}`, 5, 60_000)) {
    throw new VigilError("RATE_LIMITED", "Too many registration attempts", 429);
  }

  const db = await getDb();
  const email = input.email.toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    throw new VigilError("VALIDATION_ERROR", "Email already registered", 409);
  }

  const userId = newId("usr");
  const tenantId = newId("ten");
  const membershipId = newId("mem");
  const slug = `t-${userId.slice(-8)}`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const displayName = input.displayName?.trim() || email.split("@")[0] || "Operator";
  const tenantName = input.tenantName?.trim() || `${displayName} Workspace`;

  await db.insert(tenants).values({ id: tenantId, slug, name: tenantName });
  await db.insert(users).values({ id: userId, email, passwordHash, displayName });
  await db.insert(memberships).values({ id: membershipId, tenantId, userId, role: "owner" });
  await db.insert(tenantSettings).values({ tenantId, paperOnly: true });

  return createSession(userId, tenantId, email, displayName, "owner");
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ ctx: SessionContext; setCookie: string }> {
  requireSessionSecret();
  const email = input.email.toLowerCase();
  if (!rateLimit(`login:${email}`, 10, 60_000)) {
    throw new VigilError("RATE_LIMITED", "Too many login attempts", 429);
  }

  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) {
    throw new VigilError("UNAUTHORIZED", "Invalid email or password", 401);
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new VigilError("UNAUTHORIZED", "Invalid email or password", 401);
  }

  const membershipRows = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);
  const membership = membershipRows[0];
  if (!membership) {
    throw new VigilError("FORBIDDEN", "User has no tenant membership", 403);
  }

  return createSession(user.id, membership.tenantId, user.email, user.displayName, membership.role);
}

async function createSession(
  userId: string,
  tenantId: string,
  email: string,
  displayName: string,
  role: string,
): Promise<{ ctx: SessionContext; setCookie: string }> {
  const db = await getDb();
  const sessionId = newId("ses");
  const token = `${sessionId}.${randomBytes(32).toString("base64url")}`;
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    tenantId,
    tokenHash,
    expiresAt,
  });

  return {
    ctx: { sessionId, userId, tenantId, email, displayName, role },
    setCookie: buildSessionCookie(token),
  };
}

export async function logoutSession(cookieHeader: string | null): Promise<string> {
  const token = readSessionToken(cookieHeader);
  if (token) {
    const db = await getDb();
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, sha256(token)));
  }
  return clearSessionCookie();
}

export async function requireSession(cookieHeader: string | null): Promise<SessionContext> {
  requireSessionSecret();
  const token = readSessionToken(cookieHeader);
  if (!token) {
    throw new VigilError("UNAUTHORIZED", "Authentication required", 401);
  }

  const db = await getDb();
  const tokenHash = sha256(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      tenantId: sessions.tenantId,
      email: users.email,
      displayName: users.displayName,
      role: memberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(
      memberships,
      and(eq(memberships.userId, sessions.userId), eq(memberships.tenantId, sessions.tenantId)),
    )
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new VigilError("UNAUTHORIZED", "Session expired or invalid", 401);
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    tenantId: row.tenantId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
  };
}

/** Optional Clerk bridge: if CLERK_SECRET_KEY is set, callers may map Clerk user→tenant separately. */
export function clerkConfigured(): boolean {
  return Boolean(
    process.env.CLERK_SECRET_KEY?.trim() && process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim(),
  );
}
