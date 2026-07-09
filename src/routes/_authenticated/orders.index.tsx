import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate } from "@/lib/format";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: Orders,
});

function Orders() {
  const { data } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await supabase.from("orders").select("*, customer:customers(name, shop_name)").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <PageContainer>
      <PageHeader
        title="Orders"
        description="Retailer orders queued for packing and delivery."
        actions={<Button asChild size="sm" className="gap-1.5"><Link to="/orders/new"><Plus className="size-4" /> New Order</Link></Button>}
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Order No</th>
              <th className="text-left px-6 py-3 font-semibold">Customer</th>
              <th className="text-left px-6 py-3 font-semibold">Date</th>
              <th className="text-right px-6 py-3 font-semibold">Total</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No orders yet. <Link to="/orders/new" className="text-primary hover:underline">Create one</Link>.</td></tr>
            )}
            {(data ?? []).map((o: any) => (
              <tr key={o.id} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-mono text-xs">{o.order_no}</td>
                <td className="px-6 py-3">
                  <div className="font-medium">{o.customer?.name}</div>
                  <div className="text-xs text-muted-foreground">{o.customer?.shop_name}</div>
                </td>
                <td className="px-6 py-3 text-muted-foreground">{shortDate(o.order_date)}</td>
                <td className="px-6 py-3 text-right font-mono font-semibold">{inr(o.total)}</td>
                <td className="px-6 py-3"><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
