import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  registerUser,
  requireSession,
  logoutSession,
  readSessionToken,
} from "../../src/vigil/auth/session";
import { resetDbForTests } from "../../src/vigil/db/client";
import { clearRateLimitsForTests } from "../../src/vigil/security/crypto";

describe("cookie sessions", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "pglite:memory://vigil-test";
    process.env.SESSION_SECRET = "test-session-secret-32chars-minimum!!";
    await resetDbForTests();
    clearRateLimitsForTests();
  });

  afterEach(async () => {
    await resetDbForTests();
  });

  it("registers, authenticates via cookie, and revokes on logout", async () => {
    const email = `ops-${Date.now()}@vigil.test`;
    const { setCookie, ctx } = await registerUser({
      email,
      password: "correct-horse-battery",
      displayName: "Ops",
    });
    expect(ctx.tenantId).toBeTruthy();
    const token = readSessionToken(setCookie);
    expect(token).toBeTruthy();
    const session = await requireSession(`${setCookie.split(";")[0]}`);
    expect(session.email).toBe(email);

    const cleared = await logoutSession(`${setCookie.split(";")[0]}`);
    expect(cleared).toContain("Max-Age=0");
    await expect(requireSession(`${setCookie.split(";")[0]}`)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
