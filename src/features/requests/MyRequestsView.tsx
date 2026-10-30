import React, { useState, useEffect, useCallback } from 'react';
import type { JoinRequest, PublicStudentInfo } from './request.types';
import { requestService } from './request.service';
import { useAuth } from '@/features/auth/useAuth';
import { ratingService } from '@/features/ratings/rating.service';
import { RatingModal } from '@/features/ratings/RatingModal';
import { ReportModal } from '@/features/moderation/ReportModal';
import { BlockUserModal } from '@/features/moderation/BlockUserModal';
import { ActiveRideSessionBanner } from '@/features/realtime/ActiveRideSessionBanner';
import { RideCoordinationChat } from '@/features/rides/RideCoordinationChat';
import { paymentService } from '@/features/payments/payment.service';
import { PaymentActionModal } from '@/features/payments/PaymentActionModal';
import type { RidePayment } from '@/features/payments/payment.types';
import { authService } from '@/features/auth/auth.service';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import {
  Clock,
  Car,
  MapPin,
  Calendar,
  AlertCircle,
  XCircle,
  Inbox,
  RefreshCw,
  Star,
  ShieldAlert,
  Ban,
  Trash2,
  MessageSquare,
  IndianRupee,
  CheckCircle2,
} from 'lucide-react';
import { SwipeableItem } from '@/components/ui/SwipeableItem';

export interface MyRequestsViewProps {
  onFindRidesClick?: () => void;
}

