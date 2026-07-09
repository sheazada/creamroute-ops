import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { inr, shortDate } from "@/lib/format";
import { ArrowLeft, Printer, Milk } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceView,
});

function InvoiceView() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const [inv, items, pays] = await Promise.all([
        supabase.from("invoices").select("*, customer:customers(*)").eq("id", id).single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", id),
        supabase.from("payments").select("*").eq("invoice_id", id),
      ]);
      return { invoice: inv.data, items: items.data ?? [], payments: pays.data ?? [] };
    },
  });

  if (!data?.invoice) return <PageContainer><div className="text-muted-foreground">Loading…</div></PageContainer>;
  const inv = data.invoice;
  const c = inv.customer;
  const isInter = Number(inv.igst) > 0;

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6 no-print">
        <Button asChild variant="ghost" size="sm" className="gap-1.5"><Link to="/invoices"><ArrowLeft className="size-4" /> Back</Link></Button>
        <div className="flex gap-2">
          <StatusBadge status={inv.status} />
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5"><Printer className="size-4" /> Print / PDF</Button>
        </div>
      </div>

      <Card className="p-10 max-w-4xl mx-auto shadow-md print:shadow-none print:border-0">
        <div className="flex justify-between items-start pb-6 border-b">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-primary grid place-items-center text-primary-foreground">
              <Milk className="size-6" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight">DairyFlow Distributors</div>
              <div className="text-xs text-muted-foreground">Wholesale Dairy Distribution · GSTIN: 07AAAAA0000A1Z5</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight">TAX INVOICE</div>
            <div className="text-xs text-muted-foreground mt-1">Original for recipient</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 py-6 border-b">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Billed to</div>
            <div className="font-semibold">{c?.name}</div>
            {c?.shop_name && <div className="text-sm text-muted-foreground">{c.shop_name}</div>}
            {c?.address && <div className="text-sm text-muted-foreground whitespace-pre-line">{c.address}</div>}
            {c?.mobile && <div className="text-sm mt-1">Mobile: <span className="font-mono">{c.mobile}</span></div>}
            {c?.gstin && <div className="text-sm">GSTIN: <span className="font-mono">{c.gstin}</span></div>}
          </div>
          <div className="text-right space-y-1">
            <Field label="Invoice #" value={inv.invoice_no} mono />
            <Field label="Date" value={shortDate(inv.invoice_date)} />
            {inv.due_date && <Field label="Due" value={shortDate(inv.due_date)} />}
          </div>
        </div>

        <table className="w-full text-sm my-6">
          <thead>
            <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-2 font-semibold">#</th>
              <th className="text-left py-2 font-semibold">Item</th>
              <th className="text-left py-2 font-semibold">HSN</th>
              <th className="text-right py-2 font-semibold">Qty</th>
              <th className="text-right py-2 font-semibold">Rate</th>
              <th className="text-right py-2 font-semibold">Disc</th>
              <th className="text-right py-2 font-semibold">Taxable</th>
              <th className="text-right py-2 font-semibold">GST</th>
              <th className="text-right py-2 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.map((it, i) => (
              <tr key={it.id}>
                <td className="py-2 text-muted-foreground">{i + 1}</td>
                <td className="py-2 font-medium">{it.product_name}</td>
                <td className="py-2 font-mono text-xs text-muted-foreground">{it.hsn ?? "—"}</td>
                <td className="py-2 text-right font-mono">{Number(it.quantity)}</td>
                <td className="py-2 text-right font-mono">{inr(it.rate)}</td>
                <td className="py-2 text-right font-mono text-muted-foreground">{inr(it.discount)}</td>
                <td className="py-2 text-right font-mono">{inr(it.taxable)}</td>
                <td className="py-2 text-right font-mono text-muted-foreground">{Number(it.gst_rate)}% ({inr(it.tax_amount)})</td>
                <td className="py-2 text-right font-mono font-semibold">{inr(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 pt-6 border-t">
          <div>
            {inv.notes && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Notes</div>
                <div className="text-sm text-muted-foreground whitespace-pre-line">{inv.notes}</div>
              </>
            )}
            <div className="mt-6 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Terms</div>
            <div className="text-xs text-muted-foreground">
              Payment due on delivery. Interest @ 18% p.a. on overdue amounts. Goods once sold will not be taken back.
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={inr(inv.subtotal)} />
            {Number(inv.discount) > 0 && <Row label="Discount" value={`− ${inr(inv.discount)}`} />}
            {!isInter ? (
              <>
                <Row label={`CGST`} value={inr(inv.cgst)} muted />
                <Row label={`SGST`} value={inr(inv.sgst)} muted />
              </>
            ) : (
              <Row label={`IGST`} value={inr(inv.igst)} muted />
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
              <span className={`font-mono ${Number(inv.balance) > 0 ? "text-destructive" : "text-success"}`}>{inr(inv.balance)}</span>
            </div>
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
