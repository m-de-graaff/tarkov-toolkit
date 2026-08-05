// Error monitoring, dormant by default: Sentry loads only when the build
// sets VITE_SENTRY_DSN (dynamic import - zero bundle cost when off).
// reportError works either way, so call sites never care whether a DSN is
// configured; without one, errors just reach the console.
//
// Setup follows skills.sentry.dev/instrument for React 18 + Vite + React
// Router v7: errors + tracing (router-aware) + session replay with the
// privacy defaults (all text masked, media blocked), logs enabled. The one
// deliberate deviation: init is a dynamic import kicked off at boot instead
// of a synchronous first import, trading "errors in the first ~100ms" for
// keeping Sentry out of the boot chunk entirely when no DSN is set.
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { useEffect } from 'react';

type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;

const DSN = String((import.meta.env?.VITE_SENTRY_DSN as string | undefined) ?? '');

export const MONITORING_ENABLED = DSN.length > 0;

/** Call once at boot; a failed load must never take the app down with it. */
export async function initMonitoring(): Promise<void> {
  if (!MONITORING_ENABLED || import.meta.env.MODE === 'test') return;
  try {
    const mod = await import('@sentry/react');
    mod.init({
      dsn: DSN,
      environment: import.meta.env.MODE,
      // release groups errors per deploy; Vercel exposes the commit sha
      release: (import.meta.env?.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) ?? undefined,
      integrations: [
        // router-aware tracing: transactions named by route, not raw URL.
        // Tracing must register before profiling.
        mod.reactRouterV7BrowserTracingIntegration({
          useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),
        // browser profiling: needs the Document-Policy: js-profiling response
        // header (set in vercel.json); silently no-ops where unsupported
        mod.browserProfilingIntegration(),
        mod.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
      // tracing: sample production lightly, everything in dev
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0,
      tracePropagationTargets: ['localhost', /^\/api/],
      // profiling: profiles attach to sampled traces automatically
      profileSessionSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
      profileLifecycle: 'trace',
      // replay: 10% of ordinary sessions, every session with an error
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      enableLogs: true,
    });
    sentry = mod;
  } catch (error) {
    console.error('monitoring init failed:', error);
  }
}

/** Report a handled error with optional context (component stack, tags). */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } else {
    console.error('error:', error, context ?? '');
  }
}

/**
 * Application metrics (count / gauge / distribution), no-ops without a DSN.
 * Reserve for KPIs Sentry can't derive from errors and spans - business
 * events, not request counts.
 */
export const metric = {
  count(name: string, value = 1, attributes?: Record<string, string | number>): void {
    sentry?.metrics?.count?.(name, value, attributes ? { attributes } : undefined);
  },
  gauge(name: string, value: number, attributes?: Record<string, string | number>): void {
    sentry?.metrics?.gauge?.(name, value, attributes ? { attributes } : undefined);
  },
  distribution(
    name: string,
    value: number,
    attributes?: Record<string, string | number>,
  ): void {
    sentry?.metrics?.distribution?.(name, value, attributes ? { attributes } : undefined);
  },
};

/** Forward a user-feedback submission to Sentry (alongside our own storage). */
export function reportFeedback(message: string, email?: string): void {
  sentry?.captureFeedback(
    {
      message,
      ...(email ? { email } : {}),
      url: window.location.href,
    },
    { captureContext: { tags: { source: 'feedback-sheet' } } },
  );
}

/**
 * Attach/detach the signed-in user (id only - no email or name) so Sentry's
 * release health and issue pages count real users instead of anonymous
 * sessions.
 */
export function identifyUser(userId: string | null): void {
  sentry?.setUser(userId ? { id: userId } : null);
}
