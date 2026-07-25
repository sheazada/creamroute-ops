import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  Layers,
  Package,
  Pencil,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  XCircle,
  Plus,
  Check,
  X,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: Inventory,
});

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  current_stock: number;
  min_stock: number;
  mrp: number;
  purchase_price: number;
  selling_price: number;
  gst_rate: number;
  status: string;
};

type Batch = {
  id: string;
  product_id: string;
  batch_no: string | null;
  mfg_date: string | null;
  expiry_date: string | null;
  quantity: number;
  available_qty: number;
  reserved_qty: number;
  damaged_qty: number;
  cost_price: number;
  status: string;
  warehouse_id: string | null;
  product?: { name: string; unit: string } | null;
  warehouse?: { name: string } | null;
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  note: string | null;
  created_at: string;
  created_by: string | null;
  ref_id: string | null;
  ref_type: string | null;
  product?: { name: string; unit: string } | null;
};

type Adjustment = {
  id: string;
  adjustment_no: string;
  adjustment_date: string;
  reason: string | null;
  status: string;
  warehouse_id: string | null;
  notes: string | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

type AdjustmentWithItems = Adjustment & {
  items: {
    id: string;
    product_id: string;
    batch_id: string | null;
    system_qty: number;
    physical_qty: number;
    diff_qty: number;
    unit_cost: number;
    reason_detail: string | null;
    product?: { name: string } | null;
  }[];
};

function Inventory() {
  const [tab, setTab] = useState<"dashboard" | "stock" | "batches" | "movements" | "adjustments" | "damaged">("dashboard");
  const [dateFilter, setDateFilter] = useState<string>("");

  const qc = useQueryClient();

  // Products
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("status", "active").order("name");
      return (data ?? []) as Product[];
    },
  });

  // Batches
  const { data: batches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_batches")
        .select("*, product:products(name, unit), warehouse:warehouses(name)")
        .order("expiry_date", { ascending: true, nullsFirst: false });
      return (data ?? []) as Batch[];
    },
  });

  // Movements
  const { data: movements = [] } = useQuery({
    queryKey: ["movements", dateFilter],
    queryFn: async () => {
      let q = supabase
        .from("inventory_movements")
        .select("*, product:products(name, unit)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (dateFilter) q = q.eq("created_at", dateFilter);
      const { data } = await q;
      return (data ?? []) as Movement[];
    },
  });

  // Adjustments
  const { data: adjustments = [] } = useQuery({
    queryKey: ["adjustments"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_adjustments").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Adjustment[];
    },
  });

  // Warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("*").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  // Near-expiry (30 days)
  const { data: nearExpiry = [] } = useQuery({
    queryKey: ["near-expiry"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_near_expiry_stock", { _days: 30 });
      if (error) throw error;
      return (data ?? []) as { product_name: string; batch_no: string | null; expiry_date: string; available_qty: number; days_remaining: number }[];
    },
  });

  // Stock valuation
  const { data: valuation = [] } = useQuery({
    queryKey: ["stock-valuation"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stock_valuation");
      if (error) throw error;
      return (data ?? []) as {
        product_id: string;
        product_name: string;
        total_qty: number;
        available_qty: number;
        damaged_qty: number;
        avg_cost: number;
        total_value: number;
      }[];
    },
  });

  const lowStockProducts = products.filter((p) => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock));
  const outOfStockProducts = products.filter((p) => Number(p.current_stock) <= 0);
  const expiringSoon = nearExpiry.filter((b) => b.days_remaining <= 7);
  const damagedBatches = batches.filter((b) => Number(b.damaged_qty) > 0);

  const totalStockValue = valuation.reduce((s, v) => s + Number(v.total_value), 0);
  const totalDamaged = batches.reduce((s, b) => s + Number(b.damaged_qty), 0);
  const totalExpiring = nearExpiry.length;

  return (
    <PageContainer>
      <PageHeader
        title="Inventory Management"
        description="Track stock, batches, movements, adjustments, and valuation."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 no-print">
              <Printer className="size-4" /> Print
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="size-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5"><Boxes className="size-4" /> Stock by Product</TabsTrigger>
          <TabsTrigger value="batches" className="gap-1.5"><Layers className="size-4" /> Batches (FEFO)</TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5"><ArrowUpRight className="size-4" /> Movements</TabsTrigger>
          <TabsTrigger value="adjustments" className="gap-1.5"><Pencil className="size-4" /> Adjustments</TabsTrigger>
          <TabsTrigger value="damaged" className="gap-1.5"><Trash2 className="size-4" /> Damaged / Expired</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total SKUs" value={String(products.length)} icon={Package} />
            <KpiCard label="Stock Value" value={inr(totalStockValue)} icon={TrendingUp} tone="success" />
            <KpiCard label="Low Stock" value={String(lowStockProducts.length)} icon={AlertTriangle} tone="warning" />
            <KpiCard label="Out of Stock" value={String(outOfStockProducts.length)} icon={XCircle} tone="destructive" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Expiring ≤ 30d" value={String(totalExpiring)} icon={Calendar} tone="warning" />
            <KpiCard label="Expiring ≤ 7d" value={String(expiringSoon.length)} icon={Calendar} tone="destructive" />
            <KpiCard label="Damaged Stock" value={num(totalDamaged, 1)} icon={Trash2} tone="destructive" />
            <KpiCard label="Pending Adjustments" value={String(adjustments.filter((a) => a.status === "pending").length)} icon={Clock} tone="primary" />
          </div>

          {/* Alert panels */}
          <div className="grid md:grid-cols-2 gap-4">
            <AlertPanel
              title="Low Stock Alert"
              icon={<AlertTriangle className="size-4 text-warning" />}
              tone="warning"
              emptyMessage="All stock levels are healthy."
            >
              {lowStockProducts.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Min: {num(p.min_stock, 1)} {p.unit}</div>
                  </div>
                  <Badge variant="destructive" className="font-mono">
                    {num(p.current_stock, 1)} {p.unit}
                  </Badge>
                </div>
              ))}
            </AlertPanel>

            <AlertPanel
              title="Expiring Soon (≤ 7 days)"
              icon={<Calendar className="size-4 text-destructive" />}
              tone="destructive"
              emptyMessage="No batches expiring within 7 days."
            >
              {expiringSoon.slice(0, 6).map((b, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.product_name}</div>
                    <div className="text-xs text-muted-foreground">Batch: {b.batch_no ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{num(b.available_qty, 1)}</div>
                    <div className="text-xs text-destructive">{b.days_remaining}d left · {shortDate(b.expiry_date)}</div>
                  </div>
                </div>
              ))}
            </AlertPanel>
          </div>
        </TabsContent>

        {/* STOCK BY PRODUCT */}
        <TabsContent value="stock" className="mt-4">
          <StockByProductTab products={products} valuation={valuation} />
        </TabsContent>

        {/* BATCHES (FEFO) */}
        <TabsContent value="batches" className="mt-4">
          <BatchesTab batches={batches} />
        </TabsContent>

        {/* MOVEMENTS */}
        <TabsContent value="movements" className="mt-4">
          <MovementsTab movements={movements} dateFilter={dateFilter} setDateFilter={setDateFilter} />
        </TabsContent>

        {/* ADJUSTMENTS */}
        <TabsContent value="adjustments" className="mt-4">
          <AdjustmentsTab
            adjustments={adjustments}
            products={products}
            warehouses={warehouses}
            batches={batches}
          />
        </TabsContent>

        {/* DAMAGED / EXPIRED */}
        <TabsContent value="damaged" className="mt-4">
          <DamagedExpiredTab
            batches={damagedBatches}
            nearExpiry={nearExpiry}
            movements={movements.filter((m) => m.movement_type === "damaged" || m.movement_type === "expired")}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/* ═══════════════════════════════════════════
   Dashboard components
   ═══════════════════════════════════════════ */

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "default" | "success" | "warning" | "destructive" | "primary" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={cn(
          "size-4",
          tone === "success" ? "text-success" :
          tone === "warning" ? "text-warning" :
          tone === "destructive" ? "text-destructive" :
          tone === "primary" ? "text-primary" : "text-muted-foreground"
        )} />
      </div>
      <div className={cn(
        "text-2xl font-bold font-mono",
        tone === "destructive" ? "text-destructive" :
        tone === "warning" ? "text-warning" : ""
      )}>
        {value}
      </div>
    </Card>
  );
}

