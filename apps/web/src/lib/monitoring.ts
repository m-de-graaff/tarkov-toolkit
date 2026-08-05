// Error monitoring, dormant by default: Sentry loads only when the build
// sets VITE_SENTRY_DSN (dynamic import - zero bundle cost when off).
// reportError works either way, so call sites never care whether a DSN is
// configured; without one, errors just reach the console.

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
      // release lets Sentry group errors per deploy; Vercel exposes the sha
      release: (import.meta.env?.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) ?? undefined,
      // keep the payload small: no session replay, light tracing
      integrations: [],
      tracesSampleRate: 0,
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
