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
import { StatusBadge } from "@/components/status-badge";
import { inr } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: Suppliers,
});

function Suppliers() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });

  return (
    <PageContainer>
      <PageHeader
        title="Suppliers"
        description="Dairy companies you buy from — Amul, Mother Dairy, Britannia, Nestle…"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Supplier</Button></DialogTrigger>
            <SupplierDialog onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["suppliers"] }); }} />
          </Dialog>
        }
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Supplier</th>
              <th className="text-left px-6 py-3 font-semibold">Company</th>
              <th className="text-left px-6 py-3 font-semibold">Mobile</th>
              <th className="text-left px-6 py-3 font-semibold">GSTIN</th>
              <th className="text-right px-6 py-3 font-semibold">Payable</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No suppliers.</td></tr>}
            {(data ?? []).map((s) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-medium">{s.name}</td>
                <td className="px-6 py-3 text-muted-foreground">{s.company ?? "—"}</td>
                <td className="px-6 py-3 font-mono">{s.mobile ?? "—"}</td>
                <td className="px-6 py-3 font-mono text-xs">{s.gstin ?? "—"}</td>
                <td className={`px-6 py-3 text-right font-mono ${Number(s.outstanding) > 0 ? "text-destructive font-semibold" : ""}`}>{inr(s.outstanding)}</td>
                <td className="px-6 py-3"><StatusBadge status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}

function SupplierDialog({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({ name: "", company: "", mobile: "", gstin: "", address: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    const { error } = await supabase.from("suppliers").insert({
      name: f.name, company: f.company || null, mobile: f.mobile || null,
      gstin: f.gstin || null, address: f.address || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Supplier added");
    onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5"><Label>Contact name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Company</Label><Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Mobile</Label><Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>GSTIN</Label><Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} /></div>
        <div className="col-span-2 space-y-1.5"><Label>Address</Label><Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
    </DialogContent>
  );
}
