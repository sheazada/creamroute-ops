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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { inr, genDocNo, isoDate, num } from "@/lib/format";
import { Trash2, Plus, Minus, Search, ShoppingCart, User, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  stock: number;
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
  const [productQuery, setProductQuery] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () =>
      (await supabase.from("products").select("*").eq("status", "active").order("name")).data ?? [],
  });

  const selectedCustomer = useMemo(
    () => (customers ?? []).find((c) => c.id === customerId),
    [customers, customerId],
  );

  const totals = useMemo(() => {
    let subtotal = 0,
      discount = 0,
      tax = 0;
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

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const list = products ?? [];
    if (!q) return list.slice(0, 8);
    return list
      .filter(
        (p: any) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          (p.hsn ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, productQuery]);

  const addProduct = (p: any) => {
    const existingIdx = lines.findIndex((l) => l.product_id === p.id);
    if (existingIdx >= 0) {
      setLines(
        lines.map((l, i) => (i === existingIdx ? { ...l, quantity: l.quantity + 1 } : l)),
      );
    } else {
      setLines([
        ...lines,
        {
          product_id: p.id,
          product_name: p.name,
          hsn: p.hsn ?? "",
          quantity: 1,
          rate: Number(p.selling_price),
          discount: 0,
          gst_rate: Number(p.gst_rate),
          stock: Number(p.current_stock),
        },
      ]);
    }
    setProductQuery("");
  };

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const rmLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!customerId) return toast.error("Select customer");
    if (lines.length === 0) return toast.error("Add at least one item");
    setSaving(true);
    const invoice_no = genDocNo("INV");
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        invoice_no,
        customer_id: customerId,
        invoice_date: invoiceDate,
        subtotal: totals.subtotal,
        discount: totals.discount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        total: totals.total,
        balance: totals.total,
        notes: notes || null,
      })
      .select()
      .single();

    if (!error && inv) {
      const itemRows = lines.map((l) => {
        const taxable = l.quantity * l.rate - l.discount;
        const tax = (taxable * l.gst_rate) / 100;
        return {
          invoice_id: inv.id,
          product_id: l.product_id,
          product_name: l.product_name,
          hsn: l.hsn || null,
          quantity: l.quantity,
          rate: l.rate,
          discount: l.discount,
          gst_rate: l.gst_rate,
          taxable,
          tax_amount: tax,
          amount: taxable + tax,
        };
      });
      await supabase.from("invoice_items").insert(itemRows);

      for (const l of lines) {
        const p = (products ?? []).find((x) => x.id === l.product_id);
        if (p) {
          await supabase
            .from("products")
            .update({ current_stock: Number(p.current_stock) - l.quantity })
            .eq("id", l.product_id);
          await supabase.from("inventory_movements").insert({
            product_id: l.product_id,
            movement_type: "out",
            quantity: l.quantity,
            ref_type: "invoice",
            ref_id: inv.id,
            note: `Invoice ${invoice_no}`,
          });
        }
      }

      if (selectedCustomer) {
        await supabase
          .from("customers")
          .update({ outstanding: Number(selectedCustomer.outstanding) + totals.total })
          .eq("id", customerId);
      }

      await supabase.from("deliveries").insert({ invoice_id: inv.id, status: "pending" });
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice created");
    nav({ to: "/invoices/$id", params: { id: inv!.id } });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Generate Invoice"
        description="Create a GST-compliant invoice. Stock, ledger and delivery update automatically."
        actions={
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => nav({ to: "/invoices" })}>
            <ArrowLeft className="size-4" /> Back
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 lg:gap-6 pb-32 lg:pb-6">
        <div className="space-y-4">
          {/* Customer + Date */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="size-4 text-primary" />
              <h3 className="font-semibold text-sm">Bill to</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose a retail shop" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customers ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex flex-col text-left">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.shop_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {selectedCustomer && (
              <div className="mt-3 p-3 rounded-lg bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                {selectedCustomer.gstin && (
                  <div>
                    <span className="text-muted-foreground">GSTIN: </span>
                    <span className="font-mono font-medium">{selectedCustomer.gstin}</span>
                  </div>
                )}
                {selectedCustomer.phone && (
                  <div>
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="font-medium">{selectedCustomer.phone}</span>
                  </div>
                )}
                <div className="ml-auto">
                  <span className="text-muted-foreground">Outstanding: </span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      Number(selectedCustomer.outstanding) > 0 && "text-destructive",
                    )}
                  >
                    {inr(selectedCustomer.outstanding)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Switch checked={interstate} onCheckedChange={setInterstate} id="ist" />
              <Label htmlFor="ist" className="cursor-pointer text-xs">
                Interstate sale (charge IGST)
              </Label>
            </div>
          </Card>

          {/* Product picker */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-primary" />
                <h3 className="font-semibold text-sm">Items</h3>
                {lines.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {lines.length}
                  </Badge>
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search product to add…"
                className="pl-9 h-10"
              />
              {(productQuery || filteredProducts.length > 0) && (
                <div className="mt-2 border rounded-lg divide-y max-h-72 overflow-y-auto bg-card">
                  {filteredProducts.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">No products match.</div>
                  )}
                  {filteredProducts.map((p: any) => {
                    const stock = Number(p.current_stock);
                    const inCart = lines.some((l) => l.product_id === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {p.name}
                            {inCart && <Check className="size-3.5 text-primary shrink-0" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                            <span>{inr(p.selling_price)}</span>
                            <span>·</span>
                            <span>GST {Number(p.gst_rate)}%</span>
                            {p.hsn && (
                              <>
                                <span>·</span>
                                <span>HSN {p.hsn}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={stock > 0 ? "outline" : "destructive"}
                          className="text-[10px] font-mono shrink-0"
                        >
                          Stock: {num(stock, 0)}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Line items — cards on mobile, table on desktop */}
            {lines.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="lg:hidden space-y-3">
                  {lines.map((l, i) => {
                    const taxable = l.quantity * l.rate - l.discount;
                    const amount = taxable + (taxable * l.gst_rate) / 100;
                    return (
                      <div key={i} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{l.product_name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {l.hsn && `HSN ${l.hsn} · `}GST {l.gst_rate}%
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() => rmLine(i)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border rounded-lg">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-r-none"
                              onClick={() =>
                                updateLine(i, { quantity: Math.max(0, l.quantity - 1) })
                              }
                            >
                              <Minus className="size-3" />
                            </Button>
                            <Input
                              type="number"
                              value={l.quantity}
                              onChange={(e) =>
                                updateLine(i, { quantity: Number(e.target.value) })
                              }
                              className="h-8 w-14 border-0 text-center px-1 focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-l-none"
                              onClick={() => updateLine(i, { quantity: l.quantity + 1 })}
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            type="number"
                            value={l.rate}
                            onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                            className="h-8 flex-1 text-right"
                          />
                          <div className="text-sm font-mono font-semibold w-24 text-right">
                            {inr(amount)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Label className="text-muted-foreground">Discount</Label>
                          <Input
                            type="number"
                            value={l.discount}
                            onChange={(e) => updateLine(i, { discount: Number(e.target.value) })}
                            className="h-7 max-w-24 text-right"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left px-3 py-2 font-semibold">Product</th>
                        <th className="text-center px-3 py-2 font-semibold w-32">Qty</th>
                        <th className="text-right px-3 py-2 font-semibold w-24">Rate</th>
                        <th className="text-right px-3 py-2 font-semibold w-24">Discount</th>
                        <th className="text-right px-3 py-2 font-semibold w-16">GST%</th>
                        <th className="text-right px-3 py-2 font-semibold w-28">Amount</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lines.map((l, i) => {
                        const taxable = l.quantity * l.rate - l.discount;
                        const amount = taxable + (taxable * l.gst_rate) / 100;
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-sm">{l.product_name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {l.hsn && `HSN ${l.hsn}`}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center border rounded-md mx-auto w-fit">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 rounded-r-none"
                                  onClick={() =>
                                    updateLine(i, { quantity: Math.max(0, l.quantity - 1) })
                                  }
                                >
                                  <Minus className="size-3" />
                                </Button>
                                <Input
                                  type="number"
                                  value={l.quantity}
                                  onChange={(e) =>
                                    updateLine(i, { quantity: Number(e.target.value) })
                                  }
                                  className="h-7 w-12 border-0 text-center px-1 focus-visible:ring-0"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 rounded-l-none"
                                  onClick={() => updateLine(i, { quantity: l.quantity + 1 })}
                                >
                                  <Plus className="size-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={l.rate}
                                onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={l.discount}
                                onChange={(e) =>
                                  updateLine(i, { discount: Number(e.target.value) })
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={l.gst_rate}
                                onChange={(e) =>
                                  updateLine(i, { gst_rate: Number(e.target.value) })
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">
                              {inr(amount)}
                            </td>
                            <td className="px-3 py-2">
                              <Button variant="ghost" size="icon" onClick={() => rmLine(i)}>
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {lines.length === 0 && (
              <div className="mt-4 text-center py-8 border-2 border-dashed rounded-lg text-sm text-muted-foreground">
                Search above to add products to this invoice.
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-4 sm:p-5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notes / Terms
            </Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, delivery notes, etc."
              className="mt-2"
            />
          </Card>
        </div>

        {/* Summary — desktop sticky, mobile fixed footer */}
        <div className="hidden lg:block">
          <Card className="p-5 sticky top-20 space-y-3">
            <h3 className="font-semibold text-sm">Summary</h3>
            <Separator />
            <SummaryRows totals={totals} interstate={interstate} />
            <Button className="w-full h-11" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save invoice"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => nav({ to: "/invoices" })}>
              Cancel
            </Button>
          </Card>
        </div>
      </div>

      {/* Mobile sticky footer */}
      <div className="lg:hidden fixed bottom-16 inset-x-0 z-20 bg-background/95 backdrop-blur border-t p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grand total</div>
            <div className="text-xl font-semibold font-mono">{inr(totals.total)}</div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>
              {lines.length} item{lines.length !== 1 && "s"}
            </div>
            <div>Tax {inr(totals.tax)}</div>
          </div>
        </div>
        <Button className="w-full h-11" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save invoice"}
        </Button>
      </div>
    </PageContainer>
  );
}

function SummaryRows({
  totals,
  interstate,
}: {
  totals: {
    subtotal: number;
    discount: number;
    cgst: number;
    sgst: number;
    igst: number;
    tax: number;
    total: number;
  };
  interstate: boolean;
}) {
  return (
    <div className="space-y-2 text-sm">
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
      <Separator />
      <div className="flex justify-between items-center pt-1">
        <span className="font-semibold">Grand Total</span>
        <span className="text-2xl font-semibold font-mono">{inr(totals.total)}</span>
      </div>
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
