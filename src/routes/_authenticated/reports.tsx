import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

function Reports() {
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(isoDate());

  const { data } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: async () => {
      const toEnd = to; // date columns; inclusive filter below
      const [inv, items, pays, purch, pItems, custs, sups] = await Promise.all([
        supabase.from("invoices").select("id, invoice_no, invoice_date, customer_id, subtotal, cgst, sgst, igst, total, paid, balance, status, customer:customers(name, shop_name, gstin)").gte("invoice_date", from).lte("invoice_date", toEnd).order("invoice_date"),
        supabase.from("invoice_items").select("product_name, hsn, quantity, taxable, tax_amount, gst_rate, amount, invoice:invoices!inner(invoice_date, customer_id, cgst, igst)").gte("invoice.invoice_date", from).lte("invoice.invoice_date", toEnd),
        supabase.from("payments").select("payment_no, payment_date, amount, mode, reference, customer_id, invoice_id, customer:customers(name, shop_name)").gte("payment_date", from).lte("payment_date", toEnd).order("payment_date"),
        supabase.from("purchases").select("id, bill_no, purchase_date, subtotal, gst, total, paid, status, supplier:suppliers(name, company)").gte("purchase_date", from).lte("purchase_date", toEnd).order("purchase_date"),
        supabase.from("purchase_items").select("product_name, quantity, rate, gst_rate, amount, purchase:purchases!inner(purchase_date)").gte("purchase.purchase_date", from).lte("purchase.purchase_date", toEnd),
        supabase.from("customers").select("id, name, shop_name, outstanding").order("outstanding", { ascending: false }),
        supabase.from("suppliers").select("id, name, company, outstanding").order("outstanding", { ascending: false }),
      ]);
      return {
        invoices: inv.data ?? [],
        items: items.data ?? [],
        payments: pays.data ?? [],
        purchases: purch.data ?? [],
        pItems: pItems.data ?? [],
        customers: custs.data ?? [],
        suppliers: sups.data ?? [],
      };
    },
  });

  const kpi = useMemo(() => {
    const invs = data?.invoices ?? [];
    const totalSales = invs.reduce((s, r: any) => s + Number(r.total), 0);
    const totalTax = invs.reduce((s, r: any) => s + Number(r.cgst) + Number(r.sgst) + Number(r.igst), 0);
    const totalCollected = (data?.payments ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
    const totalPurchase = (data?.purchases ?? []).reduce((s, r: any) => s + Number(r.total), 0);
    const outstandingCust = (data?.customers ?? []).reduce((s, r: any) => s + Number(r.outstanding || 0), 0);
    return { totalSales, totalTax, totalCollected, totalPurchase, outstandingCust, invoiceCount: invs.length };
  }, [data]);

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Registers, ledgers, GST summary, collections and aging — filter by date range."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 h-9" />
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 h-9" />
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 no-print">
              <Printer className="size-3.5" /> Print
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Kpi label="Invoices" value={num(kpi.invoiceCount)} />
        <Kpi label="Sales" value={inr(kpi.totalSales)} />
        <Kpi label="GST" value={inr(kpi.totalTax)} />
        <Kpi label="Collections" value={inr(kpi.totalCollected)} />
        <Kpi label="Purchases" value={inr(kpi.totalPurchase)} />
        <Kpi label="Total Dues" value={inr(kpi.outstandingCust)} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sales">Sales Register</TabsTrigger>
          <TabsTrigger value="purchases">Purchase Register</TabsTrigger>
          <TabsTrigger value="cust-ledger">Customer Ledger</TabsTrigger>
          <TabsTrigger value="sup-ledger">Supplier Ledger</TabsTrigger>
          <TabsTrigger value="gst">GST Summary</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="top">Top Products / Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <ReportTable
            headers={["Date", "Invoice #", "Customer", "GSTIN", "Taxable", "GST", "Total", "Paid", "Balance", "Status"]}
            rows={(data?.invoices ?? []).map((r: any) => [
              shortDate(r.invoice_date),
              r.invoice_no,
              r.customer?.shop_name || r.customer?.name || "—",
              r.customer?.gstin || "—",
              inr(r.subtotal),
              inr(Number(r.cgst) + Number(r.sgst) + Number(r.igst)),
              inr(r.total),
              inr(r.paid),
              inr(r.balance),
              r.status,
            ])}
            totals={{ 4: inr((data?.invoices ?? []).reduce((s, r: any) => s + Number(r.subtotal), 0)), 5: inr((data?.invoices ?? []).reduce((s, r: any) => s + Number(r.cgst) + Number(r.sgst) + Number(r.igst), 0)), 6: inr(kpi.totalSales), 7: inr((data?.invoices ?? []).reduce((s, r: any) => s + Number(r.paid), 0)), 8: inr((data?.invoices ?? []).reduce((s, r: any) => s + Number(r.balance), 0)) }}
          />
        </TabsContent>

        <TabsContent value="purchases">
          <ReportTable
            headers={["Date", "Bill #", "Supplier", "Subtotal", "GST", "Total", "Paid", "Status"]}
            rows={(data?.purchases ?? []).map((r: any) => [
              shortDate(r.purchase_date),
              r.bill_no || "—",
              r.supplier?.company || r.supplier?.name || "—",
              inr(r.subtotal),
              inr(r.gst),
              inr(r.total),
              inr(r.paid),
              r.status,
            ])}
            totals={{ 3: inr((data?.purchases ?? []).reduce((s, r: any) => s + Number(r.subtotal), 0)), 4: inr((data?.purchases ?? []).reduce((s, r: any) => s + Number(r.gst), 0)), 5: inr(kpi.totalPurchase), 6: inr((data?.purchases ?? []).reduce((s, r: any) => s + Number(r.paid), 0)) }}
          />
        </TabsContent>

        <TabsContent value="cust-ledger">
          <CustomerLedger from={from} to={to} customers={data?.customers ?? []} />
        </TabsContent>

        <TabsContent value="sup-ledger">
          <ReportTable
            headers={["Supplier", "Company", "Outstanding"]}
            rows={(data?.suppliers ?? []).map((s: any) => [s.name, s.company || "—", inr(s.outstanding)])}
            totals={{ 2: inr((data?.suppliers ?? []).reduce((s: number, r: any) => s + Number(r.outstanding || 0), 0)) }}
          />
        </TabsContent>

        <TabsContent value="gst">
          <GstSummary items={data?.items ?? []} invoices={data?.invoices ?? []} />
        </TabsContent>

        <TabsContent value="collections">
          <CollectionsReport payments={data?.payments ?? []} />
        </TabsContent>

        <TabsContent value="aging">
          <AgingReport invoices={data?.invoices ?? []} />
        </TabsContent>

        <TabsContent value="top">
          <TopReport items={data?.items ?? []} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl md:text-2xl font-semibold font-mono mt-1 truncate">{value}</div>
    </Card>
  );
}

