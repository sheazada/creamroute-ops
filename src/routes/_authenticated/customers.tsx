import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { inr, inrCompact } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, MessageCircle, Mail, Phone, ReceiptText, Users, Wallet, AlertTriangle, Pencil, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getBusiness } from "@/lib/business";

export const Route = createFileRoute("/_authenticated/customers")({
  component: Customers,
});

function Customers() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "dues" | "clear">("all");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (customers ?? []).filter((c) => {
      const match = !q ||
        c.name.toLowerCase().includes(s) ||
        (c.shop_name ?? "").toLowerCase().includes(s) ||
        (c.mobile ?? "").includes(s) ||
        (c.gstin ?? "").toLowerCase().includes(s);
      if (!match) return false;
      if (filter === "dues") return Number(c.outstanding) > 0;
      if (filter === "clear") return Number(c.outstanding) <= 0;
      return true;
    });
  }, [customers, q, filter]);

  const totals = useMemo(() => {
    const list = customers ?? [];
    const outstanding = list.reduce((s, c) => s + Number(c.outstanding), 0);
    const overLimit = list.filter((c) => Number(c.credit_limit) > 0 && Number(c.outstanding) > Number(c.credit_limit)).length;
    const withDues = list.filter((c) => Number(c.outstanding) > 0).length;
    return { outstanding, overLimit, withDues, total: list.length };
  }, [customers]);

  return (
    <PageContainer>
      <PageHeader
        title="Customers & Ledger"
        description="Retail shops, credit limits, outstanding dues and reminders."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Customer</Button>
            </DialogTrigger>
            <CustomerDialog onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["customers"] }); }} />
          </Dialog>
        }
      />

      {/* Top ledger bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <LedgerStat label="Total Retailers" value={String(totals.total)} icon={Users} />
        <LedgerStat label="Total Outstanding" value={inrCompact(totals.outstanding)} icon={Wallet} tone="destructive" />
        <LedgerStat label="Shops With Dues" value={String(totals.withDues)} icon={ReceiptText} />
        <LedgerStat label="Over Credit Limit" value={String(totals.overLimit)} icon={AlertTriangle} tone={totals.overLimit ? "destructive" : undefined} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-56 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, shop, mobile, GSTIN" className="pl-9" />
          </div>
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(["all", "dues", "clear"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 font-medium ${filter === f ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              >
                {f === "all" ? "All" : f === "dues" ? "With Dues" : "Cleared"}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No customers.</div>}
          {filtered.map((c) => (
            <div key={c.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.shop_name}</div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-semibold ${Number(c.outstanding) > 0 ? "text-destructive" : ""}`}>{inr(c.outstanding)}</div>
                  <div className="text-[10px] text-muted-foreground">Limit {inr(c.credit_limit)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={c.status} />
                <ReminderActions customer={c} />
                <Link to="/invoices/new" search={{ customerId: c.id }} className="text-xs text-primary ml-auto hover:underline">Invoice →</Link>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-6 py-3 font-semibold">Customer</th>
                <th className="text-left px-6 py-3 font-semibold">Mobile</th>
                <th className="text-left px-6 py-3 font-semibold">GSTIN</th>
                <th className="text-right px-6 py-3 font-semibold">Credit Limit</th>
                <th className="text-right px-6 py-3 font-semibold">Outstanding</th>
                <th className="text-left px-6 py-3 font-semibold">Remind</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No customers.</td></tr>
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
                  <td className="px-6 py-3"><ReminderActions customer={c} /></td>
                  <td className="px-6 py-3 text-right">
                    <Link to="/invoices/new" search={{ customerId: c.id }} className="text-xs text-primary hover:underline">Invoice</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}

function LedgerStat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "destructive" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className={`text-2xl font-semibold font-mono tracking-tight ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
    </Card>
  );
}

function ReminderActions({ customer }: { customer: any }) {
  const due = Number(customer.outstanding);
  const disabled = due <= 0;
  const biz = getBusiness();
  const msg = `Hello ${customer.name}, this is a friendly reminder from ${biz.name || "us"}. Your current outstanding balance is ₹${due.toLocaleString("en-IN")}. Kindly clear it at your earliest. Thank you.`;
  const wa = customer.mobile ? `https://wa.me/91${String(customer.mobile).replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(msg)}` : "";
  const sms = customer.mobile ? `sms:${customer.mobile}?body=${encodeURIComponent(msg)}` : "";
  const mail = customer.email ? `mailto:${customer.email}?subject=${encodeURIComponent("Payment reminder")}&body=${encodeURIComponent(msg)}` : "";
  const tel = customer.mobile ? `tel:${customer.mobile}` : "";

  const btn = (href: string, Icon: any, label: string, enabled: boolean) => (
    <Button
      asChild={enabled}
      size="icon"
      variant="ghost"
      className="size-8"
      disabled={!enabled || disabled}
      title={disabled ? "No dues" : label}
      onClick={disabled ? undefined : () => { if (enabled) toast.success(`${label} opened`); }}
    >
      {enabled ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"><Icon className="size-4" /></a> : <span><Icon className="size-4" /></span>}
    </Button>
  );

  return (
    <div className="flex items-center gap-0.5">
      {btn(wa, MessageCircle, "WhatsApp reminder", !!wa)}
      {btn(sms, ReceiptText, "SMS reminder", !!sms)}
      {btn(mail, Mail, "Email reminder", !!mail)}
      {btn(tel, Phone, "Call", !!tel)}
    </div>
  );
}

function CustomerDialog({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({ name: "", shop_name: "", mobile: "", email: "", gstin: "", address: "", credit_limit: "0", notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name: f.name,
      shop_name: f.shop_name || null,
      mobile: f.mobile || null,
      email: f.email || null,
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
          <Label>Email</Label>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
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
