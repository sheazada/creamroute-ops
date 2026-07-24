import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bell, RefreshCw, RotateCw, Mail, MessageSquare, Send, CheckCircle2, XCircle, Clock, Ban, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Center — Delivery alerts" },
      { name: "description", content: "Review delivery notification history and retry failed sends." },
      { property: "og:title", content: "Notification Center" },
      { property: "og:description", content: "Track and retry retailer delivery notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

type NotifStatus = "queued" | "sending" | "sent" | "failed" | "suppressed" | "cancelled";
type NotifChannel = "email" | "sms" | "whatsapp";

type Row = {
  id: string;
  channel: NotifChannel;
  status: NotifStatus;
  recipient: string;
  recipient_name: string | null;
  subject: string | null;
  body: string | null;
  template: string | null;
  template_data: any;
  customer_id: string | null;
  invoice_id: string | null;
  delivery_id: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  provider: string | null;
  provider_message_id: string | null;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  sent_at: string | null;
  created_at: string;
  customer: { id: string; name: string; shop_name: string | null } | null;
  invoice: { id: string; invoice_no: string } | null;
};

const STATUS_META: Record<NotifStatus, { label: string; cls: string; icon: any }> = {
  queued: { label: "Queued", cls: "bg-sky-50 text-sky-700 border-sky-200", icon: Clock },
  sending: { label: "Sending", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Send },
  sent: { label: "Sent", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  failed: { label: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
  suppressed: { label: "Suppressed", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Ban },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: Ban },
};

const CHANNEL_META: Record<NotifChannel, { label: string; icon: any; cls: string }> = {
  email: { label: "Email", icon: Mail, cls: "text-indigo-600" },
  sms: { label: "SMS", icon: MessageSquare, cls: "text-emerald-600" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, cls: "text-green-600" },
};

function fmtDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function NotificationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | NotifStatus>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | NotifChannel>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Row | null>(null);
  const [retrying, setRetrying] = useState(false);

  const { data: rows, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["notification-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select(
          "id, channel, status, recipient, recipient_name, subject, body, template, template_data, customer_id, invoice_id, delivery_id, attempts, max_attempts, last_error, provider, provider_message_id, last_attempt_at, next_retry_at, sent_at, created_at, customer:customers(id, name, shop_name), invoice:invoices(id, invoice_no)"
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const counts = useMemo(() => {
    const c: Record<NotifStatus | "all", number> = {
      all: 0, queued: 0, sending: 0, sent: 0, failed: 0, suppressed: 0, cancelled: 0,
    };
    (rows ?? []).forEach((r) => { c.all += 1; c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (channelFilter !== "all" && r.channel !== channelFilter) return false;
      if (!q) return true;
      const hay = [
        r.recipient, r.recipient_name, r.subject, r.customer?.shop_name, r.customer?.name, r.invoice?.invoice_no, r.template,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, statusFilter, channelFilter, search]);

  const failedInView = useMemo(() => filtered.filter((r) => r.status === "failed"), [filtered]);
  const selectedFailedIds = useMemo(
    () => failedInView.filter((r) => selected.has(r.id)).map((r) => r.id),
    [failedInView, selected],
  );

  const requeue = async (ids: string[]) => {
    if (ids.length === 0) return;
    setRetrying(true);
    try {
      const { error } = await supabase
        .from("notification_logs")
        .update({ status: "queued", next_retry_at: null, last_error: null })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Requeued ${ids.length} notification${ids.length === 1 ? "" : "s"} for retry.`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["notification-logs"] });
    } catch (e: any) {
      toast.error(e?.message || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAllFailed = () => {
    const ids = failedInView.map((r) => r.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      if (allOn) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  };

  return (
    <PageContainer>
      <PageHeader
        icon={Bell}
        title="Notification Center"
        subtitle="Delivery alert history with per-row retry for failed sends."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5" disabled={isFetching}>
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} /> Refresh
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={retrying || failedInView.length === 0}
              onClick={() => requeue(selectedFailedIds.length ? selectedFailedIds : failedInView.map((r) => r.id))}
            >
              <RotateCw className={cn("size-4", retrying && "animate-spin")} />
              {selectedFailedIds.length
                ? `Retry selected (${selectedFailedIds.length})`
                : `Retry all failed (${failedInView.length})`}
            </Button>
          </div>
        }
      />

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-auto">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All <Badge variant="secondary" className="ml-1.5">{counts.all}</Badge></TabsTrigger>
            <TabsTrigger value="queued">Queued <Badge variant="secondary" className="ml-1.5">{counts.queued}</Badge></TabsTrigger>
            <TabsTrigger value="sent">Sent <Badge variant="secondary" className="ml-1.5">{counts.sent}</Badge></TabsTrigger>
            <TabsTrigger value="failed">Failed <Badge variant="secondary" className="ml-1.5">{counts.failed}</Badge></TabsTrigger>
            <TabsTrigger value="suppressed">Suppressed <Badge variant="secondary" className="ml-1.5">{counts.suppressed}</Badge></TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Search shop, recipient, invoice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[260px]"
          />
        </div>
      </Card>

      <Card className="mt-3 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No notifications match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-2 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all failed in view"
                      checked={failedInView.length > 0 && failedInView.every((r) => selected.has(r.id))}
                      onChange={toggleAllFailed}
                      disabled={failedInView.length === 0}
                    />
                  </th>
                  <th className="p-2 text-left">When</th>
                  <th className="p-2 text-left">Channel</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Recipient</th>
                  <th className="p-2 text-left">Shop / Invoice</th>
                  <th className="p-2 text-left">Template</th>
                  <th className="p-2 text-right">Attempts</th>
                  <th className="p-2 text-left">Last error</th>
                  <th className="p-2 text-right w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const sMeta = STATUS_META[r.status];
                  const cMeta = CHANNEL_META[r.channel];
                  const SIcon = sMeta.icon;
                  const CIcon = cMeta.icon;
                  const isFailed = r.status === "failed";
                  return (
                    <tr key={r.id} className="border-t align-top hover:bg-muted/20">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          aria-label="Select notification"
                          checked={selected.has(r.id)}
                          disabled={!isFailed}
                          onChange={() => toggle(r.id)}
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(r.created_at)}
                        {r.next_retry_at && isFailed && (
                          <div className="text-[11px] text-amber-700">Next retry {fmtDateTime(r.next_retry_at)}</div>
                        )}
                      </td>
                      <td className="p-2">
                        <span className={cn("inline-flex items-center gap-1", cMeta.cls)}>
                          <CIcon className="size-4" /> {cMeta.label}
                        </span>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className={cn("gap-1", sMeta.cls)}>
                          <SIcon className="size-3.5" /> {sMeta.label}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{r.recipient_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.recipient}</div>
                      </td>
                      <td className="p-2">
                        <div>{r.customer?.shop_name || r.customer?.name || "—"}</div>
                        {r.invoice?.invoice_no && (
                          <div className="text-xs text-muted-foreground">#{r.invoice.invoice_no}</div>
                        )}
                      </td>
                      <td className="p-2 text-xs">{r.template || <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-2 text-right tabular-nums text-xs">
                        {r.attempts}/{r.max_attempts}
                      </td>
                      <td className="p-2 max-w-[260px]">
                        {r.last_error ? (
                          <div className="text-xs text-rose-700 line-clamp-2" title={r.last_error}>{r.last_error}</div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => setDetail(r)}>
                            <Eye className="size-4" />
                          </Button>
                          {isFailed && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              disabled={retrying}
                              onClick={() => requeue([r.id])}
                            >
                              <RotateCw className={cn("size-3.5", retrying && "animate-spin")} /> Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notification detail</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Recipient</div>
                  <div className="font-medium">{detail.recipient_name || "—"}</div>
                  <div className="text-xs">{detail.recipient}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Channel · Status</div>
                  <div className="font-medium">{CHANNEL_META[detail.channel].label} · {STATUS_META[detail.status].label}</div>
                  <div className="text-xs">Attempts {detail.attempts}/{detail.max_attempts}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div>{fmtDateTime(detail.created_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last attempt</div>
                  <div>{fmtDateTime(detail.last_attempt_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                  <div>{fmtDateTime(detail.sent_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Next retry</div>
                  <div>{fmtDateTime(detail.next_retry_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Provider</div>
                  <div>{detail.provider || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Provider message id</div>
                  <div className="break-all text-xs">{detail.provider_message_id || "—"}</div>
                </div>
              </div>

              {detail.subject && (
                <div>
                  <div className="text-xs text-muted-foreground">Subject</div>
                  <div className="font-medium">{detail.subject}</div>
                </div>
              )}
              {detail.body && (
                <div>
                  <div className="text-xs text-muted-foreground">Body</div>
                  <pre className="whitespace-pre-wrap rounded border bg-muted/30 p-2 text-xs">{detail.body}</pre>
                </div>
              )}
              {detail.last_error && (
                <div>
                  <div className="text-xs text-muted-foreground">Last error</div>
                  <pre className="whitespace-pre-wrap rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">{detail.last_error}</pre>
                </div>
              )}
              {detail.template_data && Object.keys(detail.template_data ?? {}).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Template data</div>
                  <pre className="whitespace-pre-wrap rounded border bg-muted/30 p-2 text-xs">{JSON.stringify(detail.template_data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {detail?.status === "failed" && (
              <Button
                className="gap-1"
                disabled={retrying}
                onClick={async () => { await requeue([detail!.id]); setDetail(null); }}
              >
                <RotateCw className={cn("size-4", retrying && "animate-spin")} /> Retry now
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
