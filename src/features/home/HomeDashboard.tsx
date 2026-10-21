import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Search, PlusCircle, CheckCircle2, Shield, Database, Lock, Zap } from 'lucide-react';
import { INSTITUTIONAL_DOMAIN } from '@/features/auth/domainValidation';

interface HomeDashboardProps {
  onFindRideClick?: () => void;
  onOfferRideClick?: () => void;
  userEmail?: string | null;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onFindRideClick,
  onOfferRideClick,
  userEmail,
}) => {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      {/* Greeting Banner with Indira Brand Navy & Cyan Accents */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-primary/10 via-[#00A2A5]/5 to-transparent p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#003C84]/10 border border-[#003C84]/20 px-3 py-1 text-xs font-semibold text-primary">
              <Shield className="h-3.5 w-3.5 text-[#00A2A5]" />
              <span>ICEM Campus Network</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {userEmail ? `Welcome, ${userEmail.split('@')[0]}` : 'Welcome to ICEM Connect'}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Coordinate trips you are already making with fellow ICEM students. Share bike/scooter seats and stay connected safely.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button onClick={onFindRideClick} variant="outline" className="gap-2">
              <Search className="h-4 w-4 text-[#00A2A5]" />
              <span>Find a Ride</span>
            </Button>
            <Button onClick={onOfferRideClick} className="gap-2 shadow-sm bg-primary hover:bg-primary-hover">
              <PlusCircle className="h-4 w-4" />
              <span>Offer a Seat</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Phase 0 Foundation Verification Checklist */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <span>Phase 0 — Project Foundation Status</span>
              </CardTitle>
              <CardDescription>
                Architectural baseline validated against PRD.md, Architecture.md, and Rules.md
              </CardDescription>
            </div>
            <Badge variant="cyan" className="gap-1 px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Foundation Verified</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-1 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Indira Institutional Theme &amp; Tokens</span>
              </div>
              <p className="text-muted-foreground">
                Indira Deep Navy (<code>#003C84</code>), Royal Blue (<code>#1D59A3</code>), Cyan-Teal (<code>#00A2A5</code>), and Tangerine (<code>#E85C0D</code>) with Inter typography.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-1 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Supabase Backend Integration</span>
              </div>
              <p className="text-muted-foreground">
                Connected client integration with live health check, typed schemas, and fallback diagnostics.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-1 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Institutional Auth &amp; Domain Shell</span>
              </div>
              <p className="text-muted-foreground">
                Strict server-side validation rejecting non-@<strong>{INSTITUTIONAL_DOMAIN}</strong> accounts.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-1 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>PostgreSQL Migrations &amp; RLS</span>
              </div>
              <p className="text-muted-foreground">
                Isolated <code>user_roles</code>, private PRN fields, and strict Row Level Security policies.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Principles & Privacy Commitment */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003C84]/10 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <h4 className="font-semibold text-foreground text-sm">Verified Students Only</h4>
          <p className="text-muted-foreground leading-relaxed">
            Every user is authenticated with their official ICEM student credentials. No external or public taxi drivers.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00A2A5]/10 text-[#00A2A5]">
            <Lock className="h-4 w-4" />
          </div>
          <h4 className="font-semibold text-foreground text-sm">Strict Data Privacy</h4>
          <p className="text-muted-foreground leading-relaxed">
            Student PRN numbers and private contact details are never exposed. Live GPS is temporary and only shared during active rides.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E85C0D]/10 text-[#E85C0D]">
            <Zap className="h-4 w-4" />
          </div>
          <h4 className="font-semibold text-foreground text-sm">Route-Based Sharing</h4>
          <p className="text-muted-foreground leading-relaxed">
            Coordinating rides students are already making between ICEM, Main Road, Market, Pimpri, and Bhosari.
          </p>
        </div>
      </div>
    </div>
  );
};
