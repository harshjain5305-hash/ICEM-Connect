import React, { useState, useEffect, useCallback } from 'react';
import type { JoinRequest, PublicStudentInfo } from './request.types';
import { requestService } from './request.service';
import { useAuth } from '@/features/auth/useAuth';
import { ratingService } from '@/features/ratings/rating.service';
import { RatingModal } from '@/features/ratings/RatingModal';
import { ReportModal } from '@/features/moderation/ReportModal';
import { BlockUserModal } from '@/features/moderation/BlockUserModal';
import { ActiveRideSessionBanner } from '@/features/realtime/ActiveRideSessionBanner';
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
} from 'lucide-react';

export interface MyRequestsViewProps {
  onFindRidesClick?: () => void;
}

export const MyRequestsView: React.FC<MyRequestsViewProps> = ({ onFindRidesClick }) => {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [ratingReq, setRatingReq] = useState<JoinRequest | null>(null);
  const [reportUser, setReportUser] = useState<{ user: PublicStudentInfo; rideId?: string } | null>(null);
  const [blockUser, setBlockUser] = useState<PublicStudentInfo | null>(null);
  const [hasRatedMap, setHasRatedMap] = useState<Record<string, boolean>>({});

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await requestService.listRequestsByStudent(user.id);
      setRequests(data);
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
          {requests.map((req) => (
            <Card key={req.id} className="overflow-hidden border border-border shadow-sm">
              <CardHeader className="p-4 pb-2 bg-muted/20 flex flex-row items-center justify-between border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {req.ride?.departure_date || 'Upcoming'}
                  </span>
                  <span className="text-xs text-muted-foreground">&bull;</span>
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {req.ride?.departure_time || 'Scheduled'}
                  </span>
                </div>
                {getStatusBadge(req.status)}
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs">
                {/* ROUTE CORRIDOR */}
                <div className="rounded-lg bg-muted/40 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Origin / Pickup: {req.ride?.origin?.name || 'ICEM Origin'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <MapPin className="h-3.5 w-3.5 text-[#E85C0D] shrink-0" />
                    <span>Destination / Drop: {req.ride?.destination?.name || 'Destination'}</span>
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
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
};
