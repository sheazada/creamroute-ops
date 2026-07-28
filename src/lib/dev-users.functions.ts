import { createServerFn } from "@tanstack/react-start";

export const DEMO_PASSWORD = "Demo@1234";

export const DEMO_USERS = [
  { role: "admin", email: "admin@demo.dairyflow.app", full_name: "Demo Admin" },
  { role: "manager", email: "manager@demo.dairyflow.app", full_name: "Demo Manager" },
  { role: "salesperson", email: "sales@demo.dairyflow.app", full_name: "Demo Salesperson" },
  { role: "driver", email: "driver@demo.dairyflow.app", full_name: "Demo Driver" },
  { role: "helper", email: "helper@demo.dairyflow.app", full_name: "Demo Helper" },
  { role: "retailer", email: "retailer@demo.dairyflow.app", full_name: "Demo Retailer", shop_name: "Demo Kirana Store" },
] as const;

/**
 * Seed demo users AND link the retailer user to a customer record.
 *
 * Why the customer link matters:
 *   The retailer portal queries `customers WHERE user_id = <auth_user_id>` to find
 *   the logged-in user's shop, outstanding balance, orders, and ledger. Without
 *   this link the portal renders a blank shell.
 *
 * The link is a 1:1 unique partial index (customers.user_id WHERE user_id IS NOT NULL),
 * so at most one customer per auth user. Walk-in customers have user_id = NULL.
 */
export const seedDemoUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const created: string[] = [];
  const existing: string[] = [];
  const linkedRetailers: string[] = [];

  for (const u of DEMO_USERS) {
    const { data: createRes, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });

    let userId = createRes?.user?.id ?? null;

    if (createErr) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
      if (found) {
        userId = found.id;
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

    // 1. Ensure profile row exists.
    await supabaseAdmin.from("profiles").upsert(
      { id: userId, full_name: u.full_name, email: u.email },
      { onConflict: "id" },
    );

    // 2. Set role (overwrite any previous assignment).
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: u.role });

    // 3. RETAILER: link this auth user to a customer record so the portal can load.
    if (u.role === "retailer") {
      const shopName = (u as typeof u & { shop_name?: string }).shop_name ?? u.full_name;

      // Try to find an existing customer linked to this user.
      const { data: existingCustomer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingCustomer) {
        // Already linked — make sure shop name is fresh.
        await supabaseAdmin
          .from("customers")
          .update({
            name: u.full_name,
            shop_name: shopName,
            status: "active",
          })
          .eq("id", existingCustomer.id);
        linkedRetailers.push(u.email + " (updated)");
      } else {
        // No customer yet — create one, linked to this user.
        // Use a unique retailer_code so we don't collide on re-seed.
        const retailerCode = "DEMO-" + u.email.split("@")[0].toUpperCase().slice(0, 8);
        const { error } = await supabaseAdmin.from("customers").insert({
          user_id: userId,
          retailer_code: retailerCode,
          name: u.full_name,
          shop_name: shopName,
          mobile: "9876500001",
          email: u.email,
          status: "active",
          credit_limit: 25000,
          outstanding: 0,

        });
        if (error) {
          console.warn("[seed] failed to create retailer customer:", error.message);
        } else {
          linkedRetailers.push(u.email);
        }
      }
    }
  }

  return { ok: true, created, existing, linkedRetailers };
});

/**
 * Admin action: link an existing customer row to an existing auth user by email.
 * Used from the Roles & Permissions admin page.
 */
export const linkCustomerToUser = createServerFn({ method: "POST" })
  .inputValidator((data: { customerId: string; userEmail: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


    if (!data.customerId || !data.userEmail) {
      throw new Error("customerId and userEmail are required");
    }

    // Resolve auth user.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = list?.users.find((x) => x.email?.toLowerCase() === data.userEmail.toLowerCase());
    if (!user) {
      throw new Error(`No auth user found with email: ${data.userEmail}`);
    }

    // Unlink any other customer that might be using this auth user (1:1 constraint).
    await supabaseAdmin
      .from("customers")
      .update({ user_id: null })
      .eq("user_id", user.id)
      .neq("id", data.customerId);

    // Link this customer.
    const { error } = await supabaseAdmin
      .from("customers")
      .update({ user_id: user.id })
      .eq("id", data.customerId);

    if (error) throw new Error(error.message);
    return { ok: true, userId: user.id, email: user.email };
  },
);

/**
 * Admin action: unlink a customer from their auth user (set user_id = NULL).
 */
export const unlinkCustomerFromUser = createServerFn({ method: "POST" })
  .inputValidator((data: { customerId: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("customers")
      .update({ user_id: null })
      .eq("id", data.customerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
);
