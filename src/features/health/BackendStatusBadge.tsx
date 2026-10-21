import React, { useEffect, useState } from 'react';
import { checkBackendHealth, type HealthReport } from './healthService';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export const BackendStatusBadge: React.FC = () => {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const refreshHealth = async () => {
    setLoading(true);
    try {
      const result = await checkBackendHealth();
      setReport(result);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const getStatusBadge = () => {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Probing backend...</span>
        </span>
      );
    }

    if (!report) return null;

    switch (report.status) {
      case 'healthy':
        return (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            title="Click to view backend health details"
          >
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span>Backend: Healthy ({report.latencyMs}ms)</span>
          </button>
        );
      case 'unconfigured':
        return (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            title="Click to view backend setup details"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>Backend: Phase 0 Baseline</span>
          </button>
        );
      case 'error':
        return (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
            title="Click to view connection error"
          >
            <XCircle className="h-3.5 w-3.5 text-red-600" />
            <span>Backend: Error</span>
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {getStatusBadge()}

      {showDetails && report && (
        <div className="absolute right-0 top-10 z-50 w-80 sm:w-96 rounded-xl border border-border bg-card p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm text-foreground">Backend Health & Foundation</h4>
            </div>
            <button
              onClick={refreshHealth}
              disabled={loading}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
            </button>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div>
              <span className="font-medium text-muted-foreground">Status: </span>
              <span className={cn(
                "font-semibold uppercase",
                report.status === 'healthy' && "text-emerald-600",
                report.status === 'unconfigured' && "text-amber-600",
                report.status === 'error' && "text-red-600",
              )}>
                {report.status}
              </span>
            </div>

            <div>
              <span className="font-medium text-muted-foreground">Diagnostic: </span>
              <p className="mt-0.5 text-foreground">{report.message}</p>
            </div>

            <div className="rounded-lg bg-muted/60 p-2.5 font-mono text-[11px] space-y-1">
              <div>Domain Rule: @{report.config.institutionalDomain}</div>
              <div>Baseline Migration: Ready in supabase/migrations/</div>
              <div>Supabase Edge Function: Ready in supabase/functions/</div>
              <div>Measured Latency: {report.latencyMs}ms</div>
            </div>

            {report.status === 'unconfigured' && (
              <p className="text-[11px] text-muted-foreground italic">
                To connect to a live Supabase database, provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.
              </p>
            )}
          </div>

          <div className="mt-4 pt-2 border-t border-border flex justify-end">
            <button
              onClick={() => setShowDetails(false)}
              className="text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
