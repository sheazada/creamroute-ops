// Server-side Sentry initialization (runs in Cloudflare Workers / Nitro SSR).
// Captures backend errors in server functions, API routes, and unhandled exceptions.

import * as Sentry from "@sentry/node";

let serverInitialized = false;

export function initSentryServer(): void {
  if (serverInitialized) return;

  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || "development";

  if (!dsn) {
    console.log("[Sentry] No SENTRY_DSN configured — server error monitoring disabled");
    serverInitialized = true;
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release: `dairyflow-server@${process.env.APP_VERSION || "dev"}`,

    tracesSampleRate: environment === "production" ? 0.1 : 0,

    // Filter noisy backend errors
    ignoreErrors: [
      /ENOENT/, // missing files in dev
      /ECONNREFUSED/,
      /Non-Error promise rejection captured/,
    ],

    sendDefaultPii: false,

    beforeSend(event) {
      if (environment === "development" || environment === "test") {
        return null;
      }
      return event;
    },
  });

  // Global unhandled exception handlers (Cloudflare Workers may not support all of these)
  if (typeof process !== "undefined") {
    process.on("unhandledRejection", (reason) => {
      console.error("[Sentry] Unhandled rejection:", reason);
      Sentry.captureException(reason, {
        level: "error",
        tags: { mechanism: "unhandled_rejection" },
      });
    });

    process.on("uncaughtException", (error) => {
      console.error("[Sentry] Uncaught exception:", error);
      Sentry.captureException(error, {
        level: "fatal",
        tags: { mechanism: "uncaught_exception" },
      });
    });
  }

  serverInitialized = true;
  console.log("[Sentry] Server initialized", { environment });
}

/**
 * Wrap an async server function with error capture.
 * Usage:
 *   export const myFn = createServerFn({ method: "POST" })
 *     .handler(async (ctx) => withErrorCapture(ctx, "myFn", async () => { ... }));
 */
export async function withErrorCapture<T>(
  context: { userId?: string; userEmail?: string },
  functionName: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const { reportError, setUserContext } = await import("./sentry");

    // Attach user context if available
    if (context.userId) {
      setUserContext({
        id: context.userId,
        email: context.userEmail,
      });
    }

    reportError(error, {
      message: `Error in server function: ${functionName}`,
      severity: "error",
      tags: {
        mechanism: "server_function",
        function_name: functionName,
      },
      extras: {
        userId: context.userId,
        userEmail: context.userEmail,
      },
    });

    throw error; // Re-throw so the calling code still sees the failure
  }
}

/**
 * Capture a critical backend failure and trigger an alert.
 * Use for: payment failures, data corruption, auth bypasses.
 */
export function captureCriticalFailure(
  event: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
): string | undefined {
  const { reportError, addBreadcrumb } = require("./sentry");

  addBreadcrumb("critical", `CRITICAL: ${event}`, {
    level: "fatal",
    data: metadata,
  });

  return reportError(error, {
    message: `CRITICAL FAILURE: ${event}`,
    severity: "fatal",
    tags: {
      mechanism: "critical_alert",
      event,
    },
    extras: metadata,
    fingerprint: [`critical-${event}`],
  });
}
