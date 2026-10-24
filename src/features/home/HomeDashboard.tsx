import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Search,
  PlusCircle,
  Shield,
  Lock,
  Zap,
  MapPin,
  ArrowRight,
  Navigation,
  Users,
  Compass,
} from 'lucide-react';

export interface PopularCorridor {
  origin: string;
  destination: string;
  pickupLocationId: string;
  dropLocationId: string;
  type: string;
  description: string;
  estimatedTime: string;
}

export interface HomeDashboardProps {
  onFindRideClick?: (corridor?: { pickupLocationId: string; dropLocationId: string }) => void;
  onOfferRideClick?: () => void;
  userEmail?: string | null;
}

export const POPULAR_CORRIDORS: PopularCorridor[] = [
  {
    origin: 'Talegaon Station',
    destination: 'ICEM Campus',
    pickupLocationId: 'loc_talegaon_station',
    dropLocationId: 'loc_icem_campus',
    type: 'Railway Link',
    description: 'Convenient hop for train commuters via Talegaon Dabhade',
    estimatedTime: '15-20 min',
  },
  {
    origin: 'Akurdi / Nigdi',
    destination: 'ICEM Campus',
    pickupLocationId: 'loc_akurdi_station',
    dropLocationId: 'loc_icem_campus',
    type: 'PCMC Express',
    description: 'Connecting Pradhikaran & Old Mumbai Highway to Parandwadi',
    estimatedTime: '25-30 min',
  },
  {
    origin: 'Ravet / Kiwale',
    destination: 'ICEM Campus',
    pickupLocationId: 'loc_kiwale_phata',
    dropLocationId: 'loc_icem_campus',
    type: 'Local Route',
    description: 'Quick corridor across Mukai Chowk & Dehu Road bypass',
    estimatedTime: '12-18 min',
  },
  {
    origin: 'Bhosari / Landewadi',
    destination: 'ICEM Campus',
    pickupLocationId: 'loc_bhosari_stand',
    dropLocationId: 'loc_icem_campus',
    type: 'East PCMC',
    description: 'Daily carpool and bike share routes for eastern PCMC students',
    estimatedTime: '30-40 min',
  },
];

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
            <Button onClick={() => onFindRideClick?.()} variant="outline" className="gap-2">
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

      {/* Popular Campus Commute Corridors */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="h-5 w-5 text-primary" />
                <span>Popular Campus Commute Corridors</span>
              </CardTitle>
              <CardDescription>
                Frequent student routes connecting transit hubs with Indira ICEM Parandwadi
              </CardDescription>
            </div>
            <Badge variant="cyan" className="gap-1 px-3 py-1">
              <Compass className="h-3.5 w-3.5" />
              <span>Live Campus Hubs</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {POPULAR_CORRIDORS.map((corridor, idx) => (
              <div
                key={idx}
                onClick={() =>
                  onFindRideClick?.({
                    pickupLocationId: corridor.pickupLocationId,
                    dropLocationId: corridor.dropLocationId,
                  })
                }
                className="group cursor-pointer rounded-xl border border-border bg-card p-3.5 transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                      <MapPin className="h-4 w-4 text-[#00A2A5] shrink-0" />
                      <span>{corridor.origin}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span>{corridor.destination}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {corridor.description}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-border/50">
                  <span className="font-medium text-[#003C84] dark:text-[#00A2A5]">{corridor.type}</span>
                  <span className="text-muted-foreground">~{corridor.estimatedTime}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How ICEM Connect Works */}
      <div className="rounded-2xl border border-border bg-muted/20 p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>How ICEM Connect Works</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            A trusted, peer-to-peer ride sharing community exclusively for verified Indira students
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
              1
            </div>
            <h4 className="font-semibold text-foreground text-sm">Find or Offer</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Search by route and time to catch a ride, or offer empty scooter and bike seats on journeys you already make.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00A2A5]/10 text-[#00A2A5] font-bold text-xs">
              2
            </div>
            <h4 className="font-semibold text-foreground text-sm">Coordinate Easily</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Coordinate pickup locations directly with your verified rider or host via private in-app trip messaging.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E85C0D]/10 text-[#E85C0D] font-bold text-xs">
              3
            </div>
            <h4 className="font-semibold text-foreground text-sm">Travel Safely</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Track live trip location in real-time. Ephemeral location sharing automatically turns off once your ride is complete.
            </p>
          </div>
        </div>
      </div>

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
