export type StaffRole = "admin" | "manager" | "salesperson" | "driver" | "helper";
export type AppRole = StaffRole | "retailer" | "retailer_user";

const ALL: StaffRole[] = ["admin", "manager", "salesperson", "driver", "helper"];
const FIN: StaffRole[] = ["admin", "manager"];
const SALES: StaffRole[] = ["admin", "manager", "salesperson"];

/** All staff roles, exported for UI iteration (role selector, etc.). */
export const ALL_ROLES: StaffRole[] = ALL;

/** Path prefix -> roles allowed. Longest matching prefix wins. */
export const ROUTE_ACCESS: { prefix: string; roles: StaffRole[] }[] = [
  { prefix: "/dashboard", roles: FIN },
  { prefix: "/orders", roles: SALES },
  { prefix: "/demand-consolidation", roles: ALL },
  { prefix: "/delivery-demand", roles: ALL },
  { prefix: "/invoices", roles: SALES },
  { prefix: "/payments", roles: SALES },
  { prefix: "/cash-reconciliation", roles: FIN },
  { prefix: "/reconcile", roles: FIN },
  { prefix: "/deliveries", roles: ALL },
  { prefix: "/delivery-status", roles: FIN },
  { prefix: "/route-optimization", roles: FIN },
  { prefix: "/routes", roles: FIN },
  { prefix: "/products", roles: SALES },
  { prefix: "/inventory", roles: FIN },
  { prefix: "/customers", roles: SALES },
  { prefix: "/customer-ledger", roles: FIN },
  { prefix: "/suppliers", roles: FIN },
  { prefix: "/purchases", roles: FIN },
  { prefix: "/crates", roles: ["admin", "manager", "driver", "helper"] },
  { prefix: "/claims", roles: FIN },
  { prefix: "/reports", roles: FIN },
  { prefix: "/payment-reminders", roles: FIN },
  { prefix: "/notifications", roles: FIN },
  { prefix: "/share-log", roles: ["admin"] },
  { prefix: "/admin/roles", roles: ["admin"] },
  { prefix: "/settings", roles: ALL }, // employees can view summaries; edits are admin-only in-page
];

export function isRetailerRole(roles: string[]) {
  return roles.includes("retailer") || roles.includes("retailer_user");
}

export function primaryStaffRole(roles: string[]): StaffRole | null {
  const order: StaffRole[] = ["admin", "manager", "salesperson", "driver", "helper"];
  return order.find((r) => roles.includes(r)) ?? null;
}

export function landingForRoles(roles: string[]): string {
  if (isRetailerRole(roles)) return "/retailer";
  const role = primaryStaffRole(roles);
  if (role === "admin" || role === "manager") return "/dashboard";
  if (role === "salesperson") return "/invoices";
  if (role === "driver" || role === "helper") return "/demand-consolidation";
  return "/auth";
}

export function canAccessPath(pathname: string, roles: string[]): boolean {
  const role = primaryStaffRole(roles);
  if (!role) return false;
  const match = ROUTE_ACCESS.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  if (!match) return true;
  return match.roles.includes(role);
}

/** Return the list of roles required to access a path. Empty array = unrestricted. */
export function requiredRolesForPath(pathname: string): StaffRole[] {
  const match = ROUTE_ACCESS.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  return match?.roles ?? [];
}

export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function roleDescription(
  role: StaffRole | "retailer" | "retailer_user",
): string {
  switch (role) {
    case "admin":
      return "Full system access. Manages users, roles, and settings.";
    case "manager":
      return "Operational control. Orders, deliveries, finance, reports.";
    case "salesperson":
      return "Sales access. Orders, invoices, customers, products.";
    case "driver":
      return "Field operations. Delivery demand and routes.";
    case "helper":
      return "Field operations. Delivery demand and routes.";
    case "retailer":
    case "retailer_user":
      return "Customer portal. Places orders and views invoices.";
  }
}

/** Inverse map: role -> list of route prefixes they can access. */
export const ROLE_ACCESS: Record<StaffRole | "retailer" | "retailer_user", string[]> =
  (() => {
    const result: Record<string, string[]> = {
      admin: [],
      manager: [],
      salesperson: [],
      driver: [],
      helper: [],
      retailer: ["/retailer"],
      retailer_user: ["/retailer"],
    };
    for (const entry of ROUTE_ACCESS) {
      for (const role of entry.roles) {
        result[role].push(entry.prefix);
      }
    }
    return result as typeof result;
  })();
