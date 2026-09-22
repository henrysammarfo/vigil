import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { dashboardOverviewFn, meFn, windowStatusFn } from "@/api/dashboard";

export function Trend({ value }: { value: string }) {
  const up = value.startsWith("+");
  const flat = value.startsWith("0") || value === "0.00%";
  const I = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={up ? "text-primary" : "text-foreground"}>
      <I className="mr-1 inline h-4 w-4" />
      {value}
    </span>
  );
}

export function Score({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-20 bg-muted">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold">{value}</span>
    </div>
  );
}

export function useSession() {
  return useQuery({
    queryKey: ["vigil", "me"],
    queryFn: () => meFn(),
    retry: false,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["vigil", "dashboard"],
    queryFn: () => dashboardOverviewFn(),
    refetchInterval: 30_000,
  });
}

export function useWindowStatus() {
  return useQuery({
    queryKey: ["vigil", "window"],
    queryFn: () => windowStatusFn(),
    refetchInterval: 60_000,
  });
}

/** @deprecated static fixtures removed — kept empty export for compile safety during migration */
export const signals: Array<{
  ticker: string;
  event: string;
  time: string;
  move: string;
  score: number;
  state: string;
}> = [];
