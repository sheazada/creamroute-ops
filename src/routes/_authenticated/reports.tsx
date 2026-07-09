import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, num, isoDate } from "@/lib/format";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

function Reports() {
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(isoDate());

  const { data } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: async () => {
      const [inv, items, pays, custs] = await Promise.all([
        supabase.from("invoices").select("*, customer:customers(name)").gte("invoice_date", from).lte("invoice_date", to),
        supabase.from("invoice_items").select("product_name, quantity, amount, invoice:invoices!inner(invoice_date, customer:customers(name))").gte("invoice.invoice_date", from).lte("invoice.invoice_date", to),
        supabase.from("payments").select("amount, mode").gte("payment_date", from).lte("payment_date", to),
        supabase.from("customers").select("name, outstanding").gt("outstanding", 0),
      ]);

      const invs = inv.data ?? [];
      const totalSales = invs.reduce((s, r) => s + Number(r.total), 0);
      const totalTax = invs.reduce((s, r) => s + Number(r.cgst) + Number(r.sgst) + Number(r.igst), 0);
      const totalCollected = (pays.data ?? []).reduce((s, r) => s + Number(r.amount), 0);

      const byProduct = new Map<string, { qty: number; amount: number }>();
      const byCustomer = new Map<string, number>();
      for (const it of (items.data ?? []) as any[]) {
        const cur = byProduct.get(it.product_name) ?? { qty: 0, amount: 0 };
        cur.qty += Number(it.quantity); cur.amount += Number(it.amount);
        byProduct.set(it.product_name, cur);
        const cn = it.invoice?.customer?.name ?? "—";
        byCustomer.set(cn, (byCustomer.get(cn) ?? 0) + Number(it.amount));
      }
      const products = Array.from(byProduct.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount);
      const customers = Array.from(byCustomer.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

      return { totalSales, totalTax, totalCollected, invoices: invs.length, products, customers, outstanding: custs.data ?? [] };
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Sales, GST, product movement and outstanding — filter by date range."
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 h-9" />
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 h-9" />
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Invoices</div>
          <div className="text-2xl font-semibold font-mono mt-1">{data?.invoices ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Sales</div>
          <div className="text-2xl font-semibold font-mono mt-1">{inr(data?.totalSales ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">GST Collected</div>
          <div className="text-2xl font-semibold font-mono mt-1">{inr(data?.totalTax ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Collections</div>
          <div className="text-2xl font-semibold font-mono mt-1">{inr(data?.totalCollected ?? 0)}</div>
        </Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Product-wise Sales</TabsTrigger>
          <TabsTrigger value="customers">Customer-wise Sales</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ReportTable
            headers={["Product", "Qty", "Amount"]}
            rows={(data?.products ?? []).map((p) => [p.name, num(p.qty, 2), inr(p.amount)])}
          />
        </TabsContent>
        <TabsContent value="customers">
          <ReportTable
            headers={["Customer", "Total purchases"]}
            rows={(data?.customers ?? []).map((c) => [c.name, inr(c.amount)])}
          />
        </TabsContent>
        <TabsContent value="outstanding">
          <ReportTable
            headers={["Customer", "Outstanding"]}
            rows={(data?.outstanding ?? []).map((c: any) => [c.name, inr(c.outstanding)])}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  const exportCsv = () => {
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"}</div>
        <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5"><Download className="size-3.5" /> Export</Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            {headers.map((h, i) => <th key={h} className={`px-6 py-3 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && <tr><td colSpan={headers.length} className="text-center py-12 text-muted-foreground">No data.</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {r.map((c, j) => <td key={j} className={`px-6 py-3 ${j === 0 ? "font-medium" : "text-right font-mono"}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
