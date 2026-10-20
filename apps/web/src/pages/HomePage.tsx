import type { HealthResponse } from '@susharts/shared';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api-client.js';

type ApiStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; health: HealthResponse }
  | { kind: 'error'; message: string };

/**
 * Phase 1 placeholder storefront. The status panel exists to prove the
 * frontend-to-API-to-database path works end to end before features land.
 */
export function HomePage() {
  const [status, setStatus] = useState<ApiStatus>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    apiFetch<HealthResponse>('/api/v1/health', { signal: controller.signal })
      .then((health) => setStatus({ kind: 'ready', health }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to reach the API',
        });
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="container-page py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Handmade crochet &amp; pipe-cleaner art
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        The storefront is being built. Browsing, custom options and checkout arrive in the next
        phases.
      </p>

      <div className="mt-10 rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Platform status
        </h2>
        <div className="mt-3 text-sm" role="status" aria-live="polite">
          {status.kind === 'loading' && <p className="text-slate-500">Checking services…</p>}
          {status.kind === 'error' && <p className="text-red-600">API unreachable: {status.message}</p>}
          {status.kind === 'ready' && (
            <dl className="grid gap-2 sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">API</dt>
                <dd className="font-medium">{status.health.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Database</dt>
                <dd className="font-medium">{status.health.checks.database}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Uptime</dt>
                <dd className="font-medium">{status.health.uptimeSeconds}s</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
