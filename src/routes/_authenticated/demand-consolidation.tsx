import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { Download, Printer, Truck, Store, Package, ShoppingCart, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/demand-consolidation")({
  component: DemandConsolidation,
});

type OrderWithItems = {
  id: string;
  order_no: string;
  order_date: string;
  customer_id: string;
  subtotal: number;
  total: number;
  status: string;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    shop_name: string | null;
    address: string | null;
    mobile: string | null;
  } | null;
  items: {
    id: string;
    product_name: string;
    product_id: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
};

function DemandConsolidation() {
  const [date, setDate] = useState(isoDate());
  const [query, setQuery] = useState("");

  // Auto-fetch all orders for this date
  const { data: orders, isLoading } = useQuery({
    queryKey: ["demand-orders", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_no, order_date, customer_id, subtotal, total, status, notes, customer:customers(id, name, shop_name, address, mobile), items:order_items(id, product_name, product_id, quantity, rate, amount)"
        )
        .eq("order_date", date)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithItems[];
    },
  });

  // Auto-aggregate product-wise demand
  const { pickup, shops, totalQty, totalAmount, orderCount, productCount } = useMemo(() => {
    const byProduct = new Map<string, { qty: number; amount: number; orders: Set<string> }>();
    const byShop = new Map<
      string,
      {
        name: string;
        shop_name: string | null;
        address: string | null;
        mobile: string | null;
        orders: string[];
        items: { product: string; qty: number; amount: number }[];
        total: number;
      }
    >();

    let orderCount = 0;

    for (const order of orders ?? []) {
      if (!order.items || order.items.length === 0) continue;
      orderCount++;

      for (const item of order.items) {
        // Product-wise aggregation
        const p = byProduct.get(item.product_name) ?? { qty: 0, amount: 0, orders: new Set<string>() };
        p.qty += Number(item.quantity);
        p.amount += Number(item.amount);
        p.orders.add(order.order_no);
        byProduct.set(item.product_name, p);

        // Shop-wise aggregation
        const c = order.customer;
        const key = c?.name ?? "—";
        const s = byShop.get(key) ?? {
          name: c?.name ?? "—",
          shop_name: c?.shop_name ?? null,
          address: c?.address ?? null,
          mobile: c?.mobile ?? null,
          orders: [],
          items: [],
          total: 0,
        };
        if (!s.orders.includes(order.order_no)) s.orders.push(order.order_no);
        s.items.push({ product: item.product_name, qty: Number(item.quantity), amount: Number(item.amount) });
        s.total += Number(item.amount);
        byShop.set(key, s);
      }
    }

    const pickup = Array.from(byProduct.entries())
      .map(([name, v]) => ({ name, qty: v.qty, amount: v.amount, orderCount: v.orders.size }))
      .sort((a, b) => b.qty - a.qty);
    const shops = Array.from(byShop.values()).sort((a, b) => b.total - a.total);
    return {
      pickup,
      shops,
      totalQty: pickup.reduce((s, p) => s + p.qty, 0),
      totalAmount: pickup.reduce((s, p) => s + p.amount, 0),
      orderCount,
      productCount: pickup.length,
    };
  }, [orders]);

  const filteredShops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.shop_name ?? "").toLowerCase().includes(q) ||
        s.items.some((it) => it.product.toLowerCase().includes(q))
    );
  }, [shops, query]);

  const exportCsv = () => {
    const rows: string[][] = [];
    rows.push(["Demand Consolidation — " + shortDate(date)]);
    rows.push(["Total Orders: " + orderCount, "Total Qty: " + num(totalQty, 1), "Total Value: " + inr(totalAmount)]);
    rows.push([]);
    rows.push(["Product", "Total Qty", "Total Value", "# Orders"]);
    pickup.forEach((p) => rows.push([p.name, String(p.qty), String(p.amount), String(p.orderCount)]));
    rows.push([]);
    rows.push(["", String(totalQty), String(totalAmount), String(orderCount)]);
    rows.push([]);
    rows.push(["--- Shop-wise Breakdown ---"]);
    rows.push(["Shop", "Contact", "Items", "Total"]);
    shops.forEach((s) => {
      rows.push([
        s.shop_name ?? s.name,
        s.mobile ?? "",
        s.items.map((it) => `${it.product}: ${num(it.qty, 1)}`).join(", "),
        String(s.total),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demand-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Demand Consolidation"
        description="Auto-aggregated product demand from all orders for this date. Updates live as orders come in."
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
            <ShoppingCart className="size-3" /> Orders
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{orderCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="size-3" /> Products
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{productCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Truck className="size-3" /> Total units
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{num(totalQty, 1)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Store className="size-3" /> Shops
          </div>
          <div className="text-2xl font-semibold font-mono mt-1">{shops.length}</div>
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
                Consolidated quantity of every product from {orderCount} orders. Updates automatically as new orders come in.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 sm:px-6 py-3 font-semibold">#</th>
                    <th className="text-left px-4 sm:px-6 py-3 font-semibold">Product</th>
                    <th className="text-right px-4 sm:px-6 py-3 font-semibold">Total qty</th>
                    <th className="text-right px-4 sm:px-6 py-3 font-semibold hidden sm:table-cell"># Orders</th>
                    <th className="text-right px-4 sm:px-6 py-3 font-semibold hidden sm:table-cell">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">Loading…</td>
                    </tr>
                  )}
                  {!isLoading && pickup.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Package className="size-8 mx-auto mb-2 opacity-50" />
                        <div>No orders for {shortDate(date)}.</div>
                        <div className="text-xs mt-1">Create orders and they will appear here automatically.</div>
                      </td>
                    </tr>
                  )}
                  {pickup.map((p, i) => (
                    <tr key={p.name} className="hover:bg-muted/30">
                      <td className="px-4 sm:px-6 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 sm:px-6 py-3 font-medium">{p.name}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono font-semibold text-base">{num(p.qty, 1)}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">{p.orderCount}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                {pickup.length > 0 && (
                  <tfoot>
                    <tr className="bg-primary/5 font-semibold">
                      <td colSpan={2} className="px-4 sm:px-6 py-3">Total</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono text-lg">{num(totalQty, 1)}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono hidden sm:table-cell">{orderCount}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono hidden sm:table-cell">{inr(totalAmount)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="shops">
          <div className="mb-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search shop, contact, or product…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
          {isLoading && (
            <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
          )}
          {!isLoading && filteredShops.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              {orders && orders.length > 0 ? "No shops match your search." : "No shops for this date."}
            </Card>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredShops.map((s) => (
              <Card key={s.name} className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b flex items-start justify-between gap-3 bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{s.shop_name ?? s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.name}</div>
                    {s.address && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">📍 {s.address}</div>
                    )}
                    {s.mobile && (
                      <div className="text-[11px] text-muted-foreground">📞 {s.mobile}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold text-sm">{inr(s.total)}</div>
                    <div className="flex flex-wrap justify-end gap-1 mt-1">
                      {s.orders.map((o) => (
                        <Badge key={o} variant="secondary" className="text-[9px] font-mono">
                          {o}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 text-[10px] uppercase text-muted-foreground">
                      <th className="text-left px-4 py-1.5">Product</th>
                      <th className="text-right px-4 py-1.5">Qty</th>
                      <th className="text-right px-4 py-1.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {s.items.map((it, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-sm">{it.product}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold w-20">{num(it.qty, 1)}</td>
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
