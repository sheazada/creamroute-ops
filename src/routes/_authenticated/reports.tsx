import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, num, isoDate, shortDate } from "@/lib/format";
import { Download, ExternalLink, FileText, Printer } from "lucide-react";

type Cell = string | number | { text: string; to?: string; params?: Record<string, string> };

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

function Reports() {
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(isoDate());

  const { data } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: async () => {
      const toEnd = to;
      const [inv, items, pays, purch, pItems, custs, sups, sPays] = await Promise.all([
        supabase.from("invoices").select("id, invoice_no, invoice_date, customer_id, subtotal, cgst, sgst, igst, total, paid, balance, status, customer:customers(name, shop_name, gstin)").gte("invoice_date", from).lte("invoice_date", toEnd).order("invoice_date"),
        supabase.from("invoice_items").select("product_name, hsn, quantity, taxable, tax_amount, gst_rate, amount, invoice:invoices!inner(invoice_date, customer_id, cgst, igst)").gte("invoice.invoice_date", from).lte("invoice.invoice_date", toEnd),
        supabase.from("payments").select("payment_no, payment_date, amount, mode, reference, customer_id, invoice_id, customer:customers(name, shop_name)").gte("payment_date", from).lte("payment_date", toEnd).order("payment_date"),
        supabase.from("purchases").select("id, bill_no, purchase_date, subtotal, gst, total, paid, status, supplier_id, supplier:suppliers(name, company)").gte("purchase_date", from).lte("purchase_date", toEnd).order("purchase_date"),
        supabase.from("purchase_items").select("product_name, quantity, rate, gst_rate, amount, purchase:purchases!inner(purchase_date)").gte("purchase.purchase_date", from).lte("purchase.purchase_date", toEnd),
        supabase.from("customers").select("id, name, shop_name, outstanding").order("outstanding", { ascending: false }),
        supabase.from("suppliers").select("id, name, company, outstanding").order("outstanding", { ascending: false }),
        supabase.from("supplier_payments").select("payment_no, payment_date, amount, mode, reference, supplier_id, purchase_id").gte("payment_date", from).lte("payment_date", toEnd).order("payment_date"),
      ]);
      return {
        invoices: inv.data ?? [],
        items: items.data ?? [],
        payments: pays.data ?? [],
        purchases: purch.data ?? [],
        pItems: pItems.data ?? [],
        customers: custs.data ?? [],
        suppliers: sups.data ?? [],
        supplierPayments: sPays.data ?? [],
      };
    },
  });

  const kpi = useMemo(() => {
    const invs = data?.invoices ?? [];
    const totalSales = invs.reduce((s, r: any) => s + Number(r.total), 0);
    const totalTaxable = invs.reduce((s, r: any) => s + Number(r.subtotal), 0);
    const totalTax = invs.reduce((s, r: any) => s + Number(r.cgst) + Number(r.sgst) + Number(r.igst), 0);
    const totalCollected = (data?.payments ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
    const totalPurchase = (data?.purchases ?? []).reduce((s, r: any) => s + Number(r.total), 0);
    const totalPurchaseTaxable = (data?.purchases ?? []).reduce((s, r: any) => s + Number(r.subtotal), 0);
    const outstandingCust = (data?.customers ?? []).reduce((s, r: any) => s + Number(r.outstanding || 0), 0);
    const outstandingSup = (data?.suppliers ?? []).reduce((s, r: any) => s + Number(r.outstanding || 0), 0);
    const grossProfit = totalTaxable - totalPurchaseTaxable;
    const margin = totalTaxable > 0 ? (grossProfit / totalTaxable) * 100 : 0;
    return { totalSales, totalTax, totalTaxable, totalCollected, totalPurchase, totalPurchaseTaxable, outstandingCust, outstandingSup, invoiceCount: invs.length, grossProfit, margin };
  }, [data]);

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Registers, ledgers, GST, profit, collections & aging — export as CSV or PDF."
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
        <Kpi label="Gross Profit" value={inr(kpi.grossProfit)} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sales">Sales Register</TabsTrigger>
          <TabsTrigger value="purchases">Purchase Register</TabsTrigger>
          <TabsTrigger value="cust-ledger">Customer Ledger</TabsTrigger>
          <TabsTrigger value="sup-ledger">Supplier Ledger</TabsTrigger>
          <TabsTrigger value="profit">Profit &amp; Loss</TabsTrigger>
          <TabsTrigger value="gst">GST Summary</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="aging-sup">Payables Aging</TabsTrigger>
          <TabsTrigger value="top">Top Products / Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <ReportTable
            title="Sales Register"
            meta={`${from} to ${to}`}
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
            totals={{ 4: inr(kpi.totalTaxable), 5: inr(kpi.totalTax), 6: inr(kpi.totalSales), 7: inr((data?.invoices ?? []).reduce((s, r: any) => s + Number(r.paid), 0)), 8: inr((data?.invoices ?? []).reduce((s, r: any) => s + Number(r.balance), 0)) }}
          />
        </TabsContent>

        <TabsContent value="purchases">
          <ReportTable
            title="Purchase Register"
            meta={`${from} to ${to}`}
            headers={["Date", "Bill #", "Supplier", "Subtotal", "GST", "Total", "Paid", "Status"]}
            rows={(data?.purchases ?? []).map((r: any) => [
              shortDate(r.purchase_date),
              r.bill_no || "—",
              r.supplier_id
                ? { text: r.supplier?.company || r.supplier?.name || "—", to: "/suppliers/$id", params: { id: r.supplier_id } }
                : (r.supplier?.company || r.supplier?.name || "—"),
              inr(r.subtotal),
              inr(r.gst),
              inr(r.total),
              inr(r.paid),
              r.status,
            ])}
            totals={{ 3: inr(kpi.totalPurchaseTaxable), 4: inr((data?.purchases ?? []).reduce((s, r: any) => s + Number(r.gst), 0)), 5: inr(kpi.totalPurchase), 6: inr((data?.purchases ?? []).reduce((s, r: any) => s + Number(r.paid), 0)) }}
          />
        </TabsContent>

        <TabsContent value="cust-ledger">
          <CustomerLedger from={from} to={to} customers={data?.customers ?? []} />
        </TabsContent>

        <TabsContent value="sup-ledger">
          <SupplierLedger from={from} to={to} suppliers={data?.suppliers ?? []} />
        </TabsContent>

        <TabsContent value="profit">
          <ProfitReport kpi={kpi} from={from} to={to} />
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

        <TabsContent value="aging-sup">
          <PayablesAging from={from} to={to} />
        </TabsContent>

        <TabsContent value="top">
          <TopReport items={data?.items ?? []} invoices={data?.invoices ?? []} />
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

function ProfitReport({ kpi, from, to }: { kpi: any; from: string; to: string }) {
  const rows: (string | number)[][] = [
    ["Revenue (taxable sales)", inr(kpi.totalTaxable)],
    ["Cost of goods (taxable purchases)", inr(kpi.totalPurchaseTaxable)],
    ["Gross Profit", inr(kpi.grossProfit)],
    ["Gross Margin %", `${kpi.margin.toFixed(2)}%`],
    ["— GST collected (output)", inr(kpi.totalTax)],
    ["— Collections received", inr(kpi.totalCollected)],
    ["— Customer outstanding", inr(kpi.outstandingCust)],
    ["— Supplier outstanding", inr(kpi.outstandingSup)],
  ];
  return (
    <ReportTable
      title="Profit & Loss (summary)"
      meta={`${from} to ${to}`}
      headers={["Particulars", "Amount"]}
      rows={rows}
    />
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
      title="Receivables Aging"
      headers={["Customer", "0–30", "31–60", "61–90", "91–120", "120+", "Total"]}
      rows={rows.map(([n, v]) => [n, inr(v.c0), inr(v.c30), inr(v.c60), inr(v.c90), inr(v.c90p), inr(v.total)])}
      totals={{ 1: inr(sum("c0")), 2: inr(sum("c30")), 3: inr(sum("c60")), 4: inr(sum("c90")), 5: inr(sum("c90p")), 6: inr(sum("total")) }}
    />
  );
}

function PayablesAging({ from: _f, to: _t }: { from: string; to: string }) {
  const { data } = useQuery({
    queryKey: ["payables-aging"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("id, bill_no, purchase_date, total, paid, status, supplier:suppliers(name, company)")
        .neq("status", "paid")
        .neq("status", "void")
        .order("purchase_date");
      return data ?? [];
    },
  });
  const today = new Date();
  const buckets = new Map<string, { c0: number; c30: number; c60: number; c90: number; c90p: number; total: number }>();
  for (const p of data ?? []) {
    const bal = Number(p.total) - Number(p.paid);
    if (bal <= 0) continue;
    const days = Math.floor((today.getTime() - new Date(p.purchase_date).getTime()) / 86400000);
    const key = (p as any).supplier?.company || (p as any).supplier?.name || "—";
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
      title="Payables Aging"
      headers={["Supplier", "0–30", "31–60", "61–90", "91–120", "120+", "Total"]}
      rows={rows.map(([n, v]) => [n, inr(v.c0), inr(v.c30), inr(v.c60), inr(v.c90), inr(v.c90p), inr(v.total)])}
      totals={{ 1: inr(sum("c0")), 2: inr(sum("c30")), 3: inr(sum("c60")), 4: inr(sum("c90")), 5: inr(sum("c90p")), 6: inr(sum("total")) }}
    />
  );
}

function TopReport({ items, invoices }: { items: any[]; invoices: any[] }) {
  const byProduct = new Map<string, { qty: number; amount: number }>();
  for (const it of items) {
    const cur = byProduct.get(it.product_name) ?? { qty: 0, amount: 0 };
    cur.qty += Number(it.quantity); cur.amount += Number(it.amount);
    byProduct.set(it.product_name, cur);
  }
  const byCustomer = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status === "void") continue;
    const key = inv.customer?.shop_name || inv.customer?.name || "—";
    byCustomer.set(key, (byCustomer.get(key) ?? 0) + Number(inv.total));
  }
  const products = Array.from(byProduct.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 50);
  const customers = Array.from(byCustomer.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ReportTable
        headers={["Product", "Qty", "Amount"]}
        rows={products.map((p) => [p.name, num(p.qty, 2), inr(p.amount)])}
        title="Top products"
      />
      <ReportTable
        headers={["Customer", "Total purchases"]}
        rows={customers.map(([n, a]) => [n, inr(a)])}
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
      const [opening, inv, pays] = await Promise.all([
        supabase.from("invoices").select("total, paid").eq("customer_id", id).lt("invoice_date", from).neq("status", "void"),
        supabase.from("invoices").select("id, invoice_no, invoice_date, total, balance, status").eq("customer_id", id).gte("invoice_date", from).lte("invoice_date", to).order("invoice_date"),
        supabase.from("payments").select("id, payment_no, payment_date, amount, mode, reference").eq("customer_id", id).gte("payment_date", from).lte("payment_date", to).order("payment_date"),
      ]);
      const openingBal = (opening.data ?? []).reduce((s: number, r: any) => s + Number(r.total) - Number(r.paid), 0)
        - 0; // opening pre-period payments already reduce invoice.paid via triggers
      const entries: any[] = [];
      for (const i of inv.data ?? []) entries.push({ date: i.invoice_date, ref: i.invoice_no, particulars: `Sale • ${i.status}`, debit: Number(i.total), credit: 0 });
      for (const p of pays.data ?? []) entries.push({ date: p.payment_date, ref: p.payment_no, particulars: `Payment • ${p.mode.toUpperCase()}${p.reference ? ` • ${p.reference}` : ""}`, debit: 0, credit: Number(p.amount) });
      entries.sort((a, b) => a.date.localeCompare(b.date));
      let bal = openingBal;
      const rows: any[] = [{ date: from, ref: "—", particulars: "Opening balance", debit: 0, credit: 0, balance: openingBal }];
      for (const e of entries) { bal += e.debit - e.credit; rows.push({ ...e, balance: bal }); }
      return { rows, dr: entries.reduce((s, e) => s + e.debit, 0), cr: entries.reduce((s, e) => s + e.credit, 0), openingBal, closing: bal };
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
          title={`Customer Statement — ${selected?.shop_name || selected?.name || ""}`}
          meta={`${from} to ${to} • Opening ${inr(data?.openingBal ?? 0)} • Closing ${inr(data?.closing ?? 0)}`}
          headers={["Date", "Ref #", "Particulars", "Debit", "Credit", "Running Balance"]}
          rows={(data?.rows ?? []).map((r: any) => [shortDate(r.date), r.ref, r.particulars, r.debit ? inr(r.debit) : "—", r.credit ? inr(r.credit) : "—", inr(r.balance)])}
          totals={{ 3: inr(data?.dr ?? 0), 4: inr(data?.cr ?? 0), 5: inr(data?.closing ?? 0) }}
        />
      )}
    </div>
  );
}

