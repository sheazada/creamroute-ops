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
  requiredRolesForPath,
  type StaffRole,
} from "@/lib/access";
import { logAccessEvent } from "@/lib/audit.server";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // 1. Authenticate
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // 2. Resolve roles.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as string);

    // 3. Retailers never belong in the staff app.
    if (isRetailerRole(roles)) throw redirect({ to: "/retailer" });

    const landing = landingForRoles(roles);
    if (landing === "/auth") throw redirect({ to: "/auth" });

    // 4. Permission check.
    const path = location.pathname;
    const allowed = canAccessPath(path, roles);
    const required = requiredRolesForPath(path);

    if (!allowed) {
      logAccessEvent({
        data: {
          eventType: "access_denied",
          userId: data.user.id,
          userEmail: data.user.email ?? null,
          userRoles: roles,
          requiredRoles: required,
          routePath: path,
          reason: `User roles [${roles.join(",")}] missing required [${required.join(",")}]`,
        },
      }).catch((err) => console.warn("[audit] logAccessEvent failed:", err));

      throw new AccessDeniedError({
        requiredRoles: required,
        userRoles: roles,
        attemptedPath: path,
      });
    }

    return { user: data.user, roles };
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
