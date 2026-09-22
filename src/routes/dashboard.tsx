import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { meFn, logoutFn } from "@/api/dashboard";
import { Button } from "@/components/ui/button";

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
  const navigate = useNavigate();
  return (
    <div>
      <div className="sr-only">
        <Button
          type="button"
          onClick={async () => {
            await logoutFn();
            void navigate({ to: "/auth" });
          }}
        >
          Sign out
        </Button>
        <Link to="/auth">Auth</Link>
      </div>
      <Outlet />
    </div>
  );
}