function SupplierLedger({ from, to, suppliers }: { from: string; to: string; suppliers: any[] }) {
  const [id, setId] = useState<string>("");
  const { data } = useQuery({
    queryKey: ["sup-ledger", id, from, to],
    enabled: !!id,
    queryFn: async () => {
      const [opening, purch, pays] = await Promise.all([
        supabase.from("purchases").select("total, paid").eq("supplier_id", id).lt("purchase_date", from).neq("status", "void"),
        supabase.from("purchases").select("id, bill_no, purchase_date, total, status").eq("supplier_id", id).gte("purchase_date", from).lte("purchase_date", to).order("purchase_date"),
        supabase.from("supplier_payments").select("id, payment_no, payment_date, amount, mode, reference").eq("supplier_id", id).gte("payment_date", from).lte("payment_date", to).order("payment_date"),
      ]);
      const openingBal = (opening.data ?? []).reduce((s: number, r: any) => s + Number(r.total) - Number(r.paid), 0);
      const entries: any[] = [];
      for (const p of purch.data ?? []) entries.push({ date: p.purchase_date, ref: p.bill_no || "—", particulars: `Purchase • ${p.status}`, credit: Number(p.total), debit: 0 });
      for (const p of pays.data ?? []) entries.push({ date: p.payment_date, ref: p.payment_no, particulars: `Payment • ${p.mode.toUpperCase()}${p.reference ? ` • ${p.reference}` : ""}`, credit: 0, debit: Number(p.amount) });
      entries.sort((a, b) => a.date.localeCompare(b.date));
      let bal = openingBal;
      const rows: any[] = [{ date: from, ref: "—", particulars: "Opening balance", debit: 0, credit: 0, balance: openingBal }];
      for (const e of entries) { bal += e.credit - e.debit; rows.push({ ...e, balance: bal }); }
      return { rows, dr: entries.reduce((s, e) => s + e.debit, 0), cr: entries.reduce((s, e) => s + e.credit, 0), openingBal, closing: bal };
    },
  });
  const selected = suppliers.find((s) => s.id === id);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <Label className="text-xs">Supplier</Label>
        <Select value={id} onValueChange={setId}>
          <SelectTrigger className="w-72 h-9"><SelectValue placeholder="Select a supplier" /></SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.company || s.name} {Number(s.outstanding) > 0 ? `• ${inr(s.outstanding)} payable` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && <span className="text-xs text-muted-foreground">Current payable: <b className="text-foreground">{inr(selected.outstanding)}</b></span>}
      </div>
      {!id ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">Select a supplier to view their statement of account.</Card>
      ) : (
        <ReportTable
          title={`Supplier Statement — ${selected?.company || selected?.name || ""}`}
          meta={`${from} to ${to} • Opening ${inr(data?.openingBal ?? 0)} • Closing ${inr(data?.closing ?? 0)}`}
          headers={["Date", "Ref #", "Particulars", "Debit (Paid)", "Credit (Bill)", "Running Payable"]}
          rows={(data?.rows ?? []).map((r: any) => [shortDate(r.date), r.ref, r.particulars, r.debit ? inr(r.debit) : "—", r.credit ? inr(r.credit) : "—", inr(r.balance)])}
          totals={{ 3: inr(data?.dr ?? 0), 4: inr(data?.cr ?? 0), 5: inr(data?.closing ?? 0) }}
        />
      )}
    </div>
  );
}

