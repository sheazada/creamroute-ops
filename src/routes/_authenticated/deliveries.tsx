import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate, genDocNo } from "@/lib/format";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/deliveries")({
  component: Deliveries,
});

type Delivery = {
  id: string;
  route: string | null;
  assigned_to: string | null;
  status: string;
  delivered_at: string | null;
  invoice: {
    id: string;
    invoice_no: string;
    total: number;
    balance: number;
    customer: { id: string; name: string; shop_name: string | null; address: string | null; mobile: string | null } | null;
  } | null;
};

function Deliveries() {
  const qc = useQueryClient();
  const [payFor, setPayFor] = useState<Delivery | null>(null);

  const { data } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () =>
      (await supabase
        .from("deliveries")
        .select("*, invoice:invoices(id, invoice_no, total, balance, customer:customers(id, name, shop_name, address, mobile))")
        .order("created_at", { ascending: false })).data as unknown as Delivery[] ?? [],
  });

  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("deliveries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  return (
    <PageContainer>
      <PageHeader title="Deliveries" description="Assign routes, mark delivered, and collect cash on delivery." />

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {(data ?? []).length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No deliveries yet.</Card>
        )}
        {(data ?? []).map((d) => (
          <Card key={d.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{d.invoice?.customer?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{d.invoice?.customer?.shop_name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{d.invoice?.customer?.address}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs text-muted-foreground">{d.invoice?.invoice_no}</div>
                <div className="font-mono font-semibold">{inr(d.invoice?.total ?? 0)}</div>
                {Number(d.invoice?.balance ?? 0) > 0 && (
                  <div className="text-[11px] text-destructive font-mono">Due {inr(d.invoice?.balance ?? 0)}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={d.status} />
              <Select value={d.status} onValueChange={(v) => update(d.id, { status: v, delivered_at: v === "delivered" ? new Date().toISOString() : null })}>
                <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="en_route">En Route</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                disabled={!d.invoice || Number(d.invoice.balance) <= 0}
                onClick={() => setPayFor(d)}
              >
                <Wallet className="size-4" /> Collect Cash
              </Button>
              {d.invoice?.customer?.mobile && (
                <Button asChild size="sm" variant="ghost">
                  <a href={`tel:${d.invoice.customer.mobile}`}>Call</a>
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="p-0 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-6 py-3 font-semibold">Invoice</th>
                <th className="text-left px-6 py-3 font-semibold">Customer</th>
                <th className="text-right px-6 py-3 font-semibold">Amount</th>
                <th className="text-right px-6 py-3 font-semibold">Balance</th>
                <th className="text-left px-6 py-3 font-semibold">Route</th>
                <th className="text-left px-6 py-3 font-semibold">Assigned</th>
                <th className="text-left px-6 py-3 font-semibold">Date</th>
                <th className="text-left px-6 py-3 font-semibold">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data ?? []).length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No deliveries. Deliveries auto-create when you generate an invoice.</td></tr>
              )}
              {(data ?? []).map((d) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-6 py-3 font-mono text-xs">{d.invoice?.invoice_no}</td>
                  <td className="px-6 py-3">
                    <div className="font-medium">{d.invoice?.customer?.name}</div>
                    <div className="text-xs text-muted-foreground">{d.invoice?.customer?.shop_name}</div>
                  </td>
                  <td className="px-6 py-3 text-right font-mono">{inr(d.invoice?.total ?? 0)}</td>
                  <td className={`px-6 py-3 text-right font-mono ${Number(d.invoice?.balance ?? 0) > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{inr(d.invoice?.balance ?? 0)}</td>
                  <td className="px-6 py-3">
                    <Input defaultValue={d.route ?? ""} onBlur={(e) => e.target.value !== (d.route ?? "") && update(d.id, { route: e.target.value })} className="h-8 max-w-32" placeholder="R-01" />
                  </td>
                  <td className="px-6 py-3">
                    <Input defaultValue={d.assigned_to ?? ""} onBlur={(e) => e.target.value !== (d.assigned_to ?? "") && update(d.id, { assigned_to: e.target.value })} className="h-8 max-w-40" placeholder="Driver" />
                  </td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">{d.delivered_at ? shortDate(d.delivered_at) : "—"}</td>
                  <td className="px-6 py-3">
                    <Select value={d.status} onValueChange={(v) => update(d.id, { status: v, delivered_at: v === "delivered" ? new Date().toISOString() : null })}>
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={!d.invoice || Number(d.invoice.balance) <= 0}
                      onClick={() => setPayFor(d)}
                    >
                      <Wallet className="size-3.5" /> Collect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CollectPaymentDialog
        delivery={payFor}
        onClose={() => setPayFor(null)}
        onSaved={() => {
          setPayFor(null);
          qc.invalidateQueries({ queryKey: ["deliveries"] });
          qc.invalidateQueries({ queryKey: ["payments"] });
          qc.invalidateQueries({ queryKey: ["customers"] });
        }}
      />
    </PageContainer>
  );
}

function CollectPaymentDialog({ delivery, onClose, onSaved }: { delivery: Delivery | null; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "upi" | "bank">("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [markDelivered, setMarkDelivered] = useState(true);

  const open = !!delivery;
  const bal = Number(delivery?.invoice?.balance ?? 0);

  const save = async () => {
    if (!delivery?.invoice || !delivery.invoice.customer) return;
    const amt = Number(amount || bal);
    if (!amt || amt <= 0) return toast.error("Enter amount");
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      payment_no: genDocNo("RCP"),
      customer_id: delivery.invoice.customer.id,
      invoice_id: delivery.invoice.id,
      amount: amt,
      mode,
      reference: reference || null,
      notes: `Collected on delivery${delivery.route ? ` · route ${delivery.route}` : ""}`,
    });
    if (error) { setSaving(false); return toast.error(error.message); }
    if (markDelivered && delivery.status !== "delivered") {
      await supabase.from("deliveries").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", delivery.id);
    }
    setSaving(false);
    setAmount(""); setReference(""); setMode("cash");
    toast.success("Payment recorded");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
        {delivery && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="font-medium">{delivery.invoice?.customer?.name}</div>
              <div className="text-xs text-muted-foreground">{delivery.invoice?.customer?.shop_name} · {delivery.invoice?.invoice_no}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Balance due</span>
                <span className="font-mono font-semibold text-destructive">{inr(bal)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount received</Label>
                <Input type="number" placeholder={String(bal)} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {mode !== "cash" && (
              <div className="space-y-1.5">
                <Label>Reference / txn id</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={markDelivered} onChange={(e) => setMarkDelivered(e.target.checked)} />
              Also mark delivery as Delivered
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
