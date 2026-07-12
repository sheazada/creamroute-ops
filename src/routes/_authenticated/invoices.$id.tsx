import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate } from "@/lib/format";
import { ArrowLeft, Printer, Milk, Pencil, Ban, Save, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceView,
});

type EditableItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  hsn: string | null;
  quantity: number;
  rate: number;
  discount: number;
  gst_rate: number;
  _deleted?: boolean;
};

function InvoiceView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableItem[]>([]);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const [inv, items, pays] = await Promise.all([
        supabase.from("invoices").select("*, customer:customers(*)").eq("id", id).single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at"),
        supabase.from("payments").select("*").eq("invoice_id", id),
      ]);
      return { invoice: inv.data, items: items.data ?? [], payments: pays.data ?? [] };
    },
  });

  useEffect(() => {
    if (data?.items && !editing) {
      setDraft(
        data.items.map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          hsn: it.hsn,
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          discount: Number(it.discount),
          gst_rate: Number(it.gst_rate),
        })),
      );
    }
  }, [data?.items, editing]);

  if (!data?.invoice)
    return (
      <PageContainer>
        <div className="text-muted-foreground">Loading…</div>
      </PageContainer>
    );
  const inv = data.invoice;
  const c = inv.customer;
  const isInter = Number(inv.igst) > 0;
  const isVoid = inv.status === "void";

  const saveEdits = async () => {
    setSaving(true);
    try {
      for (const row of draft) {
        if (row._deleted) {
          await supabase.from("invoice_items").delete().eq("id", row.id);
          continue;
        }
        const taxable = row.quantity * row.rate - row.discount;
        const tax_amount = (taxable * row.gst_rate) / 100;
        await supabase
          .from("invoice_items")
          .update({
            quantity: row.quantity,
            rate: row.rate,
            discount: row.discount,
            taxable,
            tax_amount,
            amount: taxable + tax_amount,
          })
          .eq("id", row.id);

        // Adjust stock delta if quantity changed
        const original = (data.items ?? []).find((it: any) => it.id === row.id);
        if (original && row.product_id) {
          const delta = row.quantity - Number(original.quantity);
          if (delta !== 0) {
            const { data: p } = await supabase
              .from("products")
              .select("current_stock")
              .eq("id", row.product_id)
              .single();
            if (p) {
              await supabase
                .from("products")
                .update({ current_stock: Number(p.current_stock) - delta })
                .eq("id", row.product_id);
              await supabase.from("inventory_movements").insert({
                product_id: row.product_id,
                movement_type: delta > 0 ? "out" : "in",
                quantity: Math.abs(delta),
                ref_type: "invoice_edit",
                ref_id: inv.id,
                note: `Invoice ${inv.invoice_no} edited`,
              });
            }
          }
        }
      }
      toast.success("Invoice updated — balances recalculated");
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const voidInvoice = async () => {
    try {
      // Restock every line item
      for (const it of data.items) {
        if (!it.product_id) continue;
        const { data: p } = await supabase
          .from("products")
          .select("current_stock")
          .eq("id", it.product_id)
          .single();
        if (p) {
          await supabase
            .from("products")
            .update({ current_stock: Number(p.current_stock) + Number(it.quantity) })
            .eq("id", it.product_id);
          await supabase.from("inventory_movements").insert({
            product_id: it.product_id,
            movement_type: "in",
            quantity: Number(it.quantity),
            ref_type: "invoice_void",
            ref_id: inv.id,
            note: `Invoice ${inv.invoice_no} voided`,
          });
        }
      }
      const { error } = await supabase
        .from("invoices")
        .update({ status: "void" })
        .eq("id", inv.id);
      if (error) throw error;
      toast.success("Invoice voided — customer outstanding updated");
      await qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to void invoice");
    }
  };

  // Live totals during edit
  const liveTotals = (() => {
    let subtotal = 0,
      tax = 0;
    for (const l of draft) {
      if (l._deleted) continue;
      const taxable = l.quantity * l.rate - l.discount;
      subtotal += taxable;
      tax += (taxable * l.gst_rate) / 100;
    }
    return { subtotal, tax, total: subtotal + tax };
  })();

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6 no-print">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/invoices">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge status={inv.status} />
          {!editing && !isVoid && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="size-4" /> Edit items
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive">
                    <Ban className="size-4" /> Void
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Void invoice {inv.invoice_no}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Stock will be restored and the customer's outstanding balance will be reduced
                      by {inr(inv.balance)}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={voidInvoice}>Void invoice</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {editing && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="size-4" /> Cancel
              </Button>
              <Button size="sm" onClick={saveEdits} disabled={saving} className="gap-1.5">
                <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
              </Button>
            </>
          )}
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
              <Printer className="size-4" /> Print / PDF
            </Button>
          )}
        </div>
      </div>

      {/* Live customer balance banner */}
      {c && (
        <div className="max-w-4xl mx-auto mb-4 no-print flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <div>
            <span className="text-muted-foreground">Customer: </span>
            <span className="font-semibold">{c.name}</span>
            {c.shop_name && <span className="text-muted-foreground"> · {c.shop_name}</span>}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">This invoice balance: </span>
              <span
                className={`font-mono font-semibold ${Number(inv.balance) > 0 ? "text-destructive" : "text-success"}`}
              >
                {inr(inv.balance)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Total outstanding: </span>
              <span
                className={`font-mono font-semibold ${Number(c.outstanding) > 0 ? "text-destructive" : "text-success"}`}
              >
                {inr(c.outstanding)}
              </span>
            </div>
          </div>
        </div>
      )}

      <Card className="p-6 sm:p-10 max-w-4xl mx-auto shadow-md print:shadow-none print:border-0">
        <div className="flex justify-between items-start pb-6 border-b gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-primary grid place-items-center text-primary-foreground">
              <Milk className="size-6" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight">DairyFlow Distributors</div>
              <div className="text-xs text-muted-foreground">
                Wholesale Dairy Distribution · GSTIN: 07AAAAA0000A1Z5
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-semibold tracking-tight">TAX INVOICE</div>
            <div className="text-xs text-muted-foreground mt-1">
              {isVoid ? "VOIDED" : "Original for recipient"}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 sm:gap-8 py-6 border-b">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Billed to
            </div>
            <div className="font-semibold">{c?.name}</div>
            {c?.shop_name && <div className="text-sm text-muted-foreground">{c.shop_name}</div>}
            {c?.address && (
              <div className="text-sm text-muted-foreground whitespace-pre-line">{c.address}</div>
            )}
            {c?.mobile && (
              <div className="text-sm mt-1">
                Mobile: <span className="font-mono">{c.mobile}</span>
              </div>
            )}
            {c?.gstin && (
              <div className="text-sm">
                GSTIN: <span className="font-mono">{c.gstin}</span>
              </div>
            )}
          </div>
          <div className="sm:text-right space-y-1">
            <Field label="Invoice #" value={inv.invoice_no} mono />
            <Field label="Date" value={shortDate(inv.invoice_date)} />
            {inv.due_date && <Field label="Due" value={shortDate(inv.due_date)} />}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm my-6 min-w-[640px]">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2 font-semibold">#</th>
                <th className="text-left py-2 font-semibold">Item</th>
                <th className="text-left py-2 font-semibold">HSN</th>
                <th className="text-right py-2 font-semibold">Qty</th>
                <th className="text-right py-2 font-semibold">Rate</th>
                <th className="text-right py-2 font-semibold">Disc</th>
                <th className="text-right py-2 font-semibold">GST</th>
                <th className="text-right py-2 font-semibold">Amount</th>
                {editing && <th className="w-8 no-print" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(editing ? draft : data.items).map((it: any, i: number) => {
                if (editing && it._deleted) return null;
                const q = editing ? it.quantity : Number(it.quantity);
                const rate = editing ? it.rate : Number(it.rate);
                const disc = editing ? it.discount : Number(it.discount);
                const gstRate = editing ? it.gst_rate : Number(it.gst_rate);
                const taxable = q * rate - disc;
                const taxAmt = (taxable * gstRate) / 100;
                const amount = taxable + taxAmt;
                return (
                  <tr key={editing ? it.id : it.id}>
                    <td className="py-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 font-medium">{it.product_name}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">
                      {it.hsn ?? "—"}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {editing ? (
                        <Input
                          type="number"
                          value={q}
                          onChange={(e) =>
                            setDraft(
                              draft.map((r) =>
                                r.id === it.id ? { ...r, quantity: Number(e.target.value) } : r,
                              ),
                            )
                          }
                          className="h-8 w-20 text-right ml-auto"
                        />
                      ) : (
                        q
                      )}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {editing ? (
                        <Input
                          type="number"
                          value={rate}
                          onChange={(e) =>
                            setDraft(
                              draft.map((r) =>
                                r.id === it.id ? { ...r, rate: Number(e.target.value) } : r,
                              ),
                            )
                          }
                          className="h-8 w-24 text-right ml-auto"
                        />
                      ) : (
                        inr(rate)
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">
                      {editing ? (
                        <Input
                          type="number"
                          value={disc}
                          onChange={(e) =>
                            setDraft(
                              draft.map((r) =>
                                r.id === it.id ? { ...r, discount: Number(e.target.value) } : r,
                              ),
                            )
                          }
                          className="h-8 w-20 text-right ml-auto"
                        />
                      ) : (
                        inr(disc)
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">
                      {gstRate}% ({inr(taxAmt)})
                    </td>
                    <td className="py-2 text-right font-mono font-semibold">{inr(amount)}</td>
                    {editing && (
                      <td className="py-2 text-right no-print">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() =>
                            setDraft(
                              draft.map((r) => (r.id === it.id ? { ...r, _deleted: true } : r)),
                            )
                          }
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 sm:gap-8 pt-6 border-t">
          <div>
            {inv.notes && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Notes
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-line">{inv.notes}</div>
              </>
            )}
            <div className="mt-6 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Terms
            </div>
            <div className="text-xs text-muted-foreground">
              Payment due on delivery. Interest @ 18% p.a. on overdue amounts. Goods once sold will
              not be taken back.
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            {editing ? (
              <>
                <Row label="Subtotal (live)" value={inr(liveTotals.subtotal)} />
                <Row label="Tax (live)" value={inr(liveTotals.tax)} muted />
                <div className="border-t pt-2 mt-2 flex justify-between items-center">
                  <span className="font-semibold">New total (on save)</span>
                  <span className="text-xl font-semibold font-mono">{inr(liveTotals.total)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground pt-1">
                  Customer outstanding recalculates automatically when you save.
                </div>
              </>
            ) : (
              <>
                <Row label="Subtotal" value={inr(inv.subtotal)} />
                {Number(inv.discount) > 0 && (
                  <Row label="Discount" value={`− ${inr(inv.discount)}`} />
                )}
                {!isInter ? (
                  <>
                    <Row label="CGST" value={inr(inv.cgst)} muted />
                    <Row label="SGST" value={inr(inv.sgst)} muted />
                  </>
                ) : (
                  <Row label="IGST" value={inr(inv.igst)} muted />
                )}
                <div className="border-t pt-2 mt-2 flex justify-between items-center">
                  <span className="font-semibold">Grand Total</span>
                  <span className="text-xl font-semibold font-mono">{inr(inv.total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Paid</span>
                  <span className="font-mono">{inr(inv.paid)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Balance due</span>
                  <span
                    className={`font-mono ${Number(inv.balance) > 0 ? "text-destructive" : "text-success"}`}
                  >
                    {inr(inv.balance)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-12 flex justify-between items-end text-xs text-muted-foreground">
          <div>Thank you for your business.</div>
          <div className="text-right">
            <div className="h-10" />
            <div className="border-t pt-1">Authorized signatory</div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
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
