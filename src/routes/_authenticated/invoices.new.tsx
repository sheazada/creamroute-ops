import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { inr, genDocNo, isoDate } from "@/lib/format";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ customerId: z.string().optional() });

export const Route = createFileRoute("/_authenticated/invoices/new")({
  validateSearch: searchSchema,
  component: NewInvoice,
});

type Line = {
  product_id: string;
  product_name: string;
  hsn: string;
  quantity: number;
  rate: number;
  discount: number;
  gst_rate: number;
};

function NewInvoice() {
  const nav = useNavigate();
  const { customerId: initialCust } = Route.useSearch();
  const [customerId, setCustomerId] = useState(initialCust ?? "");
  const [invoiceDate, setInvoiceDate] = useState(isoDate());
  const [interstate, setInterstate] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [] });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: async () => (await supabase.from("products").select("*").eq("status", "active").order("name")).data ?? [] });

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, tax = 0;
    for (const l of lines) {
      const gross = l.quantity * l.rate;
      const disc = l.discount;
      const taxable = gross - disc;
      const t = (taxable * l.gst_rate) / 100;
      subtotal += taxable;
      discount += disc;
      tax += t;
    }
    const cgst = interstate ? 0 : tax / 2;
    const sgst = interstate ? 0 : tax / 2;
    const igst = interstate ? tax : 0;
    return { subtotal, discount, tax, cgst, sgst, igst, total: subtotal + tax };
  }, [lines, interstate]);

  const addLine = () => setLines([...lines, { product_id: "", product_name: "", hsn: "", quantity: 1, rate: 0, discount: 0, gst_rate: 5 }]);
  const setLine = (i: number, l: Line) => setLines(lines.map((x, idx) => (idx === i ? l : x)));
  const rmLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!customerId) return toast.error("Select customer");
    if (lines.length === 0) return toast.error("Add at least one item");
    if (lines.some((l) => !l.product_id)) return toast.error("Select product for every line");
    setSaving(true);
    const invoice_no = genDocNo("INV");
    const { data: inv, error } = await supabase.from("invoices").insert({
      invoice_no, customer_id: customerId, invoice_date: invoiceDate,
      subtotal: totals.subtotal, discount: totals.discount,
      cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst,
      total: totals.total, balance: totals.total, notes: notes || null,
    }).select().single();

    if (!error && inv) {
      const itemRows = lines.map((l) => {
        const taxable = l.quantity * l.rate - l.discount;
        const tax = (taxable * l.gst_rate) / 100;
        return {
          invoice_id: inv.id, product_id: l.product_id, product_name: l.product_name, hsn: l.hsn || null,
          quantity: l.quantity, rate: l.rate, discount: l.discount, gst_rate: l.gst_rate,
          taxable, tax_amount: tax, amount: taxable + tax,
        };
      });
      await supabase.from("invoice_items").insert(itemRows);

      // stock deduction + movements
      for (const l of lines) {
        const p = (products ?? []).find((x) => x.id === l.product_id);
        if (p) {
          await supabase.from("products").update({ current_stock: Number(p.current_stock) - l.quantity }).eq("id", l.product_id);
          await supabase.from("inventory_movements").insert({
            product_id: l.product_id, movement_type: "out", quantity: l.quantity,
            ref_type: "invoice", ref_id: inv.id, note: `Invoice ${invoice_no}`,
          });
        }
      }

      // customer outstanding
      const cust = (customers ?? []).find((c) => c.id === customerId);
      if (cust) {
        await supabase.from("customers").update({ outstanding: Number(cust.outstanding) + totals.total }).eq("id", customerId);
      }

      // auto-create pending delivery
      await supabase.from("deliveries").insert({ invoice_id: inv.id, status: "pending" });
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice created");
    nav({ to: "/invoices/$id", params: { id: inv!.id } });
  };

  return (
    <PageContainer>
      <PageHeader title="Generate Invoice" description="Create a GST invoice. Stock and customer balance update automatically." />
      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
              <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.shop_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Invoice date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
          <div className="space-y-1.5 flex flex-col justify-end">
            <div className="flex items-center gap-3 h-9">
              <Switch checked={interstate} onCheckedChange={setInterstate} id="ist" />
              <Label htmlFor="ist" className="cursor-pointer">Interstate (IGST)</Label>
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Line items</Label>
            <Button variant="outline" size="sm" onClick={addLine} className="gap-1"><Plus className="size-3" /> Add item</Button>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-2 font-semibold">Product</th>
                  <th className="text-left px-3 py-2 font-semibold w-20">HSN</th>
                  <th className="text-right px-3 py-2 font-semibold w-20">Qty</th>
                  <th className="text-right px-3 py-2 font-semibold w-24">Rate</th>
                  <th className="text-right px-3 py-2 font-semibold w-24">Discount</th>
                  <th className="text-right px-3 py-2 font-semibold w-16">GST%</th>
                  <th className="text-right px-3 py-2 font-semibold w-28">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No items yet.</td></tr>
                )}
                {lines.map((l, i) => {
                  const taxable = l.quantity * l.rate - l.discount;
                  const amount = taxable + (taxable * l.gst_rate) / 100;
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <Select value={l.product_id} onValueChange={(v) => {
                          const p = (products ?? []).find((x) => x.id === v);
                          if (p) setLine(i, { ...l, product_id: v, product_name: p.name, hsn: p.hsn ?? "", rate: Number(p.selling_price), gst_rate: Number(p.gst_rate) });
                        }}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>{(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (stock: {Number(p.current_stock)})</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2"><Input className="h-8 text-xs" value={l.hsn} onChange={(e) => setLine(i, { ...l, hsn: e.target.value })} /></td>
                      <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={l.quantity} onChange={(e) => setLine(i, { ...l, quantity: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={l.rate} onChange={(e) => setLine(i, { ...l, rate: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={l.discount} onChange={(e) => setLine(i, { ...l, discount: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={l.gst_rate} onChange={(e) => setLine(i, { ...l, gst_rate: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-sm">{inr(amount)}</td>
                      <td className="px-3 py-2"><Button variant="ghost" size="icon" onClick={() => rmLine(i)}><Trash2 className="size-3.5" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label>Notes / Terms</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terms & conditions, delivery notes, etc." />
          </div>
          <div className="border rounded-xl p-5 bg-muted/30 space-y-2 text-sm">
            <Row label="Subtotal" value={inr(totals.subtotal)} />
            {totals.discount > 0 && <Row label="Discount" value={`− ${inr(totals.discount)}`} />}
            {!interstate ? (
              <>
                <Row label="CGST" value={inr(totals.cgst)} muted />
                <Row label="SGST" value={inr(totals.sgst)} muted />
              </>
            ) : (
              <Row label="IGST" value={inr(totals.igst)} muted />
            )}
            <div className="border-t pt-2 mt-2 flex justify-between items-center">
              <span className="font-semibold">Grand Total</span>
              <span className="text-2xl font-semibold font-mono">{inr(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => nav({ to: "/invoices" })}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save invoice"}</Button>
        </div>
      </Card>
    </PageContainer>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
