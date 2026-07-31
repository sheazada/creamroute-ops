// Shared Sentry configuration — used by both client and server initializers.
// Severity levels, alert routing, and tagging helpers live here.

import * as Sentry from "@sentry/core";

// Severity levels aligned with Sentry's severity
export type ErrorSeverity = "fatal" | "error" | "warning" | "info" | "debug";

// Which severities trigger a PagerDuty / Slack webhook alert
// (configured in Sentry project → Alerts → Rules)
const CRITICAL_SEVERITIES: ErrorSeverity[] = ["fatal", "error"];

export function isCriticalSeverity(severity: ErrorSeverity): boolean {
  return CRITICAL_SEVERITIES.includes(severity);
}

export function reportError(
  error: unknown,
  context: {
    message?: string;
    severity?: ErrorSeverity;
    tags?: Record<string, string>;
    extras?: Record<string, unknown>;
    handled?: boolean;
    fingerprint?: string[];
  } = {},
): string | undefined {
  const eventId = Sentry.captureException(error, {
    level: context.severity ?? "error",
    tags: {
      ...context.tags,
      handled: String(context.handled ?? true),
    },
    extra: {
      ...context.extras,
      message: context.message,
    },
    fingerprint: context.fingerprint,
  });
  return eventId;
}

export function reportMessage(
  message: string,
  options: {
    severity?: ErrorSeverity;
    tags?: Record<string, string>;
    extras?: Record<string, unknown>;
  } = {},
): string | undefined {
  return Sentry.captureMessage(message, {
    level: options.severity ?? "info",
    tags: options.tags,
    extra: options.extras,
  });
}

export function addBreadcrumb(
  category: string,
  message: string,
  options: {
    level?: "debug" | "info" | "warning" | "error" | "fatal";
    data?: Record<string, unknown>;
  } = {},
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level: options.level ?? "info",
    data: options.data,
    timestamp: Date.now() / 1000,
  });
}

export function setUserContext(user: {
  id?: string;
  email?: string;
  role?: string;
  tenant?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.role,
  });
  if (user.role) {
    Sentry.setTag("user.role", user.role);
  }
  if (user.tenant) {
    Sentry.setTag("tenant", user.tenant);
  }
}

export function clearUserContext(): void {
  Sentry.setUser(null);
  // Sentry doesn't expose removeTag directly on core — just set empty
  Sentry.setTag("user.role", "");
  Sentry.setTag("tenant", "");
}

export function setRouteContext(route: string): void {
  Sentry.setTag("route", route);
  addBreadcrumb("navigation", `Navigated to ${route}`);
}
