import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { useDashboard } from "@/components/vigil/dashboard-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  clearBitgetCredentialsFn,
  meFn,
  saveBitgetCredentialsFn,
  updateSettingsFn,
} from "@/api/dashboard";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings — VIGIL" },
      { name: "description", content: "Configure the VIGIL paper-trading workspace." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const q = useDashboard();
  const qc = useQueryClient();
  const settings = q.data?.ok ? q.data.settings : null;
  const [weekendWatch, setWeekendWatch] = useState(true);
  const [afterHoursWatch, setAfterHoursWatch] = useState(true);
  const [maxPositionUsd, setMaxPositionUsd] = useState(5000);
  const [minConfidence, setMinConfidence] = useState(70);
  const [llmDeclared, setLlmDeclared] = useState("agentrouter/venice");
  const [fennMode, setFennMode] = useState(true);
  const [allowlistText, setAllowlistText] = useState("");
  const [fixedPaperSize, setFixedPaperSize] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [bitgetKey, setBitgetKey] = useState("");
  const [bitgetSecret, setBitgetSecret] = useState("");
  const [bitgetPass, setBitgetPass] = useState("");
  const [bitgetMsg, setBitgetMsg] = useState<string | null>(null);
  const [bitgetStatus, setBitgetStatus] = useState<{
    configured: boolean;
    keyHint: string | null;
    source: string;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await meFn();
      if (me.ok && me.bitget) {
        setBitgetStatus({
          configured: me.bitget.configured,
          keyHint: me.bitget.keyHint,
          source: me.bitget.source,
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (!settings) return;
    const key = `${settings.tenantId}:${settings.updatedAt}`;
    // Don't clobber in-progress edits when react-query refetches the same row.
    if (dirty && hydratedKey) return;
    if (hydratedKey === key) return;
    setWeekendWatch(settings.weekendWatch);
    setAfterHoursWatch(settings.afterHoursWatch);
    setMaxPositionUsd(settings.maxPositionUsd);
    setMinConfidence(settings.minConfidence);
    setLlmDeclared(settings.llmDeclared);
    setFennMode(settings.fennMode ?? true);
    setAllowlistText(Array.isArray(settings.allowlist) ? settings.allowlist.join(", ") : "");
    setFixedPaperSize(settings.fixedPaperSize ?? 1);
    setHydratedKey(key);
    setDirty(false);
  }, [settings, dirty, hydratedKey]);

  function touchAllowlist(v: string) {
    setDirty(true);
    setAllowlistText(v);
  }

  return (
    <DashboardShell title="Settings" kicker="FENN workspace policy">
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Execution policy" meta="Locked to paper">
          <Setting name="Paper trading" desc="Paper = live training on the $100 book. Demo deposit ignored." on locked />
          <Setting
            name="FENN refuse-by-default"
            desc="Empty allowlist → NO cards. Headline alone is never a fill."
            on={fennMode}
            onChange={(v) => {
              setDirty(true);
              setFennMode(v);
            }}
          />
          <Setting
            name="Weekend watch"
            desc="Monitor Saturday and Sunday events."
            on={weekendWatch}
            onChange={(v) => {
              setDirty(true);
              setWeekendWatch(v);
            }}
          />
          <Setting
            name="After-hours watch"
            desc="Monitor post-close weekday events."
            on={afterHoursWatch}
            onChange={(v) => {
              setDirty(true);
              setAfterHoursWatch(v);
            }}
          />
        </Panel>
        <Panel title="Allowlist · human GO">
          <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            rToken allowlist (comma-separated). Starts empty.
          </label>
          <Input
            className="mt-2 rounded-none"
            placeholder="e.g. NVDA"
            value={allowlistText}
            onChange={(e) => touchAllowlist(e.target.value)}
            onBlur={(e) => touchAllowlist(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Demo shape: ten headlines, nine NO why-cards, one paper only when the name is here.
          </p>
          <label className="mt-5 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Fixed paper size
          </label>
          <Input
            type="number"
            className="mt-2 rounded-none"
            value={fixedPaperSize}
            onChange={(e) => {
              setDirty(true);
              setFixedPaperSize(Number(e.target.value));
            }}
          />
          <label className="mt-5 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Min confidence
          </label>
          <Input
            type="number"
            className="mt-2 rounded-none"
            value={minConfidence}
            onChange={(e) => {
              setDirty(true);
              setMinConfidence(Number(e.target.value));
            }}
          />
          <label className="mt-5 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Max position USD (risk cap on the $100 book)
          </label>
          <Input
            type="number"
            className="mt-2 rounded-none"
            value={maxPositionUsd}
            onChange={(e) => {
              setDirty(true);
              setMaxPositionUsd(Number(e.target.value));
            }}
          />
          <label className="mt-5 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            LLM declared (submission field)
          </label>
          <Input
            className="mt-2 rounded-none"
            value={llmDeclared}
            onChange={(e) => {
              setDirty(true);
              setLlmDeclared(e.target.value);
            }}
          />
          <Button
            className="mt-6"
            variant="signal"
            onClick={async () => {
              const allowlist = allowlistText
                .split(/[\s,]+/)
                .map((t) => t.trim().toUpperCase())
                .filter(Boolean);
              const res = await updateSettingsFn({
                data: {
                  weekendWatch,
                  afterHoursWatch,
                  maxPositionUsd,
                  minConfidence,
                  llmDeclared,
                  fennMode,
                  allowlist,
                  fixedPaperSize,
                },
              });
              if (res.ok) {
                setMsg(`Saved · allowlist ${allowlist.length ? allowlist.join(",") : "(empty)"}`);
                setDirty(false);
                setHydratedKey(null);
                await qc.invalidateQueries({ queryKey: ["vigil"] });
              } else {
                setMsg(`${res.code}: ${res.message}`);
              }
            }}
          >
            Save settings
          </Button>
          {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
        </Panel>
      </div>
      <Panel title="Your Bitget Demo" className="mt-4" meta="Encrypted per workspace">
        <p className="text-sm text-muted-foreground">
          Connect <strong>your</strong> Demo API keys. Ciphertext only in the database — never sent
          back to the browser. Platform LLM keys stay server-side and are rate-capped per person in
          Desk chat.
        </p>
        {bitgetStatus?.configured ? (
          <p className="mt-3 border border-border bg-muted/30 px-3 py-2 text-xs">
            Connected · hint {bitgetStatus.keyHint ?? "••••"} · source {bitgetStatus.source}
          </p>
        ) : (
          <p className="mt-3 border border-border px-3 py-2 text-xs text-muted-foreground">
            Not connected — Run agent stays locked until you save Demo keys.
          </p>
        )}
        <label className="mt-4 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          API key
        </label>
        <Input
          className="mt-2 rounded-none"
          type="password"
          autoComplete="off"
          value={bitgetKey}
          onChange={(e) => setBitgetKey(e.target.value)}
          placeholder="Bitget Demo API key"
        />
        <label className="mt-4 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          API secret
        </label>
        <Input
          className="mt-2 rounded-none"
          type="password"
          autoComplete="off"
          value={bitgetSecret}
          onChange={(e) => setBitgetSecret(e.target.value)}
          placeholder="Bitget Demo API secret"
        />
        <label className="mt-4 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Passphrase
        </label>
        <Input
          className="mt-2 rounded-none"
          type="password"
          autoComplete="off"
          value={bitgetPass}
          onChange={(e) => setBitgetPass(e.target.value)}
          placeholder="Bitget Demo passphrase"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="signal"
            onClick={async () => {
              setBitgetMsg(null);
              const res = await saveBitgetCredentialsFn({
                data: {
                  apiKey: bitgetKey,
                  apiSecret: bitgetSecret,
                  passphrase: bitgetPass,
                },
              });
              if (res.ok) {
                setBitgetStatus({
                  configured: res.bitget.configured,
                  keyHint: res.bitget.keyHint,
                  source: res.bitget.source,
                });
                setBitgetKey("");
                setBitgetSecret("");
                setBitgetPass("");
                setBitgetMsg("Saved · encrypted to this workspace only");
                await qc.invalidateQueries({ queryKey: ["vigil"] });
              } else {
                setBitgetMsg(`${res.code}: ${res.message}`);
              }
            }}
          >
            Save Demo keys
          </Button>
          {bitgetStatus?.configured && (
            <Button
              variant="outline"
              onClick={async () => {
                const res = await clearBitgetCredentialsFn();
                if (res.ok) {
                  setBitgetStatus({
                    configured: false,
                    keyHint: null,
                    source: "none",
                  });
                  setBitgetMsg("Cleared");
                  await qc.invalidateQueries({ queryKey: ["vigil"] });
                } else {
                  setBitgetMsg(`${res.code}: ${res.message}`);
                }
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {bitgetMsg && <p className="mt-3 text-xs text-muted-foreground">{bitgetMsg}</p>}
      </Panel>

      <Panel title="Single agent model" className="mt-4" meta="Not a swarm">
        <p className="text-sm text-muted-foreground">
          One pipeline per workspace:{" "}
          <code className="text-foreground">Run agent</code> on Overview (after hours / weekend)
          plus optional worker for that tenant. Desk chat is a separate capped assistant — it cannot
          spawn extra trading agents or burn your Bitget keys.
        </p>
      </Panel>

      <Panel title="Promotion" className="mt-4" meta="S2">
        <p className="text-sm text-muted-foreground">
          X posts must include #BitgetHackathon and @Bitget_AI and quote the official Bitget_AI
          status. Metrics must be labeled observed / estimated / targeted.
        </p>
      </Panel>
    </DashboardShell>
  );
}

function Setting({
  name,
  desc,
  on = false,
  locked,
  onChange,
}: {
  name: string;
  desc: string;
  on?: boolean;
  locked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-4 last:border-0">
      <div>
        <p className="text-sm font-bold uppercase">{name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch
        checked={on}
        disabled={Boolean(locked)}
        onCheckedChange={onChange ?? (() => undefined)}
      />
    </div>
  );
}
