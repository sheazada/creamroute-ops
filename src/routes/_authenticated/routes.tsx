import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, num, isoDate, shortDate, genDocNo } from "@/lib/format";
import { ArrowDown, ArrowUp, Camera, CheckCircle2, Download, MapPin, Plus, Printer, Route as RouteIcon, Trash2, Truck, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/routes")({
  component: RoutePlanning,
});

type RouteRow = {
  id: string;
  name: string;
  area: string | null;
  driver_name: string | null;
  helper_name: string | null;
  active: boolean;
  notes: string | null;
  capacity_units: number | null;
  capacity_label: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
};

type DeliveryRun = {
  id: string;
  route_id: string;
  run_date: string;
  driver_name: string | null;
  helper_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  notes: string | null;
};


type Stop = {
  id: string;
  route_id: string;
  customer_id: string;
  sequence: number;
  customer: {
    id: string;
    name: string;
    shop_name: string | null;
    address: string | null;
    mobile: string | null;
    outstanding: number;
  } | null;
};

function RoutePlanning() {
  const [tab, setTab] = useState<"plan" | "sheet">("plan");
  const [date, setDate] = useState(isoDate());

  return (
    <PageContainer>
      <PageHeader
        title="Route Planning"
        description="Group shops into delivery routes and generate daily driver sheets"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "plan" | "sheet")}>
        <TabsList>
          <TabsTrigger value="plan"><MapPin className="size-4" /> Plan Routes</TabsTrigger>
          <TabsTrigger value="sheet"><Truck className="size-4" /> Daily Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4">
          <PlanTab />
        </TabsContent>

        <TabsContent value="sheet" className="mt-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="sheet-date">Date</Label>
              <Input id="sheet-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
              <Printer className="size-4" /> Print all
            </Button>
          </div>
          <SheetTab date={date} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/* ---------------- Plan tab ---------------- */

function PlanTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: routes } = useQuery({
    queryKey: ["routes"],
    queryFn: async (): Promise<RouteRow[]> => {
      const { data, error } = await supabase.from("routes").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeId = selectedId ?? routes?.[0]?.id ?? null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["routes"] });

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Routes list */}
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Routes</div>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="gap-1"><Plus className="size-3.5" /> New</Button>
        </div>
        <div className="space-y-1">
          {(routes ?? []).length === 0 && (
            <div className="text-xs text-muted-foreground px-2 py-6 text-center">No routes yet.</div>
          )}
          {(routes ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
                activeId === r.id ? "bg-secondary font-medium" : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{r.name}</span>
                {!r.active && <Badge variant="outline" className="text-[10px]">off</Badge>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{r.area || "—"}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {r.driver_name ? `🚛 ${r.driver_name}` : "no driver"}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Detail */}
      <div>
        {activeId ? (
          <RouteDetail routeId={activeId} route={routes?.find((r) => r.id === activeId) ?? null} onEdit={setEditing} />
        ) : (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Create your first route to start assigning shops.
          </Card>
        )}
      </div>

      <RouteFormDialog
        open={creating || !!editing}
        route={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={(id) => { invalidate(); if (id) setSelectedId(id); }}
      />
    </div>
  );
}

function RouteDetail({ routeId, route, onEdit }: { routeId: string; route: RouteRow | null; onEdit: (r: RouteRow) => void }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: stops } = useQuery({
    queryKey: ["route-stops", routeId],
    queryFn: async (): Promise<Stop[]> => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("id, route_id, customer_id, sequence, customer:customers(id, name, shop_name, address, mobile, outstanding)")
        .eq("route_id", routeId)
        .order("sequence");
      if (error) throw error;
      return (data ?? []) as unknown as Stop[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["route-stops", routeId] });

  const move = async (id: string, dir: -1 | 1) => {
    const list = stops ?? [];
    const idx = list.findIndex((s) => s.id === id);
    const swap = list[idx + dir];
    if (!swap) return;
    const a = list[idx];
    await Promise.all([
      supabase.from("route_stops").update({ sequence: swap.sequence }).eq("id", a.id),
      supabase.from("route_stops").update({ sequence: a.sequence }).eq("id", swap.id),
    ]);
    invalidate();
  };

  const remove = async (id: string) => {
    await supabase.from("route_stops").delete().eq("id", id);
    invalidate();
    toast.success("Stop removed");
  };

  const total = stops?.length ?? 0;
  const outstanding = (stops ?? []).reduce((s, x) => s + Number(x.customer?.outstanding ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold flex items-center gap-2">
              {route?.name}
              {route && !route.active && <Badge variant="outline">Inactive</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">{route?.area || "No area"}</div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Driver: <b className="text-foreground">{route?.driver_name || "—"}</b></span>
              <span>Helper: <b className="text-foreground">{route?.helper_name || "—"}</b></span>
              <span>Stops: <b className="text-foreground">{total}</b></span>
              <span>Capacity: <b className="text-foreground">{route?.capacity_units ? `${num(route.capacity_units, 0)} ${route.capacity_label || ""}` : "—"}</b></span>
              <span>Outstanding: <b className="text-foreground">{inr(outstanding)}</b></span>
            </div>
            {route?.notes && <div className="mt-2 text-xs text-muted-foreground italic">{route.notes}</div>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => route && onEdit(route)}>Edit route</Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1"><UserPlus className="size-4" /> Add stops</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="text-sm font-semibold">Stops in delivery order</div>
          <div className="text-xs text-muted-foreground">Use arrows to reorder</div>
        </div>
        {(stops ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No stops yet. Click "Add stops" to assign shops.</div>
        ) : (
          <ol className="divide-y">
            {(stops ?? []).map((s, i) => (
              <li key={s.id} className="px-5 py-3 flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.customer?.shop_name || s.customer?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.customer?.address || "—"}
                    {s.customer?.mobile ? ` · ${s.customer.mobile}` : ""}
                  </div>
                </div>
                <div className="text-xs text-right shrink-0">
                  <div className="text-muted-foreground">Due</div>
                  <div className="font-mono font-semibold">{inr(s.customer?.outstanding ?? 0)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => move(s.id, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => move(s.id, 1)} disabled={i === (stops?.length ?? 0) - 1} aria-label="Move down"><ArrowDown className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(s.id)} className="text-destructive" aria-label="Remove"><Trash2 className="size-4" /></Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <AddStopsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        routeId={routeId}
        existing={new Set((stops ?? []).map((s) => s.customer_id))}
        nextSeq={(stops ?? []).length}
        onSaved={invalidate}
      />
    </div>
  );
}

function RouteFormDialog({
  open, route, onClose, onSaved,
}: {
  open: boolean; route: RouteRow | null; onClose: () => void; onSaved: (id?: string) => void;
}) {
  const isEdit = !!route;
  const [name, setName] = useState(route?.name ?? "");
  const [area, setArea] = useState(route?.area ?? "");
  const [driver, setDriver] = useState(route?.driver_name ?? "");
  const [helper, setHelper] = useState(route?.helper_name ?? "");
  const [active, setActive] = useState(route?.active ?? true);
  const [notes, setNotes] = useState(route?.notes ?? "");
  const [capacity, setCapacity] = useState<string>(route?.capacity_units != null ? String(route.capacity_units) : "");
  const [capacityLabel, setCapacityLabel] = useState(route?.capacity_label ?? "L");
  const [vehicleNumber, setVehicleNumber] = useState(route?.vehicle_number ?? "");
  const [vehicleType, setVehicleType] = useState(route?.vehicle_type ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(route?.name ?? "");
      setArea(route?.area ?? "");
      setDriver(route?.driver_name ?? "");
      setHelper(route?.helper_name ?? "");
      setActive(route?.active ?? true);
      setNotes(route?.notes ?? "");
      setCapacity(route?.capacity_units != null ? String(route.capacity_units) : "");
      setCapacityLabel(route?.capacity_label ?? "L");
      setVehicleNumber(route?.vehicle_number ?? "");
      setVehicleType(route?.vehicle_type ?? "");
    }
  }, [open, route]);

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload = {
      name: name.trim(), area: area || null, driver_name: driver || null, helper_name: helper || null,
      active, notes: notes || null,
      capacity_units: capacity ? Number(capacity) : null,
      capacity_label: capacityLabel || null,
      vehicle_number: vehicleNumber || null,
      vehicle_type: vehicleType || null,
    };

    if (isEdit && route) {
      const { error } = await supabase.from("routes").update(payload).eq("id", route.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      onSaved(route.id);
    } else {
      const { data, error } = await supabase.from("routes").insert(payload).select().single();
      setSaving(false);
      if (error) return toast.error(error.message);
      onSaved(data?.id);
    }
    toast.success(isEdit ? "Route updated" : "Route created");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Edit route" : "New route"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Barari South" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Area</Label><Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Barari" /></div>
            <div><Label>Status</Label>
              <Select value={active ? "1" : "0"} onValueChange={(v) => setActive(v === "1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Active</SelectItem>
                  <SelectItem value="0">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Driver</Label><Input value={driver} onChange={(e) => setDriver(e.target.value)} /></div>
            <div><Label>Helper</Label><Input value={helper} onChange={(e) => setHelper(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Vehicle capacity</Label><Input type="number" inputMode="decimal" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 400" /></div>
            <div><Label>Unit</Label><Input value={capacityLabel} onChange={(e) => setCapacityLabel(e.target.value)} placeholder="L / crates / kg" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Vehicle number</Label><Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} placeholder="e.g. BR10AB1234" /></div>
            <div><Label>Vehicle type</Label>
              <Select value={vehicleType || "none"} onValueChange={(v) => setVehicleType(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="bike">Bike</SelectItem>
                  <SelectItem value="auto">Auto / Rickshaw</SelectItem>
                  <SelectItem value="tempo">Tempo</SelectItem>
                  <SelectItem value="mini_truck">Mini truck</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="van">Refrigerated van</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Landmarks, timing…" /></div>

        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStopsDialog({
  open, onClose, routeId, existing, nextSeq, onSaved,
}: {
  open: boolean; onClose: () => void; routeId: string; existing: Set<string>; nextSeq: number; onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers-picker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers").select("id, name, shop_name, address, outstanding")
        .eq("status", "active").order("name");
      return data ?? [];
    },
    enabled: open,
  });

  useMemo(() => { if (open) { setPicked(new Set()); setQ(""); } }, [open]);

  const filtered = (customers ?? []).filter((c: any) => {
    if (existing.has(c.id)) return false;
    const s = (q || "").toLowerCase();
    if (!s) return true;
    return (c.name?.toLowerCase().includes(s) || c.shop_name?.toLowerCase().includes(s) || c.address?.toLowerCase().includes(s));
  });

  const toggle = (id: string) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };

  const save = async () => {
    if (picked.size === 0) return onClose();
    setSaving(true);
    const rows = Array.from(picked).map((cid, i) => ({
      route_id: routeId, customer_id: cid, sequence: nextSeq + i + 1,
    }));
    const { error } = await supabase.from("route_stops").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${picked.size} shop${picked.size === 1 ? "" : "s"}`);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add shops to route</DialogTitle></DialogHeader>
        <Input placeholder="Search shops…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-80 overflow-auto border rounded-lg divide-y">
          {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No matching shops.</div>}
          {filtered.map((c: any) => (
            <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer">
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="size-4" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.shop_name || c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.address || "—"}</div>
              </div>
              <div className="text-xs font-mono">{inr(c.outstanding)}</div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <div className="flex-1 text-xs text-muted-foreground">{picked.size} selected</div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Sheet tab ---------------- */

type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  total: number;
  balance: number;
  customer_id: string;
  customer: { id: string; name: string; shop_name: string | null; address: string | null; mobile: string | null; outstanding: number } | null;
  items: { product_name: string; quantity: number; rate: number; amount: number }[];
};

function SheetTab({ date }: { date: string }) {
  const { data: routes } = useQuery({
    queryKey: ["routes-active"],
    queryFn: async () => {
      const { data } = await supabase.from("routes").select("*").eq("active", true).order("name");
      return (data ?? []) as RouteRow[];
    },
  });

  const { data: stops } = useQuery({
    queryKey: ["all-route-stops"],
    queryFn: async () => {
      const { data } = await supabase.from("route_stops").select("route_id, customer_id, sequence").order("sequence");
      return data ?? [];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices-for-sheet", date],
    queryFn: async (): Promise<InvoiceRow[]> => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_no, invoice_date, total, balance, customer_id, customer:customers(id, name, shop_name, address, mobile, outstanding), items:invoice_items(product_name, quantity, rate, amount)")
        .eq("invoice_date", date)
        .neq("status", "void");
      return (data ?? []) as unknown as InvoiceRow[];
    },
  });

  const custToRoute = useMemo(() => {
    const m = new Map<string, { route_id: string; sequence: number }>();
    (stops ?? []).forEach((s: any) => {
      const prev = m.get(s.customer_id);
      if (!prev || prev.sequence > s.sequence) m.set(s.customer_id, { route_id: s.route_id, sequence: s.sequence });
    });
    return m;
  }, [stops]);

  const grouped = useMemo(() => {
    const byRoute = new Map<string, InvoiceRow[]>();
    const unassigned: InvoiceRow[] = [];
    (invoices ?? []).forEach((inv) => {
      const link = custToRoute.get(inv.customer_id);
      if (!link) unassigned.push(inv);
      else {
        const arr = byRoute.get(link.route_id) ?? [];
        arr.push(inv);
        byRoute.set(link.route_id, arr);
      }
    });
    // sort each route by stop sequence
    for (const [rid, arr] of byRoute) {
      arr.sort((a, b) => (custToRoute.get(a.customer_id)?.sequence ?? 0) - (custToRoute.get(b.customer_id)?.sequence ?? 0));
      byRoute.set(rid, arr);
    }
    return { byRoute, unassigned };
  }, [invoices, custToRoute]);

  if (!invoices) return <Card className="p-10 text-center text-sm text-muted-foreground">Loading…</Card>;
  if (invoices.length === 0)
    return <Card className="p-10 text-center text-sm text-muted-foreground">No invoices for {shortDate(date)}.</Card>;

  return (
    <div className="space-y-4">
      {(routes ?? []).map((r) => {
        const list = grouped.byRoute.get(r.id) ?? [];
        if (list.length === 0) return null;
        return <RouteSheet key={r.id} route={r} invoices={list} date={date} />;
      })}
      {grouped.unassigned.length > 0 && (
        <RouteSheet
          key="unassigned"
          route={{ id: "u", name: "Unassigned shops", area: null, driver_name: null, helper_name: null, active: true, notes: "Shops not yet on any route", capacity_units: null, capacity_label: null, vehicle_number: null, vehicle_type: null }}
          invoices={grouped.unassigned}
          date={date}
        />
      )}
    </div>
  );
}

type DeliveryRow = {
  id: string;
  invoice_id: string;
  status: string;
  delivered_at: string | null;
  received_by: string | null;
  pod_photo_url: string | null;
  pod_signature: string | null;
  collected_amount: number | null;
  collected_mode: string | null;
  route_id: string | null;
};

function RouteSheet({ route, invoices, date }: { route: RouteRow; invoices: InvoiceRow[]; date: string }) {
  const qc = useQueryClient();
  const [podFor, setPodFor] = useState<{ inv: InvoiceRow; delivery: DeliveryRow | null } | null>(null);

  const invoiceIds = invoices.map((i) => i.id);
  const { data: deliveries } = useQuery({
    queryKey: ["deliveries-for-sheet", date, invoiceIds.join(",")],
    enabled: invoiceIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, invoice_id, status, delivered_at, received_by, pod_photo_url, pod_signature, collected_amount, collected_mode, route_id")
        .in("invoice_id", invoiceIds);
      return (data ?? []) as DeliveryRow[];
    },
  });
  const dByInv = useMemo(() => {
    const m = new Map<string, DeliveryRow>();
    (deliveries ?? []).forEach((d) => m.set(d.invoice_id, d));
    return m;
  }, [deliveries]);

  const pickup = useMemo(() => {
    const m = new Map<string, number>();
    invoices.forEach((inv) => inv.items?.forEach((it) => {
      m.set(it.product_name, (m.get(it.product_name) ?? 0) + Number(it.quantity));
    }));
    return Array.from(m, ([product, qty]) => ({ product, qty })).sort((a, b) => b.qty - a.qty);
  }, [invoices]);

  const totalValue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalDue = invoices.reduce((s, i) => s + Number(i.balance), 0);
  const load = pickup.reduce((s, p) => s + p.qty, 0);
  const cap = Number(route.capacity_units || 0);
  const pct = cap > 0 ? Math.min(100, (load / cap) * 100) : 0;
  const over = cap > 0 && load > cap;

  const doneCount = invoices.filter((i) => dByInv.get(i.id)?.status === "delivered").length;

  const setStatus = async (delId: string | undefined, invId: string, status: string) => {
    if (!delId) return;
    const patch: any = { status, route_id: route.id === "u" ? null : route.id };
    if (status === "delivered") patch.delivered_at = new Date().toISOString();
    if (status !== "delivered") patch.delivered_at = null;
    const { error } = await supabase.from("deliveries").update(patch).eq("id", delId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["deliveries-for-sheet", date, invoiceIds.join(",")] });
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  const assignAll = async () => {
    if (route.id === "u") return;
    const ids = (deliveries ?? []).filter((d) => d.route_id !== route.id).map((d) => d.id);
    if (ids.length === 0) return toast.info("All stops already on this route");
    const { error } = await supabase.from("deliveries").update({ route_id: route.id }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Linked ${ids.length} delivery${ids.length === 1 ? "" : "ies"} to ${route.name}`);
    qc.invalidateQueries({ queryKey: ["deliveries-for-sheet", date, invoiceIds.join(",")] });
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  const sheetDomId = `route-sheet-${route.id}`;
  const printThis = () => {
    document.body.classList.add("print-single");
    const el = document.getElementById(sheetDomId);
    el?.classList.add("print-target");
    const cleanup = () => {
      document.body.classList.remove("print-single");
      el?.classList.remove("print-target");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 50);
  };
  const exportCsv = () => {
    const rows: string[][] = [];
    rows.push([`Delivery Sheet - ${route.name}`]);
    rows.push([`Date`, shortDate(date)]);
    if (route.area) rows.push([`Area`, route.area]);
    if (route.driver_name) rows.push([`Driver`, route.driver_name]);
    if (route.helper_name) rows.push([`Helper`, route.helper_name]);
    if (route.capacity_units) rows.push([`Capacity`, `${route.capacity_units} ${route.capacity_label || ""}`]);
    rows.push([]);
    rows.push(["Pickup summary"]);
    rows.push(["Product", "Quantity"]);
    pickup.forEach((p) => rows.push([p.product, String(p.qty)]));
    rows.push([]);
    rows.push(["Stops"]);
    rows.push(["#", "Shop", "Address", "Mobile", "Invoice", "Item", "Qty", "Rate", "Amount", "Invoice Total", "Collect"]);
    invoices.forEach((inv, i) => {
      const shop = inv.customer?.shop_name || inv.customer?.name || "";
      const addr = inv.customer?.address || "";
      const mob = inv.customer?.mobile || "";
      const items = inv.items ?? [];
      if (items.length === 0) {
        rows.push([String(i + 1), shop, addr, mob, inv.invoice_no, "", "", "", "", String(inv.total), String(inv.balance)]);
      } else {
        items.forEach((it, k) => rows.push([
          k === 0 ? String(i + 1) : "",
          k === 0 ? shop : "",
          k === 0 ? addr : "",
          k === 0 ? mob : "",
          k === 0 ? inv.invoice_no : "",
          it.product_name,
          String(it.quantity),
          String(it.rate),
          String(it.amount),
          k === 0 ? String(inv.total) : "",
          k === 0 ? String(inv.balance) : "",
        ]));
      }
    });
    rows.push([]);
    rows.push(["", "", "", "", "", "", "", "", "TOTAL", String(totalValue), String(totalDue)]);
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-${route.name.replace(/\s+/g, "-").toLowerCase()}-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <Card id={sheetDomId} className="route-sheet overflow-hidden print:break-inside-avoid print:mb-6">
      <div className="px-5 py-3 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <RouteIcon className="size-4 text-primary" /> {route.name}
            {route.area && <span className="text-xs text-muted-foreground font-normal">· {route.area}</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {shortDate(date)} · {invoices.length} stop{invoices.length === 1 ? "" : "s"} · {doneCount} delivered
            {route.driver_name ? ` · Driver: ${route.driver_name}` : ""}
            {route.helper_name ? ` · Helper: ${route.helper_name}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div>Value <span className="font-mono font-semibold">{inr(totalValue)}</span></div>
          <div>Collect <span className="font-mono font-semibold text-destructive">{inr(totalDue)}</span></div>
          <Button size="sm" variant="outline" onClick={printThis} className="no-print gap-1.5"><Printer className="size-3.5" /> Print</Button>
          <Button size="sm" variant="outline" onClick={exportCsv} className="no-print gap-1.5"><Download className="size-3.5" /> CSV</Button>
          {route.id !== "u" && (
            <Button size="sm" variant="outline" onClick={assignAll} className="no-print">Assign to route</Button>
          )}
        </div>
      </div>


      {/* Pickup summary + capacity bar */}
      <div className="px-5 py-3 border-b space-y-3">
        {cap > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold uppercase tracking-wider text-muted-foreground">Load vs capacity</span>
              <span className={`font-mono ${over ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {num(load, 1)} / {num(cap, 0)} {route.capacity_label || ""}
                {over && ` · OVER by ${num(load - cap, 1)}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pickup for this route</div>
          <div className="flex flex-wrap gap-2">
            {pickup.map((p) => (
              <div key={p.product} className="text-xs px-2.5 py-1 rounded-md bg-primary/5 border border-primary/10">
                <span className="font-medium">{p.product}</span>
                <span className="ml-2 font-mono font-semibold">{num(p.qty, 2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stops */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left w-10">#</th>
              <th className="px-4 py-2 text-left">Shop</th>
              <th className="px-4 py-2 text-left">Items</th>
              <th className="px-4 py-2 text-right">Value</th>
              <th className="px-4 py-2 text-right">Collect</th>
              <th className="px-4 py-2 text-center w-44 no-print">Status</th>
              <th className="px-4 py-2 text-center w-40 no-print">Delivery entry</th>
              <th className="px-4 py-2 text-center w-20 print:table-cell hidden">Signed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((inv, i) => {
              const d = dByInv.get(inv.id);
              const delivered = d?.status === "delivered";
              return (
                <tr key={inv.id} className={delivered ? "bg-emerald-500/5" : ""}>
                  <td className="px-4 py-3 align-top font-semibold text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium flex items-center gap-1.5">
                      {inv.customer?.shop_name || inv.customer?.name}
                      {delivered && <CheckCircle2 className="size-3.5 text-emerald-600" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{inv.customer?.address || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.customer?.mobile ? `📞 ${inv.customer.mobile} · ` : ""}Inv {inv.invoice_no}
                    </div>
                    {d?.received_by && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                        Received by <b>{d.received_by}</b>
                        {d.collected_amount ? ` · ${inr(d.collected_amount)} ${(d.collected_mode || "").toUpperCase()}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs">
                    {(inv.items ?? []).map((it, k) => (
                      <div key={k} className="flex justify-between gap-3 border-b last:border-0 py-0.5">
                        <span className="truncate">{it.product_name}</span>
                        <span className="font-mono">{num(it.quantity, 2)}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 align-top text-right font-mono">{inr(inv.total)}</td>
                  <td className="px-4 py-3 align-top text-right font-mono font-semibold text-destructive">{inr(inv.balance)}</td>
                  <td className="px-4 py-3 align-top text-center no-print">
                    <Select value={d?.status ?? "planned"} onValueChange={(v) => setStatus(d?.id, inv.id, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="en_route">En Route</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 align-top text-center no-print">
                    <Button size="sm" variant={delivered ? "outline" : "default"} className="gap-1.5 w-full"
                      disabled={!d}
                      onClick={() => setPodFor({ inv, delivery: d ?? null })}>
                      {delivered ? <><Camera className="size-3.5" /> POD</> : <><Wallet className="size-3.5" /> Deliver</>}
                    </Button>
                  </td>
                  <td className="px-4 py-3 align-top text-center hidden print:table-cell">
                    <span className="inline-block w-16 border-b border-dashed h-5" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30 font-semibold">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right">Totals</td>
              <td className="px-4 py-2 text-right font-mono">{inr(totalValue)}</td>
              <td className="px-4 py-2 text-right font-mono text-destructive">{inr(totalDue)}</td>
              <td className="no-print" colSpan={2} />
              <td className="hidden print:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>

      <DeliverStopDialog
        open={!!podFor}
        onClose={() => setPodFor(null)}
        payload={podFor}
        route={route}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["deliveries-for-sheet", date, invoiceIds.join(",")] });
          qc.invalidateQueries({ queryKey: ["deliveries"] });
          qc.invalidateQueries({ queryKey: ["invoices-for-sheet", date] });
          qc.invalidateQueries({ queryKey: ["customers"] });
          setPodFor(null);
        }}
      />
    </Card>
  );
}

/* ---------------- Deliver dialog with POD ---------------- */

function DeliverStopDialog({
  open, onClose, payload, route, onSaved,
}: {
  open: boolean; onClose: () => void;
  payload: { inv: InvoiceRow; delivery: DeliveryRow | null } | null;
  route: RouteRow; onSaved: () => void;
}) {
  const [receivedBy, setReceivedBy] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "upi" | "bank">("cash");
  const [reference, setReference] = useState("");
  const [signature, setSignature] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && payload) {
      setReceivedBy(payload.delivery?.received_by ?? "");
      setAmount("");
      setMode((payload.delivery?.collected_mode as any) ?? "cash");
      setReference("");
      setSignature(payload.delivery?.pod_signature ?? "");
      setFile(null);
    }
  }, [open, payload]);

  if (!payload) return null;
  const { inv, delivery } = payload;
  const bal = Number(inv.balance);

  const save = async () => {
    if (!delivery) return toast.error("No delivery record");
    if (!receivedBy.trim()) return toast.error("Who received it?");
    setSaving(true);
    try {
      let podUrl = delivery.pod_photo_url;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${inv.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("pod").upload(path, file, { upsert: true, contentType: file.type });
        if (up.error) throw up.error;
        podUrl = path;
      }
      const amt = Number(amount || 0);
      if (amt > 0 && inv.customer) {
        const { error: pErr } = await supabase.from("payments").insert({
          payment_no: genDocNo("RCP"),
          customer_id: inv.customer.id,
          invoice_id: inv.id,
          amount: amt,
          mode,
          reference: reference || null,
          notes: `Collected on delivery · route ${route.name}`,
        });
        if (pErr) throw pErr;
      }
      const { error: dErr } = await supabase.from("deliveries").update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        received_by: receivedBy.trim(),
        pod_photo_url: podUrl,
        pod_signature: signature || null,
        collected_amount: amt > 0 ? amt : delivery.collected_amount,
        collected_mode: amt > 0 ? mode : delivery.collected_mode,
        route_id: route.id === "u" ? null : route.id,
      }).eq("id", delivery.id);
      if (dErr) throw dErr;
      toast.success("Delivery marked with POD");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery · {inv.customer?.shop_name || inv.customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/40 p-3 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Invoice {inv.invoice_no}</div>
              <div className="text-xs text-muted-foreground">{inv.items?.length ?? 0} items · {inr(inv.total)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="font-mono font-semibold text-destructive">{inr(bal)}</div>
            </div>
          </div>

          <div>
            <Label>Received by *</Label>
            <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Person accepting the goods" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cash collected</Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={bal > 0 ? String(bal) : "0"} />
            </div>
            <div>
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
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn id / UTR" />
            </div>
          )}

          <div>
            <Label>Signature (typed name)</Label>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Signed as…" />
          </div>

          <div>
            <Label>Proof photo</Label>
            <Input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {delivery?.pod_photo_url && !file && (
              <div className="text-[11px] text-muted-foreground mt-1">Existing photo on file · uploading a new one will replace it.</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Mark Delivered"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

