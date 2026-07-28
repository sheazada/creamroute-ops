import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Milk, Loader2, Shield, Users, Truck, HardHat, Briefcase, Store } from "lucide-react";
import { seedDemoUsers, DEMO_USERS, DEMO_PASSWORD } from "@/lib/dev-users.functions";
import { logAccessEvent } from "@/lib/audit.server";

const ROLE_ICONS: Record<string, any> = {
  admin: Shield,
  manager: Briefcase,
  salesperson: Users,
  driver: Truck,
  helper: HardHat,
  retailer: Store,
};

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  // Only allow same-origin relative paths.
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [seeding, setSeeding] = useState(false);
  const seed = useServerFn(seedDemoUsers);

  const goPostAuth = () => {
    const dest = safeNext(next);
    if (dest) {
      window.location.href = dest;
    } else {
      navigate({ to: "/", replace: true });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goPostAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSignIn = async (emailArg: string, passwordArg: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: emailArg, password: passwordArg });
    if (error) {
      // Fire-and-forget log — must not block the UI.
      logAccessEvent({
        data: {
          eventType: "login_failure",
          userId: null,
          userEmail: emailArg,
          userRoles: [],
          requiredRoles: [],
          routePath: "/auth",
          reason: error.message,
        },
      }).catch(() => {});
      throw error;
    }
    // Success — log with resolved roles.
    const roles = await (async () => {
      try {
        const { data: r } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        return (r ?? []).map((x) => x.role);
      } catch {
        return [];
      }
    })();
    logAccessEvent({
      data: {
        eventType: "login_success",
        userId: data.user.id,
        userEmail: data.user.email ?? emailArg,
        userRoles: roles,
        requiredRoles: [],
        routePath: "/auth",
      },
    }).catch(() => {});
    return data;
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await doSignIn(email, password); toast.success("Welcome back"); goPostAuth(); } catch (err: any) { toast.error(err.message); }
    setLoading(false);
  };

  const quickLogin = async (roleEmail: string) => {
    setLoading(true);
    try {
      await doSignIn(roleEmail, DEMO_PASSWORD);
      toast.success("Welcome back");
      // Redirect retailer to retailer portal
      if (roleEmail.includes("retailer")) {
        navigate({ to: "/retailer", replace: true });
      } else {
        goPostAuth();
      }
    } catch {
      try {
        setSeeding(true);
        await seed({ data: {} } as any);
        setSeeding(false);
        await doSignIn(roleEmail, DEMO_PASSWORD);
        toast.success("Demo users seeded. Welcome back");
        // Redirect retailer to retailer portal
        if (roleEmail.includes("retailer")) {
          navigate({ to: "/retailer", replace: true });
        } else {
          goPostAuth();
        }
      } catch (e: any) {
        setSeeding(false);
        toast.error(e?.message ?? "Quick login failed");
      }
    }
    setLoading(false);
  };

  const seedNow = async () => {
    setSeeding(true);
    try {
      const res: any = await seed({ data: {} } as any);
      toast.success(`Demo users ready (${res.created.length} created, ${res.existing.length} refreshed)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Seed failed");
    }
    setSeeding(false);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can sign in now.");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
            <Milk className="size-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">DairyFlow Pro</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            The operating system for your dairy distribution business.
          </h1>
          <p className="text-primary-foreground/80 max-w-md">
            Manage retailers, inventory, GST invoicing, payments and deliveries —
            all in one clean, fast ERP.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-md pt-4">
            {["GST Invoicing", "Live Inventory", "Route Delivery"].map((k) => (
              <div key={k} className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 text-xs font-medium text-center">
                {k}
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} DairyFlow Pro
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8 shadow-sm">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="size-8 rounded-lg bg-primary grid place-items-center text-primary-foreground">
              <Milk className="size-4" />
            </div>
            <span className="font-semibold">DairyFlow Pro</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome</h2>
          <p className="text-sm text-muted-foreground mb-6">Sign in to manage your distribution.</p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Min 8 characters. The first account becomes admin.</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-amber-900">Dev quick login</p>
                <p className="text-[11px] text-amber-800/80">Instant sign-in for each role. Password: <code className="font-mono">{DEMO_PASSWORD}</code></p>
              </div>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={seedNow} disabled={seeding || loading}>
                {seeding && <Loader2 className="size-3 animate-spin mr-1" />}
                Seed
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map((u) => {
                const Icon = ROLE_ICONS[u.role] ?? Users;
                return (
                  <Button
                    key={u.role}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9 justify-start gap-2 text-xs"
                    disabled={loading || seeding}
                    onClick={() => quickLogin(u.email)}
                  >
                    <Icon className="size-3.5" />
                    <span className="capitalize">{u.role}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-[10px] text-amber-800/70">For development only — remove before production. Retailer logs in redirect to the retailer portal.</p>
          </div>

          <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">One login for everyone</p>
            <p>Admin, Manager, Salesperson, Driver and Helper all sign in here. Your role is assigned by your administrator.</p>
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            <Link to="/dashboard" className="hover:underline">Back to app</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
