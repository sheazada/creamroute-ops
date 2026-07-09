import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  ShoppingCart,
  ReceiptText,
  Wallet,
  Truck,
  Building2,
  ClipboardList,
  BarChart3,
  Settings,
  Search,
  Bell,
  LogOut,
  Milk,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { label: "Overview", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Sales",
    items: [
      { to: "/orders", label: "Orders", icon: ShoppingCart },
      { to: "/invoices", label: "Invoices", icon: ReceiptText },
      { to: "/payments", label: "Payments", icon: Wallet },
      { to: "/deliveries", label: "Deliveries", icon: Truck },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    label: "Partners",
    items: [
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/suppliers", label: "Suppliers", icon: Building2 },
      { to: "/purchases", label: "Purchases", icon: ClipboardList },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/daily-demand", label: "Daily Demand", icon: ClipboardList },
      { to: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  { label: "Admin", items: [{ to: "/settings", label: "Settings", icon: Settings }] },
] as const;

function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userRes.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userRes.user.id),
      ]);
      return {
        user: userRes.user,
        profile,
        roles: (roles ?? []).map((r) => r.role),
      };
    },
  });
}

function useAlertsCount() {
  return useQuery({
    queryKey: ["alerts-count"],
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, current_stock, min_stock")
        .eq("status", "active");
      const low = (prods ?? []).filter((p) => Number(p.current_stock) <= Number(p.min_stock)).length;
      const soon = new Date();
      soon.setDate(soon.getDate() + 7);
      const { count } = await supabase
        .from("product_batches")
        .select("id", { count: "exact", head: true })
        .lte("expiry_date", soon.toISOString().slice(0, 10))
        .gt("quantity", 0);
      return low + (count ?? 0);
    },
    refetchInterval: 60_000,
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const alerts = useAlertsCount();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials =
    me.data?.profile?.full_name
      ?.split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ??
    me.data?.user?.email?.[0]?.toUpperCase() ??
    "U";

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="fixed inset-y-0 left-0 w-60 bg-sidebar border-r border-sidebar-border z-40 flex flex-col no-print">
        <div className="p-5 flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary grid place-items-center text-primary-foreground">
            <Milk className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight leading-none">DairyFlow Pro</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              Distribution ERP
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
          {nav.map((section) => (
            <div key={section.label}>
              <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((it) => {
                  const active = path === it.to || path.startsWith(it.to + "/");
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium ring-1 ring-primary/10"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary">
              <div className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
                {initials}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-semibold truncate">
                  {me.data?.profile?.full_name ?? me.data?.user?.email}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {me.data?.roles?.[0] ?? "user"}
                </div>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="pl-60 flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 border-b bg-background/70 backdrop-blur px-6 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search customers, invoices, products…"
              className="pl-9 h-9 bg-muted/60 border-transparent focus-visible:bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-4" />
              {(alerts.data ?? 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
              )}
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/invoices/new">
                <ReceiptText className="size-4" /> New Invoice
              </Link>
            </Button>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
