import React, { useState } from 'react';
import type { Ride } from './ride.types';
import type { RideStatus } from '@/types/database';
import { useAuth } from '@/features/auth/useAuth';
import { rideService } from './ride.service';
import { RIDE_STATUS_METADATA, isRideCancellable } from './ride.state';
import { RouteMapPreview } from '@/features/routes/RouteMapPreview';
import { WaypointSequenceList } from '@/features/routes/WaypointSequenceList';
import { HostRequestsSection } from '@/features/requests/HostRequestsSection';
import { JoinRequestModal } from '@/features/requests/JoinRequestModal';
import { ActiveRideSessionBanner } from '@/features/realtime/ActiveRideSessionBanner';
import { RideCoordinationChat } from './RideCoordinationChat';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Car,
  Users,
  ShieldCheck,
  Send,
  Play,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  MessageSquare,
  Radio,
  Milestone,
  Info,
} from 'lucide-react';

export type RideDetailTab = 'overview' | 'waypoints' | 'tracking' | 'chat' | 'requests';

export interface RideDetailModalProps {
  ride: Ride;
  isOpen: boolean;
  onClose: () => void;
  onRideUpdated?: (updatedRide: Ride) => void;
  initialTab?: RideDetailTab;
}

export const RideDetailModal: React.FC<RideDetailModalProps> = ({
  ride,
  isOpen,
  onClose,
  onRideUpdated,
  initialTab = 'overview',
}) => {
  const { user, profile } = useAuth();
  const [currentRide, setCurrentRide] = useState<Ride>(ride);
  const [activeTab, setActiveTab] = useState<RideDetailTab>(initialTab);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);

  if (!isOpen) return null;

  const isHost = Boolean(user && user.id === currentRide.host_id);
  const statusMeta = RIDE_STATUS_METADATA[currentRide.status];
  const isTripActive = currentRide.status === 'ACTIVE';

  const completedPassedSequences = React.useMemo(() => {
    if (currentRide.status === 'COMPLETED' && currentRide.waypoints) {
      return new Set(currentRide.waypoints.map((w) => w.sequence));
    }
    return undefined;
  }, [currentRide.status, currentRide.waypoints]);

  const handleStatusTransition = async (targetStatus: RideStatus) => {
    if (!user) return;
    setIsActionLoading(true);
    setActionError(null);

    try {
      let updated: Ride;
      if (targetStatus === 'PUBLISHED') {
        updated = await rideService.publishRide(user.id, currentRide.id);
      } else if (targetStatus === 'ACTIVE') {
        updated = await rideService.startRide(user.id, currentRide.id);
        setActiveTab('tracking'); // Auto-switch to live tracking on start
      } else if (targetStatus === 'COMPLETED') {
        updated = await rideService.completeRide(user.id, currentRide.id);
      } else if (targetStatus === 'CANCELLED') {
        updated = await rideService.cancelRide(user.id, currentRide.id);
      } else {
        updated = await rideService.transitionRideStatus(user.id, currentRide.id, targetStatus);
      }

      setCurrentRide(updated);
      setShowCancelConfirm(false);
      if (onRideUpdated) {
        onRideUpdated(updated);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('Failed to update ride status');
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const navTabs: { id: RideDetailTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
    { id: 'waypoints', label: 'Waypoints', icon: <Milestone className="h-4 w-4" /> },
    {
      id: 'tracking',
      label: 'Live Map',
      icon: <Radio className={`h-4 w-4 ${isTripActive ? 'text-emerald-500 animate-pulse' : ''}`} />,
      badge: isTripActive ? 'LIVE' : undefined,
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ];

  if (isHost) {
    navTabs.push({
      id: 'requests',
      label: 'Requests',
      icon: <Users className="h-4 w-4" />,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ride-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[90vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 sm:px-6 py-3.5 bg-muted/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Car className="h-5 w-5 text-[#003C84] dark:text-[#00A2A5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="ride-detail-title" className="text-base font-bold text-foreground">
                  Ride Details
                </h2>
                <Badge variant={statusMeta.badgeVariant} className="text-[10px] py-0 px-2 font-medium">
                  {statusMeta.label}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                #{currentRide.id.slice(0, 8)}
              </p>
            </div>
          </div>

          {/* Quick-Jump Header Icons + Close Button */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setActiveTab('waypoints')}
              title="Jump to Waypoints"
              className={`p-1.5 rounded-lg transition-colors ${
                activeTab === 'waypoints'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-label="View Waypoints"
            >
              <Milestone className="h-4 w-4" />
            </button>

            <button
              onClick={() => setActiveTab('tracking')}
              title="Jump to Live Map"
              className={`p-1.5 rounded-lg transition-colors relative ${
                activeTab === 'tracking'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-label="View Live Traveling Map"
            >
              <Radio className="h-4 w-4" />
              {isTripActive && (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              title="Jump to Coordination Chat"
              className={`p-1.5 rounded-lg transition-colors ${
                activeTab === 'chat'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-label="Open Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </button>

            <div className="h-4 w-px bg-border/60 mx-1" />

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* STICKY TAB NAVIGATION BAR */}
        <div className="flex border-b border-border bg-muted/20 px-2 sm:px-4 py-1.5 gap-1 overflow-x-auto shrink-0 scrollbar-none">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-h-[36px] ${
                  isActive
                    ? 'bg-card text-foreground font-semibold shadow-sm border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500 text-white font-bold animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT CONTAINER */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {actionError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Status Banner */}
              <div className={`rounded-xl border p-3.5 space-y-1 ${statusMeta.bgClass}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Current State</span>
                  <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                </div>
                <p className="text-xs text-foreground/90">{statusMeta.description}</p>
              </div>

              {/* Quick Route Summary Card */}
              <div className="rounded-xl border border-border/80 p-3.5 bg-muted/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Route Summary
                  </span>
                  <button
                    onClick={() => setActiveTab('waypoints')}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <Milestone className="h-3.5 w-3.5" /> View Waypoints
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{currentRide.origin?.name || 'ICEM Campus'}</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span>{currentRide.destination?.name || 'PCMC Destination'}</span>
                  </div>
                </div>
              </div>

              {/* Trip Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border/70 p-3 bg-card space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Departure Date
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {currentRide.departure_date}
                  </span>
                </div>

                <div className="rounded-xl border border-border/70 p-3 bg-card space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Departure Time
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {currentRide.departure_time}
                  </span>
                </div>

                <div className="rounded-xl border border-border/70 p-3 bg-card space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5 text-primary" /> Vehicle Type
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {currentRide.vehicle_type}
                  </span>
                </div>

                <div className="rounded-xl border border-border/70 p-3 bg-card space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" /> Seat Availability
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {currentRide.available_seats} / {currentRide.total_seats} seats free
                  </span>
                </div>
              </div>

              {/* Host Coordination Note */}
              {currentRide.note && (
                <div className="rounded-xl border border-border/70 p-3.5 bg-muted/20 space-y-1 text-xs">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" /> Host Coordination Note
                  </span>
                  <p className="italic text-foreground">&ldquo;{currentRide.note}&rdquo;</p>
                </div>
              )}

              {/* Host Participation & Security Badge */}
              <div className="rounded-xl border border-primary/20 bg-[#003C84]/5 p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#00A2A5]" />
                  <div>
                    <span className="font-medium text-foreground">
                      {isHost ? 'You are hosting this ride' : 'Verified ICEM Student Route'}
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Institutional identity guaranteed. PRN protected.
                    </p>
                  </div>
                </div>
                {isHost && <Badge variant="navy">Host Controls</Badge>}
              </div>

              {/* Host Lifecycle Controls */}
              {isHost && (
                <div className="rounded-xl border border-border p-4 bg-muted/30 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground block">
                    Manage Ride Lifecycle
                  </span>

                  {currentRide.status === 'DRAFT' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        className="flex-1 gap-2 bg-[#003C84] hover:bg-[#1D59A3] text-white"
                        disabled={isActionLoading}
                        onClick={() => handleStatusTransition('PUBLISHED')}
                      >
                        <Send className="h-4 w-4" /> Publish Ride Now
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isActionLoading}
                        onClick={() => setShowCancelConfirm(true)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        Cancel Draft
                      </Button>
                    </div>
                  )}

                  {(currentRide.status === 'PUBLISHED' || currentRide.status === 'CONFIRMED') && (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={isActionLoading}
                          onClick={() => handleStatusTransition('ACTIVE')}
                        >
                          <Play className="h-4 w-4" /> Start Ride (Begin Journey)
                        </Button>
                        <Button
                          variant="outline"
                          disabled={isActionLoading}
                          onClick={() => setShowCancelConfirm(true)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          Cancel Ride
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Starting the ride transitions status to <code>ACTIVE</code> and activates live GPS room.
                      </p>
                    </div>
                  )}

                  {currentRide.status === 'ACTIVE' && (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          className="flex-1 gap-2 bg-[#003C84] hover:bg-[#1D59A3] text-white"
                          disabled={isActionLoading}
                          onClick={() => handleStatusTransition('COMPLETED')}
                        >
                          <CheckCircle className="h-4 w-4" /> Complete Ride
                        </Button>
                        <Button
                          variant="outline"
                          disabled={isActionLoading}
                          onClick={() => setShowCancelConfirm(true)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          Cancel Ride
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Completing marks journey finished and starts the 3-hour chat retention window.
                      </p>
                    </div>
                  )}

                  {showCancelConfirm && isRideCancellable(currentRide.status) && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                        <AlertTriangle className="h-4 w-4" /> Confirm Ride Cancellation
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Are you sure you want to cancel this ride? Confirmed passengers will be notified and live location access revoked.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isActionLoading}
                          onClick={() => handleStatusTransition('CANCELLED')}
                          className="gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Confirm Cancellation
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isActionLoading}
                          onClick={() => setShowCancelConfirm(false)}
                        >
                          Keep Ride
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Passenger Request Seat CTA */}
              {!isHost && ['PUBLISHED', 'CONFIRMED'].includes(currentRide.status) && (
                <div className="rounded-xl border border-primary/20 bg-[#003C84]/5 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Need transport on this route?</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {currentRide.available_seats} seat{currentRide.available_seats === 1 ? '' : 's'} available
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={currentRide.available_seats < 1}
                      onClick={() => setShowJoinModal(true)}
                      className="bg-[#003C84] hover:bg-[#1D59A3] text-white text-xs gap-1.5 font-semibold"
                    >
                      <Users className="h-3.5 w-3.5" /> Request Seat
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WAYPOINTS & ROUTE */}
          {activeTab === 'waypoints' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="space-y-3 rounded-xl border border-border/80 p-4 bg-muted/10">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block">
                  Route Corridor &amp; Map Preview
                </span>

                {currentRide.route && (
                  <RouteMapPreview
                    route={currentRide.route}
                    waypoints={currentRide.waypoints || []}
                  />
                )}

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Origin</span>
                      <span className="text-sm font-medium text-foreground">
                        {currentRide.origin?.name || 'ICEM Transit Origin'}
                      </span>
                      {currentRide.origin?.address && (
                        <span className="text-xs text-muted-foreground block">
                          {currentRide.origin.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-3 h-5 border-l-2 border-dashed border-border/80" />

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Destination</span>
                      <span className="text-sm font-medium text-foreground">
                        {currentRide.destination?.name || 'PCMC Destination'}
                      </span>
                      {currentRide.destination?.address && (
                        <span className="text-xs text-muted-foreground block">
                          {currentRide.destination.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {currentRide.waypoints && currentRide.waypoints.length > 2 && (
                  <div className="pt-3 border-t border-border/60">
                    <WaypointSequenceList
                      waypoints={currentRide.waypoints}
                      passedSequences={completedPassedSequences}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LIVE TRACKING */}
          {activeTab === 'tracking' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {user ? (
                <ActiveRideSessionBanner
                  ride={currentRide}
                  currentUser={profile}
                  onStatusChanged={(newStatus) => {
                    setCurrentRide((prev) => ({ ...prev, status: newStatus as RideStatus }));
                    if (onRideUpdated) {
                      onRideUpdated({ ...currentRide, status: newStatus as RideStatus });
                    }
                  }}
                />
              ) : (
                <div className="text-center p-6 text-xs text-muted-foreground">
                  Please log in to view active tracking for this trip.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COORDINATION CHAT */}
          {activeTab === 'chat' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {user && currentRide.status !== 'DRAFT' ? (
                <RideCoordinationChat
                  rideId={currentRide.id}
                  rideStatus={currentRide.status}
                  currentUserId={user.id}
                  currentUserName={profile?.name || 'Student'}
                  hostId={currentRide.host_id}
                />
              ) : (
                <div className="text-center p-6 text-xs text-muted-foreground">
                  Coordination chat becomes available once the ride is published.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: HOST REQUESTS & PARTICIPANTS (HOST ONLY) */}
          {activeTab === 'requests' && isHost && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <HostRequestsSection
                ride={currentRide}
                onRideCapacityChanged={async () => {
                  try {
                    const refreshed = await rideService.getRide(currentRide.id);
                    setCurrentRide(refreshed);
                    if (onRideUpdated) onRideUpdated(refreshed);
                  } catch (e) {
                    console.error('Refresh ride error:', e);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* JOIN REQUEST MODAL */}
        <JoinRequestModal
          ride={currentRide}
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onRequestSubmitted={async () => {
            try {
              const refreshed = await rideService.getRide(currentRide.id);
              setCurrentRide(refreshed);
              if (onRideUpdated) onRideUpdated(refreshed);
            } catch (e) {
              console.error('Refresh ride error:', e);
            }
          }}
        />

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between border-t border-border px-4 sm:px-6 py-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">Viewing:</span>
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              {activeTab}
            </span>
          </div>

          <Button variant="outline" onClick={onClose} size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
