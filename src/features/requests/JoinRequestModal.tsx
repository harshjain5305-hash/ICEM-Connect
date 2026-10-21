import React, { useState } from 'react';
import type { Ride, RideWaypoint } from '@/features/rides/ride.types';
import { useAuth } from '@/features/auth/useAuth';
import { requestService } from './request.service';
import { Button } from '@/components/ui/Button';
import {
  X,
  Clock,
  Car,
  MapPin,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Send,
} from 'lucide-react';

export interface JoinRequestModalProps {
  ride: Ride;
  pickupWaypoint?: RideWaypoint | null;
  dropWaypoint?: RideWaypoint | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted?: () => void;
}

export const JoinRequestModal: React.FC<JoinRequestModalProps> = ({
  ride,
  pickupWaypoint,
  dropWaypoint,
  isOpen,
  onClose,
  onRequestSubmitted,
}) => {
  const { user } = useAuth();
  const [seatCount, setSeatCount] = useState<number>(1);
  const [specificAreaNote, setSpecificAreaNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const maxSeatsAllowed = Math.min(ride.available_seats, 4);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in as a verified ICEM student.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await requestService.createRequest(user.id, {
        ride_id: ride.id,
        pickup_waypoint_id: pickupWaypoint?.id || null,
        drop_waypoint_id: dropWaypoint?.id || null,
        seat_count: seatCount,
        specific_area_note: specificAreaNote.trim() || null,
      });

      setSuccess(true);
      if (onRequestSubmitted) {
        onRequestSubmitted();
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit join request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-request-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-8">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/30">
          <div>
            <h3 id="join-request-modal-title" className="text-base font-bold text-foreground">
              Request a Seat
            </h3>
            <p className="text-xs text-muted-foreground">
              Coordinate commute with ICEM student host
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-5">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-foreground">Request Sent!</h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Waiting for the host to accept your request. You will receive a notification as soon as they respond.
                </p>
              </div>
              <Button
                className="w-full bg-[#003C84] hover:bg-[#1D59A3] text-white"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* RIDE SEGMENT SUMMARY */}
              <div className="rounded-xl border border-primary/20 bg-[#003C84]/5 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-[#003C84] dark:text-[#00A2A5]">
                    <Clock className="h-4 w-4" /> {ride.departure_time} &bull; {ride.departure_date}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Car className="h-3.5 w-3.5" /> {ride.vehicle_type}
                  </span>
                </div>

                <div className="space-y-1 pt-1 border-t border-primary/10">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Pickup: {pickupWaypoint?.label || ride.origin?.name || 'Origin'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <MapPin className="h-3.5 w-3.5 text-[#E85C0D] shrink-0" />
                    <span>Drop: {dropWaypoint?.label || ride.destination?.name || 'Destination'}</span>
                  </div>
                </div>
              </div>

              {/* SEAT COUNT SELECTION */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Number of Seats</span>
                  <span className="text-[11px] text-muted-foreground">
                    {ride.available_seats} seat{ride.available_seats === 1 ? '' : 's'} free
                  </span>
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((num) => {
                    const isAvailable = num <= maxSeatsAllowed;
                    const isSelected = seatCount === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setSeatCount(num)}
                        className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#003C84] text-white border-[#003C84] dark:bg-[#00A2A5]'
                            : isAvailable
                            ? 'border-input hover:bg-muted text-foreground'
                            : 'border-border/40 text-muted-foreground/40 cursor-not-allowed bg-muted/20'
                        }`}
                      >
                        {num} {num === 1 ? 'Seat' : 'Seats'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OPTIONAL PICKUP / SPECIFIC-AREA NOTE (Design.md §73) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="specific-area-note"
                  className="text-xs font-semibold text-foreground flex items-center justify-between"
                >
                  <span className="flex items-center gap-1">
                    Specific area / pickup note <span className="text-muted-foreground font-normal">(optional)</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {specificAreaNote.length}/140
                  </span>
                </label>
                <textarea
                  id="specific-area-note"
                  rows={2}
                  maxLength={140}
                  value={specificAreaNote}
                  onChange={(e) => setSpecificAreaNote(e.target.value)}
                  placeholder="e.g., Near the HP petrol pump; I can walk 100 m"
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                />
                <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                  <HelpCircle className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  Add a landmark or small-area detail that helps the host understand your pickup location.
                </p>
              </div>

              {/* ERROR ALERT */}
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || maxSeatsAllowed < 1}
                  className="flex-1 gap-2 bg-[#003C84] hover:bg-[#1D59A3] text-white"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSubmitting ? 'Sending Request...' : 'Send Request'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
