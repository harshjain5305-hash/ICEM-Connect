import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { rideService } from './ride.service';
import type { Ride } from './ride.types';
import { RIDE_STATUS_METADATA } from './ride.state';
import { RideDetailModal } from './RideDetailModal';
import { MyRequestsView } from '@/features/requests/MyRequestsView';
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
} from 'lucide-react';

export type RideFilterCategory = 'all' | 'active' | 'drafts' | 'past';

export interface MyRidesViewProps {
  onOfferNewClick?: () => void;
  onFindRidesClick?: () => void;
}

export const MyRidesView: React.FC<MyRidesViewProps> = ({ onOfferNewClick, onFindRidesClick }) => {
  const { user, profile } = useAuth();
  const [mainTab, setMainTab] = useState<'hosted' | 'requests'>('hosted');
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<RideFilterCategory>('all');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchRides = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await rideService.listHostRides(user.id);
      setRides(data);
    } catch (err) {
      console.error('Failed to load host rides:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

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
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            mainTab === 'requests'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Booked Seats &amp; Requests
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
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRides}
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
              onClick={() => setActiveFilter(tab.key as RideFilterCategory)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
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
        <div className="space-y-3">
          {filteredRides.map((ride) => {
            const statusMeta = RIDE_STATUS_METADATA[ride.status];
            const isDraft = ride.status === 'DRAFT';
            const isPublished = ride.status === 'PUBLISHED' || ride.status === 'CONFIRMED';
            const isActive = ride.status === 'ACTIVE';

            return (
              <div
                key={ride.id}
                onClick={() => {
                  setSelectedRide(ride);
                  setIsModalOpen(true);
                }}
                className="group relative cursor-pointer rounded-xl border border-border/80 bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md space-y-3"
              >
                {/* TOP BAR: STATUS + TIME */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusMeta.badgeVariant}>
                      {statusMeta.label}
                    </Badge>
                    {isActive && (
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {ride.departure_date} &bull; <Clock className="h-3 w-3" /> {ride.departure_time}
                  </span>
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
        />
      )}
    </div>
  );
};
