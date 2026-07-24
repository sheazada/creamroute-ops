import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_recent_invoices",
  title: "List recent invoices",
  description: "List recent GST invoices visible to the signed-in user, optionally filtered by customer or date range.",
  inputSchema: {
    customer_id: z.string().uuid().optional(),
    from_date: z.string().optional().describe("ISO date (YYYY-MM-DD) inclusive."),
    to_date: z.string().optional().describe("ISO date (YYYY-MM-DD) inclusive."),
    limit: z.number().int().positive().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ customer_id, from_date, to_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = sb(ctx)
      .from("invoices")
      .select("id, invoice_number, invoice_date, customer_id, total, paid, balance, status")
      .order("invoice_date", { ascending: false })
      .limit(Math.min(limit ?? 50, 500));
    if (customer_id) q = q.eq("customer_id", customer_id);
    if (from_date) q = q.gte("invoice_date", from_date);
    if (to_date) q = q.lte("invoice_date", to_date);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { invoices: data } };
  },
});
