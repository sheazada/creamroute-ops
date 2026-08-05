import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  AccessDeniedError,
  AccessDeniedPage,
} from "@/components/access-denied";
import {
  canAccessPath,
  isRetailerRole,
  landingForRoles,
  requiredPermissionsForPath,
  type StaffRole,
} from "@/lib/access";
import { logAccessEvent } from "@/lib/audit.server";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // 1. Authenticate
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { next: undefined } });

    // 2. Check account status (blocks inactive/suspended/blocked accounts)
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", data.user.id)
      .maybeSingle();
    if ((profile?.account_status ?? "active") !== "active") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    // 3. Resolve roles.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as string);

    // 4. Get user permissions
    const { data: permissionRows } = await supabase.rpc("get_user_permissions", {
      _user_id: data.user.id,
    });
    const userPermissions = (permissionRows ?? []).map((p: any) => p.permission_name);

    // 5. Retailers never belong in the staff app.
    if (isRetailerRole(roles)) throw redirect({ to: "/retailer" });

    const landing = landingForRoles(roles);
    if (landing === "/auth") throw redirect({ to: "/auth", search: { next: undefined } });

    // 6. Permission check.
    const path = location.pathname;
    const allowed = canAccessPath(path, userPermissions);
    const required = requiredPermissionsForPath(path);

    if (!allowed) {
      logAccessEvent({
        data: {
          eventType: "access_denied",
          userId: data.user.id,
          userEmail: data.user.email ?? null,
          userRoles: roles,
          requiredRoles: required,
          routePath: path,
          reason: `User permissions [${userPermissions.join(",")}] missing required [${required.join(",")}]`,
        },
      }).catch((err) => console.warn("[audit] logAccessEvent failed:", err));

      throw new AccessDeniedError({
        requiredRoles: required,
        userRoles: roles,
        attemptedPath: path,
      });
    }

    return { user: data.user, roles, permissions: userPermissions };
  },
  errorComponent: ({ error }) => {
    if (error instanceof AccessDeniedError) {
      return (
        <AccessDeniedPage
          context={{
            requiredRoles: error.requiredRoles,
            userRoles: error.userRoles,
            attemptedPath: error.attemptedPath,
          }}
        />
      );
    }
    return (
      <div className="p-10 text-center text-muted-foreground">
        <div className="text-lg font-semibold mb-2">Something went wrong</div>
        <div className="text-sm">{(error as Error)?.message ?? "Unknown error"}</div>
      </div>
    );
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
