import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, num, isoDate, shortDate, genDocNo } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sudha-challan")({
  component: SudhaChallan,
});

type DemandItem = {
  id: string;
  product_name: string;
  product_id: string | null;
  total_ordered_qty: number;
};

type ChallanItem = {
  id: string;
  product_name: string;
  product_id: string;
  ordered_qty: number;
  received_qty: number;
  rate: number;
  gst_rate: number;
  amount: number;
  variance_type: "ok" | "short" | "extra" | "rejected";
  variance_qty: number;
  notes: string;
};

function SudhaChallan() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"entry" | "history" | "reconciliation">("entry");
  const [challanDate, setChallanDate] = useState(isoDate());
  const [sSudhaChallanNo, setSudhaChallanNo] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [items, setItems] = useState<ChallanItem[]>([]);
  const [selectedConsolidation, setSelectedConsolidation] = useState<string>("");
  const [search, setSearch] = useState("");

  // Fetch today's demand consolidations
  const { data: consolidations = [] } = useQuery({
    queryKey: ["demand-consolidations", challanDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_consolidations")
        .select("id, consolidation_no, consolidation_date, status")
        .eq("consolidation_date", challanDate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch consolidation items when selected
  const { data: consolidationItems = [] } = useQuery({
    queryKey: ["consolidation-items", selectedConsolidation],
    queryFn: async () => {
      if (!selectedConsolidation) return [];
      const { data, error } = await supabase
        .from("demand_consolidation_items")
        .select("id, product_name, product_id, total_ordered_qty")
        .eq("demand_consolidation_id", selectedConsolidation);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedConsolidation,
  });

  // Load consolidation items into challan items
  const loadFromConsolidation = () => {
    if (consolidationItems.length === 0) {
      return toast.error("No items in this consolidation");
    }
    setItems(
      consolidationItems.map((ci: DemandItem) => ({
        id: crypto.randomUUID(),
        product_name: ci.product_name,
        product_id: ci.product_id ?? "",
        ordered_qty: Number(ci.total_ordered_qty),
        received_qty: Number(ci.total_ordered_qty), // Default to ordered
        rate: 0,
        gst_rate: 5,
        amount: 0,
        variance_type: "ok" as const,
        variance_qty: 0,
        notes: "",
      }))
    );
    toast.success(`Loaded ${consolidationItems.length} items from consolidation`);
  };

  // Update item
  const updateItem = (id: string, field: keyof ChallanItem, value: string | number) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      const newItem = { ...item, [field]: value };
      // Auto-calculate variance
      if (field === "received_qty") {
        const received = Number(value);
        const diff = received - item.ordered_qty;
        newItem.variance_qty = Math.abs(diff);
        if (diff === 0) newItem.variance_type = "ok";
        else if (diff > 0) newItem.variance_type = "extra";
        else newItem.variance_type = "short";
      }
      // Auto-calculate amount
      if (field === "received_qty" || field === "rate") {
        newItem.amount = newItem.received_qty * newItem.rate;
      }
      return newItem;
    });
    setItems(updated);
  };

  // Add manual item
  const addManualItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        product_name: "",
        product_id: "",
        ordered_qty: 0,
        received_qty: 0,
        rate: 0,
        gst_rate: 5,
        amount: 0,
        variance_type: "ok",
        variance_qty: 0,
        notes: "",
      },
    ]);
  };

  // Remove item
  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const cgst = subtotal * 0.025; // 2.5% CGST for dairy
    const sgst = subtotal * 0.025;
    const total = subtotal + cgst + sgst;
    return { subtotal, cgst, sgst, total };
  }, [items]);

  const varianceCounts = useMemo(() => {
    return {
      ok: items.filter((i) => i.variance_type === "ok").length,
      short: items.filter((i) => i.variance_type === "short").length,
      extra: items.filter((i) => i.variance_type === "extra").length,
      rejected: items.filter((i) => i.variance_type === "rejected").length,
    };
  }, [items]);

  // Save challan
  const handleSave = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    if (!sSudhaChallanNo.trim()) return toast.error("Enter Sudha challan number");

    // Validate items
    for (const item of items) {
      if (!item.product_name.trim()) return toast.error("Enter product name for all items");
      if (item.received_qty <= 0) return toast.error("Received quantity must be > 0");
    }

    try {
      const challanNo = genDocNo("SUDHA");
      const { data: challan, error: challanErr } = await supabase
        .from("sudha_challans")
        .insert({
          challan_no: sSudhaChallanNo.trim(),
          challan_date: challanDate,
          vehicle_no: vehicleNo || null,
          driver_name: driverName || null,
          subtotal: totals.subtotal,
          cgst: totals.cgst,
          sgst: totals.sgst,
          total: totals.total,
          status: "received",
        })
        .select()
        .single();

      if (challanErr) throw challanErr;

      // Insert items
      for (const item of items) {
        const { error: itemErr } = await supabase
          .from("sudha_challan_items")
          .insert({
            challan_id: challan.id,
            product_name: item.product_name,
            product_id: item.product_id || null,
            ordered_qty: item.ordered_qty,
            received_qty: item.received_qty,
            rate: item.rate,
            gst_rate: item.gst_rate,
            amount: item.amount,
            variance_type: item.variance_type,
            variance_qty: item.variance_qty,
            notes: item.notes || null,
          });
        if (itemErr) throw itemErr;
      }

      toast.success(`Sudha challan ${sSudhaChallanNo} saved!`);
      qc.invalidateQueries({ queryKey: ["sudha-challans"] });
      qc.invalidateQueries({ queryKey: ["daily-reconciliation"] });

      // Reset
      setSudhaChallanNo("");
      setVehicleNo("");
      setDriverName("");
      setItems([]);
      setSelectedConsolidation("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save challan");
    }
  };

  // Fetch historical challans
  const { data: historicalChallans = [] } = useQuery({
    queryKey: ["sudha-challans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sudha_challans")
        .select("*, items:sudha_challan_items(count)")
        .order("challan_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Sudha Challan Entry"
        description="Record what Sudha delivered. Track variances and create claims."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="entry" className="gap-1.5">
            <Truck className="size-4" /> New Challan
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <Package className="size-4" /> History
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="gap-1.5">
            <RefreshCw className="size-4" /> Daily Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="mt-4 space-y-4">
          {/* Header info */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Sudha Challan No *</Label>
                <Input
                  value={sSudhaChallanNo}
                  onChange={(e) => setSudhaChallanNo(e.target.value)}
                  placeholder="e.g. SD/2026-27/12345"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Challan Date *</Label>
                <Input
                  type="date"
                  value={challanDate}
                  onChange={(e) => setChallanDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Vehicle No</Label>
                <Input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  placeholder="e.g. BR10AB1234"
                  className="mt-1"
                />
              </div>
            </div>
          </Card>

          {/* Load from consolidation */}
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-3">
              <ShoppingCart className="size-5 text-primary shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Load from Demand Consolidation</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Auto-fill items from today's consolidated demand
                </div>
              </div>
              <Select value={selectedConsolidation} onValueChange={setSelectedConsolidation}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select consolidation" />
                </SelectTrigger>
                <SelectContent>
                  {consolidations.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.consolidation_no} ({shortDate(c.consolidation_date)})
                    </SelectItem>
                  ))}
                  {consolidations.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      No consolidations for {shortDate(challanDate)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button onClick={loadFromConsolidation} disabled={!selectedConsolidation}>
                Load Items
              </Button>
            </div>
          </Card>

          {/* Items table */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Challan Items</h3>
                <div className="text-xs text-muted-foreground">
                  {items.length} items · {varianceCounts.ok} OK · {varianceCounts.short} Short ·{" "}
                  {varianceCounts.extra} Extra · {varianceCounts.rejected} Rejected
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addManualItem} className="gap-1.5">
                <Plus className="size-4" /> Add Item
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 py-2 font-semibold">Product</th>
                    <th className="text-right px-4 py-2 font-semibold">Ordered</th>
                    <th className="text-right px-4 py-2 font-semibold">Received</th>
                    <th className="text-center px-4 py-2 font-semibold">Variance</th>
                    <th className="text-right px-4 py-2 font-semibold">Rate</th>
                    <th className="text-right px-4 py-2 font-semibold">Amount</th>
                    <th className="text-left px-4 py-2 font-semibold">Notes</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Package className="size-10 mx-auto mb-3 opacity-50" />
                        <div className="text-sm font-semibold">No items yet</div>
                        <div className="text-xs mt-1">
                          Load from consolidation or add items manually
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const diff = item.received_qty - item.ordered_qty;
                      return (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2">
                            <Input
                              value={item.product_name}
                              onChange={(e) => updateItem(item.id, "product_name", e.target.value)}
                              placeholder="Product name"
                              className="h-8"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono">{num(item.ordered_qty, 1)}</td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={item.received_qty}
                              onChange={(e) => updateItem(item.id, "received_qty", e.target.value)}
                              className="h-8 w-20 text-right font-mono"
                              min="0"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            {diff === 0 ? (
                              <Badge variant="outline" className="text-success border-success/30">
                                <CheckCircle2 className="size-3 mr-1" /> OK
                              </Badge>
                            ) : diff > 0 ? (
                              <Badge variant="outline" className="text-primary">
                                +{num(diff, 1)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-destructive">
                                {num(diff, 1)}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateItem(item.id, "rate", e.target.value)}
                              className="h-8 w-20 text-right font-mono"
                              placeholder="₹"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-semibold">
                            {inr(item.amount)}
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={item.notes}
                              onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                              placeholder="Notes"
                              className="h-8"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              onClick={() => removeItem(item.id)}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            {items.length > 0 && (
              <div className="border-t bg-muted/30 p-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Subtotal</div>
                    <div className="font-mono font-semibold">{inr(totals.subtotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">CGST (2.5%)</div>
                    <div className="font-mono">{inr(totals.cgst)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">SGST (2.5%)</div>
                    <div className="font-mono">{inr(totals.sgst)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-mono font-bold text-lg">{inr(totals.total)}</div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Save button */}
          <Button onClick={handleSave} disabled={items.length === 0 || !sSudhaChallanNo.trim()} className="w-full gap-2" size="lg">
            <CheckCircle2 className="size-5" />
            Save Sudha Challan
          </Button>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Challan No</th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Items</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historicalChallans.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        No challans recorded yet.
                      </td>
                    </tr>
                  ) : (
                    historicalChallans.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono font-semibold">{c.challan_no}</td>
                        <td className="px-4 py-3">{shortDate(c.challan_date)}</td>
                        <td className="px-4 py-3">{c.items?.[0]?.count ?? 0} items</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{inr(c.total)}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline">{c.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <Card className="p-8 text-center">
            <RefreshCw className="size-10 mx-auto mb-3 text-muted-foreground" />
            <div className="text-lg font-semibold mb-1">Daily Reconciliation</div>
            <div className="text-sm text-muted-foreground">
              View received vs distributed vs leftover for each product.
            </div>
            <div className="text-xs text-muted-foreground mt-4">
              Coming soon: This will show a simple table for each day:
              <br />
              Received from Sudha → Distributed to retailers → Leftover → Damaged
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
