/**
 * Per-tenant credential vault — each registrant connects their own Bitget Demo keys.
 * Ciphertext only in DB; never expose raw secrets to the client.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { tenantSecrets } from "../db/schema";
import { newId } from "../security/crypto";
import { openSecret, sealSecret } from "../security/secret-box";
import { VigilError } from "../security/errors";

export type BitgetTenantCreds = {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  baseUrl: string;
};

export type TenantCredStatus = {
  provider: "bitget";
  configured: boolean;
  keyHint: string | null;
  source: "tenant" | "env" | "none";
  updatedAt: string | null;
};

const PROVIDER_BITGET = "bitget";

export async function saveBitgetCredentials(
  tenantId: string,
  input: { apiKey: string; apiSecret: string; passphrase: string },
): Promise<TenantCredStatus> {
  const apiKey = input.apiKey.trim();
  const apiSecret = input.apiSecret.trim();
  const passphrase = input.passphrase.trim();
  if (!apiKey || !apiSecret || !passphrase) {
    throw new VigilError(
      "VALIDATION_ERROR",
      "Bitget Demo API key, secret, and passphrase are required",
      400,
    );
  }
  if (apiKey.length < 8 || apiSecret.length < 8) {
    throw new VigilError("VALIDATION_ERROR", "Credentials look too short", 400);
  }

  const payload = JSON.stringify({
    apiKey,
    apiSecret,
    passphrase,
    v: 1,
  });
  const ciphertext = sealSecret(payload);
  const keyHint = `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
  const db = await getDb();
  const now = new Date();
  const existing = await db
    .select()
    .from(tenantSecrets)
    .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.provider, PROVIDER_BITGET)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(tenantSecrets)
      .set({ ciphertext, keyHint, updatedAt: now })
      .where(eq(tenantSecrets.id, existing[0].id));
  } else {
    await db.insert(tenantSecrets).values({
      id: newId("sec"),
      tenantId,
      provider: PROVIDER_BITGET,
      ciphertext,
      keyHint,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    provider: "bitget",
    configured: true,
    keyHint,
    source: "tenant",
    updatedAt: now.toISOString(),
  };
}

export async function clearBitgetCredentials(tenantId: string): Promise<TenantCredStatus> {
  const db = await getDb();
  await db
    .delete(tenantSecrets)
    .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.provider, PROVIDER_BITGET)));
  return {
    provider: "bitget",
    configured: false,
    keyHint: null,
    source: "none",
    updatedAt: null,
  };
}

export async function getBitgetCredStatus(tenantId: string): Promise<TenantCredStatus> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tenantSecrets)
    .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.provider, PROVIDER_BITGET)))
    .limit(1);
  const row = rows[0];
  if (row) {
    return {
      provider: "bitget",
      configured: true,
      keyHint: row.keyHint,
      source: "tenant",
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  // Ops-only env fallback (shared Demo) — not for multi-user production
  const allowEnv = process.env["VIGIL_ALLOW_ENV_BITGET"]?.trim().toLowerCase();
  if (allowEnv === "1" || allowEnv === "true") {
    const k = process.env["BITGET_API_KEY"]?.trim();
    if (k && process.env["BITGET_API_SECRET"]?.trim() && process.env["BITGET_PASSPHRASE"]?.trim()) {
      return {
        provider: "bitget",
        configured: true,
        keyHint: `${k.slice(0, 4)}…${k.slice(-4)}`,
        source: "env",
        updatedAt: null,
      };
    }
  }
  return {
    provider: "bitget",
    configured: false,
    keyHint: null,
    source: "none",
    updatedAt: null,
  };
}

/** Resolve Demo credentials for this tenant. Prefer vault; optional env fallback. */
export async function resolveBitgetCredentials(tenantId: string): Promise<BitgetTenantCreds> {
  const paper = process.env["BITGET_PAPER"]?.trim().toLowerCase();
  if (paper !== "true" && paper !== "1" && paper !== "yes") {
    throw new VigilError(
      "PAPER_LOCK_VIOLATION",
      "BITGET_PAPER must be true. Live execution is forbidden for VIGIL S2.",
      403,
    );
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(tenantSecrets)
    .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.provider, PROVIDER_BITGET)))
    .limit(1);
  const row = rows[0];
  if (row) {
    try {
      const opened = JSON.parse(openSecret(row.ciphertext)) as {
        apiKey?: string;
        apiSecret?: string;
        passphrase?: string;
      };
      if (opened.apiKey && opened.apiSecret && opened.passphrase) {
        return {
          apiKey: opened.apiKey,
          apiSecret: opened.apiSecret,
          passphrase: opened.passphrase,
          baseUrl: process.env["BITGET_BASE_URL"]?.trim() || "https://api.bitget.com",
        };
      }
    } catch {
      throw new VigilError(
        "BITGET_PAPER_NOT_CONFIGURED",
        "Stored Bitget credentials could not be decrypted. Re-save your Demo keys in Settings.",
        503,
      );
    }
  }

  const allowEnv = process.env["VIGIL_ALLOW_ENV_BITGET"]?.trim().toLowerCase();
  if (allowEnv === "1" || allowEnv === "true") {
    const apiKey = process.env["BITGET_API_KEY"]?.trim();
    const apiSecret = process.env["BITGET_API_SECRET"]?.trim();
    const passphrase = process.env["BITGET_PASSPHRASE"]?.trim();
    if (apiKey && apiSecret && passphrase) {
      return {
        apiKey,
        apiSecret,
        passphrase,
        baseUrl: process.env["BITGET_BASE_URL"]?.trim() || "https://api.bitget.com",
      };
    }
  }

  throw new VigilError(
    "BITGET_PAPER_NOT_CONFIGURED",
    "Connect your own Bitget Demo API keys in Settings → Your Bitget Demo. Each workspace uses its own keys.",
    503,
  );
}