function GstSummary({ items, invoices }: { items: any[]; invoices: any[] }) {
  const byRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
  const byHsn = new Map<string, { taxable: number; tax: number; qty: number }>();
  for (const it of items) {
    const rate = Number(it.gst_rate || 0);
    const taxable = Number(it.taxable || 0);
    const tax = Number(it.tax_amount || 0);
    const inter = Number(it.invoice?.igst || 0) > 0;
    const cur = byRate.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    cur.taxable += taxable;
    if (inter) cur.igst += tax; else { cur.cgst += tax / 2; cur.sgst += tax / 2; }
    byRate.set(rate, cur);
    const h = it.hsn || "—";
    const hcur = byHsn.get(h) ?? { taxable: 0, tax: 0, qty: 0 };
    hcur.taxable += taxable; hcur.tax += tax; hcur.qty += Number(it.quantity || 0);
    byHsn.set(h, hcur);
  }
  const rateRows = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]);
  const hsnRows = Array.from(byHsn.entries()).sort((a, b) => b[1].taxable - a[1].taxable);
  const totalTaxable = invoices.reduce((s: number, r: any) => s + Number(r.subtotal), 0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ReportTable
        headers={["GST %", "Taxable", "CGST", "SGST", "IGST", "Total Tax"]}
        rows={rateRows.map(([rate, v]) => [`${rate}%`, inr(v.taxable), inr(v.cgst), inr(v.sgst), inr(v.igst), inr(v.cgst + v.sgst + v.igst)])}
        title="Rate-wise summary"
      />
      <ReportTable
        headers={["HSN", "Qty", "Taxable", "Tax"]}
        rows={hsnRows.map(([h, v]) => [h, num(v.qty, 2), inr(v.taxable), inr(v.tax)])}
        title="HSN summary"
        totals={{ 2: inr(totalTaxable) }}
      />
    </div>
  );
}

