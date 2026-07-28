import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, shortDate, isoDate } from "@/lib/format";
import { useRealtimeSync } from "@/lib/realtime";
import { Plus, Search, ReceiptText, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: Orders,
});

type Order = {
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
    outstanding: number;
    credit_limit: number;
  } | null;
  items: { id: string; quantity: number }[];
};

function Orders() {
  // Live-update when orders change.
  useRealtimeSync({
    tableName: "orders",
    invalidateKeys: [["orders"]],
  });

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [query, setQuery] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", statusFilter, dateFilter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, customer:customers(id, name, shop_name, outstanding, credit_limit), items:order_items(id, quantity)")
        .neq("status", "cancelled")
        .order("order_date", { ascending: false });

      if (dateFilter) q = q.eq("order_date", dateFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);

      const { data } = await q;
      return (data ?? []) as unknown as Order[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.order_no.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        (o.customer?.shop_name ?? "").toLowerCase().includes(q)
    );
  }, [orders, query]);

  const totals = useMemo(() => {
    return {
      count: filtered.length,
      totalValue: filtered.reduce((s, o) => s + Number(o.total), 0),
      pending: filtered.filter((o) => o.status === "pending").length,
      approved: filtered.filter((o) => o.status === "approved").length,
    };
  }, [filtered]);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-blue-100 text-blue-800 border-blue-200",
    invoiced: "bg-emerald-100 text-emerald-800 border-emerald-200",
    delivered: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <PageContainer>
      <PageHeader
        title="Orders"
        description="All retailer orders — created by admin or self-service."
        actions={
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/orders/new">
              <Plus className="size-4" /> New Order
            </Link>
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Orders</div>
          <div className="text-2xl font-bold font-mono mt-1">{totals.count}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Value</div>
          <div className="text-2xl font-bold font-mono mt-1">{inr(totals.totalValue)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pending</div>
          <div className="text-2xl font-bold font-mono mt-1 text-warning">{totals.pending}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Approved</div>
          <div className="text-2xl font-bold font-mono mt-1 text-blue-600">{totals.approved}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search order #, customer, shop…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-36 h-9" />
          {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}
        </div>
      </Card>

      {/* Orders table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Order #</th>
                <th className="text-left px-4 py-3 font-semibold">Customer</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Outstanding</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Items</th>
                <th className="text-right px-4 py-3 font-semibold">Total</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No orders found. <Link to="/orders/new" className="text-primary hover:underline">Create one</Link>.
                  </td>
                </tr>
              )}
              {filtered.map((o) => {
                const overLimit = o.customer && Number(o.customer.credit_limit) > 0 && Number(o.customer.outstanding) > Number(o.customer.credit_limit);
                return (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{o.order_no}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium flex items-center gap-1.5">
                        {o.customer?.shop_name ?? o.customer?.name ?? "—"}
                        {overLimit && <Badge variant="destructive" className="text-[9px]">Over limit</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{o.customer?.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono hidden md:table-cell">
                      <span className={cn(
                        Number(o.customer?.outstanding ?? 0) > 0 ? "text-destructive" : "text-success"
                      )}>
                        {inr(o.customer?.outstanding ?? 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{shortDate(o.order_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{o.items?.length ?? 0} items</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{inr(o.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={cn("text-[10px] capitalize", statusColors[o.status] ?? "")}>
                        {o.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-right">{filtered.length} orders</td>
                  <td className="px-4 py-3 text-right font-mono text-lg">{inr(totals.totalValue)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
