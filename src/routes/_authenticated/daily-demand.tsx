import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/daily-demand")({
  component: DailyDemand,
});

function DailyDemand() {
  const [date, setDate] = useState(isoDate());
  const { data } = useQuery({
    queryKey: ["daily-demand", date],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("invoice_items")
        .select("product_name, quantity, amount, invoice:invoices!inner(invoice_date, customer:customers(name, shop_name))")
        .eq("invoice.invoice_date", date);
      const rows = items ?? [];
      const byProduct = new Map<string, { qty: number; amount: number; buyers: Map<string, number> }>();
      for (const r of rows as any[]) {
        const key = r.product_name;
        const cur = byProduct.get(key) ?? { qty: 0, amount: 0, buyers: new Map() };
        cur.qty += Number(r.quantity);
        cur.amount += Number(r.amount);
        const cn = r.invoice?.customer?.name ?? "—";
        cur.buyers.set(cn, (cur.buyers.get(cn) ?? 0) + Number(r.quantity));
        byProduct.set(key, cur);
      }
      const products = Array.from(byProduct.entries())
        .map(([name, v]) => ({ name, qty: v.qty, amount: v.amount, buyers: Array.from(v.buyers.entries()) }))
        .sort((a, b) => b.qty - a.qty);
      return { products, totalQty: products.reduce((s, p) => s + p.qty, 0), totalAmount: products.reduce((s, p) => s + p.amount, 0) };
    },
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = [["Product", "Quantity Sold", "Amount"]];
    data.products.forEach((p) => rows.push([p.name, String(p.qty), String(p.amount)]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `daily-demand-${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Daily Demand Report"
        description="Everything sold on a given day — use this to place tomorrow's supplier order."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-9" />
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5"><Download className="size-4" /> Export CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Products sold</div>
          <div className="text-2xl font-semibold font-mono mt-1">{data?.products.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total units</div>
          <div className="text-2xl font-semibold font-mono mt-1">{num(data?.totalQty ?? 0, 2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</div>
          <div className="text-2xl font-semibold font-mono mt-1">{inr(data?.totalAmount ?? 0)}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">Product-wise demand — {shortDate(date)}</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Product</th>
              <th className="text-right px-6 py-3 font-semibold">Qty sold</th>
              <th className="text-right px-6 py-3 font-semibold">Amount</th>
              <th className="text-left px-6 py-3 font-semibold">Top buyers</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.products ?? []).length === 0 && <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No sales for this date.</td></tr>}
            {data?.products.map((p) => (
              <tr key={p.name} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-medium">{p.name}</td>
                <td className="px-6 py-3 text-right font-mono font-semibold">{num(p.qty, 2)}</td>
                <td className="px-6 py-3 text-right font-mono">{inr(p.amount)}</td>
                <td className="px-6 py-3 text-xs text-muted-foreground">
                  {p.buyers.slice(0, 3).map(([n, q]) => `${n} (${num(q, 0)})`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
