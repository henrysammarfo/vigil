import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { useDashboard } from "@/components/vigil/dashboard-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateSettingsFn } from "@/api/dashboard";
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

  useEffect(() => {
    if (!settings) return;
    setWeekendWatch(settings.weekendWatch);
    setAfterHoursWatch(settings.afterHoursWatch);
    setMaxPositionUsd(settings.maxPositionUsd);
    setMinConfidence(settings.minConfidence);
    setLlmDeclared(settings.llmDeclared);
    setFennMode(settings.fennMode ?? true);
    setAllowlistText(Array.isArray(settings.allowlist) ? settings.allowlist.join(", ") : "");
    setFixedPaperSize(settings.fixedPaperSize ?? 1);
  }, [settings]);

  return (
    <DashboardShell title="Settings" kicker="FENN workspace policy">
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Execution policy" meta="Locked to paper">
          <Setting name="Paper trading" desc="Required. Live execution is unavailable." on locked />
          <Setting
            name="FENN refuse-by-default"
            desc="Empty allowlist → NO cards. Headline alone is never a fill."
            on={fennMode}
            onChange={setFennMode}
          />
          <Setting
            name="Weekend watch"
            desc="Monitor Saturday and Sunday events."
            on={weekendWatch}
            onChange={setWeekendWatch}
          />
          <Setting
            name="After-hours watch"
            desc="Monitor post-close weekday events."
            on={afterHoursWatch}
            onChange={setAfterHoursWatch}
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
            onChange={(e) => setAllowlistText(e.target.value)}
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
            onChange={(e) => setFixedPaperSize(Number(e.target.value))}
          />
          <label className="mt-5 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Min confidence
          </label>
          <Input
            type="number"
            className="mt-2 rounded-none"
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
          />
          <label className="mt-5 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Max position USD (risk cap, not spray size)
          </label>
          <Input
            type="number"
            className="mt-2 rounded-none"
            value={maxPositionUsd}
            onChange={(e) => setMaxPositionUsd(Number(e.target.value))}
          />
          <label className="mt-5 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            LLM declared (submission field)
          </label>
          <Input
            className="mt-2 rounded-none"
            value={llmDeclared}
            onChange={(e) => setLlmDeclared(e.target.value)}
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
                setMsg("Saved");
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
      <Switch checked={on} disabled={locked} onCheckedChange={onChange} />
    </div>
  );
}
