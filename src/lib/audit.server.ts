// Server function for writing access audit events.
// Used by both the login page (login events) and route guards (access_denied events).

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AuditEvent = {
  eventType: "login_success" | "login_failure" | "logout" | "access_denied";
  userId: string | null;
  userEmail: string | null;
  userRoles: string[];
  requiredRoles: string[];
  routePath: string | null;
  reason?: string | null;
};

function extractClientInfo(headers: Headers) {
  return {
    ip:
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headers.get("x-real-ip") ??
      headers.get("cf-connecting-ip") ??
      "unknown",
    userAgent: headers.get("user-agent") ?? "unknown",
  };
}

export const logAccessEvent = createServerFn({ method: "POST" }).handler(
  async ({ data, headers }: { data: AuditEvent; headers: Headers }) => {
    const { ip, userAgent } = extractClientInfo(headers);

    const { error } = await supabaseAdmin.rpc("log_access_event", {
      _event_type: data.eventType,
      _user_id: data.userId,
      _user_email: data.userEmail,
      _user_roles: data.userRoles,
      _required_roles: data.requiredRoles,
      _route_path: data.routePath,
      _ip_address: ip,
      _user_agent: userAgent,
      _reason: data.reason ?? null,
    });

    if (error) {
      // Audit logging must never break the user-facing flow.
      console.error("[audit] log_access_event failed:", error);
    }
    return { ok: !error };
  },
);

// Fetch recent audit events (admin use).
export const fetchAccessAuditLog = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { limit?: number; eventType?: string } }) => {
    const limit = data.limit ?? 100;
    let q = supabaseAdmin
      .from("access_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data.eventType && data.eventType !== "all") {
      q = q.eq("event_type", data.eventType);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  },
);
