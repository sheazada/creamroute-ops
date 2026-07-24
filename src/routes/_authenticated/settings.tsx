import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { ShieldCheck, User as UserIcon, ChevronDown, Building2, Landmark } from "lucide-react";
import { getBusiness, saveBusiness, type BusinessProfile } from "@/lib/business";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

type Role = "admin" | "manager" | "salesperson" | "driver" | "helper";
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Full access, manages team & finances" },
  { value: "manager", label: "Manager", hint: "Operations + financial reports" },
  { value: "salesperson", label: "Salesperson", hint: "Orders, invoices, customers" },
  { value: "driver", label: "Driver", hint: "Deliveries & daily demand" },
  { value: "helper", label: "Helper", hint: "Deliveries & stock assistance" },
];

const roleStyles: Record<Role, string> = {
  admin: "bg-primary/10 text-primary ring-primary/20",
  manager: "bg-blue-500/10 text-blue-700 ring-blue-500/20",
  salesperson: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20",
  driver: "bg-amber-500/10 text-amber-700 ring-amber-500/20",
  helper: "bg-violet-500/10 text-violet-700 ring-violet-500/20",
};

function Settings() {
  const qc = useQueryClient();
  const [biz, setBiz] = useState<BusinessProfile>(() => getBusiness());
  const setField = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) =>
    setBiz((b) => ({ ...b, [k]: v }));

  const { data: me } = useQuery({
    queryKey: ["me-settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      return { userId: u.user.id, roles: (roles ?? []).map((r) => r.role as Role) };
    },
  });

  const isAdmin = me?.roles.includes("admin") ?? false;

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");
      const rMap = new Map<string, Role[]>();
      for (const r of roles ?? []) {
        const cur = rMap.get(r.user_id) ?? [];
        cur.push(r.role as Role);
        rMap.set(r.user_id, cur);
      }
      return (profiles ?? []).map((p) => ({ ...p, roles: rMap.get(p.id) ?? [] }));
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["users-list"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBiz = () => {
    saveBusiness(biz);
    toast.success("Business profile saved — reflects on all new invoices");
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Business details, invoice branding and team roles." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CollapsibleCard
          icon={Building2}
          title="Business identity"
          description="Shown on every invoice header, print copy and PDF."
          summary={biz.name ? `${biz.name}${biz.gstin ? " · GSTIN " + biz.gstin : ""}` : "Not set — tap to add"}
          storageKey={me?.userId ? `settings:section:${me.userId}:business` : undefined}
          readOnly={!isAdmin}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Trade name</Label>
                <Input value={biz.name} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Legal name (optional)</Label>
                <Input
                  value={biz.legal_name ?? ""}
                  onChange={(e) => setField("legal_name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input value={biz.gstin} onChange={(e) => setField("gstin", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>FSSAI</Label>
                <Input
                  value={biz.fssai ?? ""}
                  onChange={(e) => setField("fssai", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PAN</Label>
                <Input value={biz.pan ?? ""} onChange={(e) => setField("pan", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>State (GST)</Label>
                <Input
                  value={biz.state ?? ""}
                  onChange={(e) => setField("state", e.target.value)}
                  placeholder="Delhi"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State code</Label>
                <Input
                  value={biz.state_code ?? ""}
                  onChange={(e) => setField("state_code", e.target.value)}
                  placeholder="07"
                  maxLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice prefix</Label>
                <Input
                  value={biz.invoice_prefix ?? ""}
                  onChange={(e) => setField("invoice_prefix", e.target.value)}
                  placeholder="INV"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input value={biz.mobile} onChange={(e) => setField("mobile", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={biz.email} onChange={(e) => setField("email", e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  value={biz.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={saveBiz} size="sm">Save business profile</Button>
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          icon={Landmark}
          title="Payment & bank"
          description="Printed on invoices. UPI VPA also powers the QR code retailers can scan to pay."
          summary={
            biz.upi_vpa || biz.bank_account
              ? [biz.upi_vpa, biz.bank_name, biz.bank_account && `A/C ••${String(biz.bank_account).slice(-4)}`]
                  .filter(Boolean)
                  .join(" · ")
              : "Not set — tap to add"
          }
          storageKey={me?.userId ? `settings:section:${me.userId}:payment` : undefined}
          readOnly={!isAdmin}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>UPI VPA</Label>
              <Input
                value={biz.upi_vpa ?? ""}
                onChange={(e) => setField("upi_vpa", e.target.value)}
                placeholder="dairyflow@okhdfcbank"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bank name</Label>
              <Input
                value={biz.bank_name ?? ""}
                onChange={(e) => setField("bank_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account holder</Label>
              <Input
                value={biz.bank_holder ?? ""}
                onChange={(e) => setField("bank_holder", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account no.</Label>
              <Input
                value={biz.bank_account ?? ""}
                onChange={(e) => setField("bank_account", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IFSC</Label>
              <Input
                value={biz.bank_ifsc ?? ""}
                onChange={(e) => setField("bank_ifsc", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Branch</Label>
              <Input
                value={biz.bank_branch ?? ""}
                onChange={(e) => setField("bank_branch", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Invoice terms & conditions</Label>
              <Textarea
                rows={3}
                value={biz.terms ?? ""}
                onChange={(e) => setField("terms", e.target.value)}
              />
            </div>
          </div>
          <div className="pt-4">
            <Button onClick={saveBiz} size="sm">Save business profile</Button>
          </div>
        </CollapsibleCard>

        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Team members</h3>
            {isAdmin ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-primary/10 text-primary flex items-center gap-1">
                <ShieldCheck className="size-3" /> Admin controls
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">Read-only</span>
            )}
          </div>

          <div className="divide-y">
            {isLoading && (
              <div className="text-sm text-muted-foreground py-6 text-center">Loading team…</div>
            )}
            {(users ?? []).map((u) => {
              const currentRole = (u.roles[0] ?? "salesperson") as Role;
              const isSelf = u.id === me?.userId;
              return (
                <div
                  key={u.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-muted grid place-items-center shrink-0">
                      <UserIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {u.full_name ?? u.email}
                        {isSelf && (
                          <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin ? (
                      <Select
                        value={currentRole}
                        onValueChange={(v) => changeRole.mutate({ userId: u.id, role: v as Role })}
                        disabled={isSelf && currentRole === "admin"}
                      >
                        <SelectTrigger className="h-8 w-[150px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{r.label}</span>
                                <span className="text-[10px] text-muted-foreground">{r.hint}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded ring-1 ${roleStyles[currentRole]}`}
                      >
                        {currentRole}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {!isLoading && (users ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No team members yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function CollapsibleCard({
  icon: Icon,
  title,
  description,
  summary,
  defaultOpen = false,
  storageKey,
  readOnly = false,
  children,
}: {
  icon: any;
  title: string;
  description: string;
  summary: string;
  defaultOpen?: boolean;
  storageKey?: string;
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Hydrate from localStorage once the per-user storageKey is known.
  useEffect(() => {
    if (readOnly) return;
    if (!storageKey || typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "1" || stored === "0") setOpen(stored === "1");
    } catch {}
  }, [storageKey, readOnly]);
  useEffect(() => {
    if (readOnly) return;
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {}
  }, [open, storageKey, readOnly]);
  const effectiveOpen = readOnly ? false : open;
  return (
    <Card className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => { if (!readOnly) setOpen((v) => !v); }}
        disabled={readOnly}
        className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${readOnly ? "cursor-default" : "hover:bg-muted/40"}`}
        aria-expanded={effectiveOpen}
        title={readOnly ? "Admin-only — view only for your role" : undefined}
      >
        <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">{title}</div>
          {effectiveOpen ? (
            <div className="text-xs text-muted-foreground truncate">{description}</div>
          ) : (
            <div className="text-xs text-muted-foreground truncate">{summary}</div>
          )}
        </div>
        {readOnly ? (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hidden sm:inline">
            Admin only
          </span>
        ) : (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:inline">
              {open ? "Close" : "Edit"}
            </span>
            <ChevronDown
              className={`size-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>
      {effectiveOpen && <div className="p-6 pt-2 border-t">{children}</div>}
    </Card>
  );
}

