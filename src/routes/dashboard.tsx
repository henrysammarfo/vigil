import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { meFn } from "@/api/dashboard";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const me = await meFn();
    if (!me.ok) {
      throw redirect({ to: "/auth", search: { next: "/dashboard" } });
    }
    return { user: me.user };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return <Outlet />;
}