function ReportTable({
  headers, rows, totals, title, meta,
}: {
  headers: string[];
  rows: Cell[][];
  totals?: Record<number, string>;
  title?: string;
  meta?: string;
}) {
  const cellText = (c: Cell): string => (typeof c === "object" && c !== null ? c.text : String(c));
  const cellNode = (c: Cell): ReactNode => {
    if (typeof c === "object" && c !== null) {
      if (c.to) {
        return (
          <Link to={c.to as any} params={c.params as any} className="text-primary hover:underline inline-flex items-center gap-1">
            {c.text} <ExternalLink className="size-3 opacity-60" />
          </Link>
        );
      }
      return c.text;
    }
    return c;
  };
  const filename = (title || "report").replace(/\s+/g, "-").toLowerCase();
  const exportCsv = () => {
    const csv = [headers, ...rows.map((r) => r.map(cellText))].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filename}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const exportPdf = () => {
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const totalsRow = totals
      ? `<tr class="tot">${headers.map((_, i) => `<td>${i === 0 ? "Total" : esc(totals[i] || "")}</td>`).join("")}</tr>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title || "Report")}</title>
<style>
  *{box-sizing:border-box} body{font:12px -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:24px}
  h1{font-size:18px;margin:0 0 4px} .meta{color:#666;font-size:11px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse} th,td{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums}
  th:first-child,td:first-child{text-align:left}
  thead th{background:#f3f4f6;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#374151;border-bottom:1px solid #d1d5db}
  tr.tot td{background:#f3f4f6;font-weight:600}
  @page{size:A4 landscape;margin:12mm}
</style></head><body>
<h1>${esc(title || "Report")}</h1>
${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
<table>
  <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>
    ${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(cellText(c))}</td>`).join("")}</tr>`).join("")}
    ${totalsRow}
  </tbody>
</table>
<script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  };
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium">
          {title || <span className="text-xs text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"}</span>}
          {meta && <div className="text-[11px] text-muted-foreground font-normal mt-0.5">{meta}</div>}
        </div>
        <div className="flex items-center gap-2 no-print">
          <span className="text-xs text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"}</span>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5"><Download className="size-3.5" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={exportPdf} className="gap-1.5"><FileText className="size-3.5" /> PDF</Button>
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
                {r.map((c, j) => <td key={j} className={`px-4 py-2.5 whitespace-nowrap ${j === 0 ? "font-medium" : "text-right font-mono text-xs"}`}>{cellNode(c)}</td>)}
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
