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
import { useState } from "react";
import { ShieldCheck, User as UserIcon } from "lucide-react";

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
  const [biz, setBiz] = useState({
    name: "DairyFlow Distributors",
    gstin: "07AAAAA0000A1Z5",
    address: "Wholesale Dairy Market, New Delhi 110001",
    mobile: "+91 98100 00000",
    email: "hello@dairyflow.example",
  });

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
      // Replace all roles with the single selected role
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

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Business details, team roles and preferences." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Business details</h3>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Business name</Label><Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>GSTIN</Label><Input value={biz.gstin} onChange={(e) => setBiz({ ...biz, gstin: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Mobile</Label><Input value={biz.mobile} onChange={(e) => setBiz({ ...biz, mobile: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Textarea rows={2} value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} /></div>
            <Button onClick={() => toast.success("Saved locally. Persist to DB coming next.")}>Save changes</Button>
          </div>
        </Card>

        <Card className="p-6">
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
            {isLoading && <div className="text-sm text-muted-foreground py-6 text-center">Loading team…</div>}
            {(users ?? []).map((u) => {
              const currentRole = (u.roles[0] ?? "salesperson") as Role;
              const isSelf = u.id === me?.userId;
              return (
                <div key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-muted grid place-items-center shrink-0">
                      <UserIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {u.full_name ?? u.email}
                        {isSelf && <span className="ml-2 text-[10px] uppercase text-muted-foreground">(you)</span>}
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
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded ring-1 ${roleStyles[currentRole]}`}>
                        {currentRole}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {!isLoading && (users ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">No team members yet.</div>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
            <p><b className="text-foreground">How it works:</b> everyone signs in on the same login page. The very first account becomes <b>Admin</b>. New sign-ups default to <b>Salesperson</b>; only Admin can change roles.</p>
            <p className="pt-1"><b className="text-foreground">Roles:</b> Admin (all access) · Manager (ops + finance) · Salesperson (orders/invoices) · Driver (deliveries) · Helper (delivery support).</p>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-semibold mb-2">Coming soon</h3>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li>Custom logo & invoice templates</li>
            <li>Automated WhatsApp / SMS reminders</li>
            <li>Barcode / QR scanner integration</li>
            <li>Multi-warehouse & GPS delivery tracking</li>
            <li>AI-powered demand forecasting</li>
          </ul>
        </Card>
      </div>
    </PageContainer>
  );
}
