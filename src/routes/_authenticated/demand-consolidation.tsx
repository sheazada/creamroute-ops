import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, num, isoDate, shortDate, genDocNo } from "@/lib/format";
import { toast } from "sonner";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
  Minus,
  Package,
  Plus,
  Printer,
  RefreshCw,
  ShoppingCart,
  Store,
  Truck,
  TrendingUp,
  Wand2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/demand-consolidation")({
  component: DemandConsolidation,
});

type DeliveryCycle = {
  id: string;
  cycle_code: string;
  order_date: string;
  delivery_date: string;
  delivery_shift: string;
  cutoff_at: string;
  status: string;
  notes: string | null;
};

type DemandConsolidation = {
  id: string;
  consolidation_no: string;
  delivery_cycle_id: string;
  consolidation_date: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

type DemandItem = {
  id: string;
  demand_consolidation_id: string;
  product_id: string | null;
  product_name: string;
  total_ordered_qty: number;
  buffer_qty: number;
  final_procurement_qty: number;
  unit_price: number;
  total_value: number;
  remarks: string | null;
};

type SourceOrder = {
  order_id: string;
  demand_consolidation_id: string;
  orders?: {
    order_no: string;
    customer: { name: string; shop_name: string | null } | null;
    total: number;
  };
};

function DemandConsolidation() {
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const qc = useQueryClient();

  // Fetch all delivery cycles
  const { data: cycles } = useQuery({
    queryKey: ["delivery-cycles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_cycles")
        .select("*")
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeliveryCycle[];
    },
  });

  // Fetch consolidations
  const { data: consolidations } = useQuery({
    queryKey: ["demand-consolidations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_consolidations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DemandConsolidation[];
    },
  });

  const activeCycle = cycles?.find((c) => c.id === selectedCycleId) ?? null;
  const activeConsolidation = consolidations?.find(
    (c) => c.delivery_cycle_id === selectedCycleId
  ) ?? null;

  // Auto-select the first cycle
  const currentCycleId = selectedCycleId ?? cycles?.[0]?.id ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Demand Consolidation"
        description="Aggregate retailer orders into a procurement plan for the next delivery cycle."
        actions={
          <Button size="sm" onClick={() => setNewCycleOpen(true)} className="gap-1.5">
            <Calendar className="size-4" />
            New Cycle
          </Button>
        }
      />

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          label="Active Cycles"
          value={String(cycles?.filter((c) => c.status === "open" || c.status === "planned").length ?? 0)}
          icon={Calendar}
        />
        <KpiCard
          label="Consolidations Done"
          value={String(consolidations?.length ?? 0)}
          icon={FileText}
        />
        <KpiCard
          label="Approved"
          value={String(consolidations?.filter((c) => c.status === "approved" || c.status === "po_generated").length ?? 0)}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Pending Review"
          value={String(consolidations?.filter((c) => c.status === "draft" || c.status === "reviewed").length ?? 0)}
          icon={Clock}
          tone="warning"
        />
      </div>

      {/* Cycle selector */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Delivery Cycle:
            </Label>
            <Select
              value={currentCycleId ?? ""}
              onValueChange={(v) => {
                setSelectedCycleId(v);
              }}
            >
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Select a delivery cycle" />
              </SelectTrigger>
              <SelectContent>
                {(cycles ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <span>{c.cycle_code}</span>
                      <span className="text-xs text-muted-foreground">
                        {shortDate(c.order_date)} → {shortDate(c.delivery_date)} ({c.delivery_shift})
                      </span>
                      <StatusDot status={c.status} />
                    </div>
                  </SelectItem>
                ))}
                {(cycles ?? []).length === 0 && (
                  <SelectItem value="__none__" disabled>
                    No cycles yet — create one
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {activeCycle && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Orders: {shortDate(activeCycle.order_date)}</span>
              <span>→</span>
              <span>Delivery: {shortDate(activeCycle.delivery_date)}</span>
              <span>·</span>
              <span className="capitalize">{activeCycle.delivery_shift}</span>
              <span>·</span>
              <Badge variant={cycleStatusVariant(activeCycle.status)}>
                {activeCycle.status.replace("_", " ")}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Main content */}
      {currentCycleId ? (
        <ConsolidationView
          cycle={activeCycle}
          consolidation={activeConsolidation}
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: ["demand-consolidations"] });
            qc.invalidateQueries({ queryKey: ["demand-items"] });
            qc.invalidateQueries({ queryKey: ["demand-source-orders"] });
          }}
        />
      ) : (
        <Card className="p-12 text-center">
          <Calendar className="size-10 mx-auto mb-3 text-muted-foreground" />
          <div className="text-lg font-semibold mb-1">No delivery cycle selected</div>
          <div className="text-sm text-muted-foreground mb-4">
            Create a new delivery cycle to start consolidating retailer orders.
          </div>
          <Button onClick={() => setNewCycleOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Create Delivery Cycle
          </Button>
        </Card>
      )}

      <NewCycleDialog open={newCycleOpen} onOpenChange={setNewCycleOpen} />
    </PageContainer>
  );
}

