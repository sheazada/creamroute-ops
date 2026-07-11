import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { Download, Printer, Truck, Store, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/daily-demand")({
  component: DailyDemand,
});

type ItemRow = {
  product_name: string;
  quantity: number;
  rate: number;
  amount: number;
  invoice: {
    invoice_no: string;
    invoice_date: string;
    total: number;
    customer: { name: string; shop_name: string | null; address: string | null } | null;
  } | null;
};

function DailyDemand() {
  const [date, setDate] = useState(isoDate());
  const [query, setQuery] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["daily-demand", date],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_items")
        .select(
          "product_name, quantity, rate, amount, invoice:invoices!inner(invoice_no, invoice_date, total, customer:customers(name, shop_name, address))",
        )
        .eq("invoice.invoice_date", date);
      return (data ?? []) as unknown as ItemRow[];
    },
  });

  const { pickup, shops, totalQty, totalAmount } = useMemo(() => {
    const byProduct = new Map<string, { qty: number; amount: number }>();
    const byShop = new Map<
      string,
      {
        name: string;
        shop_name: string | null;
        address: string | null;
        invoices: Set<string>;
        items: { product: string; qty: number; amount: number }[];
        total: number;
      }
    >();

    for (const r of rows ?? []) {
      const p = byProduct.get(r.product_name) ?? { qty: 0, amount: 0 };
      p.qty += Number(r.quantity);
      p.amount += Number(r.amount);
      byProduct.set(r.product_name, p);

      const c = r.invoice?.customer;
      const key = c?.name ?? "—";
      const s = byShop.get(key) ?? {
        name: c?.name ?? "—",
        shop_name: c?.shop_name ?? null,
        address: c?.address ?? null,
        invoices: new Set<string>(),
        items: [],
        total: 0,
      };
      if (r.invoice?.invoice_no) s.invoices.add(r.invoice.invoice_no);
      s.items.push({ product: r.product_name, qty: Number(r.quantity), amount: Number(r.amount) });
      s.total += Number(r.amount);
      byShop.set(key, s);
    }

    const pickup = Array.from(byProduct.entries())
      .map(([name, v]) => ({ name, qty: v.qty, amount: v.amount }))
      .sort((a, b) => b.qty - a.qty);
    const shops = Array.from(byShop.values()).sort((a, b) => b.total - a.total);
    return {
      pickup,
      shops,
      totalQty: pickup.reduce((s, p) => s + p.qty, 0),
      totalAmount: pickup.reduce((s, p) => s + p.amount, 0),
    };
  }, [rows]);

  const filteredShops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.shop_name ?? "").toLowerCase().includes(q) ||
        s.items.some((it) => it.product.toLowerCase().includes(q)),
    );
  }, [shops, query]);

  const exportCsv = () => {
    const rows = [["Product", "Quantity", "Amount"]];
    pickup.forEach((p) => rows.push([p.name, String(p.qty), String(p.amount)]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-demand-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Daily Demand & Pickup Sheet"
        description="Total quantity to pick up from the dairy, plus each shop's order for the delivery run."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground hidden sm:block">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-9" />
            </div>
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 hidden sm:inline-flex">
              <Printer className="size-4" /> Print
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5">
              <Download className="size-4" /> CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="size-3" /> Products
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{pickup.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Truck className="size-3" /> Total units
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{num(totalQty, 2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Store className="size-3" /> Shops
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{shops.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</div>
          <div className="text-2xl font-semibold font-mono mt-1">{inr(totalAmount)}</div>
        </Card>
      </div>

      <Tabs defaultValue="pickup" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
          <TabsTrigger value="pickup" className="gap-1.5">
            <Truck className="size-4" /> Pickup Summary
          </TabsTrigger>
          <TabsTrigger value="shops" className="gap-1.5">
            <Store className="size-4" /> Per Shop
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pickup">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b bg-primary/5">
              <h3 className="font-semibold text-sm">Pick up from Sudha Dairy — {shortDate(date)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consolidated quantity of every product to collect before the route starts.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 sm:px-6 py-3 font-semibold">Product</th>
                    <th className="text-right px-4 sm:px-6 py-3 font-semibold">Total qty</th>
                    <th className="text-right px-4 sm:px-6 py-3 font-semibold hidden sm:table-cell">Value</th>
                    <th className="text-center px-4 sm:px-6 py-3 font-semibold w-20">Loaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pickup.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-muted-foreground">
                        No sales for this date.
                      </td>
                    </tr>
                  )}
                  {pickup.map((p) => (
                    <tr key={p.name} className="hover:bg-muted/30">
                      <td className="px-4 sm:px-6 py-3 font-medium">{p.name}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono font-semibold text-base">
                        {num(p.qty, 2)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">
                        {inr(p.amount)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        <input type="checkbox" className="size-4 accent-primary" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {pickup.length > 0 && (
                  <tfoot>
                    <tr className="bg-primary/5 font-semibold">
                      <td className="px-4 sm:px-6 py-3">Total</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono">{num(totalQty, 2)}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono hidden sm:table-cell">{inr(totalAmount)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="shops">
          <div className="mb-3">
            <Input
              placeholder="Search shop or product…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 max-w-sm"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {filteredShops.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground md:col-span-2">No shops for this date.</Card>
            )}
            {filteredShops.map((s) => (
              <Card key={s.name} className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b flex items-start justify-between gap-3 bg-muted/30">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{s.shop_name ?? s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.name}</div>
                    {s.address && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{s.address}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold text-sm">{inr(s.total)}</div>
                    <div className="flex flex-wrap justify-end gap-1 mt-1">
                      {Array.from(s.invoices).map((inv) => (
                        <Badge key={inv} variant="secondary" className="text-[9px] font-mono">
                          {inv}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {s.items.map((it, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-sm">{it.product}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold w-20">{num(it.qty, 2)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground w-24">
                          {inr(it.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
