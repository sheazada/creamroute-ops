import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inr, num, isoDate, shortDate, genDocNo } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Wallet,
  XCircle,
  Zap,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders/new")({
  component: NewOrder,
});

type Customer = {
  id: string;
  name: string;
  shop_name: string | null;
  mobile: string | null;
  address: string | null;
  outstanding: number;
  credit_limit: number;
  ordering_mode: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  selling_price: number;
  mrp: number;
  current_stock: number;
  status: string;
};

type Line = {
  id: string;
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
};

type LastOrder = {
  id: string;
  order_no: string;
  order_date: string;
  total: number;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    rate: number;
  }[];
};

function NewOrder() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [orderDate, setOrderDate] = useState(isoDate());
  const [source, setSource] = useState<"admin" | "salesperson" | "retailer">("admin");
  const [saving, setSaving] = useState(false);
  const [showRepeatDialog, setShowRepeatDialog] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .order("name");
      return (data ?? []) as Product[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-for-order"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("status", "active")
        .order("name");
      return (data ?? []) as Customer[];
    },
  });

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    const q = customerQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.shop_name ?? "").toLowerCase().includes(q) ||
        (c.mobile ?? "").includes(q)
    );
  }, [customers, customerQuery]);

  // Fetch last order for this customer
  const { data: lastOrder } = useQuery({
    queryKey: ["last-order", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return null;
      const { data } = await supabase
        .from("orders")
        .select("id, order_no, order_date, total, items:order_items(product_id, product_name, quantity, rate)")
        .eq("customer_id", selectedCustomer.id)
        .neq("status", "cancelled")
        .order("order_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data ?? null) as LastOrder | null;
    },
    enabled: !!selectedCustomer,
  });

  // Totals
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.amount, 0), [lines]);
  const totalItems = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  // Credit analysis
  const creditInfo = useMemo(() => {
    if (!selectedCustomer) return null;
    const outstanding = Number(selectedCustomer.outstanding);
    const creditLimit = Number(selectedCustomer.credit_limit);
    const projectedOutstanding = outstanding + subtotal;
    const availableCredit = creditLimit - outstanding;
    const willExceed = creditLimit > 0 && projectedOutstanding > creditLimit;
    const utilizationPct = creditLimit > 0 ? (projectedOutstanding / creditLimit) * 100 : 0;
    return { outstanding, creditLimit, projectedOutstanding, availableCredit, willExceed, utilizationPct };
  }, [selectedCustomer, subtotal]);

  // Select customer
  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setSearchOpen(false);
    setCustomerQuery("");
    setLines([]);
    setTimeout(() => productInputRef.current?.focus(), 100);
  };

  // Add product line
  const addProduct = (product: Product, qty: number = 1) => {
    const existing = lines.find((l) => l.product_id === product.id);
    if (existing) {
      setLines(lines.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + qty } : l)));
    } else {
      setLines([
        ...lines,
        {
          id: crypto.randomUUID(),
          product_id: product.id,
          product_name: product.name,
          unit: product.unit,
          quantity: qty,
          rate: Number(product.selling_price),
          amount: qty * Number(product.selling_price),
        },
      ]);
    }
  };

  // Update line
  const updateLine = (id: string, field: string, value: string | number) => {
    setLines(
      lines.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        updated.amount = updated.quantity * updated.rate;
        return updated;
      })
    );
  };

  // Remove line
  const removeLine = (id: string) => setLines(lines.filter((l) => l.id !== id));

  // Copy last order
  const copyLastOrder = () => {
    if (!lastOrder?.items) return;
    const newLines: Line[] = lastOrder.items.map((item) => ({
      id: crypto.randomUUID(),
      product_id: item.product_id,
      product_name: item.product_name,
      unit: products.find((p) => p.id === item.product_id)?.unit ?? "pcs",
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
    }));
    setLines(newLines);
    setShowRepeatDialog(false);
    toast.success(`Copied ${newLines.length} items from ${lastOrder.order_no}`);
  };

  // Save order
  const save = async () => {
    if (!selectedCustomer) return toast.error("Select a customer");
    if (lines.length === 0) return toast.error("Add at least one item");
    if (creditInfo?.willExceed) {
      const ok = confirm(
        `This order will exceed the credit limit by ${inr(subtotal - creditInfo.availableCredit)}.\n\nProceed anyway?`
      );
      if (!ok) return;
    }

    setSaving(true);
    const orderNo = genDocNo("ORD");

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_no: orderNo,
        customer_id: selectedCustomer.id,
        order_date: orderDate,
        subtotal,
        total: subtotal,
        status: "pending",
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Insert order items
    const { error: itemErr } = await supabase.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        product_name: l.product_name,
        quantity: l.quantity,
        rate: l.rate,
        amount: l.amount,
      }))
    );

    setSaving(false);

    if (itemErr) {
      toast.error("Order created but items failed: " + itemErr.message);
    } else {
      toast.success(`Order ${orderNo} created for ${selectedCustomer.shop_name ?? selectedCustomer.name}`);
    }

    qc.invalidateQueries({ queryKey: ["orders"] });
    nav({ to: "/orders" });
  };

  const canSave = selectedCustomer && lines.length > 0 && !saving;

  return (
    <PageContainer>
      <PageHeader
        title="New Order"
        description={selectedCustomer ? `Order for ${selectedCustomer.shop_name ?? selectedCustomer.name}` : "Select a customer to start"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => nav({ to: "/orders" })} className="gap-1.5">
              <ChevronLeft className="size-4" /> Back
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        {/* LEFT: Order items */}
        <div className="space-y-4">
          {/* Customer selector */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</Label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center font-bold shrink-0">
                      {(selectedCustomer.shop_name ?? selectedCustomer.name)?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{selectedCustomer.shop_name ?? selectedCustomer.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {selectedCustomer.name}
                        {selectedCustomer.mobile && <> · {selectedCustomer.mobile}</>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)} className="text-xs">
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setSearchOpen(true)} className="w-full mt-1 justify-start gap-2">
                    <User className="size-4" /> Select customer…
                  </Button>
                )}
              </div>
            </div>

            {selectedCustomer && creditInfo && (
              <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
                  <div className={cn("font-mono font-semibold", creditInfo.outstanding > 0 ? "text-destructive" : "text-success")}>
                    {inr(creditInfo.outstanding)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credit Limit</div>
                  <div className="font-mono font-semibold">{inr(creditInfo.creditLimit)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Available</div>
                  <div className={cn("font-mono font-semibold", creditInfo.availableCredit < 0 ? "text-destructive" : "text-success")}>
                    {inr(creditInfo.availableCredit)}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Quick actions */}
          {selectedCustomer && lines.length === 0 && lastOrder && (
            <Card className="p-3 flex items-center gap-3 bg-primary/5 border-primary/20">
              <Zap className="size-4 text-primary shrink-0" />
              <div className="text-sm flex-1">
                <b>{lastOrder.items.length} items</b> in last order ({shortDate(lastOrder.order_date)}) — {inr(lastOrder.total)}
              </div>
              <Button size="sm" onClick={() => setShowRepeatDialog(true)} className="gap-1.5">
                <Copy className="size-4" /> Repeat order
              </Button>
            </Card>
          )}

          {/* Product search + lines */}
          <Card className="p-0 overflow-hidden">
            <div className="p-3 border-b flex flex-wrap items-center gap-2">
              <ProductSearchButton
                products={products}
                onAdd={addProduct}
                disabled={!selectedCustomer}
                inputRef={productInputRef}
              />
              <div className="flex-1" />
              <div className="text-xs text-muted-foreground">
                {lines.length} items · {num(totalItems, 1)} units
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <ShoppingCart className="size-10 mx-auto mb-3 opacity-50" />
                <div className="text-sm font-semibold">No items yet</div>
                <div className="text-xs mt-1">
                  {selectedCustomer ? "Search and add products above." : "Select a customer first."}
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {lines.map((line, idx) => (
                  <div key={line.id} className="p-3 flex items-center gap-3 hover:bg-muted/30 group">
                    <div className="size-8 rounded-full bg-muted grid place-items-center text-xs font-bold shrink-0 text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{line.product_name}</div>
                      <div className="text-xs text-muted-foreground">{line.unit} · {inr(line.rate)}/unit</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => updateLine(line.id, "quantity", Math.max(0, line.quantity - 1))}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="h-8 w-16 text-center font-mono"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", Math.max(0, Number(e.target.value) || 0))}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => updateLine(line.id, "quantity", line.quantity + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    <div className="w-24 text-right">
                      <div className="font-mono font-semibold text-sm">{inr(line.amount)}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => removeLine(line.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          {selectedCustomer && (
            <Card className="p-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions, delivery time, etc."
                rows={2}
                className="mt-1"
              />
            </Card>
          )}
        </div>

        {/* RIGHT: Summary + checkout */}
        <div className="space-y-4">
          <Card className="p-4 sticky top-20">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Order Summary</div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Items</span>
                <span className="font-mono">{lines.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total units</span>
                <span className="font-mono">{num(totalItems, 1)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Order date</span>
                <span className="font-mono text-xs">{shortDate(orderDate)}</span>
              </div>

              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="font-mono">{inr(subtotal)}</span>
                </div>
              </div>
            </div>

            {/* Credit warning */}
            {creditInfo?.willExceed && (
              <div className="mb-3 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-destructive">Exceeds credit limit</div>
                  <div className="text-destructive/80 mt-0.5">
                    By {inr(subtotal - creditInfo.availableCredit)} · Available: {inr(creditInfo.availableCredit)}
                  </div>
                </div>
              </div>
            )}

            {creditInfo && !creditInfo.willExceed && creditInfo.creditLimit > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Credit utilization</span>
                  <span className="font-mono">{creditInfo.utilizationPct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      creditInfo.utilizationPct > 80 ? "bg-destructive" : creditInfo.utilizationPct > 60 ? "bg-warning" : "bg-success"
                    )}
                    style={{ width: `${Math.min(100, creditInfo.utilizationPct)}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={save}
              disabled={!canSave}
              className="w-full gap-2 py-5 text-base"
            >
              {saving ? (
                <>
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating order…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5" />
                  Create Order · {inr(subtotal)}
                </>
              )}
            </Button>

            {lines.length > 0 && (
              <Button variant="ghost" onClick={() => setLines([])} className="w-full mt-2 text-xs">
                Clear all items
              </Button>
            )}
          </Card>
        </div>
      </div>

      {/* Customer search dialog */}
      <Dialog open={searchOpen} onOpenChange={(v) => { setSearchOpen(v); if (!v) setCustomerQuery(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, shop, or mobile…"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto -mx-1">
            {filteredCustomers.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No customers found.</div>
            )}
            {filteredCustomers.map((c) => {
              const overLimit = Number(c.credit_limit) > 0 && Number(c.outstanding) > Number(c.credit_limit);
              return (
                <button
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted rounded-md transition-colors flex items-center gap-3",
                    selectedCustomer?.id === c.id && "bg-primary/10"
                  )}
                >
                  <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center font-bold shrink-0">
                    {(c.shop_name ?? c.name)?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.shop_name ?? c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.name}
                      {c.mobile && <> · {c.mobile}</>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn("font-mono font-semibold text-sm", Number(c.outstanding) > 0 ? "text-destructive" : "text-success")}>
                      {inr(c.outstanding)}
                    </div>
                    {overLimit && (
                      <div className="text-[10px] text-destructive flex items-center gap-1 justify-end">
                        <AlertTriangle className="size-3" /> Over limit
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Repeat order dialog */}
      <Dialog open={showRepeatDialog} onOpenChange={setShowRepeatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repeat Last Order?</DialogTitle>
          </DialogHeader>
          {lastOrder && (
            <div>
              <div className="text-sm text-muted-foreground mb-3">
                This will copy all {lastOrder.items.length} items from <b>{lastOrder.order_no}</b> ({shortDate(lastOrder.order_date)}) totaling {inr(lastOrder.total)}.
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-md">
                {lastOrder.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border-b last:border-0 text-sm">
                    <span>{it.product_name}</span>
                    <span className="font-mono text-xs">
                      {num(it.quantity, 1)} × {inr(it.rate)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowRepeatDialog(false)}>Cancel</Button>
                <Button onClick={copyLastOrder} className="gap-1.5">
                  <Copy className="size-4" /> Copy items
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

/* ═══════════════════════════════════════
   Product Search Button with dropdown
   ═══════════════════════════════════════ */

function ProductSearchButton({
  products,
  onAdd,
  disabled,
  inputRef,
}: {
  products: Product[];
  onAdd: (p: Product, qty?: number) => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products.slice(0, 8);
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
    );
  }, [products, query]);

  const handleAdd = (p: Product) => {
    onAdd(p, 1);
    setQuery("");
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="relative flex-1 min-w-[200px]">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder={disabled ? "Select a customer first…" : "Search products…"}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {open && !disabled && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No products found.</div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => handleAdd(p)}
                className="w-full text-left p-2.5 hover:bg-muted flex items-center gap-3 border-b last:border-0"
              >
                <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Package className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.category ?? "—"} · {p.unit} · Stock: {num(p.current_stock, 1)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-semibold text-sm">{inr(p.selling_price)}</div>
                  {Number(p.mrp) > 0 && <div className="text-[10px] text-muted-foreground">MRP {inr(p.mrp)}</div>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
