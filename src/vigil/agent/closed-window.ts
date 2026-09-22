export type MarketWindowState = "rth_open" | "after_hours" | "weekend" | "holiday_closed";

export type WindowGateResult = {
  allowed: boolean;
  state: MarketWindowState;
  reason: string;
  nowUtc: string;
  nextRthOpenUtc: string | null;
};

/** US equities regular trading hours approximated in America/New_York. */
export function evaluateClosedWindow(
  now: Date = new Date(),
  opts: { weekendWatch?: boolean; afterHoursWatch?: boolean } = {},
): WindowGateResult {
  const weekendWatch = opts.weekendWatch ?? true;
  const afterHoursWatch = opts.afterHoursWatch ?? true;
  const parts = getNyParts(now);
  const nowUtc = now.toISOString();

  if (parts.day === 0 || parts.day === 6) {
    return {
      allowed: weekendWatch,
      state: "weekend",
      reason: weekendWatch
        ? "Weekend window — vigil active"
        : "Weekend watch disabled by tenant policy",
      nowUtc,
      nextRthOpenUtc: nextWeekdayOpen(now, 1).toISOString(),
    };
  }

  const minutes = parts.hour * 60 + parts.minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  if (minutes >= open && minutes < close) {
    return {
      allowed: false,
      state: "rth_open",
      reason: "US RTH is open — VIGIL stands down",
      nowUtc,
      nextRthOpenUtc: null,
    };
  }

  return {
    allowed: afterHoursWatch,
    state: "after_hours",
    reason: afterHoursWatch
      ? "After-hours / pre-market — vigil active"
      : "After-hours watch disabled by tenant policy",
    nowUtc,
    nextRthOpenUtc:
      minutes < open ? setNyTime(now, 9, 30).toISOString() : nextWeekdayOpen(now, 1).toISOString(),
  };
}

function getNyParts(date: Date): { day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bits = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    day: weekdayMap[bits.weekday ?? "Mon"] ?? 1,
    hour: Number(bits.hour),
    minute: Number(bits.minute),
  };
}

function nextWeekdayOpen(from: Date, addDays: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + addDays);
  return setNyTime(d, 9, 30);
}

function setNyTime(base: Date, hour: number, minute: number): Date {
  // Approximate: construct an ISO guess then adjust — sufficient for UI countdown.
  const ny = getNyParts(base);
  const deltaMin = hour * 60 + minute - (ny.hour * 60 + ny.minute);
  return new Date(base.getTime() + deltaMin * 60_000);
}