export const MyRequestsView: React.FC<MyRequestsViewProps> = ({ onFindRidesClick }) => {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, RidePayment>>({});
  const [paymentModalState, setPaymentModalState] = useState<{
    payment: RidePayment;
    hostUpiId: string;
    hostName: string;
  } | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [ratingReq, setRatingReq] = useState<JoinRequest | null>(null);
  const [reportUser, setReportUser] = useState<{ user: PublicStudentInfo; rideId?: string } | null>(null);
  const [blockUser, setBlockUser] = useState<PublicStudentInfo | null>(null);
  const [hasRatedMap, setHasRatedMap] = useState<Record<string, boolean>>({});
  const [chatRideId, setChatRideId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setActionError(null);
    try {
      const [data, studentPayments] = await Promise.all([
        requestService.listRequestsByStudent(user.id),
        paymentService.listStudentPayments(user.id).catch(() => []),
      ]);
      setRequests(data);

      const pMap: Record<string, RidePayment> = {};
      studentPayments.forEach((p) => {
        if (p.request_id) pMap[p.request_id] = p;
        pMap[`ride_${p.ride_id}`] = p;
      });
      setPaymentsMap(pMap);
    } catch (err: unknown) {
      console.error('Failed to load student requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const handlePaymentsUpdate = () => {
      fetchRequests();
    };
    window.addEventListener('icem:payments_updated', handlePaymentsUpdate);
    return () => window.removeEventListener('icem:payments_updated', handlePaymentsUpdate);
  }, [fetchRequests]);

  const handleOpenPayModal = async (req: JoinRequest) => {
    if (!user || !req.ride) return;
    setIsPaymentLoading(req.id);
    setActionError(null);
    try {
      const hostProfile = await authService.getProfile(req.ride.host_id).catch(() => null);
      const hostUpi = hostProfile?.upi_id || '';
      const payment = await paymentService.createOrGetPayment({
        ride_id: req.ride_id,
        request_id: req.id,
        payer_id: user.id,
        payee_id: req.ride.host_id,
        amount: req.offered_amount || 0,
      });
      setPaymentModalState({
        payment,
        hostUpiId: hostUpi,
        hostName: hostProfile?.name || 'Ride Host',
      });
    } catch (err: unknown) {
      console.error('Failed to initiate payment:', err);
      setActionError((err as Error).message || 'Failed to initiate payment');
    } finally {
      setIsPaymentLoading(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    const checkRated = async () => {
      const map: Record<string, boolean> = {};
      for (const req of requests) {
        if (req.status === 'ACCEPTED' && req.ride?.status === 'COMPLETED' && req.ride.host_id) {
          map[req.id] = await ratingService.hasRated(req.ride_id, user.id, req.ride.host_id);
        }
      }
      setHasRatedMap(map);
    };
    checkRated();
  }, [requests, user]);

  const handleCancel = async (requestId: string) => {
    if (!user) return;
    setCancellingId(requestId);
    setActionError(null);
    try {
      await requestService.cancelRequest(user.id, requestId);
      await fetchRequests();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  const isRequestDeletable = (req: JoinRequest): boolean => {
    // Live ride cannot be deleted while in progress
    if (req.ride?.status === 'ACTIVE') return false;
    // Host approval pending ride cannot be deleted
    if (req.status === 'PENDING') return false;
    return true;
  };

  const handleDismissRequest = async (requestId: string) => {
    if (!user) return;
    const target = requests.find((r) => r.id === requestId);
    if (target && !isRequestDeletable(target)) {
      if (target.status === 'PENDING') {
        setActionError('Cannot delete a ride while host approval is pending. You may cancel the request instead.');
      } else if (target.ride?.status === 'ACTIVE') {
        setActionError('Cannot delete an active live ride in progress.');
      }
      return;
    }

    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    try {
      await requestService.dismissRequest(user.id, requestId);
    } catch (err: unknown) {
      console.error('Dismiss request error:', err);
      setActionError((err as Error).message || 'Failed to dismiss request');
      await fetchRequests();
    }
  };

  const handleClearInactive = async () => {
    if (!user) return;
    setRequests((prev) => prev.filter((r) => !isRequestDeletable(r)));
    try {
      await requestService.clearInactiveRequests(user.id);
    } catch (err) {
      console.error('Clear inactive requests error:', err);
    }
  };

  const getStatusBadge = (status: JoinRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="text-xs">
            Pending Host Approval
          </Badge>
        );
      case 'ACCEPTED':
        return (
          <Badge variant="success" className="text-xs">
            Seat Confirmed
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive" className="text-xs">
            Declined
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="secondary" className="text-xs">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">My Booked Seats &amp; Requests</h2>
          <p className="text-xs text-muted-foreground">
            Track ride requests submitted to ICEM student hosts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {requests.some((r) => ['REJECTED', 'CANCELLED'].includes(r.status) || (r.status === 'ACCEPTED' && r.ride?.status === 'COMPLETED')) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearInactive}
              className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              title="Remove past/inactive requests from list (auto-deletes from database after 2 days)"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear Past
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            disabled={isLoading}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* CONTENT */}
      {isLoading ? (
        <div className="text-center py-12 text-xs text-muted-foreground">
          Loading your ride requests...
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Inbox className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">No Requests Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                You haven&apos;t requested a seat on any ICEM commute routes yet.
              </p>
            </div>
            {onFindRidesClick && (
              <Button
                size="sm"
                onClick={onFindRidesClick}
                className="bg-[#003C84] hover:bg-[#1D59A3] text-white text-xs"
              >
                Find Compatible Rides
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const deletable = isRequestDeletable(req);
            return (
              <SwipeableItem
                key={req.id}
                onDelete={() => handleDismissRequest(req.id)}
                disabled={!deletable}
                deleteLabel="Dismiss"
              >
                <Card className="overflow-hidden border border-border shadow-sm">
                  <CardHeader className="p-4 pb-2 bg-muted/20 flex flex-row items-center justify-between border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        {req.ride?.departure_date || 'Past Trip'}
                      </span>
                      <span className="text-xs text-muted-foreground">&bull;</span>
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {req.ride?.departure_time || 'Scheduled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(req.status)}
                      {deletable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissRequest(req.id);
                          }}
                          title="Delete from booked list"
                          aria-label="Delete request"
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3 text-xs">
                    {/* ROUTE CORRIDOR */}
                    <div className="rounded-lg bg-muted/40 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-foreground font-medium">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>Origin / Pickup: {req.ride?.origin?.name || (req.ride ? 'ICEM Campus Route' : 'Archived Route')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground font-medium">
                        <MapPin className="h-3.5 w-3.5 text-[#E85C0D] shrink-0" />
                        <span>Destination / Drop: {req.ride?.destination?.name || (req.ride ? 'ICEM Campus Route' : 'Archived Route')}</span>
                      </div>
                    </div>

                  {/* REALTIME ACTIVE RIDE SESSION (Phase 8) */}
                  {req.status === 'ACCEPTED' && req.ride && (
                    <ActiveRideSessionBanner
                      ride={req.ride}
                      currentUser={profile}
                      onStatusChanged={() => fetchRequests()}
                      onRateHost={() => setRatingReq(req)}
                    />
                  )}

                  {/* DETAILS ROW */}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Car className="h-3.5 w-3.5 text-primary" /> {req.ride?.vehicle_type || 'Vehicle'}
                      </span>
                      <span>
                        Seats: <strong className="text-foreground">{req.seat_count}</strong>
                      </span>
                    </div>

                    {req.specific_area_note && (
                      <span className="italic text-[11px] truncate max-w-[200px]">
                        &quot;{req.specific_area_note}&quot;
                      </span>
                    )}
                  </div>

                  {/* FUEL CONTRIBUTION & PAYMENT STATUS */}
                  {req.offered_amount !== undefined && req.offered_amount > 0 && (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <IndianRupee className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              Fuel Share: ₹{req.offered_amount}
                            </span>
                            {req.status === 'ACCEPTED' ? (
                              (() => {
                                const p = paymentsMap[req.id] || paymentsMap[`ride_${req.ride_id}`];
                                if (!p || p.status === 'PENDING') {
                                  return (
                                    <Badge variant="warning" className="text-[10px]">
                                      Payment Pending
                                    </Badge>
                                  );
                                }
                                if (p.status === 'PAID_PENDING_CONFIRMATION') {
                                  return (
                                    <Badge variant="cyan" className="text-[10px]">
                                      Awaiting Host Confirmation
                                    </Badge>
                                  );
                                }
                                if (p.status === 'CONFIRMED') {
                                  return (
                                    <Badge variant="success" className="text-[10px] gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Confirmed
                                    </Badge>
                                  );
                                }
                                if (p.status === 'DISPUTED') {
                                  return (
                                    <Badge variant="destructive" className="text-[10px]">
                                      Disputed
                                    </Badge>
                                  );
                                }
                                return null;
                              })()
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Offered with Request
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {req.status === 'ACCEPTED' ? (
                              (() => {
                                const p = paymentsMap[req.id] || paymentsMap[`ride_${req.ride_id}`];
                                if (!p || p.status === 'PENDING') {
                                  return 'Seat confirmed! Tap below to pay host directly via PhonePe, GPay, Paytm or Cash.';
                                }
                                if (p.status === 'PAID_PENDING_CONFIRMATION') {
                                  return `You marked ₹${p.amount} paid via ${p.method}. Host will confirm receipt once received.`;
                                }
                                if (p.status === 'CONFIRMED') {
                                  return 'Host confirmed receipt of your fuel share. Thank you for carpooling!';
                                }
                                if (p.status === 'DISPUTED') {
                                  return `Host indicated: "${p.dispute_reason || 'Not received'}". Please verify UPI or retry.`;
                                }
                                return '';
                              })()
                            ) : (
                              'Voluntary contribution to be settled directly with the host once approved.'
                            )}
                          </p>
                        </div>
                      </div>

                      {req.status === 'ACCEPTED' && (() => {
                        const p = paymentsMap[req.id] || paymentsMap[`ride_${req.ride_id}`];
                        if (!p || p.status === 'PENDING' || p.status === 'DISPUTED') {
                          return (
                            <Button
                              size="sm"
                              disabled={isPaymentLoading === req.id}
                              onClick={() => handleOpenPayModal(req)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-semibold h-8 shrink-0"
                            >
                              <IndianRupee className="h-3.5 w-3.5" />
                              {isPaymentLoading === req.id ? 'Loading...' : `Pay ₹${req.offered_amount} via UPI`}
                            </Button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {/* ACTIONS */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      {req.ride?.host_id && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setReportUser({
                                user: {
                                  id: req.ride!.host_id,
                                  name: 'Ride Host',
                                  department: 'Host',
                                  year: 3,
                                  rating: 5.0,
                                  is_verified: true,
                                },
                                rideId: req.ride_id,
                              })
                            }
                            className="text-[11px] text-muted-foreground hover:text-red-600 flex items-center gap-1 transition-colors"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" /> Report Host
                          </button>
                          <span className="text-muted-foreground/40">&bull;</span>
                          <button
                            type="button"
                            onClick={() =>
                              setBlockUser({
                                id: req.ride!.host_id,
                                name: 'Ride Host',
                                department: 'Host',
                                year: 3,
                                rating: 5.0,
                                is_verified: true,
                              })
                            }
                            className="text-[11px] text-muted-foreground hover:text-amber-700 flex items-center gap-1 transition-colors"
                          >
                            <Ban className="h-3 w-3" /> Block
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* CHAT WITH HOST FOR ACCEPTED REQUESTS */}
                      {req.status === 'ACCEPTED' && req.ride && req.ride.status !== 'COMPLETED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setChatRideId(chatRideId === req.ride_id ? null : req.ride_id)}
                          className="h-7 text-xs border-[#003C84]/40 text-[#003C84] hover:bg-[#003C84]/10 gap-1 font-semibold"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {chatRideId === req.ride_id ? 'Hide Chat' : 'Chat with Host'}
                        </Button>
                      )}

                      {/* RATE COMPLETED TRIP */}
                      {req.status === 'ACCEPTED' && req.ride?.status === 'COMPLETED' && (
                        hasRatedMap[req.id] ? (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current text-[#EAA023]" /> Rated Host
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setRatingReq(req)}
                            className="h-7 text-xs bg-[#003C84] hover:bg-[#1D59A3] text-white gap-1"
                          >
                            <Star className="h-3 w-3 fill-current text-[#EAA023]" /> Rate Host
                          </Button>
                        )
                      )}

                      {/* CANCEL ACTION FOR PENDING OR ACCEPTED */}
                      {(req.status === 'PENDING' || (req.status === 'ACCEPTED' && req.ride?.status !== 'COMPLETED')) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cancellingId === req.id}
                          onClick={() => handleCancel(req.id)}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {cancellingId === req.id ? 'Cancelling...' : 'Cancel Request'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* EXPANDABLE TRIP COORDINATION CHAT */}
                  {chatRideId === req.ride_id && user && req.ride && (
                    <div className="mt-3 pt-3 border-t border-border/70 animate-in fade-in-50 duration-200">
                      <RideCoordinationChat
                        rideId={req.ride_id}
                        rideStatus={req.ride.status}
                        currentUserId={user.id}
                        currentUserName={profile?.name || user.email || 'Passenger'}
                        hostId={req.ride.host_id}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </SwipeableItem>
          );
        })}
      </div>
      )}

      {/* RATING MODAL */}
      {ratingReq && ratingReq.ride && (
        <RatingModal
          isOpen={Boolean(ratingReq)}
          onClose={() => setRatingReq(null)}
          ride={ratingReq.ride}
          reviewee={{
            id: ratingReq.ride.host_id,
            name: 'Ride Host',
            department: 'Host',
            year: 3,
            rating: 5.0,
            is_verified: true,
          }}
          onRatingSubmitted={() => {
            fetchRequests();
          }}
        />
      )}

      {/* REPORT MODAL */}
      {reportUser && (
        <ReportModal
          isOpen={Boolean(reportUser)}
          onClose={() => setReportUser(null)}
          reportedStudent={reportUser.user}
          rideId={reportUser.rideId}
        />
      )}

      {/* BLOCK USER MODAL */}
      {blockUser && (
        <BlockUserModal
          isOpen={Boolean(blockUser)}
          onClose={() => setBlockUser(null)}
          targetStudent={blockUser}
          onBlocked={() => {
            fetchRequests();
          }}
        />
      )}

      {/* UPI / CASH DIRECT PAYMENT MODAL */}
      {paymentModalState && (
        <PaymentActionModal
          isOpen={Boolean(paymentModalState)}
          onClose={() => setPaymentModalState(null)}
          payment={paymentModalState.payment}
          hostUpiId={paymentModalState.hostUpiId}
          hostName={paymentModalState.hostName}
          onPaymentSuccess={() => {
            setPaymentModalState(null);
            fetchRequests();
          }}
        />
      )}
    </div>
  );
};
