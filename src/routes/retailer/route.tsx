import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { RetailerShell } from "@/components/retailer-shell";
import { supabase } from "@/integrations/supabase/client";
import { isRetailerRole, landingForRoles } from "@/lib/access";

export const Route = createFileRoute("/retailer")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      throw redirect({ to: "/auth" });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    const roleList = (roles ?? []).map((r) => r.role as string);

    if (!isRetailerRole(roleList)) {
      throw redirect({ to: landingForRoles(roleList) });
    }

    return { user: data.user, roles: roleList };
  },
  component: () => (
    <RetailerShell>
      <Outlet />
    </RetailerShell>
  ),
});
