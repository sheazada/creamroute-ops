import { createServerFn } from "@tanstack/react-start";

export const DEMO_PASSWORD = "Demo@1234";

export const DEMO_USERS = [
  { role: "admin", email: "admin@demo.dairyflow.app", full_name: "Demo Admin" },
  { role: "manager", email: "manager@demo.dairyflow.app", full_name: "Demo Manager" },
  { role: "salesperson", email: "sales@demo.dairyflow.app", full_name: "Demo Salesperson" },
  { role: "driver", email: "driver@demo.dairyflow.app", full_name: "Demo Driver" },
  { role: "helper", email: "helper@demo.dairyflow.app", full_name: "Demo Helper" },
] as const;

export const seedDemoUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const created: string[] = [];
  const existing: string[] = [];

  for (const u of DEMO_USERS) {
    // Try to create; if already exists we just make sure role is right.
    const { data: createRes, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });

    let userId = createRes?.user?.id ?? null;

    if (createErr) {
      // Likely already registered — look it up.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
      if (found) {
        userId = found.id;
        // Reset password to the known demo password so quick-login always works.
        await supabaseAdmin.auth.admin.updateUserById(found.id, {
          password: DEMO_PASSWORD,
          email_confirm: true,
        });
        existing.push(u.email);
      } else {
        continue;
      }
    } else {
      created.push(u.email);
    }

    if (!userId) continue;

    // Ensure profile row exists
    await supabaseAdmin.from("profiles").upsert(
      { id: userId, full_name: u.full_name, email: u.email },
      { onConflict: "id" },
    );

    // Force role to the demo role (overwrite any auto-assigned role)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: u.role });
  }

  return { ok: true, created, existing };
});
