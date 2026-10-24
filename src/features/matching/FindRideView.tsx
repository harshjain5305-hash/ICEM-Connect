import React, { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { LocationSelect } from '@/features/locations/LocationSelect';
import { locationService } from '@/features/locations/location.service';
import type { Location } from '@/features/locations/location.schema';
import { matchingService } from './matching.service';
import { routeAlertService } from './routeAlert.service';
import type { RideSearchResult, MatchedRideCandidate } from './matching.types';
import { RideDetailModal } from '@/features/rides/RideDetailModal';
import { JoinRequestModal } from '@/features/requests/JoinRequestModal';
import type { Ride } from '@/features/rides/ride.types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import {
  Search,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  Clock,
  Users,
  Car,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Eye,
  Bell,
  Shield,
  LogIn,
  Repeat,
} from 'lucide-react';

export interface FindRideViewProps {
  initialCorridor?: { pickupLocationId: string; dropLocationId: string; timestamp?: number } | null;
  onOfferClick?: () => void;
  onViewRequestsClick?: () => void;
  onRequestAuth?: () => void;
}

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const FindRideView: React.FC<FindRideViewProps> = ({
  initialCorridor,
  onOfferClick,
  onViewRequestsClick,
  onRequestAuth,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [pickup, setPickup] = useState<Location | null>(null);
  const [drop, setDrop] = useState<Location | null>(null);
  const [date, setDate] = useState<string>(getTodayString());
  const [time, setTime] = useState<string>('');
  const [flexibility, setFlexibility] = useState<number>(30);
  const [requestedSeats, setRequestedSeats] = useState<number>(1);

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<RideSearchResult | null>(null);

  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [requestCandidate, setRequestCandidate] = useState<MatchedRideCandidate | null>(null);
  const [authPromptCandidate, setAuthPromptCandidate] = useState<MatchedRideCandidate | null>(null);

  // Route Alert state
  const [alertEmail, setAlertEmail] = useState('');
  const [alertActive, setAlertActive] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSettingAlert, setIsSettingAlert] = useState(false);

  // 1. Resolve initial corridor if passed from Home
  useEffect(() => {
    if (!initialCorridor) return;
    let isMounted = true;

    async function loadCorridor() {
      try {
        const [pLoc, dLoc] = await Promise.all([
          locationService.getById(initialCorridor!.pickupLocationId),
          locationService.getById(initialCorridor!.dropLocationId),
        ]);
        if (!isMounted) return;
        if (pLoc && dLoc) {
          setPickup(pLoc);
          setDrop(dLoc);
          setIsSearching(true);
          setErrorMessage(null);
          try {
            const result = await matchingService.findCompatibleRides({
              pickup_location_id: pLoc.id,
              drop_location_id: dLoc.id,
              departure_date: getTodayString(),
              departure_time: null,
              flexibility_minutes: 30,
              requested_seats: 1,
              passenger_id: user?.id || null,
            });
            if (isMounted) {
              setSearchResult(result);
            }
          } catch (err: unknown) {
            if (isMounted && err instanceof Error) {
              setErrorMessage(err.message);
            }
          } finally {
            if (isMounted) setIsSearching(false);
          }
        }
      } catch (err) {
        console.warn('Failed to resolve initial corridor:', err);
      }
    }

    loadCorridor();
    return () => {
      isMounted = false;
    };
  }, [initialCorridor, initialCorridor?.timestamp, user?.id]);

  // 2. Check existing route alerts when search result returns empty
  useEffect(() => {
    if (!searchResult || searchResult.candidates.length > 0) {
      setAlertActive(false);
      setAlertMessage(null);
      return;
    }

    async function checkExistingAlert() {
      const emailToCheck = user?.email || alertEmail;
      if (!emailToCheck && !user?.id) return;
      const alerts = await routeAlertService.getUserAlerts(user?.id, emailToCheck);
      const matching = alerts.find(
        (a) =>
          a.pickupLocationId === searchResult?.pickupLocation.id &&
          a.dropLocationId === searchResult?.dropLocation.id &&
          a.date === searchResult?.query.departure_date
      );
      if (matching) {
        setAlertActive(true);
      }
    }
    checkExistingAlert();
  }, [searchResult, user?.id, user?.email, alertEmail]);

  const handleSwapLocations = () => {
    const temp = pickup;
    setPickup(drop);
    setDrop(temp);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!pickup) {
      setErrorMessage('Please choose your starting pickup location.');
      return;
    }
    if (!drop) {
      setErrorMessage('Please choose your intended destination.');
      return;
    }
    if (pickup.id === drop.id) {
      setErrorMessage('Pickup and drop locations cannot be the same place.');
      return;
    }
    if (!date) {
      setErrorMessage('Please select a travel date.');
      return;
    }

    setIsSearching(true);
    try {
      const result = await matchingService.findCompatibleRides({
        pickup_location_id: pickup.id,
        drop_location_id: drop.id,
        departure_date: date,
        departure_time: time.trim() ? time : null,
        flexibility_minutes: flexibility,
        requested_seats: requestedSeats,
        passenger_id: user?.id || null,
      });

      setSearchResult(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to search rides. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSetRouteAlert = async () => {
    if (!searchResult) return;
    const targetEmail = user?.email || alertEmail.trim();
    if (!targetEmail) {
      setAlertMessage('Please enter your institutional email to receive route alerts.');
      return;
    }
    setIsSettingAlert(true);
    setAlertMessage(null);
    try {
      await routeAlertService.createAlert({
        userId: user?.id || null,
        email: targetEmail,
        pickupLocationId: searchResult.pickupLocation.id,
        dropLocationId: searchResult.dropLocation.id,
        pickupName: searchResult.pickupLocation.name,
        dropName: searchResult.dropLocation.name,
        date: searchResult.query.departure_date,
      });
      setAlertActive(true);
      setAlertMessage('Route alert activated! You will be notified in-app as soon as a student offers a ride.');
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to set route alert.');
    } finally {
      setIsSettingAlert(false);
    }
  };

  const handleRequestSeatClick = (candidate: MatchedRideCandidate) => {
    if (!isAuthenticated) {
      setAuthPromptCandidate(candidate);
      return;
    }
    setRequestCandidate(candidate);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      {/* GUEST BROWSING NOTICE */}
      {!isAuthenticated && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#00A2A5] shrink-0" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Browsing as Guest:</strong> You can search, explore routes, and view schedules freely. Sign-in is only required when requesting a seat.
            </span>
          </div>
          {onRequestAuth && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0 self-start sm:self-auto gap-1"
              onClick={onRequestAuth}
            >
              <LogIn className="h-3 w-3" /> Sign In
            </Button>
          )}
        </div>
      )}

      {/* SEARCH CARD */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Search className="h-5 w-5 text-[#003C84] dark:text-[#00A2A5]" />
            </div>
            <div>
              <CardTitle className="text-lg">Find a Verified Student Ride</CardTitle>
              <p className="text-xs text-muted-foreground">
                Matches your requested route segment against existing host corridors
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive" className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs">{errorMessage}</div>
            </Alert>
          )}

          {/* 1. PICKUP & DROP LOCATIONS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Journey Segment
              </span>
              <button
                type="button"
                onClick={handleSwapLocations}
                disabled={!pickup && !drop}
                className="text-xs text-primary hover:text-primary/80 disabled:opacity-40 flex items-center gap-1 font-medium transition-colors"
              >
                <ArrowUpDown className="h-3 w-3" /> Swap Points
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <LocationSelect
                label="Pickup Spot"
                placeholder="e.g. ICEM Gate, Somatne Phata, Talegaon..."
                value={pickup?.id}
                onSelect={setPickup}
              />
              <LocationSelect
                label="Drop Destination"
                placeholder="e.g. Akurdi, Pimpri, Bhosari..."
                value={drop?.id}
                onSelect={setDrop}
              />
            </div>
          </div>

          {/* 2. SCHEDULE & TIMING */}
          <div className="grid gap-3 sm:grid-cols-2 border-t border-border/60 pt-3">
            <div>
              <label htmlFor="search-date-input" className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Date of Travel
              </label>
              <Input
                id="search-date-input"
                type="date"
                min={getTodayString()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="search-time-input" className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Approx Time (Optional)
              </label>
              <Input
                id="search-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="Any time"
              />
            </div>
          </div>

          {/* 3. FLEXIBILITY & SEATS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs">
            {time && (
              <div className="space-y-1.5">
                <span className="text-muted-foreground block">Time Flexibility Window</span>
                <div className="flex gap-1.5">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setFlexibility(mins)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
                        flexibility === mins
                          ? 'bg-primary text-primary-foreground font-semibold border-primary'
                          : 'border-input hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      &plusmn;{mins}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-muted-foreground block">Seats Required</span>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRequestedSeats(s)}
                    className={`px-3 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                      requestedSeats === s
                        ? 'bg-primary text-primary-foreground font-semibold border-primary'
                        : 'border-input hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    {s} {s === 1 ? 'Seat' : 'Seats'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SEARCH BUTTON */}
          <div className="pt-2">
            <Button
              type="button"
              disabled={isSearching}
              onClick={() => handleSearch()}
              className="w-full gap-2 bg-[#003C84] hover:bg-[#1D59A3] text-white font-medium py-2.5"
            >
              <Search className={`h-4 w-4 ${isSearching ? 'animate-spin' : ''}`} />
              {isSearching ? 'Scanning Compatible Corridors...' : 'Search Compatible Rides'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RESULTS DISPLAY */}
      {searchResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#00A2A5]" />
                Compatible Rides Found ({searchResult.candidates.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                For corridor: <strong>{searchResult.pickupLocation.name}</strong> &rarr;{' '}
                <strong>{searchResult.dropLocation.name}</strong>
              </p>
            </div>

            <Badge variant="cyan" className="text-xs">
              Deterministic Matching Active
            </Badge>
          </div>

          {searchResult.candidates.length === 0 ? (
            <Card className="text-center py-8 px-4 border-border bg-card space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  No compatible rides found for this segment on {searchResult.query.departure_date}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Try adjusting your departure time, increasing time flexibility, or choosing a major transit hub (such as Somatne Phata or Talegaon Station).
                </p>
              </div>

              {/* ROUTE ALERT SUBSCRIPTION BOX */}
              <div className="mx-auto max-w-md rounded-xl border border-primary/20 bg-primary/5 p-4 text-left space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Bell className="h-4 w-4 text-[#00A2A5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Set a Route Alert for This Trip
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      We'll notify you automatically when a verified student offers a ride along this corridor.
                    </p>
                  </div>
                </div>

                {alertActive ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Route Alert Active ({searchResult.pickupLocation.name.split(' ')[0]} &rarr; {searchResult.dropLocation.name.split(' ')[0]})</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {!isAuthenticated && (
                      <Input
                        type="email"
                        placeholder="your.name@indiraicem.ac.in"
                        value={alertEmail}
                        onChange={(e) => setAlertEmail(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    )}
                    {alertMessage && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">{alertMessage}</p>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSetRouteAlert}
                      disabled={isSettingAlert}
                      className="w-full h-8 text-xs gap-1.5 bg-primary text-white"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {isSettingAlert ? 'Setting Alert...' : 'Notify Me When a Ride is Available'}
                    </Button>
                  </div>
                )}
              </div>

              {onOfferClick && (
                <div className="pt-2">
                  <Button
                    onClick={onOfferClick}
                    variant="outline"
                    className="gap-2"
                  >
                    <PlusCircle className="h-4 w-4 text-[#00A2A5]" /> Offer a Ride on This Route
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {searchResult.candidates.map((candidate) => (
                <CandidateMatchCard
                  key={candidate.ride.id}
                  candidate={candidate}
                  onInspect={() => {
                    setSelectedRide(candidate.ride);
                    setIsModalOpen(true);
                  }}
                  onRequestSeat={() => {
                    handleRequestSeatClick(candidate);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* RIDE DETAIL MODAL */}
      {selectedRide && (
        <RideDetailModal
          ride={selectedRide}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedRide(null);
          }}
          onRideUpdated={() => {
            handleSearch();
          }}
        />
      )}

      {/* AUTH PROMPT MODAL FOR GUESTS CLICKING REQUEST SEAT */}
      {authPromptCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md shadow-2xl border-border animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-6 w-6 text-[#003C84] dark:text-[#00A2A5]" />
              </div>
              <CardTitle className="text-lg">Student Login Required</CardTitle>
              <CardDescription>
                To reserve a seat and coordinate directly with your student rider, verified ICEM student credentials are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
                <div className="font-semibold text-primary">Selected Trip:</div>
                <div className="text-foreground">
                  {authPromptCandidate.pickupWaypoint.label} &rarr; {authPromptCandidate.dropWaypoint.label}
                </div>
                <div className="text-muted-foreground">
                  Departs at {authPromptCandidate.ride.departure_time} &bull; {authPromptCandidate.ride.available_seats} seat free
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setAuthPromptCandidate(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-primary text-white gap-1.5"
                onClick={() => {
                  setAuthPromptCandidate(null);
                  if (onRequestAuth) onRequestAuth();
                }}
              >
                <LogIn className="h-3.5 w-3.5" /> Sign In / Register
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* JOIN REQUEST MODAL (Phase 6) */}
      {requestCandidate && (
        <JoinRequestModal
          ride={requestCandidate.ride}
          pickupWaypoint={requestCandidate.pickupWaypoint}
          dropWaypoint={requestCandidate.dropWaypoint}
          isOpen={Boolean(requestCandidate)}
          onClose={() => setRequestCandidate(null)}
          onRequestSubmitted={() => {
            handleSearch();
          }}
          onViewRequests={onViewRequestsClick}
        />
      )}
    </div>
  );
};

interface CandidateMatchCardProps {
  candidate: MatchedRideCandidate;
  onInspect: () => void;
  onRequestSeat: () => void;
}

const CandidateMatchCard: React.FC<CandidateMatchCardProps> = ({
  candidate,
  onInspect,
  onRequestSeat,
}) => {
  const { ride, pickupWaypoint, dropWaypoint, matchScore, scoreBreakdown } = candidate;
  const isDailyCommuter = Boolean(ride.note && ride.note.includes('Daily Commuter Routine'));

  return (
    <div
      onClick={onInspect}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md space-y-3"
    >
      {/* TOP ROW: MATCH SCORE + SCHEDULE */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={matchScore >= 90 ? 'success' : matchScore >= 75 ? 'cyan' : 'secondary'}
            className="font-bold text-xs"
          >
            {matchScore}% Match
          </Badge>
          {isDailyCommuter && (
            <Badge variant="cyan" className="gap-1 font-semibold text-[11px] bg-[#00A2A5]/15 text-[#00A2A5] border-[#00A2A5]/30">
              <Repeat className="h-3 w-3" /> Daily Commuter (Mon–Fri)
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Route: {scoreBreakdown.routeAlignmentScore}/40 &bull; Time: {scoreBreakdown.timeProximityScore}/30
          </span>
        </div>

        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> Departs at {ride.departure_time}
        </span>
      </div>

      {/* MATCHED SEGMENT HIGHLIGHT */}
      <div className="rounded-lg border border-primary/20 bg-[#003C84]/5 p-2.5 text-xs text-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-[#003C84] dark:text-[#00A2A5]">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>Your Requested Route Segment</span>
        </div>
        <div className="flex items-center gap-2 font-medium">
          <span className="truncate">{pickupWaypoint.label}</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">{dropWaypoint.label}</span>
        </div>
      </div>

      {/* FULL CORRIDOR PREVIEW */}
      <div className="text-xs space-y-0.5">
        <span className="text-[11px] text-muted-foreground">Host Entire Journey:</span>
        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
          <span className="truncate">{ride.origin?.name || 'ICEM Origin'}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="truncate">{ride.destination?.name || 'Destination'}</span>
        </div>
      </div>

      {/* BOTTOM ROW: VEHICLE, CAPACITY & ACTION */}
      <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1">
            <Car className="h-3.5 w-3.5 text-primary" /> {ride.vehicle_type}
          </span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Users className="h-3.5 w-3.5 text-primary" /> {ride.available_seats} seat free
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
          >
            <Eye className="h-3.5 w-3.5" /> View Route
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-[#003C84] hover:bg-[#1D59A3] text-white"
            onClick={(e) => {
              e.stopPropagation();
              onRequestSeat();
            }}
          >
            <Users className="h-3.5 w-3.5" /> Request Seat
          </Button>
        </div>
      </div>
    </div>
  );
};
