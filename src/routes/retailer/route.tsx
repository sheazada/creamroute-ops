import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { RetailerShell } from "@/components/retailer-shell";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/retailer")({
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

    // Allow both 'retailer' and 'retailer_user' roles
    if (!roleList.includes("retailer_user") && !roleList.includes("retailer")) {
      throw redirect({ to: "/dashboard" });
    }

    return { user: data.user, roles: roleList };
  },
  component: () => (
    <RetailerShell>
      <Outlet />
    </RetailerShell>
  ),
});
