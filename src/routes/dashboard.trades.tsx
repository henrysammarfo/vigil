import { createFileRoute } from "@tanstack/react-router";
import { Download, ShieldCheck } from "lucide-react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { useDashboard } from "@/components/vigil/dashboard-data";
import { Button } from "@/components/ui/button";
import { exportPaperLogFn } from "@/api/dashboard";

export const Route = createFileRoute("/dashboard/trades")({
  head: () => ({
    meta: [
      { title: "Paper Trades — VIGIL" },
      { name: "description", content: "VIGIL Agent Hub paper orders." },
    ],
  }),
  component: Trades,
});

function Trades() {
  const q = useDashboard();
  const orders = q.data?.ok ? q.data.orders : [];

  return (
    <DashboardShell
      title="Paper trades"
      kicker="Agent Hub · paper"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const res = await exportPaperLogFn();
            if (!res.ok) {
              alert(`${res.code}: ${res.message}`);
              return;
            }
            const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `vigil-paper-log-${res.exportedAt}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download /> Export
        </Button>
      }
    >
      <div className="mb-5 flex items-center gap-3 border border-primary-edge bg-primary/10 p-4 text-xs">
        <ShieldCheck className="text-primary" /> All orders shown are Bitget Demo / paper. No live
        capital. Not financial advice.
      </div>
      <Panel title="Order ledger" meta={`${orders.length} orders`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="pb-4">Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Exchange ID</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="py-4">{new Date(o.createdAt).toISOString()}</td>
                  <td className="font-bold">{o.symbol}</td>
                  <td className="uppercase">{o.side}</td>
                  <td>{o.quantity}</td>
                  <td>{o.status}</td>
                  <td className="font-mono text-xs">{o.exchangeOrderId ?? "—"}</td>
                  <td className="text-[10px] uppercase">{o.metricLabel}</td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td className="py-8 text-muted-foreground" colSpan={7}>
                    No paper orders yet. Configure Bitget Demo keys and run the agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </DashboardShell>
  );
}
