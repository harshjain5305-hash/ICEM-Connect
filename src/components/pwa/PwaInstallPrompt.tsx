import React, { useState, useEffect } from 'react';
import { usePwa } from '@/features/pwa/usePwa';
import { Download, RefreshCw, WifiOff, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const PwaInstallPrompt: React.FC = () => {
  const {
    isInstallable,
    isInstalled,
    isIos,
    isOffline,
    updateAvailable,
    installApp,
    updateApp,
  } = usePwa();

  const [dismissed, setDismissed] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  // Check dismissal timestamp (suppress for 7 days if dismissed)
  useEffect(() => {
    try {
      const dismissedUntil = localStorage.getItem('icem_pwa_dismissed_until');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setDismissed(true);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowIosInstructions(false);
    try {
      // Dismiss for 7 days
      localStorage.setItem('icem_pwa_dismissed_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {
      // ignore
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await installApp();
    } else if (isIos && !isInstalled) {
      setShowIosInstructions(true);
    }
  };

  return (
    <aside aria-label="App Status and Installation" className="relative z-50">
      {/* 1. Offline Connectivity Banner */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Offline mode active — showing cached ride data</span>
        </div>
      )}

      {/* 2. New Version Update Banner */}
      {updateAvailable && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 bg-primary text-primary-foreground px-4 py-2.5 text-xs shadow-md"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin shrink-0 text-[#00A2A5]" />
            <span>A new update for ICEM Connect is available!</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={updateApp}
            className="h-7 text-xs font-semibold px-2.5 bg-white text-primary hover:bg-slate-100"
          >
            Update Now
          </Button>
        </div>
      )}

      {/* 3. Install App Prompt Banner (Android/Chrome or iOS web) */}
      {!isInstalled && !dismissed && (isInstallable || (isIos && !showIosInstructions)) && (
        <div className="border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Download className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  Install ICEM Connect App
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Instant campus ride alerts and offline access
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="primary"
                onClick={handleInstallClick}
                className="h-8 text-xs px-3 font-semibold shadow-sm"
              >
                Install
              </Button>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                aria-label="Dismiss install banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. iOS Safari Add to Home Screen Instructions Modal/Pill */}
      {showIosInstructions && !isInstalled && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-4 max-w-md md:mx-auto rounded-2xl border border-border bg-card p-4 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Share className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Install on iPhone / iPad</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowIosInstructions(false)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            To install ICEM Connect as a native web app on iOS Safari:
          </p>
          <ol className="text-xs text-foreground space-y-1.5 list-decimal pl-4">
            <li>
              Tap the <strong>Share</strong> button <Share className="h-3 w-3 inline text-primary" /> in Safari's bottom toolbar.
            </li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
            <li>Tap <strong>"Add"</strong> in the top right corner.</li>
          </ol>
          <div className="mt-3 text-right">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowIosInstructions(false)}
              className="h-7 text-xs"
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
};
