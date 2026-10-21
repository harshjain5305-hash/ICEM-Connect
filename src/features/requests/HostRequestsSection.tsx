import React, { useState, useEffect, useCallback } from 'react';
import type { Ride } from '@/features/rides/ride.types';
import type { JoinRequest, RideParticipant } from './request.types';
import { requestService } from './request.service';
import { useAuth } from '@/features/auth/useAuth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Users,
  Check,
  X,
  Star,
  Clock,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

export interface HostRequestsSectionProps {
  ride: Ride;
  onRideCapacityChanged?: () => void;
}

export const HostRequestsSection: React.FC<HostRequestsSectionProps> = ({
  ride,
  onRideCapacityChanged,
}) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [participants, setParticipants] = useState<RideParticipant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isHost = Boolean(user && user.id === ride.host_id);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const [reqs, parts] = await Promise.all([
        requestService.listRequestsForRide(ride.id),
        requestService.listParticipants(ride.id),
      ]);
      setRequests(reqs);
      setParticipants(parts);
    } catch (err: unknown) {
      console.error('Failed to load ride requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ride.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAccept = async (requestId: string) => {
    if (!user) return;
    setProcessingId(requestId);
    setActionError(null);
    try {
      await requestService.acceptRequest(user.id, requestId);
      await loadData();
      if (onRideCapacityChanged) {
        onRideCapacityChanged();
      }
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to accept request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!user) return;
    setProcessingId(requestId);
    setActionError(null);
    try {
      await requestService.rejectRequest(user.id, { request_id: requestId });
      await loadData();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isHost) {
    return null;
  }

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  return (
    <div className="space-y-4 pt-2 border-t border-border/80">
      {/* SECTION TITLE & BADGE */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="h-4 w-4 text-primary" />
          Seat Requests &amp; Passengers
        </h4>
        <div className="flex gap-1.5">
          {pendingRequests.length > 0 && (
            <Badge variant="warning" className="text-[10px] font-bold">
              {pendingRequests.length} Pending
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {ride.available_seats} seat{ride.available_seats === 1 ? '' : 's'} free
          </Badge>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* CONFIRMED PARTICIPANTS LIST */}
      {participants.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-muted-foreground block">
            Confirmed Participants ({participants.length})
          </span>
          <div className="space-y-1.5">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                    {p.student?.name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span>{p.student?.name || 'Student'}</span>
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {p.student?.department} &bull; Yr {p.student?.year}
                    </span>
                  </div>
                </div>

                <Badge variant="success" className="text-[10px]">
                  {p.seat_count} Seat{p.seat_count > 1 ? 's' : ''} Confirmed
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PENDING REQUESTS (Design.md §73) */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-muted-foreground block">
          Pending Requests ({pendingRequests.length})
        </span>

        {isLoading ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            Loading requests...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center text-xs text-muted-foreground italic">
            No pending requests for this ride yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-border bg-card p-3 text-xs space-y-2.5 shadow-sm"
              >
                {/* REQUESTER IDENTITY */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                      {req.student?.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <span className="font-bold text-foreground block">
                        {req.student?.name || 'ICEM Student'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {req.student?.department} &bull; Year {req.student?.year}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3 fill-amber-500" />
                    {req.student?.rating ? req.student.rating.toFixed(1) : '5.0'}
                  </div>
                </div>

                {/* TRIP DETAILS & PICKUP NOTE (Design.md §73) */}
                <div className="rounded-lg bg-muted/40 p-2 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested Seats:</span>
                    <span className="font-semibold text-foreground">
                      {req.seat_count} {req.seat_count === 1 ? 'Seat' : 'Seats'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pickup note:</span>
                    <span
                      className={`font-medium ${
                        req.specific_area_note
                          ? 'text-[#003C84] dark:text-[#00A2A5]'
                          : 'text-muted-foreground italic'
                      }`}
                    >
                      {req.specific_area_note || 'None'}
                    </span>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Requested {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex gap-2 pt-1 border-t border-border/60">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={processingId === req.id}
                    onClick={() => handleReject(req.id)}
                    className="flex-1 h-8 text-xs text-destructive hover:bg-destructive/10 gap-1"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      processingId === req.id || ride.available_seats < req.seat_count
                    }
                    onClick={() => handleAccept(req.id)}
                    className="flex-1 h-8 text-xs bg-[#003C84] hover:bg-[#1D59A3] text-white gap-1"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
