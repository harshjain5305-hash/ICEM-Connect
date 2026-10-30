import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Ride } from '@/features/rides/ride.types';
import type { JoinRequest, RideParticipant, PublicStudentInfo } from './request.types';
import { requestService } from './request.service';
import { useAuth } from '@/features/auth/useAuth';
import { ratingService } from '@/features/ratings/rating.service';
import { RatingModal } from '@/features/ratings/RatingModal';
import { ReportModal } from '@/features/moderation/ReportModal';
import { BlockUserModal } from '@/features/moderation/BlockUserModal';
import { paymentService } from '@/features/payments/payment.service';
import type { RidePayment } from '@/features/payments/payment.types';
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
  ShieldAlert,
  Ban,
  IndianRupee,
  CheckCircle2,
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
  const [payments, setPayments] = useState<RidePayment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [ratingParticipant, setRatingParticipant] = useState<PublicStudentInfo | null>(null);
  const [reportParticipant, setReportParticipant] = useState<PublicStudentInfo | null>(null);
  const [blockParticipant, setBlockParticipant] = useState<PublicStudentInfo | null>(null);
  const [hasRatedMap, setHasRatedMap] = useState<Record<string, boolean>>({});

  const isHost = Boolean(user && user.id === ride.host_id);
  const isFetchingRef = React.useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) {
      setIsLoading(true);
    }
    setActionError(null);
    try {
      const [reqs, parts, payList] = await Promise.all([
        requestService.listRequestsForRide(ride.id),
        requestService.listParticipants(ride.id),
        paymentService.listPaymentsByRide(ride.id).catch(() => []),
      ]);
      setRequests(reqs);
      setParticipants(parts);
      setPayments(payList);
    } catch (err: unknown) {
      console.error('Failed to load ride requests:', err);
    } finally {
      isFetchingRef.current = false;
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [ride.id]);

  useEffect(() => {
    loadData(false);

    // 1. Supabase Realtime changes for this ride
    let channel: any = null;
    if (isSupabaseConfigured()) {
      try {
        channel = supabase
          .channel(`public:requests_${ride.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'ride_join_requests',
              filter: `ride_id=eq.${ride.id}`,
            },
            () => {
              loadData(true);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'ride_participants',
              filter: `ride_id=eq.${ride.id}`,
            },
            () => {
              loadData(true);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'ride_payments',
              filter: `ride_id=eq.${ride.id}`,
            },
            () => {
              loadData(true);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription error in HostRequestsSection:', err);
      }
    }

    // 2. Custom window events
    const handleUpdate = () => {
      loadData(true);
    };
    window.addEventListener('icem:join_requests_updated', handleUpdate);
    window.addEventListener('icem:payments_updated', handleUpdate);

    // 3. Fallback poll when open and tab is visible (15s)
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 15000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('icem:join_requests_updated', handleUpdate);
      window.removeEventListener('icem:payments_updated', handleUpdate);
      clearInterval(pollTimer);
    };
  }, [loadData, ride.id]);

  useEffect(() => {
    if (!user || ride.status !== 'COMPLETED') return;
    const checkRated = async () => {
      const map: Record<string, boolean> = {};
      for (const p of participants) {
        map[p.student_id] = await ratingService.hasRated(ride.id, user.id, p.student_id);
      }
      setHasRatedMap(map);
    };
    checkRated();
  }, [participants, ride.id, ride.status, user]);

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

  const handleConfirmPayment = async (paymentId: string) => {
    if (!user) return;
    setProcessingPaymentId(paymentId);
    setActionError(null);
    try {
      await paymentService.confirmPayment(user.id, paymentId);
      await loadData(true);
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to confirm payment');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const handleDisputePayment = async (paymentId: string) => {
    if (!user) return;
    const reason = window.prompt(
      'Please state why this contribution was not received (e.g. incorrect reference, not shown in UPI):',
      'Payment not received in UPI'
    );
    if (!reason) return;
    setProcessingPaymentId(paymentId);
    setActionError(null);
    try {
      await paymentService.disputePayment(user.id, paymentId, reason);
      await loadData(true);
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to report payment non-receipt');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  if (!isHost) {
    return null;
  }

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const pendingConfirmations = payments.filter((p) => p.status === 'PAID_PENDING_CONFIRMATION');

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

      {/* PENDING FUEL CONTRIBUTION CONFIRMATION ALERTS */}
      {pendingConfirmations.length > 0 && (
        <div className="space-y-2">
          {pendingConfirmations.map((pay) => (
            <div
              key={pay.id}
              className="rounded-xl border border-emerald-500/40 bg-linear-to-r from-emerald-500/15 via-emerald-500/10 to-transparent p-3.5 space-y-2.5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground text-xs block">
                      Confirm Fuel Contribution
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {pay.payer?.name || 'Passenger'} reported sending ₹{pay.amount} via {pay.method}
                    </span>
                  </div>
                </div>
                <Badge variant="warning" className="text-[10px]">
                  Action Required
                </Badge>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={processingPaymentId === pay.id}
                  onClick={() => handleConfirmPayment(pay.id)}
                  className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
                >
                  <Check className="h-3.5 w-3.5" /> Confirm Received ₹{pay.amount}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={processingPaymentId === pay.id}
                  onClick={() => handleDisputePayment(pay.id)}
                  className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  Not Received
                </Button>
              </div>
            </div>
          ))}
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

                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[10px]">
                    {p.seat_count} Seat{p.seat_count > 1 ? 's' : ''} Confirmed
                  </Badge>

                  {/* Payment Status Badge for this Participant */}
                  {(() => {
                    const pay = payments.find((item) => item.payer_id === p.student_id);
                    if (!pay) return null;
                    if (pay.status === 'CONFIRMED') {
                      return (
                        <Badge variant="success" className="text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" /> ₹{pay.amount} Received
                        </Badge>
                      );
                    }
                    if (pay.status === 'PAID_PENDING_CONFIRMATION') {
                      return (
                        <Badge variant="warning" className="text-[10px]">
                          ₹{pay.amount} Verify
                        </Badge>
                      );
                    }
                    if (pay.status === 'PENDING') {
                      return (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          ₹{pay.amount} Due
                        </Badge>
                      );
                    }
                    if (pay.status === 'DISPUTED') {
                      return (
                        <Badge variant="destructive" className="text-[10px]">
                          ₹{pay.amount} Disputed
                        </Badge>
                      );
                    }
                    return null;
                  })()}

                  {ride.status === 'COMPLETED' && p.student && (
                    hasRatedMap[p.student_id] ? (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current text-[#EAA023]" /> Rated
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setRatingParticipant(p.student!)}
                        className="h-6 text-[11px] px-2 bg-[#003C84] hover:bg-[#1D59A3] text-white gap-1"
                      >
                        <Star className="h-3 w-3 fill-current text-[#EAA023]" /> Rate
                      </Button>
                    )
                  )}

                  {p.student && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setReportParticipant(p.student!)}
                        title="Report Participant"
                        className="p-1 rounded text-muted-foreground hover:text-red-600 transition-colors"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockParticipant(p.student!)}
                        title="Block Participant"
                        className="p-1 rounded text-muted-foreground hover:text-amber-700 transition-colors"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
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

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Fuel Share:</span>
                    {Number(req.offered_amount) > 0 ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        ₹{Number(req.offered_amount)} offered
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">₹0 (Free / No share)</span>
                    )}
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

      {/* RATING MODAL */}
      {ratingParticipant && (
        <RatingModal
          isOpen={Boolean(ratingParticipant)}
          onClose={() => setRatingParticipant(null)}
          ride={ride}
          reviewee={ratingParticipant}
          onRatingSubmitted={() => {
            loadData();
          }}
        />
      )}

      {/* REPORT MODAL */}
      {reportParticipant && (
        <ReportModal
          isOpen={Boolean(reportParticipant)}
          onClose={() => setReportParticipant(null)}
          reportedStudent={reportParticipant}
          rideId={ride.id}
        />
      )}

      {/* BLOCK MODAL */}
      {blockParticipant && (
        <BlockUserModal
          isOpen={Boolean(blockParticipant)}
          onClose={() => setBlockParticipant(null)}
          targetStudent={blockParticipant}
          onBlocked={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};
