import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { inr } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  component: Products,
});

function Products() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.brand ?? "").toLowerCase().includes(s) || (p.barcode ?? "").includes(s);
  });

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        description="Your SKU catalog — prices, GST rates and live stock levels."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Product</Button></DialogTrigger>
            <ProductDialog onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); }} />
          </Dialog>
        }
      />
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, brands, barcode" className="pl-9" />
          </div>
          <div className="text-xs text-muted-foreground">{filtered.length} product{filtered.length === 1 ? "" : "s"}</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Product</th>
              <th className="text-left px-6 py-3 font-semibold">Brand</th>
              <th className="text-left px-6 py-3 font-semibold">HSN</th>
              <th className="text-right px-6 py-3 font-semibold">MRP</th>
              <th className="text-right px-6 py-3 font-semibold">Selling</th>
              <th className="text-right px-6 py-3 font-semibold">GST %</th>
              <th className="text-right px-6 py-3 font-semibold">Stock</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No products. Add one to get started.</td></tr>
            )}
            {filtered.map((p) => {
              const low = Number(p.current_stock) <= Number(p.min_stock);
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-6 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.category} · {p.unit}</div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{p.brand ?? "—"}</td>
                  <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.hsn ?? "—"}</td>
                  <td className="px-6 py-3 text-right font-mono">{inr(p.mrp)}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold">{inr(p.selling_price)}</td>
                  <td className="px-6 py-3 text-right font-mono">{Number(p.gst_rate)}%</td>
                  <td className="px-6 py-3 text-right font-mono">
                    <span className={low ? "text-destructive font-semibold" : ""}>
                      {low && <AlertTriangle className="size-3 inline mr-1" />}
                      {Number(p.current_stock)}
                    </span>
                    <span className="text-xs text-muted-foreground"> / {Number(p.min_stock)}</span>
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}

function ProductDialog({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({
    name: "", brand: "", category: "Dairy", unit: "pcs", hsn: "0401", barcode: "",
    mrp: "0", selling_price: "0", purchase_price: "0", gst_rate: "5",
    current_stock: "0", min_stock: "0",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    const { data: prod, error } = await supabase.from("products").insert({
      name: f.name, brand: f.brand || null, category: f.category, unit: f.unit,
      hsn: f.hsn || null, barcode: f.barcode || null,
      mrp: Number(f.mrp), selling_price: Number(f.selling_price), purchase_price: Number(f.purchase_price),
      gst_rate: Number(f.gst_rate), current_stock: Number(f.current_stock), min_stock: Number(f.min_stock),
    }).select().single();
    if (!error && prod && Number(f.current_stock) > 0) {
      await supabase.from("inventory_movements").insert({
        product_id: prod.id, movement_type: "in", quantity: Number(f.current_stock), note: "Opening stock",
      });
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product added");
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Brand</Label><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Amul, Mother Dairy…" /></div>
        <div className="space-y-1.5"><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Unit</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="L, kg, pcs" /></div>
        <div className="space-y-1.5"><Label>HSN</Label><Input value={f.hsn} onChange={(e) => setF({ ...f, hsn: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Barcode</Label><Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>GST %</Label><Input type="number" value={f.gst_rate} onChange={(e) => setF({ ...f, gst_rate: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>MRP (₹)</Label><Input type="number" value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Selling (₹)</Label><Input type="number" value={f.selling_price} onChange={(e) => setF({ ...f, selling_price: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Purchase (₹)</Label><Input type="number" value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Opening stock</Label><Input type="number" value={f.current_stock} onChange={(e) => setF({ ...f, current_stock: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Min stock</Label><Input type="number" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save product"}</Button></DialogFooter>
    </DialogContent>
  );
}
