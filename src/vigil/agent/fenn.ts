/**
 * FENN-style gates for VIGIL.
 * Allowlist starts empty. A headline is not a fill.
 * Most cycles write NO why-cards. One named side only when allowlisted.
 */

export type FennDecision =
  | { allowPaper: false; action: "NO_TRADE"; reason: string; gate: string }
  | { allowPaper: true; reason: string; gate: string };

export function parseAllowlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((x): x is string => typeof x === "string")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

export function evaluateFennGates(input: {
  fennMode: boolean;
  allowlist: string[];
  ticker: string;
  /** Tickers already papered this run (one side per name). */
  paperedTickers: Set<string>;
  /** Sides already taken this run keyed by ticker. */
  sidesByTicker: Map<string, "buy" | "sell">;
  proposedSide?: "buy" | "sell";
}): FennDecision {
  const ticker = input.ticker.trim().toUpperCase();

  if (!input.fennMode) {
    return { allowPaper: true, reason: "FENN mode off — policy continues", gate: "fenn-disabled" };
  }

  if (!ticker) {
    return {
      allowPaper: false,
      action: "NO_TRADE",
      reason: "No named rToken — headline alone is not a fill",
      gate: "unnamed",
    };
  }

  if (!input.allowlist.includes(ticker)) {
    return {
      allowPaper: false,
      action: "NO_TRADE",
      reason: `${ticker} not on allowlist (starts empty; human GO required)`,
      gate: "allowlist",
    };
  }

  if (input.paperedTickers.has(ticker)) {
    return {
      allowPaper: false,
      action: "NO_TRADE",
      reason: `${ticker} already papered this cycle — one side per name`,
      gate: "one-side",
    };
  }

  const prior = input.sidesByTicker.get(ticker);
  if (prior && input.proposedSide && prior !== input.proposedSide) {
    return {
      allowPaper: false,
      action: "NO_TRADE",
      reason: `${ticker} already has ${prior} — never paper both directions`,
      gate: "dual-side-ban",
    };
  }

  return {
    allowPaper: true,
    reason: `${ticker} allowlisted — eligible for single-side paper`,
    gate: "allowlist-pass",
  };
}

export function fixedPaperQuantity(fixedPaperSize: number): string {
  const n = Number.isFinite(fixedPaperSize) ? Math.floor(fixedPaperSize) : 1;
  return String(Math.max(1, Math.min(n, 10)));
}
