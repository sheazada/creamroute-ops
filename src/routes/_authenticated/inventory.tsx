import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { dateTime, num } from "@/lib/format";
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: Inventory,
});

function Inventory() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });
  const { data: movements } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => (await supabase.from("inventory_movements").select("*, product:products(name, unit)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: batches } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await supabase.from("product_batches").select("*, product:products(name)").order("expiry_date")).data ?? [],
  });

  const lowStock = (products ?? []).filter((p) => Number(p.current_stock) <= Number(p.min_stock));
  const expiringSoon = (batches ?? []).filter((b) => {
    if (!b.expiry_date || Number(b.quantity) <= 0) return false;
    return new Date(b.expiry_date).getTime() - Date.now() <= 7 * 24 * 3600 * 1000;
  });

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        description="Track stock movements, low stock, damaged and expired items."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Stock Adjustment</Button></DialogTrigger>
            <AdjustDialog products={products ?? []} onSaved={() => { setOpen(false); qc.invalidateQueries(); }} />
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <AlertCard title="Low Stock" count={lowStock.length} tone="warning">
          {lowStock.slice(0, 4).map((p) => (
            <div key={p.id} className="flex items-center justify-between py-1 text-xs">
              <span>{p.name}</span>
              <span className="font-mono text-destructive">{Number(p.current_stock)} {p.unit}</span>
            </div>
          ))}
        </AlertCard>
        <AlertCard title="Expiring in 7 days" count={expiringSoon.length} tone="destructive">
          {expiringSoon.slice(0, 4).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between py-1 text-xs">
              <span>{b.product?.name}</span>
              <span className="text-muted-foreground">{b.expiry_date}</span>
            </div>
          ))}
        </AlertCard>
        <AlertCard title="Active SKUs" count={(products ?? []).filter((p) => p.status === "active").length} tone="primary" />
      </div>

      <Tabs defaultValue="movements">
        <TabsList>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="batches">Batches & Expiry</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-6 py-3 font-semibold">Time</th>
                  <th className="text-left px-6 py-3 font-semibold">Product</th>
                  <th className="text-left px-6 py-3 font-semibold">Type</th>
                  <th className="text-right px-6 py-3 font-semibold">Qty</th>
                  <th className="text-left px-6 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(movements ?? []).length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No movements yet.</td></tr>
                )}
                {(movements ?? []).map((m: any) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3 text-xs text-muted-foreground">{dateTime(m.created_at)}</td>
                    <td className="px-6 py-3">{m.product?.name}</td>
                    <td className="px-6 py-3 text-xs uppercase tracking-wider font-semibold">{m.movement_type}</td>
                    <td className={`px-6 py-3 text-right font-mono ${["in"].includes(m.movement_type) ? "text-success" : "text-destructive"}`}>
                      {["in"].includes(m.movement_type) ? "+" : "-"}{Math.abs(Number(m.quantity))}
                    </td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">{m.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-6 py-3 font-semibold">Product</th>
                  <th className="text-left px-6 py-3 font-semibold">Unit</th>
                  <th className="text-right px-6 py-3 font-semibold">Current</th>
                  <th className="text-right px-6 py-3 font-semibold">Minimum</th>
                  <th className="text-right px-6 py-3 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(products ?? []).map((p) => {
                  const low = Number(p.current_stock) <= Number(p.min_stock);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium">{p.name}</td>
                      <td className="px-6 py-3 text-muted-foreground">{p.unit}</td>
                      <td className={`px-6 py-3 text-right font-mono ${low ? "text-destructive font-semibold" : ""}`}>
                        {low && <AlertTriangle className="size-3 inline mr-1" />}
                        {num(p.current_stock, 2)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-muted-foreground">{num(p.min_stock, 2)}</td>
                      <td className="px-6 py-3 text-right font-mono">₹{num(Number(p.current_stock) * Number(p.purchase_price), 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="batches">
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-6 py-3 font-semibold">Product</th>
                  <th className="text-left px-6 py-3 font-semibold">Batch</th>
                  <th className="text-left px-6 py-3 font-semibold">Mfg</th>
                  <th className="text-left px-6 py-3 font-semibold">Expiry</th>
                  <th className="text-right px-6 py-3 font-semibold">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(batches ?? []).length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No batches recorded.</td></tr>
                )}
                {(batches ?? []).map((b: any) => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3">{b.product?.name}</td>
                    <td className="px-6 py-3 font-mono text-xs">{b.batch_no}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">{b.mfg_date ?? "—"}</td>
                    <td className="px-6 py-3 text-xs">{b.expiry_date ?? "—"}</td>
                    <td className="px-6 py-3 text-right font-mono">{num(b.quantity, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function AlertCard({ title, count, tone, children }: { title: string; count: number; tone: "warning" | "destructive" | "primary"; children?: React.ReactNode }) {
  const toneCls = {
    warning: "border-warning/30 bg-warning/5",
    destructive: "border-destructive/30 bg-destructive/5",
    primary: "border-primary/20 bg-primary-soft",
  }[tone];
  return (
    <Card className={`p-4 ${toneCls}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wider">{title}</div>
        <div className="text-lg font-semibold font-mono">{count}</div>
      </div>
      {children}
    </Card>
  );
}

function AdjustDialog({ products, onSaved }: { products: any[]; onSaved: () => void }) {
  const [f, setF] = useState({ product_id: "", movement_type: "in", quantity: "", note: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.product_id || !f.quantity) return toast.error("Product and quantity required");
    setSaving(true);
    const q = Number(f.quantity);
    const signed = ["in"].includes(f.movement_type) ? q : -q;
    const { error } = await supabase.from("inventory_movements").insert({
      product_id: f.product_id, movement_type: f.movement_type, quantity: Math.abs(q), note: f.note || null,
    });
    if (!error) {
      const prod = products.find((p) => p.id === f.product_id);
      if (prod) {
        await supabase.from("products").update({ current_stock: Number(prod.current_stock) + signed }).eq("id", f.product_id);
      }
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Stock updated");
    onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Stock Adjustment</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Product</Label>
          <Select value={f.product_id} onValueChange={(v) => setF({ ...f, product_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={f.movement_type} onValueChange={(v) => setF({ ...f, movement_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Stock In</SelectItem>
              <SelectItem value="out">Stock Out</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="adjust">Adjustment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Note</Label><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Update stock"}</Button></DialogFooter>
    </DialogContent>
  );
}
