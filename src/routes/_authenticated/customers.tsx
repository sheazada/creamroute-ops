import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: Customers,
});

function Customers() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").order("name");
      return data ?? [];
    },
  });

  const filtered = (customers ?? []).filter((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.shop_name ?? "").toLowerCase().includes(s) ||
      (c.mobile ?? "").includes(s) ||
      (c.gstin ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description="Retail shops you supply. Track credit limits, outstanding, and ledger."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Customer</Button>
            </DialogTrigger>
            <CustomerDialog onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["customers"] }); }} />
          </Dialog>
        }
      />

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, shop, mobile, GSTIN" className="pl-9" />
          </div>
          <div className="text-xs text-muted-foreground">{filtered.length} customer{filtered.length === 1 ? "" : "s"}</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-3 font-semibold">Customer</th>
              <th className="text-left px-6 py-3 font-semibold">Mobile</th>
              <th className="text-left px-6 py-3 font-semibold">GSTIN</th>
              <th className="text-right px-6 py-3 font-semibold">Credit Limit</th>
              <th className="text-right px-6 py-3 font-semibold">Outstanding</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No customers yet.</td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-6 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.shop_name}</div>
                </td>
                <td className="px-6 py-3 text-muted-foreground font-mono">{c.mobile ?? "—"}</td>
                <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{c.gstin ?? "—"}</td>
                <td className="px-6 py-3 text-right font-mono">{inr(c.credit_limit)}</td>
                <td className={`px-6 py-3 text-right font-mono font-semibold ${Number(c.outstanding) > 0 ? "text-destructive" : ""}`}>{inr(c.outstanding)}</td>
                <td className="px-6 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-6 py-3 text-right">
                  <Link to="/invoices/new" search={{ customerId: c.id }} className="text-xs text-primary hover:underline">Invoice</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}

function CustomerDialog({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({ name: "", shop_name: "", mobile: "", gstin: "", address: "", credit_limit: "0", notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name: f.name,
      shop_name: f.shop_name || null,
      mobile: f.mobile || null,
      gstin: f.gstin || null,
      address: f.address || null,
      credit_limit: Number(f.credit_limit) || 0,
      notes: f.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Customer added");
    onSaved();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Contact name *</Label>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Shop name</Label>
          <Input value={f.shop_name} onChange={(e) => setF({ ...f, shop_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile</Label>
          <Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>GSTIN</Label>
          <Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />
        </div>
        <div className="space-y-1.5">
          <Label>Credit limit (₹)</Label>
          <Input type="number" value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address</Label>
          <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save customer"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