function AlertPanel({ title, icon, tone, children, emptyMessage }: { title: string; icon: React.ReactNode; tone: "warning" | "destructive" | "primary"; children: React.ReactNode; emptyMessage: string }) {
  const hasChildren = React.Children.count(children) > 0;
  return (
    <Card className={cn(
      "p-4",
      tone === "warning" ? "border-warning/30" :
      tone === "destructive" ? "border-destructive/30" : "border-primary/20"
    )}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="text-xs font-semibold uppercase tracking-wider">{title}</div>
      </div>
      {!hasChildren ? (
        <div className="text-sm text-muted-foreground py-2">{emptyMessage}</div>
      ) : children}
    </Card>
  );
}

/* ══════════════════════════════════════════
   Stock by Product Tab
   ═══════════════════════════════════════════ */

function StockByProductTab({ products, valuation }: { products: Product[]; valuation: any[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const valMap = useMemo(() => {
    const m = new Map<string, { total_qty: number; available_qty: number; damaged_qty: number; avg_cost: number; total_value: number }>();
    valuation.forEach((v) => m.set(v.product_id, v));
    return m;
  }, [valuation]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q) && !(p.category ?? "").toLowerCase().includes(q)) return false;
        if (filter === "low") return Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock);
        if (filter === "out") return Number(p.current_stock) <= 0;
        return true;
      })
      .sort((a, b) => Number(a.current_stock) - Number(b.current_stock));
  }, [products, search, filter]);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search product or category…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all", "low", "out"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 font-medium", filter === f ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
              {f === "all" ? "All" : f === "low" ? "Low Stock" : "Out of Stock"}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} products</div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Category</th>
                <th className="text-right px-4 py-3 font-semibold">Current</th>
                <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">Min</th>
                <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Available</th>
                <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Damaged</th>
                <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Avg Cost</th>
                <th className="text-right px-4 py-3 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No products match your filters.</td></tr>
              )}
              {filtered.map((p) => {
                const low = Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock);
                const out = Number(p.current_stock) <= 0;
                const val = valMap.get(p.id);
                return (
                  <tr key={p.id} className={cn("hover:bg-muted/30", out && "bg-destructive/5")}>
                    <td className="px-4 py-3">
                      <div className="font-medium flex items-center gap-2">
                        {p.name}
                        {out && <XCircle className="size-3.5 text-destructive" />}
                        {low && !out && <AlertTriangle className="size-3.5 text-warning" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.category ?? "—"}</td>
                    <td className={cn("px-4 py-3 text-right font-mono font-semibold", out ? "text-destructive" : low ? "text-warning" : "")}>
                      {num(p.current_stock, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">{num(p.min_stock, 2)}</td>
                    <td className="px-4 py-3 text-right font-mono hidden lg:table-cell">{val ? num(val.available_qty, 2) : num(p.current_stock, 2)}</td>
                    <td className="px-4 py-3 text-right font-mono hidden lg:table-cell text-destructive">{val ? num(val.damaged_qty, 2) : "0"}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">{inr(val?.avg_cost ?? p.purchase_price)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{inr(val?.total_value ?? Number(p.current_stock) * Number(p.purchase_price))}</td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 font-semibold">
                  <td colSpan={2} className="px-4 py-3">Total Value</td>
                  <td colSpan={5}></td>
                  <td className="px-4 py-3 text-right font-mono text-lg">
                    {inr(filtered.reduce((s, p) => {
                      const val = valMap.get(p.id);
                      return s + (val?.total_value ?? Number(p.current_stock) * Number(p.purchase_price));
                    }, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Batches Tab (FEFO ordered)
   ═══════════════════════════════════════════ */

function BatchesTab({ batches }: { batches: Batch[] }) {
  const [search, setSearch] = useState("");
  const [showExpired, setShowExpired] = useState(false);

  const now = new Date();
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches
      .filter((b) => {
        const isExpired = b.expiry_date && new Date(b.expiry_date) < now;
        if (!showExpired && isExpired) return false;
        if (q && !(b.product?.name ?? "").toLowerCase().includes(q) && !(b.batch_no ?? "").toLowerCase().includes(q)) return false;
        return true;
      });
  }, [batches, search, showExpired, now]);

  const totalAvailable = filtered.reduce((s, b) => s + Number(b.available_qty), 0);
  const totalDamaged = filtered.reduce((s, b) => s + Number(b.damaged_qty), 0);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search product or batch…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} className="size-4" />
          Show expired batches
        </Label>
        <div className="text-xs text-muted-foreground ml-auto">
          FEFO order · {filtered.length} batches · Available: {num(totalAvailable, 1)} · Damaged: {num(totalDamaged, 1)}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Batch</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Mfg Date</th>
                <th className="text-left px-4 py-3 font-semibold">Expiry</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Available</th>
                <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">Reserved</th>
                <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">Damaged</th>
                <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Cost</th>
                <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Warehouse</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No batches found.</td></tr>
              )}
              {filtered.map((b) => {
                const isExpired = b.expiry_date && new Date(b.expiry_date) < now;
                const isExpiringSoon = b.expiry_date && !isExpired && (new Date(b.expiry_date).getTime() - now.getTime()) <= 7 * 24 * 3600 * 1000;
                return (
                  <tr key={b.id} className={cn("hover:bg-muted/30", isExpired && "bg-destructive/5", isExpiringSoon && !isExpired && "bg-warning/5")}>
                    <td className="px-4 py-3 font-medium">{b.product?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.batch_no ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{b.mfg_date ? shortDate(b.mfg_date) : "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {b.expiry_date ? (
                        <span className={cn(isExpired ? "text-destructive font-semibold" : isExpiringSoon ? "text-warning font-semibold" : "")}>
                          {shortDate(b.expiry_date)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {b.status === "expired" || isExpired ? (
                        <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                      ) : b.status === "blocked" ? (
                        <Badge variant="secondary" className="text-[10px]">Blocked</Badge>
                      ) : isExpiringSoon ? (
                        <Badge variant="outline" className="text-[10px] text-warning border-warning">Expiring</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-success border-success/30">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{num(b.available_qty, 2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">{num(b.reserved_qty, 2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-destructive hidden sm:table-cell">{num(b.damaged_qty, 2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">{inr(b.cost_price)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{b.warehouse?.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Movements Tab
   ═══════════════════════════════════════════ */

function MovementsTab({ movements, dateFilter, setDateFilter }: { movements: Movement[]; dateFilter: string; setDateFilter: (v: string) => void }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== "all" && m.movement_type !== typeFilter) return false;
      if (search && !(m.product?.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [movements, typeFilter, search]);

  const movementIcons: Record<string, any> = {
    in: ArrowUpRight,
    out: ArrowDownLeft,
    damaged: Trash2,
    expired: Calendar,
    adjustment: Pencil,
    grn_in: ArrowUpRight,
    dispatch_out: ArrowDownLeft,
    return_in: ArrowUpRight,
  };

  const movementColors: Record<string, string> = {
    in: "text-success",
    out: "text-destructive",
    damaged: "text-destructive",
    expired: "text-destructive",
    adjustment: "text-warning",
    grn_in: "text-success",
    dispatch_out: "text-destructive",
    return_in: "text-success",
  };

  const totalIn = filtered.filter((m) => ["in", "grn_in", "return_in"].includes(m.movement_type)).reduce((s, m) => s + Number(m.quantity), 0);
  const totalOut = filtered.filter((m) => ["out", "dispatch_out"].includes(m.movement_type)).reduce((s, m) => s + Number(m.quantity), 0);
  const totalDamaged = filtered.filter((m) => m.movement_type === "damaged").reduce((s, m) => s + Number(m.quantity), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground font-semibold">Total In</div><div className="text-lg font-mono font-bold text-success">+{num(totalIn, 1)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground font-semibold">Total Out</div><div className="text-lg font-mono font-bold text-destructive">-{num(totalOut, 1)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground font-semibold">Damaged</div><div className="text-lg font-mono font-bold text-destructive">{num(totalDamaged, 1)}</div></Card>
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search product…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-36 h-9" />
          {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="in">Stock In</SelectItem>
            <SelectItem value="out">Stock Out</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
            <SelectItem value="grn_in">GRN In</SelectItem>
            <SelectItem value="dispatch_out">Dispatch Out</SelectItem>
            <SelectItem value="return_in">Return In</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Time</th>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-right px-4 py-3 font-semibold">Qty</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Ref</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No movements found.</td></tr>
              )}
              {filtered.map((m) => {
                const Icon = movementIcons[m.movement_type] ?? ArrowUpRight;
                const color = movementColors[m.movement_type] ?? "text-muted-foreground";
                const isIn = ["in", "grn_in", "return_in", "adjustment"].includes(m.movement_type) && !["damaged", "expired"].includes(m.movement_type);
                return (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(m.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3 font-medium">{m.product?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold uppercase", color)}>
                        <Icon className="size-3" /> {m.movement_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono font-semibold", isIn ? "text-success" : "text-destructive")}>
                      {isIn ? "+" : "-"}{num(m.quantity, 2)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground hidden md:table-cell">
                      {m.ref_type && m.ref_id ? `${m.ref_type.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{m.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Adjustments Tab
   ═══════════════════════════════════════════ */

function AdjustmentsTab({ adjustments, products, warehouses, batches }: { adjustments: Adjustment[]; products: Product[]; warehouses: any[]; batches: Batch[] }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState<AdjustmentWithItems | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return adjustments;
    return adjustments.filter((a) => a.adjustment_no.toLowerCase().includes(q) || (a.reason ?? "").toLowerCase().includes(q));
  }, [adjustments, search]);

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-warning/20 text-warning",
    approved: "bg-primary/20 text-primary",
    rejected: "bg-destructive/20 text-destructive",
    posted: "bg-success/20 text-success",
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search adjustment…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="size-4" /> New Adjustment</Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Adjustment #</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Reason</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Warehouse</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Notes</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No adjustments yet.</td></tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{a.adjustment_no}</td>
                  <td className="px-4 py-3 text-xs">{shortDate(a.adjustment_date)}</td>
                  <td className="px-4 py-3 text-xs capitalize">{(a.reason ?? "—").replace("_", " ")}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {warehouses.find((w) => w.id === a.warehouse_id)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={cn("text-[10px] capitalize", statusColors[a.status] ?? "")}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{a.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setViewOpen(a as AdjustmentWithItems)} className="gap-1">
                      <Eye className="size-3.5" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {createOpen && (
        <CreateAdjustmentDialog
          products={products}
          warehouses={warehouses}
          batches={batches}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {viewOpen && (
        <ViewAdjustmentDialog adjustment={viewOpen} onClose={() => setViewOpen(null)} />
      )}
    </div>
  );
}

function CreateAdjustmentDialog({ products, warehouses, batches, onClose }: { products: Product[]; warehouses: any[]; batches: Batch[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; batch_id: string; system_qty: string; physical_qty: string; reason_detail: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, { product_id: "", batch_id: "", system_qty: "0", physical_qty: "0", reason_detail: "" }]);
  const updateItem = (i: number, field: string, value: string) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const save = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    for (const it of items) {
      if (!it.product_id) return toast.error("Select a product for all items");
    }
    setSaving(true);

    // Generate adjustment number
    const { data: adjData, error: adjErr } = await supabase.rpc("generate_adjustment_no");
    if (adjErr) { setSaving(false); return toast.error(adjErr.message); }

    const { data: adj, error: createErr } = await supabase
      .from("stock_adjustments")
      .insert({
        adjustment_no: adjData,
        reason: reason || null,
        warehouse_id: warehouseId || null,
        notes: notes || null,
        status: "pending",
        adjustment_date: isoDate(),
      })
      .select()
      .single();

    if (createErr) { setSaving(false); return toast.error(createErr.message); }

    // Insert items
    const itemRows = items.map((it) => ({
      adjustment_id: adj.id,
      product_id: it.product_id,
      batch_id: it.batch_id || null,
      system_qty: Number(it.system_qty) || 0,
      physical_qty: Number(it.physical_qty) || 0,
      diff_qty: (Number(it.physical_qty) || 0) - (Number(it.system_qty) || 0),
      unit_cost: products.find((p) => p.id === it.product_id)?.purchase_price ?? 0,
      reason_detail: it.reason_detail || null,
    }));

    const { error: itemErr } = await supabase.from("stock_adjustment_items").insert(itemRows);
    setSaving(false);

    if (itemErr) return toast.error(itemErr.message);

    toast.success("Adjustment created & submitted for approval");
    qc.invalidateQueries({ queryKey: ["adjustments"] });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Stock Adjustment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical_count">Physical Count</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="expiry">Expiry</SelectItem>
                  <SelectItem value="manual_correction">Manual Correction</SelectItem>
                  <SelectItem value="return_from_retailer">Return from Retailer</SelectItem>
                  <SelectItem value="supplier_return">Supplier Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Warehouse</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Items</Label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus className="size-3" /> Add item</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 p-2 border rounded-md bg-muted/20">
                  <div className="col-span-4">
                    <Select value={it.product_id} onValueChange={(v) => updateItem(i, "product_id", v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Select value={it.batch_id} onValueChange={(v) => updateItem(i, "batch_id", v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Batch" /></SelectTrigger>
                      <SelectContent>
                        {batches.filter((b) => b.product_id === it.product_id).map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.batch_no ?? "No batch"} ({num(b.available_qty, 1)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="System qty" value={it.system_qty} onChange={(e) => updateItem(i, "system_qty", e.target.value)} className="h-8" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Physical qty" value={it.physical_qty} onChange={(e) => updateItem(i, "physical_qty", e.target.value)} className="h-8" />
                  </div>
                  <div className="col-span-1 flex items-center">
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-8 w-8 text-destructive"><X className="size-4" /></Button>
                  </div>
                  <div className="col-span-12">
                    <Input
                      placeholder="Reason detail (e.g. broken crate, expired batch)"
                      value={it.reason_detail}
                      onChange={(e) => updateItem(i, "reason_detail", e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                  No items added yet. Click "Add item" above.
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Submit for Approval"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewAdjustmentDialog({ adjustment, onClose }: { adjustment: AdjustmentWithItems; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["adjustment-items", adjustment.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_adjustment_items")
        .select("*, product:products(name)")
        .eq("adjustment_id", adjustment.id);
      return (data ?? []) as any[];
    },
  });

  const handleAction = async (action: "approve" | "reject" | "post") => {
    setBusy(true);
    try {
      if (action === "approve") {
        const { error } = await supabase
          .from("stock_adjustments")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("id", adjustment.id);
        if (error) throw error;
        toast.success("Adjustment approved. Click 'Post' to apply stock changes.");
      } else if (action === "reject") {
        const { error } = await supabase
          .from("stock_adjustments")
          .update({ status: "rejected" })
          .eq("id", adjustment.id);
        if (error) throw error;
        toast.success("Adjustment rejected");
      } else if (action === "post") {
        const { error } = await supabase.rpc("post_stock_adjustment", { _adjustment_id: adjustment.id });
        if (error) throw error;
        toast.success("Stock adjustment posted successfully!");
      }
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-warning/20 text-warning",
    approved: "bg-primary/20 text-primary",
    rejected: "bg-destructive/20 text-destructive",
    posted: "bg-success/20 text-success",
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Adjustment {adjustment.adjustment_no}
            <Badge className={cn("text-[10px] capitalize", statusColors[adjustment.status] ?? "")}>
              {adjustment.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">Date: </span>{shortDate(adjustment.adjustment_date)}</div>
            <div><span className="text-muted-foreground">Reason: </span><span className="capitalize">{(adjustment.reason ?? "—").replace("_", " ")}</span></div>
            <div><span className="text-muted-foreground">Notes: </span>{adjustment.notes ?? "—"}</div>
            {adjustment.approved_at && <div><span className="text-muted-foreground">Approved: </span>{shortDate(adjustment.approved_at)}</div>}
          </div>

          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">System</th>
                  <th className="text-right p-2">Physical</th>
                  <th className="text-right p-2">Diff</th>
                  <th className="text-left p-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it) => {
                  const diff = Number(it.physical_qty) - Number(it.system_qty);
                  return (
                    <tr key={it.id}>
                      <td className="p-2 font-medium">{it.product?.name ?? "—"}</td>
                      <td className="p-2 text-right font-mono">{num(it.system_qty, 2)}</td>
                      <td className="p-2 text-right font-mono">{num(it.physical_qty, 2)}</td>
                      <td className={cn("p-2 text-right font-mono font-semibold", diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "")}>
                        {diff > 0 ? "+" : ""}{num(diff, 2)}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{it.reason_detail ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          {adjustment.status === "pending" && (
            <>
              <Button variant="destructive" onClick={() => handleAction("reject")} disabled={busy} className="gap-1"><X className="size-4" /> Reject</Button>
              <Button onClick={() => handleAction("approve")} disabled={busy} className="gap-1 bg-emerald-600 hover:bg-emerald-700"><Check className="size-4" /> Approve</Button>
            </>
          )}
          {adjustment.status === "approved" && (
            <Button onClick={() => handleAction("post")} disabled={busy} className="gap-1"><ShieldCheck className="size-4" /> Post to Stock</Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════
   Damaged / Expired Tab
   ═══════════════════════════════════════════ */

function DamagedExpiredTab({ batches, nearExpiry, movements }: { batches: Batch[]; nearExpiry: any[]; movements: Movement[] }) {
  return (
    <div className="space-y-4">
      {/* Damaged stock */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-destructive/5">
          <div className="flex items-center gap-2">
            <Trash2 className="size-4 text-destructive" />
            <h3 className="font-semibold text-sm">Damaged Stock Register</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Batch</th>
                <th className="text-left px-4 py-3 font-semibold">Expiry</th>
                <th className="text-right px-4 py-3 font-semibold">Damaged Qty</th>
                <th className="text-right px-4 py-3 font-semibold">Available</th>
                <th className="text-right px-4 py-3 font-semibold">Cost Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No damaged stock.</td></tr>
              )}
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{b.product?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.batch_no ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{b.expiry_date ? shortDate(b.expiry_date) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-destructive">{num(b.damaged_qty, 2)}</td>
                  <td className="px-4 py-3 text-right font-mono">{num(b.available_qty, 2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{inr(Number(b.damaged_qty) * Number(b.cost_price))}</td>
                </tr>
              ))}
            </tbody>
            {batches.length > 0 && (
              <tfoot>
                <tr className="bg-destructive/5 font-semibold">
                  <td colSpan={3} className="px-4 py-3">Total Damaged</td>
                  <td className="px-4 py-3 text-right font-mono text-destructive">{num(batches.reduce((s, b) => s + Number(b.damaged_qty), 0), 2)}</td>
                  <td></td>
                  <td className="px-4 py-3 text-right font-mono">{inr(batches.reduce((s, b) => s + Number(b.damaged_qty) * Number(b.cost_price), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Near expiry */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-warning/5">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-warning" />
            <h3 className="font-semibold text-sm">Near Expiry (≤ 30 days) — FEFO Priority</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Batch</th>
                <th className="text-left px-4 py-3 font-semibold">Expiry Date</th>
                <th className="text-right px-4 py-3 font-semibold">Days Left</th>
                <th className="text-right px-4 py-3 font-semibold">Available Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {nearExpiry.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No batches expiring soon.</td></tr>
              )}
              {nearExpiry.map((b, i) => (
                <tr key={i} className={cn("hover:bg-muted/20", b.days_remaining <= 7 && "bg-warning/5")}>
                  <td className="px-4 py-3 font-medium">{b.product_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.batch_no ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{shortDate(b.expiry_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={b.days_remaining <= 7 ? "destructive" : "outline"} className={cn("font-mono", b.days_remaining <= 7 && "text-destructive")}>
                      {b.days_remaining}d
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{num(b.available_qty, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent damage/expiry movements */}
      {movements.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Recent Damage / Expiry Movements</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <th className="text-left px-4 py-3 font-semibold">Time</th>
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-right px-4 py-3 font-semibold">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.slice(0, 20).map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3 font-medium">{m.product?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="text-[10px] uppercase">{m.movement_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-destructive">{num(m.quantity, 2)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