function CollectionsReport({ payments }: { payments: any[] }) {
  const byMode = new Map<string, number>();
  for (const p of payments) byMode.set(p.mode, (byMode.get(p.mode) ?? 0) + Number(p.amount));
  const modeRows = Array.from(byMode.entries()).map(([m, a]) => [m.toUpperCase(), inr(a)]);
  const total = payments.reduce((s: number, r: any) => s + Number(r.amount), 0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <ReportTable headers={["Mode", "Amount"]} rows={modeRows} title="By payment mode" totals={{ 1: inr(total) }} />
      <div className="lg:col-span-2">
        <ReportTable
          headers={["Date", "Payment #", "Customer", "Mode", "Reference", "Amount"]}
          rows={payments.map((p: any) => [
            shortDate(p.payment_date),
            p.payment_no,
            p.customer?.shop_name || p.customer?.name || "—",
            p.mode.toUpperCase(),
            p.reference || "—",
            inr(p.amount),
          ])}
          title="Receipts"
          totals={{ 5: inr(total) }}
        />
      </div>
    </div>
  );
}

function AgingReport({ invoices }: { invoices: any[] }) {
  const today = new Date();
  const buckets = new Map<string, { c0: number; c30: number; c60: number; c90: number; c90p: number; total: number }>();
  for (const inv of invoices) {
    if (Number(inv.balance) <= 0 || inv.status === "void") continue;
    const days = Math.floor((today.getTime() - new Date(inv.invoice_date).getTime()) / 86400000);
    const bal = Number(inv.balance);
    const key = inv.customer?.shop_name || inv.customer?.name || "—";
    const cur = buckets.get(key) ?? { c0: 0, c30: 0, c60: 0, c90: 0, c90p: 0, total: 0 };
    if (days <= 30) cur.c0 += bal;
    else if (days <= 60) cur.c30 += bal;
    else if (days <= 90) cur.c60 += bal;
    else if (days <= 120) cur.c90 += bal;
    else cur.c90p += bal;
    cur.total += bal;
    buckets.set(key, cur);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => b[1].total - a[1].total);
  const sum = (k: keyof (typeof rows)[0][1]) => rows.reduce((s, [, v]) => s + (v[k] as number), 0);
  return (
    <ReportTable
      headers={["Customer", "0–30", "31–60", "61–90", "91–120", "120+", "Total"]}
      rows={rows.map(([n, v]) => [n, inr(v.c0), inr(v.c30), inr(v.c60), inr(v.c90), inr(v.c90p), inr(v.total)])}
      totals={{ 1: inr(sum("c0")), 2: inr(sum("c30")), 3: inr(sum("c60")), 4: inr(sum("c90")), 5: inr(sum("c90p")), 6: inr(sum("total")) }}
    />
  );
}

function TopReport({ items }: { items: any[] }) {
  const byProduct = new Map<string, { qty: number; amount: number }>();
  const byCustomer = new Map<string, number>();
  for (const it of items) {
    const cur = byProduct.get(it.product_name) ?? { qty: 0, amount: 0 };
    cur.qty += Number(it.quantity); cur.amount += Number(it.amount);
    byProduct.set(it.product_name, cur);
  }
  const products = Array.from(byProduct.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 50);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ReportTable
        headers={["Product", "Qty", "Amount"]}
        rows={products.map((p) => [p.name, num(p.qty, 2), inr(p.amount)])}
        title="Top products"
      />
      <ReportTable
        headers={["Customer", "Total purchases"]}
        rows={Array.from(byCustomer.entries()).map(([n, a]) => [n, inr(a)])}
        title="Top customers"
      />
    </div>
  );
}

