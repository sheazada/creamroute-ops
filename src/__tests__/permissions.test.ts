// Automated tests for the role-based access system.
//
// Verifies:
// - Each role is allowed on its expected routes.
// - Each role is denied on routes it shouldn't access.
// - Admin can access everything.
// - Unknown paths are allowed by default (no accidental lockouts).

import { describe, it, expect } from "vitest";
import {
  canAccessPath,
  isRetailerRole,
  landingForRoles,
  requiredRolesForPath,
  ROUTE_ACCESS,
  ROLE_ACCESS,
  ALL_ROLES,
  roleDescription,
  type StaffRole,
} from "@/lib/access";

describe("canAccessPath", () => {
  it("admin can access every defined route", () => {
    for (const { prefix } of ROUTE_ACCESS) {
      expect(canAccessPath(prefix, ["admin"])).toBe(true);
    }
  });

  it("retailer cannot access staff routes", () => {
    const staffRoutes = ROUTE_ACCESS.map((r) => r.prefix);
    for (const path of staffRoutes) {
      expect(canAccessPath(path, ["retailer"])).toBe(false);
      expect(canAccessPath(path, ["retailer_user"])).toBe(false);
    }
  });

  it("driver can only access delivery routes and shared pages", () => {
    const allowed: string[] = [];
    const denied: string[] = [];
    for (const { prefix } of ROUTE_ACCESS) {
      if (canAccessPath(prefix, ["driver"])) allowed.push(prefix);
      else denied.push(prefix);
    }
    // Driver should have at least the delivery pages.
    expect(allowed.some((p) => p.includes("delivery") || p.includes("demand"))).toBe(true);
    // Driver should NOT have admin-only or finance pages.
    expect(allowed).not.toContain("/admin/roles");
    expect(allowed).not.toContain("/dashboard");
    expect(allowed).not.toContain("/reconcile");
    expect(allowed).not.toContain("/reports");
  });

  it("manager can access most operational pages but not admin-only routes", () => {
    // Settings is viewable by all staff (edits are admin-only in-page).
    expect(canAccessPath("/settings", ["manager"])).toBe(true);
    // But admin-only routes are denied.
    expect(canAccessPath("/admin/roles", ["manager"])).toBe(false);
    expect(canAccessPath("/share-log", ["manager"])).toBe(false);
    // Manager CAN access dashboard, reports, and operations.
    expect(canAccessPath("/dashboard", ["manager"])).toBe(true);
    expect(canAccessPath("/reports", ["manager"])).toBe(true);
    expect(canAccessPath("/orders", ["manager"])).toBe(true);
  });

  it("salesperson cannot access finance or admin pages", () => {
    expect(canAccessPath("/reconcile", ["salesperson"])).toBe(false);
    expect(canAccessPath("/cash-reconciliation", ["salesperson"])).toBe(false);
    expect(canAccessPath("/payment-reminders", ["salesperson"])).toBe(false);
    expect(canAccessPath("/admin/roles", ["salesperson"])).toBe(false);
    expect(canAccessPath("/share-log", ["salesperson"])).toBe(false);

    // Salesperson CAN access orders/invoices/customers/settings.
    expect(canAccessPath("/orders", ["salesperson"])).toBe(true);
    expect(canAccessPath("/invoices", ["salesperson"])).toBe(true);
    expect(canAccessPath("/customers", ["salesperson"])).toBe(true);
    expect(canAccessPath("/settings", ["salesperson"])).toBe(true);
  });

  it("unknown paths are allowed by default (no accidental lockouts)", () => {
    expect(canAccessPath("/some-new-future-route", ["driver"])).toBe(true);
    expect(canAccessPath("/foo/bar", ["salesperson"])).toBe(true);
  });

  it("empty roles are denied", () => {
    expect(canAccessPath("/dashboard", [])).toBe(false);
    expect(canAccessPath("/orders", [])).toBe(false);
  });

  it("multi-role: at least one matching role is enough", () => {
    expect(canAccessPath("/settings", ["driver", "admin"])).toBe(true);
    expect(canAccessPath("/reconcile", ["salesperson", "manager"])).toBe(true);
  });
});

describe("isRetailerRole", () => {
  it("recognizes retailer and retailer_user", () => {
    expect(isRetailerRole(["retailer"])).toBe(true);
    expect(isRetailerRole(["retailer_user"])).toBe(true);
    expect(isRetailerRole(["admin", "retailer"])).toBe(true);
    expect(isRetailerRole(["admin"])).toBe(false);
    expect(isRetailerRole([])).toBe(false);
  });
});

describe("landingForRoles", () => {
  it("routes each role to its home page", () => {
    expect(landingForRoles(["admin"])).toBe("/dashboard");
    expect(landingForRoles(["manager"])).toBe("/dashboard");
    expect(landingForRoles(["salesperson"])).toBe("/invoices");
    expect(landingForRoles(["driver"])).toBe("/demand-consolidation");
    expect(landingForRoles(["helper"])).toBe("/demand-consolidation");
    expect(landingForRoles(["retailer"])).toBe("/retailer");
  });
});

describe("requiredRolesForPath", () => {
  it("returns the correct required roles for known paths", () => {
    expect(requiredRolesForPath("/dashboard")).toEqual(["admin", "manager"]);
    expect(requiredRolesForPath("/admin/roles")).toEqual(["admin"]);
    expect(requiredRolesForPath("/orders")).toEqual(["admin", "manager", "salesperson"]);
  });

  it("returns empty array for unknown paths", () => {
    expect(requiredRolesForPath("/nonexistent")).toEqual([]);
  });
});

describe("ROLE_ACCESS inverse", () => {
  it("admin has many routes", () => {
    expect(ROLE_ACCESS["admin"].length).toBeGreaterThan(10);
  });

  it("driver has delivery-related routes only", () => {
    const routes = ROLE_ACCESS["driver"];
    expect(routes.some((r) => r.includes("delivery") || r.includes("demand"))).toBe(true);
    expect(routes).not.toContain("/admin/roles");
    expect(routes).not.toContain("/dashboard");
  });

  it("retailer has the portal route", () => {
    expect(ROLE_ACCESS["retailer"]).toContain("/retailer");
  });
});

describe("roleDescription", () => {
  it("every role has a non-empty description", () => {
    for (const role of [...ALL_ROLES, "retailer", "retailer_user"]) {
      const desc = roleDescription(role as StaffRole | "retailer" | "retailer_user");
      expect(desc.length).toBeGreaterThan(10);
    }
  });
});

describe("ROUTE_ACCESS matrix completeness", () => {
  it("every route entry uses a known role", () => {
    const allKnown = new Set([...ALL_ROLES]);
    for (const { roles } of ROUTE_ACCESS) {
      for (const role of roles) {
        expect(allKnown.has(role)).toBe(true);
      }
    }
  });

  it("no duplicate roles in any route's required list", () => {
    for (const { prefix, roles } of ROUTE_ACCESS) {
      const unique = new Set(roles);
      expect(unique.size).toBe(roles.length);
    }
  });

  it("critical admin routes are admin-only", () => {
    const adminOnly = ["/admin/roles", "/share-log"];
    for (const path of adminOnly) {
      const entry = ROUTE_ACCESS.find((r) => r.prefix === path);
      if (entry) {
        expect(entry.roles).toEqual(["admin"]);
      }
    }
  });
});
