import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, User as UserIcon, ChevronDown, Building2, Landmark, Pencil, X, Check } from "lucide-react";
import {
  getBusiness,
  saveBusiness,
  validateBusiness,
  maskMiddle,
  maskTail,
  maskVpa,
  type BusinessProfile,
  type BusinessValidationErrors,
} from "@/lib/business";
import { MaskedInput } from "@/components/masked-input";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

type Section = "business" | "payment";

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

  const [errors, setErrors] = useState<BusinessValidationErrors>({});
  const err = (k: keyof BusinessProfile) => errors[k];

  // Edit / Save / Cancel state per section (only one section editable at a time)
  const [editing, setEditing] = useState<Section | null>(null);
  const [snapshot, setSnapshot] = useState<BusinessProfile | null>(null);
  const dirty = useMemo(
    () => editing !== null && snapshot !== null && JSON.stringify(snapshot) !== JSON.stringify(biz),
    [editing, snapshot, biz],
  );

  // Confirm dialog for discarding unsaved changes (close section / cancel / navigate)
  const [confirm, setConfirm] = useState<null | { onConfirm: () => void; message?: string }>(null);
  const askDiscard = (onConfirm: () => void, message?: string) => {
    if (!dirty) { onConfirm(); return; }
    setConfirm({ onConfirm, message });
  };

  const startEdit = (section: Section) => {
    if (editing && editing !== section && dirty) {
      askDiscard(() => {
        if (snapshot) setBiz(snapshot);
        setErrors({});
        setSnapshot(biz);
        setEditing(section);
      });
      return;
    }
    setSnapshot(biz);
    setErrors({});
    setEditing(section);
  };

  const cancelEdit = () => {
    askDiscard(() => {
      if (snapshot) setBiz(snapshot);
      setEditing(null);
      setSnapshot(null);
      setErrors({});
    });
  };

  const saveBiz = () => {
    const { ok, errors: e } = validateBusiness(biz);
    setErrors(e);
    if (!ok) {
      toast.error("Please fix the highlighted fields before saving");
      return;
    }
    saveBusiness(biz);
    setEditing(null);
    setSnapshot(null);
    toast.success("Business profile saved — reflects on all new invoices");
  };

  // Warn on browser unload while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Block in-app navigation while dirty.
  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !window.confirm("You have unsaved changes. Leave without saving?");
    },
    enableBeforeUnload: false,
  });


  return (
    <PageContainer>
      <PageHeader title="Settings" description="Business details, invoice branding and team roles." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CollapsibleCard
          icon={Building2}
          title="Business identity"
          description="Shown on every invoice header, print copy and PDF."
          summary={biz.name ? `${biz.name}${biz.gstin ? " · GSTIN " + maskMiddle(biz.gstin, 2, 4) : ""}` : "Not set — tap to add"}
          storageKey={me?.userId ? `settings:section:${me.userId}:business` : undefined}
          readOnly={!isAdmin}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Trade name" error={err("name")} colSpan={2}>
                <Input
                  value={biz.name}
                  onChange={(e) => setField("name", e.target.value)}
                  aria-invalid={!!err("name")}
                />
              </FieldRow>
              <FieldRow label="Legal name (optional)" error={err("legal_name")} colSpan={2}>
                <Input
                  value={biz.legal_name ?? ""}
                  onChange={(e) => setField("legal_name", e.target.value)}
                />
              </FieldRow>
              <FieldRow label="GSTIN" error={err("gstin")} hint="15 chars • state+PAN+entity+Z+checksum">
                <MaskedInput
                  value={biz.gstin}
                  onChange={(e) => setField("gstin", e.target.value)}
                  mask={(v) => maskMiddle(v, 2, 4)}
                  uppercase
                  maxLength={15}
                  invalid={!!err("gstin")}
                  placeholder="07AAAAA0000A1Z5"
                />
              </FieldRow>
              <FieldRow label="FSSAI" error={err("fssai")}>
                <MaskedInput
                  value={biz.fssai ?? ""}
                  onChange={(e) => setField("fssai", e.target.value)}
                  mask={(v) => maskTail(v, 4)}
                  maxLength={14}
                  inputMode="numeric"
                  invalid={!!err("fssai")}
                />
              </FieldRow>
              <FieldRow label="PAN" error={err("pan")}>
                <MaskedInput
                  value={biz.pan ?? ""}
                  onChange={(e) => setField("pan", e.target.value)}
                  mask={(v) => maskMiddle(v, 2, 3)}
                  uppercase
                  maxLength={10}
                  invalid={!!err("pan")}
                  placeholder="AAAAA1234A"
                />
              </FieldRow>
              <FieldRow label="State (GST)" error={err("state")}>
                <Input
                  value={biz.state ?? ""}
                  onChange={(e) => setField("state", e.target.value)}
                  placeholder="Delhi"
                />
              </FieldRow>
              <FieldRow label="State code" error={err("state_code")}>
                <Input
                  value={biz.state_code ?? ""}
                  onChange={(e) => setField("state_code", e.target.value.replace(/\D/g, ""))}
                  placeholder="07"
                  maxLength={2}
                  inputMode="numeric"
                  aria-invalid={!!err("state_code")}
                />
              </FieldRow>
              <FieldRow label="Invoice prefix" error={err("invoice_prefix")}>
                <Input
                  value={biz.invoice_prefix ?? ""}
                  onChange={(e) => setField("invoice_prefix", e.target.value)}
                  placeholder="INV"
                  maxLength={8}
                  aria-invalid={!!err("invoice_prefix")}
                />
              </FieldRow>
              <FieldRow label="Mobile" error={err("mobile")}>
                <Input
                  value={biz.mobile}
                  onChange={(e) => setField("mobile", e.target.value)}
                  aria-invalid={!!err("mobile")}
                  inputMode="tel"
                />
              </FieldRow>
              <FieldRow label="Email" error={err("email")}>
                <Input
                  value={biz.email}
                  onChange={(e) => setField("email", e.target.value)}
                  aria-invalid={!!err("email")}
                  inputMode="email"
                />
              </FieldRow>
              <FieldRow label="Address" error={err("address")} colSpan={2}>
                <Textarea
                  rows={2}
                  value={biz.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </FieldRow>
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
              ? [
                  biz.upi_vpa && maskVpa(biz.upi_vpa),
                  biz.bank_name,
                  biz.bank_account && `A/C ••${String(biz.bank_account).slice(-4)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Not set — tap to add"
          }
          storageKey={me?.userId ? `settings:section:${me.userId}:payment` : undefined}
          readOnly={!isAdmin}
        >
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="UPI VPA" error={err("upi_vpa")} colSpan={2} hint="Powers the QR retailers scan to pay">
              <MaskedInput
                value={biz.upi_vpa ?? ""}
                onChange={(e) => setField("upi_vpa", e.target.value)}
                mask={maskVpa}
                placeholder="dairyflow@okhdfcbank"
                invalid={!!err("upi_vpa")}
              />
            </FieldRow>
            <FieldRow label="Bank name" error={err("bank_name")}>
              <Input
                value={biz.bank_name ?? ""}
                onChange={(e) => setField("bank_name", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Account holder" error={err("bank_holder")}>
              <Input
                value={biz.bank_holder ?? ""}
                onChange={(e) => setField("bank_holder", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Account no." error={err("bank_account")}>
              <MaskedInput
                value={biz.bank_account ?? ""}
                onChange={(e) => setField("bank_account", e.target.value.replace(/\D/g, ""))}
                mask={(v) => maskTail(v, 4)}
                inputMode="numeric"
                maxLength={18}
                invalid={!!err("bank_account")}
              />
            </FieldRow>
            <FieldRow label="IFSC" error={err("bank_ifsc")}>
              <MaskedInput
                value={biz.bank_ifsc ?? ""}
                onChange={(e) => setField("bank_ifsc", e.target.value)}
                mask={(v) => maskMiddle(v, 4, 3)}
                uppercase
                maxLength={11}
                invalid={!!err("bank_ifsc")}
                placeholder="HDFC0000000"
              />
            </FieldRow>
            <FieldRow label="Branch" error={err("bank_branch")} colSpan={2}>
              <Input
                value={biz.bank_branch ?? ""}
                onChange={(e) => setField("bank_branch", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Invoice terms & conditions" error={err("terms")} colSpan={2}>
              <Textarea
                rows={3}
                value={biz.terms ?? ""}
                onChange={(e) => setField("terms", e.target.value)}
              />
            </FieldRow>
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
  editing = false,
  dirty = false,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  icon: any;
  title: string;
  description: string;
  summary: string;
  defaultOpen?: boolean;
  storageKey?: string;
  readOnly?: boolean;
  editing?: boolean;
  dirty?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
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
  // Auto-open the section while it's being edited so the form is visible.
  useEffect(() => { if (editing) setOpen(true); }, [editing]);
  const effectiveOpen = readOnly ? false : open;

  const requestToggle = () => {
    if (readOnly) return;
    if (open && editing && dirty) {
      // Route close-with-unsaved-changes through Cancel (which prompts).
      onCancel?.();
      return;
    }
    if (open && editing) {
      // Close cleanly and exit edit mode.
      onCancel?.();
      setOpen(false);
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="w-full flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={requestToggle}
          disabled={readOnly}
          className={`flex items-center gap-3 flex-1 min-w-0 text-left transition-colors -m-2 p-2 rounded ${readOnly ? "cursor-default" : "hover:bg-muted/40"}`}
          aria-expanded={effectiveOpen}
          title={readOnly ? "Admin-only — view only for your role" : undefined}
        >
          <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm flex items-center gap-2">
              {title}
              {editing && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20">
                  {dirty ? "Editing • unsaved" : "Editing"}
                </span>
              )}
            </div>
            {effectiveOpen ? (
              <div className="text-xs text-muted-foreground truncate">{description}</div>
            ) : (
              <div className="text-xs text-muted-foreground truncate">{summary}</div>
            )}
          </div>
          <ChevronDown
            className={`size-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {readOnly ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hidden sm:inline">
              Admin only
            </span>
          ) : editing ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onCancel?.()}
              >
                <X className="size-3.5 mr-1" /> Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onSave?.()}
                disabled={!dirty}
              >
                <Check className="size-3.5 mr-1" /> Save
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onEdit?.()}
            >
              <Pencil className="size-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
      </div>
      {effectiveOpen && (
        <div className="p-6 pt-2 border-t">
          <fieldset disabled={!editing} className={editing ? "" : "opacity-90"}>
            {children}
          </fieldset>
        </div>
      )}
    </Card>
  );
}



function FieldRow({
  label,
  error,
  hint,
  colSpan = 1,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  colSpan?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${colSpan === 2 ? "col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