function CustomerLedger({ from, to, customers }: { from: string; to: string; customers: any[] }) {
  const [id, setId] = useState<string>("");
  const { data } = useQuery({
    queryKey: ["cust-ledger", id, from, to],
    enabled: !!id,
    queryFn: async () => {
      const [inv, pays] = await Promise.all([
        supabase.from("invoices").select("id, invoice_no, invoice_date, total, balance, status").eq("customer_id", id).gte("invoice_date", from).lte("invoice_date", to).order("invoice_date"),
        supabase.from("payments").select("id, payment_no, payment_date, amount, mode, reference").eq("customer_id", id).gte("payment_date", from).lte("payment_date", to).order("payment_date"),
      ]);
      const entries: any[] = [];
      for (const i of inv.data ?? []) entries.push({ date: i.invoice_date, ref: i.invoice_no, particulars: `Sale • ${i.status}`, debit: Number(i.total), credit: 0 });
      for (const p of pays.data ?? []) entries.push({ date: p.payment_date, ref: p.payment_no, particulars: `Payment • ${p.mode.toUpperCase()}${p.reference ? ` • ${p.reference}` : ""}`, debit: 0, credit: Number(p.amount) });
      entries.sort((a, b) => a.date.localeCompare(b.date));
      let bal = 0;
      const rows = entries.map((e) => { bal += e.debit - e.credit; return { ...e, balance: bal }; });
      return { rows, dr: entries.reduce((s, e) => s + e.debit, 0), cr: entries.reduce((s, e) => s + e.credit, 0) };
    },
  });
  const selected = customers.find((c) => c.id === id);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <Label className="text-xs">Customer</Label>
        <Select value={id} onValueChange={setId}>
          <SelectTrigger className="w-72 h-9"><SelectValue placeholder="Select a retailer" /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.shop_name || c.name} {Number(c.outstanding) > 0 ? `• ${inr(c.outstanding)} due` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && <span className="text-xs text-muted-foreground">Current outstanding: <b className="text-foreground">{inr(selected.outstanding)}</b></span>}
      </div>
      {!id ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">Select a customer to view their statement of account.</Card>
      ) : (
        <ReportTable
          headers={["Date", "Ref #", "Particulars", "Debit", "Credit", "Running Balance"]}
          rows={(data?.rows ?? []).map((r: any) => [shortDate(r.date), r.ref, r.particulars, r.debit ? inr(r.debit) : "—", r.credit ? inr(r.credit) : "—", inr(r.balance)])}
          totals={{ 3: inr(data?.dr ?? 0), 4: inr(data?.cr ?? 0), 5: inr((data?.dr ?? 0) - (data?.cr ?? 0)) }}
        />
      )}
    </div>
  );
}

function ReportTable({
  headers, rows, totals, title,
}: {
  headers: string[];
  rows: (string | number)[][];
  totals?: Record<number, string>;
  title?: string;
}) {
  const exportCsv = () => {
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(title || "report").replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {title || <span className="text-xs text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"}</span>}
        </div>
        <div className="flex items-center gap-2 no-print">
          {title && <span className="text-xs text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"}</span>}
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5"><Download className="size-3.5" /> Export CSV</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              {headers.map((h, i) => <th key={h} className={`px-4 py-3 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td colSpan={headers.length} className="text-center py-12 text-muted-foreground">No data.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/30">
                {r.map((c, j) => <td key={j} className={`px-4 py-2.5 whitespace-nowrap ${j === 0 ? "font-medium" : "text-right font-mono text-xs"}`}>{c}</td>)}
              </tr>
            ))}
            {totals && rows.length > 0 && (
              <tr className="bg-muted/60 font-semibold">
                {headers.map((_, i) => (
                  <td key={i} className={`px-4 py-2.5 whitespace-nowrap ${i === 0 ? "text-left" : "text-right font-mono text-xs"}`}>
                    {i === 0 ? "Total" : totals[i] || ""}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