function ConsolidationView({
  cycle,
  consolidation,
  onRefresh,
}: {
  cycle: DeliveryCycle | null;
  consolidation: DemandConsolidation | null;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"product" | "shops" | "orders">("product");
  const [generating, setGenerating] = useState(false);

  const isApproved = consolidation?.status === "approved" || consolidation?.status === "po_generated";

  // Fetch consolidation items
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["demand-items", consolidation?.id],
    queryFn: async () => {
      if (!consolidation) return [];
      const { data, error } = await supabase
        .from("demand_consolidation_items")
        .select("*")
        .eq("demand_consolidation_id", consolidation.id)
        .order("total_ordered_qty", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DemandItem[];
    },
    enabled: !!consolidation,
  });

  // Fetch source orders
  const { data: sourceOrders = [] } = useQuery({
    queryKey: ["demand-source-orders", consolidation?.id],
    queryFn: async () => {
      if (!consolidation) return [];
      const { data, error } = await supabase
        .from("demand_source_orders")
        .select("order_id, demand_consolidation_id, orders!inner(order_no, total, customer:customers(id, name, shop_name))")
        .eq("demand_consolidation_id", consolidation.id);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!consolidation,
  });

  // Compute totals
  const totals = useMemo(() => {
    const totalOrdered = items.reduce((s, i) => s + Number(i.total_ordered_qty), 0);
    const totalBuffer = items.reduce((s, i) => s + Number(i.buffer_qty), 0);
    const totalProcurement = items.reduce((s, i) => s + Number(i.final_procurement_qty), 0);
    const totalValue = items.reduce((s, i) => s + Number(i.total_value), 0);
    return { totalOrdered, totalBuffer, totalProcurement, totalValue, productCount: items.length };
  }, [items]);

  // Generate consolidation
  const generate = async () => {
    if (!cycle) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("create_demand_consolidation", {
        p_delivery_cycle_id: cycle.id,
      });
      if (error) throw error;
      toast.success("Demand consolidation generated!");
      qc.invalidateQueries({ queryKey: ["demand-consolidations"] });
      qc.invalidateQueries({ queryKey: ["demand-items"] });
      qc.invalidateQueries({ queryKey: ["demand-source-orders"] });
      qc.invalidateQueries({ queryKey: ["delivery-cycles"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate consolidation");
    } finally {
      setGenerating(false);
    }
  };

  // Approve consolidation
  const approve = async () => {
    if (!consolidation) return;
    const { error } = await supabase
      .from("demand_consolidations")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", consolidation.id);
    if (error) return toast.error(error.message);
    toast.success("Consolidation approved and locked!");
    onRefresh();
  };

  // Update buffer qty for an item
  const updateBuffer = async (itemId: string, bufferQty: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const finalQty = Number(item.total_ordered_qty) + bufferQty;
    const totalValue = finalQty * Number(item.unit_price);

    const { error } = await supabase
      .from("demand_consolidation_items")
      .update({ buffer_qty: bufferQty, final_procurement_qty: finalQty, total_value: totalValue })
      .eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["demand-items", consolidation?.id] });
  };

  // Export CSV
  const exportCsv = () => {
    if (!cycle || items.length === 0) return;
    const rows: string[][] = [];
    rows.push(["Demand Consolidation — " + (consolidation?.consolidation_no ?? "")]);
    rows.push(["Cycle: " + cycle.cycle_code, "Orders: " + shortDate(cycle.order_date), "Delivery: " + shortDate(cycle.delivery_date)]);
    rows.push([]);
    rows.push(["Product", "Ordered Qty", "Buffer Qty", "Final Procurement Qty", "Unit Price", "Total Value"]);
    items.forEach((i) => {
      rows.push([
        i.product_name,
        String(Number(i.total_ordered_qty)),
        String(Number(i.buffer_qty)),
        String(Number(i.final_procurement_qty)),
        Number(i.unit_price).toFixed(2),
        Number(i.total_value).toFixed(2),
      ]);
    });
    rows.push([]);
    rows.push(["", String(totals.totalOrdered), String(totals.totalBuffer), String(totals.totalProcurement), "", totals.totalValue.toFixed(2)]);
    rows.push([]);
    rows.push(["Source Orders"]);
    sourceOrders.forEach((so: any) => {
      const cust = so.orders?.customer;
      rows.push([
        so.orders?.order_no ?? "",
        cust?.shop_name ?? cust?.name ?? "",
        "",
        "",
        "Total",
        Number(so.orders?.total ?? 0).toFixed(2),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demand-${cycle.cycle_code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // No consolidation yet — show generate button
  if (!consolidation) {
    return (
      <Card className="p-12 text-center">
        <Wand2 className="size-10 mx-auto mb-3 text-primary" />
        <div className="text-lg font-semibold mb-1">No consolidation yet</div>
        <div className="text-sm text-muted-foreground mb-4">
          Generate a demand consolidation from all retailer orders for{" "}
          {shortDate(cycle?.order_date ?? "")}.
        </div>
        <Button onClick={generate} disabled={generating} className="gap-1.5">
          <Wand2 className="size-4" />
          {generating ? "Generating…" : "Generate Consolidation"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Consolidation header */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{consolidation.consolidation_no}</h2>
              <Badge variant={consolidationStatusVariant(consolidation.status)}>
                {consolidation.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Created {shortDate(consolidation.created_at)}
              {consolidation.approved_at && ` · Approved ${shortDate(consolidation.approved_at)}`}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isApproved && (
              <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="gap-1.5">
                <RefreshCw className="size-4" />
                Regenerate
              </Button>
            )}
            {consolidation.status === "draft" && (
              <Button size="sm" onClick={approve} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <Lock className="size-4" />
                Approve & Lock
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 no-print">
              <Printer className="size-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 no-print">
              <Download className="size-4" /> CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Products" value={String(totals.productCount)} icon={Package} />
        <KpiCard label="Total Ordered" value={num(totals.totalOrdered, 1)} icon={ShoppingCart} />
        <KpiCard label="Buffer Added" value={num(totals.totalBuffer, 1)} icon={Plus} tone="warning" />
        <KpiCard label="To Procure" value={num(totals.totalProcurement, 1)} icon={Truck} tone="primary" />
        <KpiCard label="Total Value" value={inr(totals.totalValue)} icon={TrendingUp} />
      </div>

      {/* Source orders count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShoppingCart className="size-4" />
        <span>{sourceOrders.length} retailer orders included in this consolidation</span>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="product" className="gap-1.5">
            <Package className="size-4" />
            Product-wise Demand
          </TabsTrigger>
          <TabsTrigger value="shops" className="gap-1.5">
            <Store className="size-4" />
            Shop-wise Breakdown
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <FileText className="size-4" />
            Source Orders ({sourceOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="product" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b bg-primary/5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Truck className="size-4" />
                Pickup from Sudha Dairy — {shortDate(cycle?.delivery_date ?? "")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Edit buffer quantities to account for breakage, spillage, or extra demand.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-5 py-3 font-semibold">#</th>
                    <th className="text-left px-5 py-3 font-semibold">Product</th>
                    <th className="text-right px-5 py-3 font-semibold">Ordered Qty</th>
                    <th className="text-right px-5 py-3 font-semibold w-40">
                      {isApproved ? "Buffer" : "Buffer (editable)"}
                    </th>
                    <th className="text-right px-5 py-3 font-semibold">Final Qty</th>
                    <th className="text-right px-5 py-3 font-semibold hidden md:table-cell">Unit Price</th>
                    <th className="text-right px-5 py-3 font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsLoading && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td>
                    </tr>
                  )}
                  {!itemsLoading && items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Package className="size-8 mx-auto mb-2 opacity-50" />
                        No items in this consolidation.
                      </td>
                    </tr>
                  )}
                  {items.map((item, i) => (
                    <DemandItemRow
                      key={item.id}
                      item={item}
                      index={i}
                      editable={!isApproved}
                      onBufferChange={(buffer) => updateBuffer(item.id, buffer)}
                    />
                  ))}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr className="bg-primary/5 font-semibold">
                      <td colSpan={2} className="px-5 py-3">Total</td>
                      <td className="px-5 py-3 text-right font-mono">{num(totals.totalOrdered, 1)}</td>
                      <td className="px-5 py-3 text-right font-mono text-warning">{num(totals.totalBuffer, 1)}</td>
                      <td className="px-5 py-3 text-right font-mono text-lg text-primary">{num(totals.totalProcurement, 1)}</td>
                      <td className="px-5 py-3 text-right hidden md:table-cell"></td>
                      <td className="px-5 py-3 text-right font-mono">{inr(totals.totalValue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="shops" className="mt-4">
          <ShopBreakdownTab sourceOrders={sourceOrders} />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-5 py-3 font-semibold">#</th>
                    <th className="text-left px-5 py-3 font-semibold">Order No</th>
                    <th className="text-left px-5 py-3 font-semibold">Customer</th>
                    <th className="text-left px-5 py-3 font-semibold">Shop</th>
                    <th className="text-right px-5 py-3 font-semibold">Order Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sourceOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        No source orders.
                      </td>
                    </tr>
                  )}
                  {sourceOrders.map((so: any, i: number) => (
                    <tr key={so.order_id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-3 font-mono text-xs">{so.orders?.order_no}</td>
                      <td className="px-5 py-3">{so.orders?.customer?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{so.orders?.customer?.shop_name ?? "—"}</td>
                      <td className="px-5 py-3 text-right font-mono font-semibold">{inr(so.orders?.total ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                {sourceOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold">
                      <td colSpan={4} className="px-5 py-3">
                        Total from {sourceOrders.length} orders
                      </td>
                      <td className="px-5 py-3 text-right font-mono">
                        {inr(sourceOrders.reduce((s: number, so: any) => s + Number(so.orders?.total ?? 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Print-only section */}
      <div className="hidden print:block">
        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2">Source Orders</h3>
          <table className="w-full text-xs border">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Order #</th>
                <th className="text-left p-2">Customer</th>
                <th className="text-left p-2">Shop</th>
                <th className="text-right p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {sourceOrders.map((so: any) => (
                <tr key={so.order_id} className="border-b">
                  <td className="p-2 font-mono">{so.orders?.order_no}</td>
                  <td className="p-2">{so.orders?.customer?.name}</td>
                  <td className="p-2">{so.orders?.customer?.shop_name}</td>
                  <td className="p-2 text-right font-mono">{inr(so.orders?.total ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DemandItemRow({
  item,
  index,
  editable,
  onBufferChange,
}: {
  item: DemandItem;
  index: number;
  editable: boolean;
  onBufferChange: (buffer: number) => void;
}) {
  const [buffer, setBuffer] = useState(String(Number(item.buffer_qty)));
  const ordered = Number(item.total_ordered_qty);
  const buf = Number(buffer) || 0;
  const finalQty = ordered + buf;
  const value = finalQty * Number(item.unit_price);

  const commit = () => {
    const numBuf = Number(buffer) || 0;
    if (numBuf !== Number(item.buffer_qty)) {
      onBufferChange(numBuf);
    }
  };

  return (
    <tr className="hover:bg-muted/20">
      <td className="px-5 py-3 text-muted-foreground">{index + 1}</td>
      <td className="px-5 py-3 font-medium">{item.product_name}</td>
      <td className="px-5 py-3 text-right font-mono">{num(ordered, 1)}</td>
      <td className="px-5 py-3 text-right">
        {editable ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => {
                const v = Math.max(-ordered, (Number(buffer) || 0) - 1);
                setBuffer(String(v));
                onBufferChange(v);
              }}
            >
              <Minus className="size-3" />
            </Button>
            <Input
              type="number"
              inputMode="decimal"
              className="h-7 w-16 text-center font-mono"
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => {
                const v = (Number(buffer) || 0) + 1;
                setBuffer(String(v));
                onBufferChange(v);
              }}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        ) : (
          <span className="font-mono text-muted-foreground">{num(Number(item.buffer_qty), 1)}</span>
        )}
      </td>
      <td className="px-5 py-3 text-right font-mono font-bold text-primary text-base">
        {num(finalQty, 1)}
      </td>
      <td className="px-5 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">
        {inr(Number(item.unit_price))}
      </td>
      <td className="px-5 py-3 text-right font-mono font-semibold">{inr(value)}</td>
    </tr>
  );
}

function ShopBreakdownTab({ sourceOrders }: { sourceOrders: any[] }) {
  // Build per-shop breakdown from source orders
  const [query, setQuery] = useState("");

  const { data: orderItems } = useQuery({
    queryKey: [
      "demand-shop-breakdown",
      sourceOrders.map((so: any) => so.order_id).join(","),
    ],
    queryFn: async () => {
      if (sourceOrders.length === 0) return [];
      const orderIds = sourceOrders.map((so: any) => so.order_id);
      const { data, error } = await supabase
        .from("order_items")
        .select("product_name, quantity, rate, amount, order_id")
        .in("order_id", orderIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: sourceOrders.length > 0,
  });

  const shops = useMemo(() => {
    // Build a map of order_id -> customer info
    const orderToCustomer = new Map<string, { name: string; shop_name: string | null }>();
    for (const so of sourceOrders) {
      orderToCustomer.set(so.order_id, {
        name: so.orders?.customer?.name ?? "—",
        shop_name: so.orders?.customer?.shop_name ?? null,
      });
    }

    const byShop = new Map<
      string,
      {
        name: string;
        shop_name: string | null;
        items: { product: string; qty: number; amount: number }[];
        total: number;
        orderNos: string[];
      }
    >();

    for (const row of orderItems ?? []) {
      const customer = orderToCustomer.get(row.order_id);
      const key = customer?.name ?? "—";
      const shop = byShop.get(key) ?? {
        name: customer?.name ?? "—",
        shop_name: customer?.shop_name ?? null,
        items: [],
        total: 0,
        orderNos: [],
      };
      shop.items.push({
        product: row.product_name,
        qty: Number(row.quantity),
        amount: Number(row.amount),
      });
      shop.total += Number(row.amount);
      byShop.set(key, shop);
    }

    // Attach order numbers from source orders
    for (const so of sourceOrders) {
      const custName = so.orders?.customer?.name ?? "—";
      const shop = byShop.get(custName);
      if (shop && so.orders?.order_no && !shop.orderNos.includes(so.orders.order_no)) {
        shop.orderNos.push(so.orders.order_no);
      }
    }

    return Array.from(byShop.values()).sort((a, b) => b.total - a.total);
  }, [orderItems, sourceOrders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.shop_name ?? "").toLowerCase().includes(q) ||
        s.items.some((it) => it.product.toLowerCase().includes(q))
    );
  }, [shops, query]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search shop or product…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm h-9"
      />
      {filtered.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          No shops found.
        </Card>
      )}
      {filtered.map((s) => (
        <Card key={s.name} className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-start justify-between gap-3 bg-muted/30">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">
                {s.shop_name ?? s.name}
              </div>
              <div className="text-xs text-muted-foreground truncate">{s.name}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-semibold text-sm">{inr(s.total)}</div>
              <div className="flex flex-wrap justify-end gap-1 mt-1">
                {s.orderNos.map((no) => (
                  <Badge key={no} variant="secondary" className="text-[9px] font-mono">
                    {no}
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
                  <td className="px-4 py-2 text-right font-mono font-semibold w-20">
                    {num(it.qty, 1)}
                  </td>
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
  );
}

function NewCycleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  });
  const [shift, setShift] = useState("morning");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("ensure_delivery_cycle", {
        p_delivery_date: deliveryDate,
        p_shift: shift,
      });
      if (error) throw error;
      toast.success("Delivery cycle created!");
      qc.invalidateQueries({ queryKey: ["delivery-cycles"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create cycle");
    } finally {
      setSaving(false);
    }
  };

  const orderDate = useMemo(() => {
    const d = new Date(deliveryDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [deliveryDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Delivery Cycle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/30">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              How it works
            </div>
            <div className="text-sm">
              Orders placed on <b>{shortDate(orderDate)}</b> will be consolidated for delivery on{" "}
              <b>{shortDate(deliveryDate)}</b> ({shift}).
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Order Date</Label>
              <Input type="date" value={orderDate} disabled className="mt-1 bg-muted" />
            </div>
            <div>
              <Label>Delivery Date *</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Delivery Shift</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="evening">Evening</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Creating…" : "Create Cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ───

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: any;
  tone?: "default" | "success" | "warning" | "primary";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <Icon
          className={cn(
            "size-4",
            tone === "success"
              ? "text-emerald-600"
              : tone === "warning"
                ? "text-amber-600"
                : tone === "primary"
                  ? "text-primary"
                  : "text-muted-foreground"
          )}
        />
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
    </Card>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "bg-emerald-500",
    closed: "bg-gray-400",
    planned: "bg-blue-500",
    dispatched: "bg-amber-500",
    completed: "bg-green-600",
  };
  return <span className={cn("size-2 rounded-full", colors[status] ?? "bg-gray-400")} />;
}

function cycleStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "open":
      return "default";
    case "planned":
      return "secondary";
    case "dispatched":
      return "outline";
    case "completed":
      return "outline";
    default:
      return "secondary";
  }
}

function consolidationStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "draft":
      return "secondary";
    case "reviewed":
      return "outline";
    case "approved":
      return "default";
    case "po_generated":
      return "default";
    default:
      return "secondary";
  }
}
