import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters");
  }
  return secret;
}

/** Fixed-window rate limit. Returns true if allowed. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function clearRateLimitsForTests(): void {
  buckets.clear();
}
