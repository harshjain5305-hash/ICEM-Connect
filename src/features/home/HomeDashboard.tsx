import React, { useState } from 'react';
import type { Ride } from '@/features/rides/ride.types';
import { AvailableCampusRides } from './AvailableCampusRides';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LocationSelect } from '@/features/locations/LocationSelect';
import { locationService } from '@/features/locations/location.service';
import type { Location } from '@/features/locations/location.schema';
import { matchingService } from '@/features/matching/matching.service';
import type { RideSearchResult, MatchedRideCandidate } from '@/features/matching/matching.types';
import { JoinRequestModal } from '@/features/requests/JoinRequestModal';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/lib/utils';
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
  ArrowRightLeft,
  ArrowUpDown,
  SlidersHorizontal,
  Clock,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Car,
  Bike,
  Repeat,
  LogIn,
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

export interface CorridorSelection {
  pickupLocationId: string;
  dropLocationId: string;
  timestamp?: number;
}

export interface HomeDashboardProps {
  onFindRideClick?: (corridor?: CorridorSelection) => void;
  onOfferRideClick?: () => void;
  onInspectRide?: (ride: Ride) => void;
  onRequestAuth?: () => void;
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

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTomorrowString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatOptionDateLabel(dateStr: string): string {
  const today = getTodayString();
  const tomorrow = getTomorrowString();

  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[parseInt(parts[1], 10) - 1] || parts[1];
    return `${parseInt(parts[2], 10)} ${month}`;
  }
  return dateStr;
}

