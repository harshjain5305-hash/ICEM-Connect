import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/useAuth';
import { rideService } from './ride.service';
import type { Ride } from './ride.types';
import { RIDE_STATUS_METADATA } from './ride.state';
import { RideDetailModal } from './RideDetailModal';
import { MyRequestsView } from '@/features/requests/MyRequestsView';
import { requestService } from '@/features/requests/request.service';
import type { JoinRequest } from '@/features/requests/request.types';
import { recurringScheduleService } from './recurringSchedule.service';
import type { RecurringSchedule } from './recurringSchedule.types';
import { triggerWhatsAppShare, getRideShareData } from './commuteShare.utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Car,
  Calendar,
  Clock,
  Users,
  ArrowRight,
  PlusCircle,
  RefreshCw,
  Send,
  Play,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  Trash2,
  Repeat,
  Share2,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { SwipeableItem } from '@/components/ui/SwipeableItem';

export type RideFilterCategory = 'all' | 'active' | 'drafts' | 'past';

function getTomorrowString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface MyRidesViewProps {
  onOfferNewClick?: () => void;
  onFindRidesClick?: () => void;
}

export const MyRidesView: React.FC<MyRidesViewProps> = ({ onOfferNewClick, onFindRidesClick }) => {
  const { user, profile } = useAuth();
  const [mainTab, setMainTab] = useState<'hosted' | 'requests'>('hosted');
  const [rides, setRides] = useState<Ride[]>([]);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [requestsMap, setRequestsMap] = useState<Record<string, JoinRequest[]>>({});
  const [studentRequestsCount, setStudentRequestsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<RideFilterCategory>('all');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [publishingScheduleId, setPublishingScheduleId] = useState<string | null>(null);
  const isFetchingRef = React.useRef(false);

  const fetchRides = useCallback(async (silent = false) => {
    if (!user || isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [data, scheds] = await Promise.all([
        rideService.listHostRides(user.id),
        recurringScheduleService.listSchedulesByHost(user.id).catch(() => []),
      ]);
      setRides(data);
      setSchedules(scheds);

      // Concurrently fetch requests for every ride hosted
      const reqMap: Record<string, JoinRequest[]> = {};
      await Promise.all(
        data.map(async (r) => {
          try {
            const reqs = await requestService.listRequestsForRide(r.id);
            reqMap[r.id] = reqs;
          } catch {
            reqMap[r.id] = [];
          }
        })
      );
      setRequestsMap(reqMap);

      // Also count passenger requests
      try {
        const studentReqs = await requestService.listRequestsByStudent(user.id);
        setStudentRequestsCount(studentReqs.length);
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Failed to load host rides:', err);
    } finally {
      isFetchingRef.current = false;
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchRides(false);

    // 1. Supabase Realtime subscription for incoming join requests
    let channel: any = null;
    if (isSupabaseConfigured()) {
      try {
        channel = supabase
          .channel('public:ride_join_requests_my_rides')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'ride_join_requests' },
            () => {
              fetchRides(true);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription error on MyRidesView:', err);
      }
    }

    // 2. Cross-tab & Window custom events
    const handleRequestsUpdate = () => {
      fetchRides(true);
    };
    window.addEventListener('icem:join_requests_updated', handleRequestsUpdate);

    // 3. Tab visibility listener
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchRides(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Fallback interval when visible (15s)
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchRides(true);
      }
    }, 15000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('icem:join_requests_updated', handleRequestsUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollTimer);
    };
  }, [fetchRides]);

  const handleToggleSchedule = async (scheduleId: string, currentActive: boolean) => {
    try {
      await recurringScheduleService.toggleActive(scheduleId, !currentActive);
      await fetchRides();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const handlePauseTomorrow = async (schedule: RecurringSchedule) => {
    const tomorrow = getTomorrowString();
    const isPaused = schedule.paused_dates.includes(tomorrow);
    try {
      if (isPaused) {
        await recurringScheduleService.resumeScheduleDate(schedule.id, tomorrow);
      } else {
        await recurringScheduleService.pauseScheduleDate(schedule.id, tomorrow);
      }
      await fetchRides();
    } catch (err) {
      console.error('Failed to update paused date:', err);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await recurringScheduleService.deleteSchedule(scheduleId);
      await fetchRides();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const handlePublishNext = async (scheduleId: string) => {
    if (!user) return;
    setPublishingScheduleId(scheduleId);
    try {
      const newRide = await recurringScheduleService.publishNextRide(scheduleId);
      if (newRide) {
        await fetchRides(false);
      }
    } catch (err) {
      console.error('Failed to publish next routine ride:', err);
    } finally {
      setPublishingScheduleId(null);
    }
  };

  const handleRideUpdated = (updatedRide: Ride) => {
    setRides((prev) =>
      prev.map((r) => (r.id === updatedRide.id ? updatedRide : r))
    );
    setSelectedRide(updatedRide);
  };

  const handleQuickPublish = async (e: React.MouseEvent, rideId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const updated = await rideService.publishRide(user.id, rideId);
      handleRideUpdated(updated);
    } catch (err) {
      console.error('Publish error:', err);
    }
  };

  const handleQuickStart = async (e: React.MouseEvent, rideId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const updated = await rideService.startRide(user.id, rideId);
      handleRideUpdated(updated);
    } catch (err) {
      console.error('Start error:', err);
    }
  };

  const handleQuickComplete = async (e: React.MouseEvent, rideId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const updated = await rideService.completeRide(user.id, rideId);
      handleRideUpdated(updated);
    } catch (err) {
      console.error('Complete error:', err);
    }
  };

  const handleDismissRide = async (rideId: string) => {
    if (!user) return;
    const targetRide = rides.find((r) => r.id === rideId);
    if (targetRide?.status === 'ACTIVE') {
      return; // Cannot delete an active live ride in progress
    }
    setRides((prev) => prev.filter((r) => r.id !== rideId));
    try {
      await rideService.dismissRide(user.id, rideId);
    } catch (err) {
      console.error('Dismiss ride error:', err);
    }
  };

  const handleClearInactive = async () => {
    if (!user) return;
    setRides((prev) => prev.filter((r) => ['PUBLISHED', 'CONFIRMED', 'ACTIVE', 'DRAFT'].includes(r.status)));
    try {
      await rideService.clearInactiveRides(user.id);
    } catch (err) {
      console.error('Clear inactive rides error:', err);
    }
  };

  const handleAcceptRequestOnCard = async (
    e: React.MouseEvent,
    requestId: string
  ) => {
    e.stopPropagation();
    if (!user) return;
    setActionLoadingId(requestId);
    try {
      await requestService.acceptRequest(user.id, requestId);
      await fetchRides();
    } catch (err) {
      console.error('Failed to accept request from card:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectRequestOnCard = async (
    e: React.MouseEvent,
    requestId: string
  ) => {
    e.stopPropagation();
    if (!user) return;
    setActionLoadingId(requestId);
    try {
      await requestService.rejectRequest(user.id, { request_id: requestId });
      await fetchRides();
    } catch (err) {
      console.error('Failed to reject request from card:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filterRides = (list: Ride[]): Ride[] => {
    switch (activeFilter) {
      case 'active':
        return list.filter((r) => ['PUBLISHED', 'CONFIRMED', 'ACTIVE'].includes(r.status));
      case 'drafts':
        return list.filter((r) => r.status === 'DRAFT');
      case 'past':
        return list.filter((r) => ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(r.status));
      case 'all':
      default:
        return list;
    }
  };

  const filteredRides = filterRides(rides);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      {/* TOP LEVEL NAVIGATION PILLS: HOSTED VS REQUESTS (Phase 6) */}
      <div className="flex rounded-xl bg-muted p-1 border border-border">
        <button
          type="button"
          onClick={() => setMainTab('hosted')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            mainTab === 'hosted'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Hosted Rides ({rides.length})
        </button>
        <button
          type="button"
          onClick={() => setMainTab('requests')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mainTab === 'requests'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>My Booked Seats &amp; Requests</span>
          {studentRequestsCount > 0 && (
            <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold">
              {studentRequestsCount}
            </span>
          )}
        </button>
      </div>

      {mainTab === 'requests' ? (
        <MyRequestsView onFindRidesClick={onFindRidesClick} />
      ) : (
        <>
          {/* HEADER & SUMMARY */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                My Offered Rides
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage your scheduled journeys and seat offerings as <strong>{profile?.name || user?.email}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {rides.some((r) => ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(r.status)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearInactive}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  title="Remove inactive rides from list (auto-deletes from database after 2 days)"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Past
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRides(false)}
                disabled={isLoading}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {onOfferNewClick && (
                <Button
                  size="sm"
                  onClick={onOfferNewClick}
                  className="gap-1.5 text-xs bg-[#003C84] hover:bg-[#1D59A3] text-white"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Offer New Ride
                </Button>
              )}
            </div>
          </div>

          {/* RECURRING COMMUTE ROUTINES (PILLAR 1 & 2: DAILY HABIT ENGINE) */}
          {schedules.length > 0 && (
            <div className="space-y-3">
              {schedules.map((schedule) => {
                const tomorrow = getTomorrowString();
                const isTomorrowPaused = schedule.paused_dates.includes(tomorrow);

                return (
                  <div
                    key={schedule.id}
                    className="rounded-xl border border-primary/20 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                          <Repeat className="h-4 w-4 text-[#00A2A5]" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              Daily Commute Routine (Mon–Fri)
                            </span>
                            <Badge variant={schedule.is_active ? 'cyan' : 'outline'} className="text-[10px]">
                              {schedule.is_active ? 'Active Routine' : 'Paused Routine'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Auto-publishes weekday seats &bull; Departs daily at{' '}
                            <strong className="text-foreground">{schedule.departure_time}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePublishNext(schedule.id)}
                          disabled={publishingScheduleId === schedule.id || !schedule.is_active}
                          className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          title="Publish next upcoming weekday ride from this routine"
                        >
                          <PlusCircle className={`h-3 w-3 ${publishingScheduleId === schedule.id ? 'animate-spin' : ''}`} />
                          <span>Publish Next Ride</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            triggerWhatsAppShare({
                              originName: schedule.origin?.name || 'ICEM Campus',
                              destinationName: schedule.destination?.name || 'Talegaon / PCMC',
                              departureDate: 'Every Mon–Fri',
                              departureTime: schedule.departure_time,
                              availableSeats: schedule.total_seats,
                              vehicleType: schedule.vehicle_type,
                              note: schedule.note || 'Regular daily campus commute',
                            })
                          }
                          className="h-7 text-xs gap-1 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"
                          title="Share commute routine to WhatsApp group"
                        >
                          <Share2 className="h-3 w-3" />
                          <span>Broadcast on WhatsApp</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          title="Delete recurring routine"
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-background/60 rounded-lg p-2 border border-border/60">
                      <span className="truncate">{schedule.origin?.name || 'Pickup Origin'}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{schedule.destination?.name || 'Destination'}</span>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/40 text-xs">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isTomorrowPaused ? 'outline' : 'secondary'}
                          onClick={() => handlePauseTomorrow(schedule)}
                          className={`h-7 text-xs gap-1.5 ${
                            isTomorrowPaused
                              ? 'border-amber-500/40 text-amber-600 bg-amber-500/10'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {isTomorrowPaused ? (
                            <>
                              <PlayCircle className="h-3.5 w-3.5 text-amber-600" />
                              <span>Resume Tomorrow ({tomorrow})</span>
                            </>
                          ) : (
                            <>
                              <PauseCircle className="h-3.5 w-3.5" />
                              <span>Skip Tomorrow ({tomorrow})</span>
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleSchedule(schedule.id, schedule.is_active)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {schedule.is_active ? 'Pause Whole Routine' : 'Resume Routine'}
                        </Button>
                      </div>

                      <span className="text-[11px] text-muted-foreground italic">
                        {isTomorrowPaused ? 'Tomorrow paused' : 'Active for all upcoming weekdays'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* FILTER TABS */}
          <div className="flex overflow-x-auto border-b border-border gap-2 pb-1 scrollbar-none">
            {[
              { key: 'all', label: 'All Rides', count: rides.length },
              {
                key: 'active',
                label: 'Active & Upcoming',
                count: rides.filter((r) => ['PUBLISHED', 'CONFIRMED', 'ACTIVE'].includes(r.status)).length,
              },
              {
                key: 'drafts',
                label: 'Drafts',
                count: rides.filter((r) => r.status === 'DRAFT').length,
              },
              {
                key: 'past',
                label: 'Completed / Past',
                count: rides.filter((r) => ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(r.status)).length,
              },
            ].map((tab) => {
              const isSelected = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key as RideFilterCategory)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* RIDE LIST / EMPTY STATES */}
          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
              <p className="text-xs text-muted-foreground">Loading your campus rides...</p>
            </div>
          ) : rides.length === 0 ? (
            <Card className="text-center py-10 px-4 border-dashed border-border bg-muted/20">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Car className="h-6 w-6 text-[#003C84] dark:text-[#00A2A5]" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No rides offered yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                If you commute to ICEM Parandwadi by bike or scooter, offer your empty seat to a batchmate and share transit.
              </p>
              {onOfferNewClick && (
                <Button
                  onClick={onOfferNewClick}
                  className="gap-2 bg-[#003C84] hover:bg-[#1D59A3] text-white"
                >
                  <PlusCircle className="h-4 w-4" /> Offer Your First Ride
                </Button>
              )}
            </Card>
          ) : filteredRides.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No rides found in the <strong>{activeFilter}</strong> category.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRides.map((ride) => {
                const statusMeta = RIDE_STATUS_METADATA[ride.status];
                const isDraft = ride.status === 'DRAFT';
                const isPublished = ride.status === 'PUBLISHED' || ride.status === 'CONFIRMED';
                const isActive = ride.status === 'ACTIVE';
                const pendingRequests = (requestsMap[ride.id] || []).filter(
                  (r) => r.status === 'PENDING'
                );

                return (
                  <SwipeableItem
                    key={ride.id}
                    onDelete={() => handleDismissRide(ride.id)}
                    disabled={ride.status === 'ACTIVE'}
                    deleteLabel="Delete"
                  >
                    <div
                      onClick={() => {
                        setSelectedRide(ride);
                        setIsModalOpen(true);
                      }}
                      className="group relative cursor-pointer rounded-xl border border-border/80 bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md space-y-3.5"
                    >
                      {/* TOP BAR: STATUS + TIME + PENDING ALERTS */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={statusMeta.badgeVariant}>
                            {statusMeta.label}
                          </Badge>
                          {isActive && (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          )}
                          {pendingRequests.length > 0 && (
                            <Badge
                              variant="warning"
                              className="text-[10px] font-bold bg-[#E85C0D]/15 text-[#E85C0D] border-[#E85C0D]/30 flex items-center gap-1 animate-pulse"
                            >
                              <AlertCircle className="h-3 w-3" />
                              {pendingRequests.length} Pending Request{pendingRequests.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {ride.departure_date} &bull; <Clock className="h-3 w-3" /> {ride.departure_time}
                          </span>
                          {ride.status !== 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismissRide(ride.id);
                              }}
                              title="Delete ride permanently from database"
                              aria-label="Delete ride"
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                    {/* CORRIDOR */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="truncate">{ride.origin?.name || 'ICEM Origin'}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{ride.destination?.name || 'PCMC Destination'}</span>
                      </div>
                      {ride.note && (
                        <p className="text-xs italic text-muted-foreground truncate">
                          &ldquo;{ride.note}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* INCOMING PENDING REQUESTS DIRECTLY ON CARD (Design.md §73) */}
                    {pendingRequests.length > 0 && (
                      <div
                        className="rounded-xl border border-[#E85C0D]/30 bg-[#E85C0D]/5 p-3 space-y-2 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between font-bold text-[#E85C0D] dark:text-[#E85C0D]">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            Incoming Join Request ({pendingRequests.length})
                          </span>
                          <span className="text-[10px] font-normal text-muted-foreground">
                            Action directly from card
                          </span>
                        </div>

                        <div className="space-y-2">
                          {pendingRequests.map((req) => (
                            <div
                              key={req.id}
                              className="rounded-lg border border-border bg-card p-3 space-y-2 shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                    {req.student?.name?.charAt(0) || 'S'}
                                  </div>
                                  <div>
                                    <span className="font-bold text-foreground block">
                                      {req.student?.name || 'ICEM Student'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {req.student?.department} &bull; Yr {req.student?.year}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                                  ★ {req.student?.rating ? req.student.rating.toFixed(1) : '5.0'}
                                </span>
                              </div>

                              <div className="rounded bg-muted/40 p-2 text-[11px] space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Requested:</span>
                                  <span className="font-semibold text-foreground">
                                    {req.seat_count} {req.seat_count === 1 ? 'Seat' : 'Seats'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Fuel Share:</span>
                                  {Number(req.offered_amount) > 0 ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
                                      ₹{Number(req.offered_amount)} offered
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic text-[10px]">₹0 (Free / No share)</span>
                                  )}
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Pickup note:</span>
                                  <span
                                    className={
                                      req.specific_area_note
                                        ? 'font-medium text-[#003C84] dark:text-[#00A2A5]'
                                        : 'italic text-muted-foreground'
                                    }
                                  >
                                    {req.specific_area_note || 'None'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-1 border-t border-border/50">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoadingId === req.id}
                                  onClick={(e) => handleRejectRequestOnCard(e, req.id)}
                                  className="flex-1 h-7 text-xs text-destructive hover:bg-destructive/10"
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={
                                    actionLoadingId === req.id || ride.available_seats < req.seat_count
                                  }
                                  onClick={(e) => handleAcceptRequestOnCard(e, req.id)}
                                  className="flex-1 h-7 text-xs bg-[#003C84] hover:bg-[#1D59A3] text-white"
                                >
                                  Accept Seat
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* BOTTOM ROW: VEHICLE, SEATS & QUICK ACTIONS */}
                    <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Car className="h-3.5 w-3.5 text-primary" /> {ride.vehicle_type}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Users className="h-3.5 w-3.5 text-primary" /> {ride.available_seats}/{ride.total_seats} seats free
                        </span>
                      </div>

                      {/* CONTEXTUAL ACTION BUTTONS */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {!isDraft && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerWhatsAppShare(getRideShareData(ride));
                            }}
                            className="h-7 text-xs gap-1 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"
                            title="Share ride to college WhatsApp group"
                          >
                            <Share2 className="h-3 w-3" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </Button>
                        )}

                        {isDraft && (
                          <Button
                            size="sm"
                            onClick={(e) => handleQuickPublish(e, ride.id)}
                            className="h-7 text-xs gap-1 bg-[#003C84] hover:bg-[#1D59A3] text-white"
                          >
                            <Send className="h-3 w-3" /> Publish
                          </Button>
                        )}

                        {isPublished && (
                          <Button
                            size="sm"
                            onClick={(e) => handleQuickStart(e, ride.id)}
                            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Play className="h-3 w-3" /> Start
                          </Button>
                        )}

                        {isActive && (
                          <Button
                            size="sm"
                            onClick={(e) => handleQuickComplete(e, ride.id)}
                            className="h-7 text-xs gap-1 bg-[#003C84] hover:bg-[#1D59A3] text-white"
                          >
                            <CheckCircle className="h-3 w-3" /> Complete
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRide(ride);
                            setIsModalOpen(true);
                          }}
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <span>Details</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </SwipeableItem>
              );
              })}
            </div>
          )}
        </>
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
          onRideUpdated={handleRideUpdated}
          onRideDeleted={(deletedId) => {
            setRides((prev) => prev.filter((r) => r.id !== deletedId));
          }}
        />
      )}
    </div>
  );
};
