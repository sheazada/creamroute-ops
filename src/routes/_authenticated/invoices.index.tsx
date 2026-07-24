import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate } from "@/lib/format";
import { Plus, Search, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices/")({
  component: Invoices,
});

function Invoices() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*, customer:customers(name, shop_name, gstin)").order("created_at", { ascending: false })).data ?? [],
  });
  const filtered = (data ?? []).filter((i: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return i.invoice_no.toLowerCase().includes(s) || i.customer?.name?.toLowerCase().includes(s);
  });
  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description="GST-compliant invoices with CGST/SGST/IGST split."
        actions={<Button asChild size="sm" className="gap-1.5"><Link to="/invoices/new"><Plus className="size-4" /> Generate Invoice</Link></Button>}
      />
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice or customer" className="pl-9" />
          </div>
          <div className="text-xs text-muted-foreground">{filtered.length} invoice{filtered.length === 1 ? "" : "s"}</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Invoice</th>
              <th className="text-left px-6 py-3 font-semibold">Customer</th>
              <th className="text-left px-6 py-3 font-semibold">Date</th>
              <th className="text-right px-6 py-3 font-semibold">Subtotal</th>
              <th className="text-right px-6 py-3 font-semibold">Tax</th>
              <th className="text-right px-6 py-3 font-semibold">Total</th>
              <th className="text-right px-6 py-3 font-semibold">Balance</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No invoices. <Link to="/invoices/new" className="text-primary hover:underline">Generate one</Link>.</td></tr>
            )}
            {filtered.map((i: any) => (
              <tr key={i.id} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-mono text-xs">
                  <Link to="/invoices/$id" params={{ id: i.id }} className="text-primary hover:underline">{i.invoice_no}</Link>
                </td>
                <td className="px-6 py-3">
                  <div className="font-medium">{i.customer?.name}</div>
                  <div className="text-xs text-muted-foreground">{i.customer?.shop_name}</div>
                </td>
                <td className="px-6 py-3 text-muted-foreground">{shortDate(i.invoice_date)}</td>
                <td className="px-6 py-3 text-right font-mono">{inr(i.subtotal)}</td>
                <td className="px-6 py-3 text-right font-mono text-muted-foreground">{inr(Number(i.cgst) + Number(i.sgst) + Number(i.igst))}</td>
                <td className="px-6 py-3 text-right font-mono font-semibold">{inr(i.total)}</td>
                <td className={`px-6 py-3 text-right font-mono ${Number(i.balance) > 0 ? "text-destructive" : "text-muted-foreground"}`}>{inr(i.balance)}</td>
                <td className="px-6 py-3"><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
