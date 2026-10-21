import React from 'react';
import { Compass, ShieldCheck } from 'lucide-react';
import { BackendStatusBadge } from '@/features/health/BackendStatusBadge';

export const AppHeader: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-foreground tracking-tight">ICEM Connect</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                <ShieldCheck className="h-3 w-3" /> Campus Verified
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Indira College of Engineering & Management, Pune
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <BackendStatusBadge />
        </div>
      </div>
    </header>
  );
};
