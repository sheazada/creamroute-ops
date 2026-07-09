import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const [biz, setBiz] = useState({
    name: "DairyFlow Distributors", gstin: "07AAAAA0000A1Z5",
    address: "Wholesale Dairy Market, New Delhi 110001",
    mobile: "+91 98100 00000", email: "hello@dairyflow.example",
  });

  const { data: users } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");
      const rMap = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const cur = rMap.get(r.user_id) ?? [];
        cur.push(r.role); rMap.set(r.user_id, cur);
      }
      return (profiles ?? []).map((p) => ({ ...p, roles: rMap.get(p.id) ?? [] }));
    },
  });

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Business details, users and preferences." />

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
          <h3 className="font-semibold mb-4">Team members</h3>
          <div className="divide-y">
            {(users ?? []).map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{u.full_name ?? u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex gap-1">
                  {u.roles.map((r: string) => (
                    <span key={r} className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">{r}</span>
                  ))}
                </div>
              </div>
            ))}
            {(users ?? []).length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No team members yet.</div>}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            New sign-ups become <b>employees</b> automatically. The first account is the <b>admin</b>.
          </p>
        </Card>

        <Card className="p-6">
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
