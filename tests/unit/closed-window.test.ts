import { describe, expect, it } from "vitest";
import { evaluateClosedWindow } from "../../src/vigil/agent/closed-window";

describe("closed-window gate", () => {
  it("blocks during a weekday RTH sample", () => {
    // 2026-09-22 was a Tuesday; construct noon ET approximately via UTC
    const wednesdayNoonEt = new Date("2026-09-23T16:00:00.000Z"); // 12:00 America/New_York EDT
    const result = evaluateClosedWindow(wednesdayNoonEt, {
      weekendWatch: true,
      afterHoursWatch: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.state).toBe("rth_open");
  });

  it("allows weekend when weekendWatch is enabled", () => {
    const saturday = new Date("2026-09-26T15:00:00.000Z");
    const result = evaluateClosedWindow(saturday, {
      weekendWatch: true,
      afterHoursWatch: true,
    });
    expect(result.state).toBe("weekend");
    expect(result.allowed).toBe(true);
  });

  it("denies weekend when weekendWatch is disabled", () => {
    const saturday = new Date("2026-09-26T15:00:00.000Z");
    const result = evaluateClosedWindow(saturday, {
      weekendWatch: false,
      afterHoursWatch: true,
    });
    expect(result.allowed).toBe(false);
  });
});
