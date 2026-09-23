/**
 * AES-256-GCM secret box keyed from SESSION_SECRET.
 * Used for per-tenant API credentials (never return plaintext to clients).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requireSessionSecret } from "./crypto";

function keyBytes(): Buffer {
  return createHash("sha256").update(`vigil-tenant-secrets:${requireSessionSecret()}`).digest();
}

/** Encrypt UTF-8 plaintext → base64url `iv.tag.ciphertext`. */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

/** Decrypt sealSecret payload. Throws on tamper / wrong key. */
export function openSecret(sealed: string): string {
  const parts = sealed.split(".");
  if (parts.length !== 3) throw new Error("Invalid sealed secret");
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, "base64url");
  const tag = Buffer.from(tagB64!, "base64url");
  const data = Buffer.from(dataB64!, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
