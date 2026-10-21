import { supabase, getSupabaseConfig } from '@/integrations/supabase/client';

export type HealthStatusType = 'healthy' | 'unconfigured' | 'error' | 'connecting';

export interface HealthReport {
  status: HealthStatusType;
  message: string;
  latencyMs: number;
  timestamp: string;
  config: {
    url: string;
    isConfigured: boolean;
    institutionalDomain: string;
  };
  details?: Record<string, unknown>;
}

export async function checkBackendHealth(): Promise<HealthReport> {
  const startTime = performance.now();
  const config = getSupabaseConfig();

  if (!config.isConfigured) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      status: 'unconfigured',
      message: 'Supabase credentials are placeholder. Local frontend shell and migrations are ready.',
      latencyMs: elapsed,
      timestamp: new Date().toISOString(),
      config: {
        url: config.url || 'Not set',
        isConfigured: false,
        institutionalDomain: config.institutionalDomain,
      },
      details: {
        migrationBaseline: 'supabase/migrations/20261021000000_phase0_baseline.sql',
        edgeFunctionBaseline: 'supabase/functions/health-check/index.ts',
        notice: 'Add your active VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to connect to a live Supabase instance.',
      },
    };
  }

  try {
    // Attempt health RPC check
    const { data, error } = await supabase.rpc('check_health');
    const elapsed = Math.round(performance.now() - startTime);

    if (error) {
      // Fallback: simple query to check auth or basic connectivity
      const { error: fallbackError } = await supabase.from('public_students').select('count', { count: 'exact', head: true });
      const fallbackElapsed = Math.round(performance.now() - startTime);

      if (fallbackError) {
        return {
          status: 'error',
          message: `Backend reachable but query returned: ${fallbackError.message}`,
          latencyMs: fallbackElapsed,
          timestamp: new Date().toISOString(),
          config: {
            url: config.url,
            isConfigured: true,
            institutionalDomain: config.institutionalDomain,
          },
          details: { error: fallbackError },
        };
      }

      return {
        status: 'healthy',
        message: 'Connected to Supabase PostgreSQL (via table query fallback).',
        latencyMs: fallbackElapsed,
        timestamp: new Date().toISOString(),
        config: {
          url: config.url,
          isConfigured: true,
          institutionalDomain: config.institutionalDomain,
        },
      };
    }

    return {
      status: 'healthy',
      message: 'Supabase database & health RPC responding normally.',
      latencyMs: elapsed,
      timestamp: new Date().toISOString(),
      config: {
        url: config.url,
        isConfigured: true,
        institutionalDomain: config.institutionalDomain,
      },
      details: (data as Record<string, unknown>) || {},
    };
  } catch (err) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to connect to backend',
      latencyMs: elapsed,
      timestamp: new Date().toISOString(),
      config: {
        url: config.url,
        isConfigured: true,
        institutionalDomain: config.institutionalDomain,
      },
    };
  }
}
