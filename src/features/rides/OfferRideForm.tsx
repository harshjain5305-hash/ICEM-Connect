import React, { useState, useId, useEffect } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { LocationSelect } from '@/features/locations/LocationSelect';
import type { Location } from '@/features/locations/location.schema';
import { rideService, RideServiceError } from './ride.service';
import type { Ride } from './ride.types';
import type { VehicleType } from '@/types/database';
import { RouteMapPreview } from '@/features/routes/RouteMapPreview';
import { WaypointSequenceList } from '@/features/routes/WaypointSequenceList';
import { routeService } from '@/features/routes/route.service';
import type { CalculatedRoute } from '@/features/routes/route.types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowRight,
  ArrowUpDown,
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  CheckCircle2,
  FileEdit,
  Send,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export interface OfferRideFormProps {
  onSuccess?: (ride: Ride) => void;
  onCancel?: () => void;
  initialOrigin?: Location | null;
  initialDestination?: Location | null;
}

function getDefaultDepartureTime(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(0);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const OfferRideForm: React.FC<OfferRideFormProps> = ({
  onSuccess,
  onCancel,
  initialOrigin = null,
  initialDestination = null,
}) => {
  const { user, profile } = useAuth();

  const [origin, setOrigin] = useState<Location | null>(initialOrigin);
  const [destination, setDestination] = useState<Location | null>(initialDestination);
  const [departureDate, setDepartureDate] = useState<string>(getTodayString());
  const [departureTime, setDepartureTime] = useState<string>(getDefaultDepartureTime());
  const [vehicleType, setVehicleType] = useState<VehicleType>('SCOOTER');
  const [totalSeats, setTotalSeats] = useState<number>(1);
  const [note, setNote] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDraftSubmitting, setIsDraftSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRide, setCreatedRide] = useState<Ride | null>(null);

  const [calculatedRoute, setCalculatedRoute] = useState<CalculatedRoute | null>(null);
  const [selectedWaypointSequences, setSelectedWaypointSequences] = useState<number[]>([]);

  useEffect(() => {
    let isCancelled = false;

    if (origin && destination && origin.id !== destination.id) {
      routeService
        .calculateRouteForLocations(origin.id, destination.id)
        .then((res) => {
          if (!isCancelled) {
            setCalculatedRoute(res);
            setSelectedWaypointSequences(res.waypoints.map((w) => w.sequence));
          }
        })
        .catch((err) => {
          console.warn('Failed to calculate preview route:', err);
        });
    } else {
      setCalculatedRoute(null);
      setSelectedWaypointSequences([]);
    }

    return () => {
      isCancelled = true;
    };
  }, [origin, destination]);

  const handleToggleWaypoint = (sequence: number) => {
    setSelectedWaypointSequences((prev) =>
      prev.includes(sequence)
        ? prev.filter((s) => s !== sequence)
        : [...prev, sequence].sort((a, b) => a - b)
    );
  };

  const noteId = useId();

  const handleSwapLocations = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSeatChange = (seats: number) => {
    setTotalSeats(seats);
  };

  const handleVehicleChange = (type: VehicleType) => {
    setVehicleType(type);
    if ((type === 'SCOOTER' || type === 'BIKE') && totalSeats > 1) {
      setTotalSeats(1); // Standard 2-wheeler default is 1 pillion passenger
    }
  };

  const handleSubmit = async (asDraft: boolean) => {
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('You must be signed in with your verified ICEM email to offer a ride.');
      return;
    }

    if (!origin) {
      setErrorMessage('Please select a starting pickup origin point.');
      return;
    }

    if (!destination) {
      setErrorMessage('Please select a trip destination.');
      return;
    }

    if (origin.id === destination.id) {
      setErrorMessage('Origin and destination cannot be the same transit point.');
      return;
    }

    if (!departureDate) {
      setErrorMessage('Please specify a departure date.');
      return;
    }

    if (!departureTime) {
      setErrorMessage('Please specify an approximate departure time.');
      return;
    }

    if (asDraft) {
      setIsDraftSubmitting(true);
    } else {
      setIsSubmitting(true);
    }

    try {
      const payload = {
        origin_location_id: origin.id,
        destination_location_id: destination.id,
        departure_date: departureDate,
        departure_time: departureTime,
        total_seats: totalSeats,
        available_seats: totalSeats,
        vehicle_type: vehicleType,
        note: note.trim() || null,
      };

      const ride = await rideService.createRide(user.id, payload, asDraft);
      setCreatedRide(ride);
      if (onSuccess) {
        onSuccess(ride);
      }
    } catch (err) {
      if (err instanceof RideServiceError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create ride. Please check your network and try again.');
      }
    } finally {
      setIsSubmitting(false);
      setIsDraftSubmitting(false);
    }
  };

  const resetForm = () => {
    setCreatedRide(null);
    setOrigin(null);
    setDestination(null);
    setDepartureDate(getTodayString());
    setDepartureTime(getDefaultDepartureTime());
    setVehicleType('SCOOTER');
    setTotalSeats(1);
    setNote('');
    setErrorMessage(null);
  };

  // SUCCESS STATE
  if (createdRide) {
    const isDraft = createdRide.status === 'DRAFT';

    return (
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">
            {isDraft ? 'Ride Saved as Draft' : 'Ride Published Successfully!'}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isDraft
              ? 'Your ride has been saved privately. You can publish it whenever you are ready.'
              : 'Your ride is now visible to verified ICEM students travelling along this route.'}
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge variant={isDraft ? 'outline' : 'cyan'}>
                {createdRide.status}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Route Corridor</span>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="truncate">{createdRide.origin?.name || 'Origin'}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{createdRide.destination?.name || 'Destination'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div>
                <span className="text-muted-foreground block">Departure</span>
                <span className="font-medium text-foreground">
                  {createdRide.departure_date} at {createdRide.departure_time}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Vehicle &amp; Seats</span>
                <span className="font-medium text-foreground">
                  {createdRide.vehicle_type} &bull; {createdRide.total_seats} {createdRide.total_seats === 1 ? 'seat' : 'seats'}
                </span>
              </div>
            </div>

            {createdRide.note && (
              <div className="border-t border-border/60 pt-2 text-xs">
                <span className="text-muted-foreground block mb-0.5">Note to passengers:</span>
                <p className="italic text-foreground">&ldquo;{createdRide.note}&rdquo;</p>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-0">
          <Button
            className="w-full sm:w-auto flex-1 gap-2 bg-[#003C84] hover:bg-[#1D59A3]"
            onClick={() => {
              if (onSuccess) onSuccess(createdRide);
            }}
          >
            <Send className="h-4 w-4" /> Go to My Rides
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={resetForm}
          >
            Offer Another Ride
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // MAIN FORM STATE
  return (
    <Card className="shadow-sm border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="h-5 w-5 text-[#003C84] dark:text-[#00A2A5]" />
            </div>
            <div>
              <CardTitle className="text-lg">Offer a Student Ride</CardTitle>
              <p className="text-xs text-muted-foreground">
                Hosting a ride as <strong>{profile?.name || user?.email}</strong>
              </p>
            </div>
          </div>
          <Badge variant="cyan" className="hidden sm:inline-flex gap-1 items-center">
            <ShieldCheck className="h-3 w-3" /> Verified Student
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {errorMessage && (
          <Alert variant="destructive" className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-xs">{errorMessage}</div>
          </Alert>
        )}

        {/* 1. ROUTE CORRIDOR SELECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
              1. Route Corridor
            </label>
            <button
              type="button"
              onClick={handleSwapLocations}
              disabled={!origin && !destination}
              className="text-xs text-primary hover:text-primary/80 disabled:opacity-40 flex items-center gap-1 font-medium transition-colors"
            >
              <ArrowUpDown className="h-3 w-3" /> Swap Origin &amp; Dest
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LocationSelect
              label="Starting From (Origin)"
              placeholder="e.g. ICEM Campus Parandwadi"
              value={origin?.id}
              onSelect={setOrigin}
            />
            <LocationSelect
              label="Going To (Destination)"
              placeholder="e.g. Somatne, Talegaon, Bhosari..."
              value={destination?.id}
              onSelect={setDestination}
            />
          </div>

          {origin && destination && (
            <div className="space-y-3 pt-1">
              <div className="rounded-lg border border-primary/20 bg-[#003C84]/5 p-2.5 text-xs text-foreground flex items-center gap-2">
                <span className="font-semibold text-primary">Selected Route:</span>
                <span className="truncate">{origin.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{destination.name}</span>
              </div>

              {calculatedRoute && (
                <div className="space-y-3 pt-1">
                  <RouteMapPreview
                    route={calculatedRoute}
                    waypoints={calculatedRoute.waypoints.filter(
                      (w) =>
                        w.sequence === 1 ||
                        w.sequence === calculatedRoute.waypoints.length ||
                        selectedWaypointSequences.includes(w.sequence)
                    )}
                  />
                  <WaypointSequenceList
                    waypoints={calculatedRoute.waypoints}
                    interactive
                    selectedSequences={selectedWaypointSequences}
                    onToggleWaypoint={handleToggleWaypoint}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. DATE & DEPARTURE TIME */}
        <div className="space-y-3 border-t border-border/60 pt-4">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            2. Schedule &amp; Timing
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="departure-date-input" className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Departure Date
              </label>
              <Input
                id="departure-date-input"
                type="date"
                min={getTodayString()}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="departure-time-input" className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Departure Time (Approx)
              </label>
              <Input
                id="departure-time-input"
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* 3. VEHICLE TYPE & SEATS */}
        <div className="space-y-3 border-t border-border/60 pt-4">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            3. Vehicle &amp; Available Seats
          </label>

          <div className="space-y-2">
            <span className="text-xs text-muted-foreground block">Vehicle Type</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleVehicleChange('SCOOTER')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                  vehicleType === 'SCOOTER'
                    ? 'border-[#003C84] bg-[#003C84]/10 text-[#003C84] dark:border-[#00A2A5] dark:text-[#00A2A5] font-semibold'
                    : 'border-input hover:bg-muted/50 text-foreground'
                }`}
              >
                <span className="text-lg mb-1">🛵</span>
                <span>Scooter / Activa</span>
              </button>

              <button
                type="button"
                onClick={() => handleVehicleChange('BIKE')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                  vehicleType === 'BIKE'
                    ? 'border-[#003C84] bg-[#003C84]/10 text-[#003C84] dark:border-[#00A2A5] dark:text-[#00A2A5] font-semibold'
                    : 'border-input hover:bg-muted/50 text-foreground'
                }`}
              >
                <span className="text-lg mb-1">🏍️</span>
                <span>Motorcycle</span>
              </button>

              <button
                type="button"
                onClick={() => handleVehicleChange('OTHER')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                  vehicleType === 'OTHER'
                    ? 'border-[#003C84] bg-[#003C84]/10 text-[#003C84] dark:border-[#00A2A5] dark:text-[#00A2A5] font-semibold'
                    : 'border-input hover:bg-muted/50 text-foreground'
                }`}
              >
                <span className="text-lg mb-1">🚗</span>
                <span>Car / Other</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Passenger Seats Available
              </span>
              <span className="text-xs font-semibold text-primary">
                {totalSeats} {totalSeats === 1 ? 'seat' : 'seats'}
              </span>
            </div>

            <div className="flex gap-2">
              {[1, 2, 3, 4].map((num) => {
                const isSelected = totalSeats === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSeatChange(num)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-[#003C84] bg-[#003C84] text-white dark:bg-[#00A2A5] dark:border-[#00A2A5] font-semibold shadow-sm'
                        : 'border-input bg-card hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    {num} {num === 1 ? 'Seat' : 'Seats'}
                  </button>
                );
              })}
            </div>
            {(vehicleType === 'SCOOTER' || vehicleType === 'BIKE') && totalSeats > 1 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                <HelpCircle className="h-3 w-3 shrink-0" />
                Note: 2-wheelers typically offer 1 pillion seat for student campus commutes.
              </p>
            )}
          </div>
        </div>

        {/* 4. OPTIONAL COORDINATION NOTE */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between">
            <label htmlFor={noteId} className="text-xs font-semibold text-foreground uppercase tracking-wide">
              4. Note / Pickup Guidance (Optional)
            </label>
            <span className="text-[11px] text-muted-foreground">
              {note.length}/300
            </span>
          </div>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="e.g. Leaving from ICEM main gate right after MCA lab. Pillion helmet available."
            className="flex min-h-[70px] w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-colors"
            rows={2}
          />
          <p className="text-[11px] text-muted-foreground">
            Non-binding coordination notes are visible to passengers reviewing your ride before requesting.
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-2 border-t border-border pt-4 bg-muted/20">
        <Button
          type="button"
          disabled={isSubmitting || isDraftSubmitting}
          onClick={() => handleSubmit(false)}
          className="w-full sm:flex-1 gap-2 bg-[#003C84] hover:bg-[#1D59A3] text-white shadow-sm font-medium"
        >
          {isSubmitting ? (
            'Publishing Ride...'
          ) : (
            <>
              <Send className="h-4 w-4" /> Publish Ride
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting || isDraftSubmitting}
          onClick={() => handleSubmit(true)}
          className="w-full sm:w-auto gap-2 text-foreground"
        >
          {isDraftSubmitting ? (
            'Saving Draft...'
          ) : (
            <>
              <FileEdit className="h-4 w-4 text-muted-foreground" /> Save as Draft
            </>
          )}
        </Button>

        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting || isDraftSubmitting}
            onClick={onCancel}
            className="w-full sm:w-auto text-xs text-muted-foreground"
          >
            Cancel
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
