import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { canAccessPath, isRetailerRole, landingForRoles } from "@/lib/access";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as string);

    // Retailers never belong in the staff app.
    if (isRetailerRole(roles)) throw redirect({ to: "/retailer" });

    const landing = landingForRoles(roles);
    if (landing === "/auth") throw redirect({ to: "/auth" });

    if (!canAccessPath(location.pathname, roles) && location.pathname !== landing) {
      throw redirect({ to: landing });
    }

    return { user: data.user, roles };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