function safeScrollTop(): void {
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    try {
      if (typeof navigator !== 'undefined' && (navigator.userAgent.includes('jsdom') || navigator.userAgent.includes('Node.js'))) {
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // JSDOM fallback
    }
  }
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onFindRideClick,
  onOfferRideClick,
  onInspectRide,
  onRequestAuth,
  userEmail,
}) => {
  const { user, isAuthenticated } = useAuth();

  // Search widget states
  const [pickup, setPickup] = useState<Location | null>(null);
  const [drop, setDrop] = useState<Location | null>(null);
  const [date, setDate] = useState<string>(getTodayString());
  const [time, setTime] = useState<string>('');
  const [flexibility, setFlexibility] = useState<number>(30);
  const [requestedSeats, setRequestedSeats] = useState<number>(1);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'ALL' | 'BIKE' | 'SCOOTER' | 'OTHER'>('ALL');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<RideSearchResult | null>(null);

  // Modal states for requesting seats
  const [requestCandidate, setRequestCandidate] = useState<MatchedRideCandidate | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState<boolean>(false);

  const handleSwapLocations = () => {
    const temp = pickup;
    setPickup(drop);
    setDrop(temp);
  };

  const handleSearch = async (customPickup?: Location, customDrop?: Location) => {
    const pLoc = customPickup || pickup;
    const dLoc = customDrop || drop;

    if (!pLoc || !dLoc) {
      setSearchError('Please select both pickup and destination locations to search rides.');
      return;
    }
    if (pLoc.id === dLoc.id) {
      setSearchError('Pickup and destination must be different locations.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await matchingService.findCompatibleRides({
        pickup_location_id: pLoc.id,
        drop_location_id: dLoc.id,
        departure_date: date,
        departure_time: time || null,
        flexibility_minutes: flexibility,
        requested_seats: requestedSeats,
        passenger_id: user?.id || null,
      });
      setSearchResult(result);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search compatible rides');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCorridorClick = async (corridor: PopularCorridor) => {
    onFindRideClick?.({
      pickupLocationId: corridor.pickupLocationId,
      dropLocationId: corridor.dropLocationId,
      timestamp: Date.now(),
    });
    try {
      const [pLoc, dLoc] = await Promise.all([
        locationService.getById(corridor.pickupLocationId),
        locationService.getById(corridor.dropLocationId),
      ]);
      if (pLoc && dLoc) {
        setPickup(pLoc);
        setDrop(dLoc);
        await handleSearch(pLoc, dLoc);
        safeScrollTop();
      }
    } catch (err) {
      console.warn('Failed to load corridor locations:', err);
    }
  };

  const handleClearSearch = () => {
    setSearchResult(null);
    setSearchError(null);
  };

  const handleRequestSeatClick = (candidate: MatchedRideCandidate) => {
    if (!isAuthenticated) {
      if (onRequestAuth) {
        onRequestAuth();
      } else {
        setShowAuthPrompt(true);
      }
      return;
    }
    setRequestCandidate(candidate);
  };

  const filteredCandidates = searchResult?.candidates.filter((c) => {
    if (vehicleTypeFilter === 'ALL') return true;
    return c.ride.vehicle_type === vehicleTypeFilter;
  }) || [];

  const hasActiveFilters = requestedSeats > 1 || Boolean(time) || vehicleTypeFilter !== 'ALL' || date !== getTodayString();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      {/* COMPACT RIDE FINDER HEADER BAR (Replaces tall welcome hero banner) */}
      <div className="rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 shadow-sm space-y-3.5">
        {/* Brand & Action Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#003C84]/10 text-primary border border-primary/20">
              <Shield className="h-4 w-4 text-[#00A2A5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">Find a Campus Ride</span>
                {userEmail && (
                  <span className="text-xs text-muted-foreground hidden md:inline">
                    &bull; Welcome, {userEmail.split('@')[0]}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-[#00A2A5]/10 px-2 py-0.5 text-[10px] font-semibold text-[#00A2A5]">
                  Live
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Instant peer-to-peer rides connecting ICEM campus with local transit hubs
              </p>
            </div>
          </div>

          {onOfferRideClick && (
            <Button
              onClick={onOfferRideClick}
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 shrink-0"
            >
              <PlusCircle className="h-3.5 w-3.5 text-[#00A2A5]" />
              <span>Offer Seat</span>
            </Button>
          )}
        </div>

        {/* Search Inputs Container */}
        <div className="space-y-2.5">
          {/* Corridor Selection: Mobile stacked close up & down with upward/downward switch arrow */}
          <div className="relative space-y-0.5 sm:space-y-0 sm:grid sm:grid-cols-[1fr,auto,1fr] sm:items-end sm:gap-2">
            {/* Origin (From) */}
            <div className="w-full">
              <LocationSelect
                label="Pickup (Origin)"
                placeholder="From: e.g. Talegaon, Akurdi, Ravet..."
                value={pickup?.id || null}
                onSelect={(loc) => setPickup(loc)}
              />
            </div>

            {/* Switch Button: Mobile shows upward/downward arrow in-between; Desktop shows left/right arrow */}
            <div className="flex justify-center -my-2.5 sm:my-0 sm:pb-1 z-10 relative">
              <button
                type="button"
                onClick={handleSwapLocations}
                className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full sm:rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-primary transition-all shadow-xs hover:scale-105 active:scale-95"
                title="Switch pickup and destination"
                aria-label="Switch pickup and destination"
              >
                {/* Mobile: Upward and Downward arrow in between origin and destination */}
                <ArrowUpDown className="h-3.5 w-3.5 text-[#00A2A5] block sm:hidden" />
                {/* Desktop: Left/Right arrow */}
                <ArrowRightLeft className="h-4 w-4 text-[#00A2A5] hidden sm:block" />
              </button>
            </div>

            {/* Destination (To) */}
            <div className="w-full">
              <LocationSelect
                label="Destination"
                placeholder="To: e.g. ICEM Campus, Nigdi, Bhosari..."
                value={drop?.id || null}
                onSelect={(loc) => setDrop(loc)}
              />
            </div>
          </div>

          {/* Action Row: Options Button (includes Date & Seats summary) + Search Button */}
          <div className="grid grid-cols-2 sm:grid-cols-[auto,1fr] gap-2 pt-0.5">
            {/* Options Button: includes Date & Seats */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'h-9.5 px-3 rounded-lg border flex items-center justify-between sm:justify-center gap-2 text-xs font-medium transition-colors w-full sm:min-w-[190px]',
                showFilters || hasActiveFilters
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-input bg-background text-foreground hover:bg-muted/60'
              )}
              title="Travel date, seats & filters"
            >
              <div className="flex items-center gap-1.5 truncate">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#00A2A5] shrink-0" />
                <span className="truncate">
                  {formatOptionDateLabel(date)} &bull; {requestedSeats} seat{requestedSeats > 1 ? 's' : ''}
                </span>
              </div>
              {hasActiveFilters && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#00A2A5] shrink-0 animate-pulse" />
              )}
            </button>

            {/* Find Compatible Rides Button */}
            <Button
              type="button"
              disabled={isSearching}
              onClick={() => handleSearch()}
              className="h-9.5 px-4 w-full gap-2 bg-[#003C84] hover:bg-[#1D59A3] text-white font-semibold text-xs shadow-xs rounded-lg"
            >
              <Search className={cn('h-3.5 w-3.5', isSearching && 'animate-spin')} />
              <span>{isSearching ? 'Scanning...' : 'Find Compatible Rides'}</span>
            </Button>
          </div>

          {/* Expandable Options Drawer (Date of Travel, Seats, Vehicle & Time) */}
          {showFilters && (
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-3.5 text-xs animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#00A2A5]" />
                  Ride Options, Date & Seats
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDate(getTodayString());
                    setRequestedSeats(1);
                    setTime('');
                    setFlexibility(30);
                    setVehicleTypeFilter('ALL');
                  }}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Reset all defaults
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Date of Travel (Included in Options) */}
                <div className="space-y-1.5">
                  <span className="text-muted-foreground font-medium block flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary" /> Date of Travel
                  </span>
                  <div className="flex gap-1.5 items-center">
                    <button
                      type="button"
                      onClick={() => setDate(getTodayString())}
                      className={cn(
                        'px-2 py-1 rounded-md border text-center font-medium transition-colors text-[11px]',
                        date === getTodayString()
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'border-input bg-card hover:bg-muted text-foreground'
                      )}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(getTomorrowString())}
                      className={cn(
                        'px-2 py-1 rounded-md border text-center font-medium transition-colors text-[11px]',
                        date === getTomorrowString()
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'border-input bg-card hover:bg-muted text-foreground'
                      )}
                    >
                      Tomorrow
                    </button>
                    <input
                      id="home-travel-date"
                      type="date"
                      min={getTodayString()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-7 flex-1 min-w-[110px] rounded-md border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* 2. Seats Needed */}
                <div className="space-y-1.5">
                  <span className="text-muted-foreground font-medium block flex items-center gap-1">
                    <Users className="h-3 w-3 text-primary" /> Seats Required
                  </span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRequestedSeats(s)}
                        className={cn(
                          'flex-1 py-1 px-2 rounded-md border text-center font-medium transition-colors text-[11px]',
                          requestedSeats === s
                            ? 'bg-primary text-primary-foreground border-primary font-semibold'
                            : 'border-input bg-card hover:bg-muted text-foreground'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Vehicle Preference */}
                <div className="space-y-1.5">
                  <span className="text-muted-foreground font-medium block flex items-center gap-1">
                    <Car className="h-3 w-3 text-primary" /> Vehicle Type
                  </span>
                  <div className="flex gap-1">
                    {[
                      { id: 'ALL', label: 'Any' },
                      { id: 'BIKE', label: 'Bike' },
                      { id: 'SCOOTER', label: 'Scooter' },
                      { id: 'OTHER', label: 'Car' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehicleTypeFilter(v.id as any)}
                        className={cn(
                          'flex-1 py-1 px-1 rounded-md border text-center text-[11px] font-medium transition-colors',
                          vehicleTypeFilter === v.id
                            ? 'bg-primary text-primary-foreground border-primary font-semibold'
                            : 'border-input bg-card hover:bg-muted text-foreground'
                        )}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Approx Time & Flexibility */}
                <div className="space-y-1.5">
                  <span className="text-muted-foreground font-medium block flex items-center gap-1">
                    <Clock className="h-3 w-3 text-primary" /> Approx Time (Optional)
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="h-7 flex-1 rounded-md border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {time && (
                      <button
                        type="button"
                        onClick={() => setTime('')}
                        className="px-2 h-7 rounded-md border border-input text-muted-foreground hover:text-foreground text-[11px]"
                        title="Clear time"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {searchError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </div>
      </div>

      {/* DYNAMIC SEARCH RESULTS SECTION (Displayed when search is triggered) */}
      {searchResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#00A2A5]" />
                Matching Rides ({filteredCandidates.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Corridor: <strong>{searchResult.pickupLocation.name.split(' ')[0]}</strong> &rarr;{' '}
                <strong>{searchResult.dropLocation.name.split(' ')[0]}</strong> &bull; {searchResult.query.departure_date}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <X className="h-3.5 w-3.5" /> Clear Search
            </Button>
          </div>

          {filteredCandidates.length === 0 ? (
            <Card className="text-center py-7 px-4 border-border bg-card space-y-3">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  No matching rides found for this exact route & options
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Try clearing the time or vehicle filter, choosing an earlier date, or offering a seat on this route for fellow students.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {onOfferRideClick && (
                  <Button
                    size="sm"
                    onClick={onOfferRideClick}
                    className="gap-1.5 bg-primary text-white text-xs font-semibold"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Offer This Ride
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearSearch}
                  className="text-xs"
                >
                  Browse All Campus Rides
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredCandidates.map((candidate) => (
                <HomeMatchCandidateCard
                  key={candidate.ride.id}
                  candidate={candidate}
                  onInspect={() => {
                    if (onInspectRide) onInspectRide(candidate.ride);
                  }}
                  onRequestSeat={() => handleRequestSeatClick(candidate)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Available Campus Rides with 4 per page pagination */}
      <AvailableCampusRides
        onInspectRide={onInspectRide}
        onOfferRideClick={onOfferRideClick}
        onFindMoreClick={safeScrollTop}
      />

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
                Route shortcuts: Click any corridor to immediately search matching rides to and from Indira ICEM
              </CardDescription>
            </div>
            <Badge variant="cyan" className="gap-1 px-2.5 py-1 shrink-0 text-xs whitespace-nowrap">
              <Compass className="h-3.5 w-3.5" />
              <span>Route Hubs</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {POPULAR_CORRIDORS.map((corridor, idx) => (
              <div
                key={idx}
                onClick={() => handleCorridorClick(corridor)}
                className="group cursor-pointer rounded-xl border border-border bg-card p-3.5 transition-all hover:border-primary/50 hover:shadow-sm"
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

      {/* JOIN REQUEST MODAL */}
      {requestCandidate && (
        <JoinRequestModal
          ride={requestCandidate.ride}
          pickupWaypoint={requestCandidate.pickupWaypoint}
          dropWaypoint={requestCandidate.dropWaypoint}
          isOpen={Boolean(requestCandidate)}
          onClose={() => setRequestCandidate(null)}
          onRequestSubmitted={() => {
            setRequestCandidate(null);
            handleSearch();
          }}
        />
      )}

      {/* GUEST AUTH PROMPT MODAL */}
      {showAuthPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-2.5 text-primary">
              <Shield className="h-5 w-5 text-[#00A2A5]" />
              <h3 className="font-bold text-base text-foreground">Verified Student Sign-In</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              To request a seat and coordinate directly with student riders, institutional ICEM credentials are required.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowAuthPrompt(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-primary text-white gap-1.5"
                onClick={() => {
                  setShowAuthPrompt(false);
                  if (onRequestAuth) onRequestAuth();
                }}
              >
                <LogIn className="h-3.5 w-3.5" /> Sign In / Register
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface HomeMatchCandidateCardProps {
  candidate: MatchedRideCandidate;
  onInspect: () => void;
  onRequestSeat: () => void;
}

const HomeMatchCandidateCard: React.FC<HomeMatchCandidateCardProps> = ({
  candidate,
  onInspect,
  onRequestSeat,
}) => {
  const { ride, pickupWaypoint, dropWaypoint, matchScore } = candidate;
  const isDailyCommuter = Boolean(ride.note && ride.note.includes('Daily Commuter Routine'));

  return (
    <div
      onClick={onInspect}
      className="group relative cursor-pointer rounded-xl border border-border/80 bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md space-y-3"
    >
      {/* Top: Match score + Schedule */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={matchScore >= 90 ? 'success' : matchScore >= 75 ? 'cyan' : 'secondary'}
            className="text-xs font-bold"
          >
            {matchScore}% Match
          </Badge>
          {isDailyCommuter && (
            <Badge variant="cyan" className="gap-1 font-semibold text-[11px] bg-[#00A2A5]/15 text-[#00A2A5] border-[#00A2A5]/30">
              <Repeat className="h-3 w-3" /> Daily Commuter
            </Badge>
          )}
        </div>

        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> Departs at {ride.departure_time}
        </span>
      </div>

      {/* Matched Route Segment */}
      <div className="rounded-lg border border-primary/20 bg-[#003C84]/5 p-2.5 text-xs text-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-[#003C84] dark:text-[#00A2A5]">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>Requested Segment Match</span>
        </div>
        <div className="flex items-center gap-2 font-medium">
          <span className="truncate">{pickupWaypoint.label}</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">{dropWaypoint.label}</span>
        </div>
      </div>

      {/* Entire Route Preview */}
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
        <span className="shrink-0 font-medium">Full Trip:</span>
        <span className="truncate">{ride.origin?.name || 'ICEM Origin'}</span>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="truncate">{ride.destination?.name || 'Destination'}</span>
      </div>

      {/* Vehicle, Capacity & CTA */}
      <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1 capitalize">
            {ride.vehicle_type === 'SCOOTER' || ride.vehicle_type === 'BIKE' ? (
              <Bike className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Car className="h-3.5 w-3.5 text-primary" />
            )}
            {ride.vehicle_type?.toLowerCase()}
          </span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Users className="h-3.5 w-3.5 text-primary" /> {ride.available_seats} seat free
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
            className="h-7 text-xs px-2.5"
          >
            Details
          </Button>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRequestSeat();
            }}
            className="h-7 text-xs px-3 bg-[#003C84] hover:bg-[#1D59A3] text-white font-medium"
          >
            Request Seat
          </Button>
        </div>
      </div>
    </div>
  );
};
