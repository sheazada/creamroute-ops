import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { shortDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/deliveries")({
  component: Deliveries,
});

function Deliveries() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => (await supabase.from("deliveries").select("*, invoice:invoices(invoice_no, total, customer:customers(name, shop_name, address))").order("created_at", { ascending: false })).data ?? [],
  });

  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("deliveries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  return (
    <PageContainer>
      <PageHeader title="Deliveries" description="Assign routes, track status and mark deliveries complete." />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Invoice</th>
              <th className="text-left px-6 py-3 font-semibold">Customer</th>
              <th className="text-left px-6 py-3 font-semibold">Route</th>
              <th className="text-left px-6 py-3 font-semibold">Assigned To</th>
              <th className="text-left px-6 py-3 font-semibold">Date</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No deliveries. Deliveries auto-create when you generate an invoice.</td></tr>}
            {(data ?? []).map((d: any) => (
              <tr key={d.id} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-mono text-xs">{d.invoice?.invoice_no}</td>
                <td className="px-6 py-3">
                  <div className="font-medium">{d.invoice?.customer?.name}</div>
                  <div className="text-xs text-muted-foreground">{d.invoice?.customer?.shop_name}</div>
                </td>
                <td className="px-6 py-3">
                  <Input defaultValue={d.route ?? ""} onBlur={(e) => e.target.value !== (d.route ?? "") && update(d.id, { route: e.target.value })} className="h-8 max-w-32" placeholder="R-01" />
                </td>
                <td className="px-6 py-3">
                  <Input defaultValue={d.assigned_to ?? ""} onBlur={(e) => e.target.value !== (d.assigned_to ?? "") && update(d.id, { assigned_to: e.target.value })} className="h-8 max-w-40" placeholder="Driver" />
                </td>
                <td className="px-6 py-3 text-xs text-muted-foreground">{d.delivered_at ? shortDate(d.delivered_at) : "—"}</td>
                <td className="px-6 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-6 py-3">
                  <Select value={d.status} onValueChange={(v) => update(d.id, { status: v, delivered_at: v === "delivered" ? new Date().toISOString() : null })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
