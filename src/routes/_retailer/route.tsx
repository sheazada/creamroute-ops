import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { RetailerShell } from "@/components/retailer-shell";

export const Route = createFileRoute("/_retailer")({
  beforeLoad: async ({ context }) => {
    // Check if user is authenticated
    const { data: userRes } = await context.queryClient
      .getQueryCache()
      .find({ queryKey: ["me"] })
      ?.fetch()
      .then(() => ({ data: null }))
      .catch(() => ({ data: null })) ?? { data: null };

    // Fallback: check auth directly
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      throw redirect({ to: "/auth" });
    }

    // Check if user is a retailer
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    
    const roleList = (roles ?? []).map((r) => r.role as string);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    // Retailers go here; others should be redirected to main app
    if (!roleList.includes("retailer_user") && !roleList.includes("retailer")) {
      throw redirect({ to: "/dashboard" });
    }

    return { user: data.user, profile, roles: roleList };
  },
  component: () => (
    <RetailerShell>
      <Outlet />
    </RetailerShell>
  ),
});

// Need supabase import for beforeLoad
import { supabase } from "@/integrations/supabase/client";
