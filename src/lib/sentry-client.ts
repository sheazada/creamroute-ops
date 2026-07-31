// Client-side Sentry initialization (runs only in the browser).
// Sets up global error handlers, performance tracing, and React integration.

import * as Sentry from "@sentry/react";
import { addBreadcrumb } from "./sentry";

let clientInitialized = false;

export function initSentryClient(): void {
  if (clientInitialized) return;
  if (typeof window === "undefined") return;

  const dsn = import.meta.env.VITE_SENTRY_DSN || process.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENV || process.env.VITE_ENV || "development";

  // Only init if DSN is present (skip in local dev without Sentry configured)
  if (!dsn) {
    console.log("[Sentry] No VITE_SENTRY_DSN configured — error monitoring disabled");
    clientInitialized = true;
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release: `dairyflow@${import.meta.env.VITE_APP_VERSION || "dev"}`,

    // Sample rates — increase in production after validating noise level
    tracesSampleRate: environment === "production" ? 0.1 : 0,
    replaysSessionSampleRate: environment === "production" ? 0.05 : 0,
    replaysOnErrorSampleRate: 1.0, // Capture replay for every error

    // Filter out known noisy errors
    ignoreErrors: [
      /ResizeObserver loop limit exceeded/,
      /NetworkError when attempting to fetch resource/,
      /Loading chunk \d+ failed/,
      /Non-Error promise rejection captured/,
    ],

    // Filter out noise from extensions / third-party scripts
    denyUrls: [
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
      /extensions\//,
      /google-analytics\.com/,
    ],

    // PII scrubbing — be conservative
    sendDefaultPii: false,
    beforeSend(event) {
      // Don't send events in development
      if (environment === "development" || environment === "test") {
        return null;
      }
      return event;
    },

    // Breadcrumb filtering
    maxBreadcrumbs: 100,
    beforeBreadcrumb(breadcrumb) {
      // Skip low-value breadcrumbs to reduce noise
      if (breadcrumb.category === "ui.click" && breadcrumb.message?.includes("data-sentry-noop")) {
        return null;
      }
      return breadcrumb;
    },

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
  });

  // Global unhandled error capture
  window.addEventListener("error", (event) => {
    addBreadcrumb("error", `Global error: ${event.message}`, {
      level: "error",
      data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    addBreadcrumb("error", `Unhandled rejection: ${reason}`, {
      level: "error",
    });
  });

  clientInitialized = true;
  console.log("[Sentry] Client initialized", { environment });
}

// Hook for components to report errors imperatively
export function useSentryError() {
  return {
    captureError: (error: unknown, context?: Record<string, unknown>) => {
      const { reportError } = require("./sentry");
      reportError(error, { extras: context });
    },
    addBreadcrumb: (category: string, message: string) => {
      addBreadcrumb(category, message);
    },
  };
}
