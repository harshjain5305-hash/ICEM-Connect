import React, { useState, useEffect, useMemo } from 'react';
import type { Ride } from '@/features/rides/ride.types';
import { rideRepository } from '@/features/rides/ride.repository';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  ArrowRight,
  Clock,
  Calendar,
  Users,
  Car,
  Bike,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  PlusCircle,
  Compass,
  Search,
} from 'lucide-react';

export interface AvailableCampusRidesProps {
  onInspectRide?: (ride: Ride) => void;
  onOfferRideClick?: () => void;
  onFindMoreClick?: () => void;
}

const RIDES_PER_PAGE = 4;

function formatDepartureTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const mins = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${formattedHours}:${mins} ${ampm}`;
  }
  return timeStr;
}

function formatRelativeDate(dateStr: string): { label: string; isToday: boolean } {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  d.setDate(d.getDate() + 1);
  const tomorrowStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) return { label: 'Today', isToday: true };
  if (dateStr === tomorrowStr) return { label: 'Tomorrow', isToday: false };
  return { label: dateStr, isToday: false };
}

function getVehicleDetails(vehicleType: string) {
  switch (vehicleType) {
    case 'BIKE':
      return { label: 'Bike', icon: Bike, color: 'text-sky-600 dark:text-sky-400' };
    case 'SCOOTER':
      return { label: 'Scooter', icon: Bike, color: 'text-teal-600 dark:text-teal-400' };
    case 'OTHER':
    default:
      return { label: 'Car / Auto', icon: Car, color: 'text-amber-600 dark:text-amber-400' };
  }
}

export const AvailableCampusRides: React.FC<AvailableCampusRidesProps> = ({
  onInspectRide,
  onOfferRideClick,
  onFindMoreClick,
}) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filterType, setFilterType] = useState<'all' | 'to_campus' | 'from_campus'>('all');

  useEffect(() => {
    let mounted = true;
    const fetchRides = async () => {
      try {
        setIsLoading(true);
        const published = await rideRepository.listPublishedRides();
        if (mounted) {
          setRides(published);
        }
      } catch (err) {
        console.error('Failed to load published campus rides:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRides();

    const handleSync = () => {
      if (mounted) {
        fetchRides();
      }
    };

    window.addEventListener('ride:deleted', handleSync);
    window.addEventListener('ride:updated', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      mounted = false;
      window.removeEventListener('ride:deleted', handleSync);
      window.removeEventListener('ride:updated', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      if (filterType === 'all') return true;
      const originName = (ride.origin?.name || ride.origin_location_id || '').toLowerCase();
      const destName = (ride.destination?.name || ride.destination_location_id || '').toLowerCase();

      if (filterType === 'to_campus') {
        return destName.includes('icem') || destName.includes('campus');
      }
      if (filterType === 'from_campus') {
        return originName.includes('icem') || originName.includes('campus');
      }
      return true;
    });
  }, [rides, filterType]);

  const totalPages = Math.max(1, Math.ceil(filteredRides.length / RIDES_PER_PAGE));

  // Reset to page 1 if filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  const currentRides = useMemo(() => {
    const startIndex = (currentPage - 1) * RIDES_PER_PAGE;
    return filteredRides.slice(startIndex, startIndex + RIDES_PER_PAGE);
  }, [filteredRides, currentPage]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden" data-testid="available-campus-rides-section">
      <CardHeader className="pb-3 border-b border-border/50 bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-bold text-foreground">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Available Campus Rides</span>
              </CardTitle>
              <Badge variant="cyan" className="px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                Live Board
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Confirmed student rides between ICEM Parandwadi and transit hubs. Request in 1 tap.
            </CardDescription>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0" role="tablist">
            <button
              role="tab"
              aria-selected={filterType === 'all'}
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                filterType === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              All Rides ({rides.length})
            </button>
            <button
              role="tab"
              aria-selected={filterType === 'to_campus'}
              onClick={() => setFilterType('to_campus')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                filterType === 'to_campus'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              To Campus
            </button>
            <button
              role="tab"
              aria-selected={filterType === 'from_campus'}
              onClick={() => setFilterType('from_campus')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                filterType === 'from_campus'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              From Campus
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">Loading active campus rides...</p>
          </div>
        ) : currentRides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
            <Compass className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Sorry, currently no rides available</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                There are no active rides scheduled right now. You can offer a seat if you are commuting, or check back soon.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              {filterType !== 'all' && (
                <Button size="sm" variant="outline" onClick={() => setFilterType('all')}>
                  View All Routes
                </Button>
              )}
              {onOfferRideClick && (
                <Button size="sm" onClick={onOfferRideClick} className="gap-1.5">
                  <PlusCircle className="h-3.5 w-3.5" />
                  Offer a Seat
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 4 Cards Grid: 2 columns on desktop, 1 on mobile */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              {currentRides.map((ride) => {
                const vehicle = getVehicleDetails(ride.vehicle_type);
                const VehicleIcon = vehicle.icon;
                const dateInfo = formatRelativeDate(ride.departure_date);
                const seatsLeft = ride.available_seats;

                const originLabel = ride.origin?.name || 'Talegaon / Transit';
                const destLabel = ride.destination?.name || 'ICEM Campus';

                return (
                  <div
                    key={ride.id}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div>
                      {/* Top Header: Host initials + Verification + Seats Badge */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-xs text-primary">
                            IC
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold text-foreground truncate">
                                Verified Host
                              </span>
                              <ShieldCheck className="h-3.5 w-3.5 text-[#00A2A5] shrink-0" />
                            </div>
                            <span className="text-[10px] text-muted-foreground">ICEM Student</span>
                          </div>
                        </div>

                        <Badge
                          variant={seatsLeft > 0 ? 'default' : 'outline'}
                          className={`text-[11px] px-2 py-0.5 shrink-0 ${
                            seatsLeft > 0
                              ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <Users className="h-3 w-3 mr-1 inline" />
                          {seatsLeft > 0 ? `${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left` : 'Full'}
                        </Badge>
                      </div>

                      {/* Route Segment */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-start gap-2 text-xs">
                          <MapPin className="h-3.5 w-3.5 text-[#00A2A5] shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-foreground block truncate">
                              {originLabel}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center pl-1 text-muted-foreground">
                          <div className="h-2 border-l border-dashed border-border ml-1.5 my-0.5" />
                        </div>

                        <div className="flex items-start gap-2 text-xs">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-foreground block truncate">
                              {destLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Timing & Vehicle Strip */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                            dateInfo.isToday
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          {dateInfo.label}
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">
                          <Clock className="h-3 w-3 text-primary" />
                          {formatDepartureTime(ride.departure_time)}
                        </span>

                        <span className={`inline-flex items-center gap-1 font-medium ${vehicle.color}`}>
                          <VehicleIcon className="h-3.5 w-3.5" />
                          {vehicle.label}
                        </span>
                      </div>

                      {/* Optional Note */}
                      {ride.note && (
                        <p className="mt-2.5 text-[11px] text-muted-foreground line-clamp-1 italic bg-muted/30 px-2 py-1 rounded">
                          "{ride.note}"
                        </p>
                      )}
                    </div>

                    {/* Bottom Action */}
                    <div className="mt-4 pt-2.5 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onInspectRide?.(ride)}
                        className="w-full gap-1.5 text-xs font-semibold justify-center h-8"
                      >
                        <span>View Details & Request</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls: <- 1 2 3 -> as requested */}
            {totalPages > 1 && (
              <div
                className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60"
                aria-label="Campus rides pagination"
              >
                <div className="text-xs text-muted-foreground">
                  Showing{' '}
                  <span className="font-semibold text-foreground">
                    {(currentPage - 1) * RIDES_PER_PAGE + 1}-
                    {Math.min(currentPage * RIDES_PER_PAGE, filteredRides.length)}
                  </span>{' '}
                  of <span className="font-semibold text-foreground">{filteredRides.length}</span> rides
                </div>

                <div className="flex items-center gap-1.5" role="navigation" aria-label="Pagination">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrevPage}
                    disabled={currentPage <= 1}
                    className="h-8 px-2.5 text-xs gap-1"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </Button>

                  {/* Numbered Page Buttons: 1, 2, 3 ... */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <Button
                      key={pageNum}
                      size="sm"
                      variant={currentPage === pageNum ? 'primary' : 'outline'}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-8 w-8 p-0 text-xs font-semibold ${
                        currentPage === pageNum
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label={`Page ${pageNum}`}
                      aria-current={currentPage === pageNum ? 'page' : undefined}
                    >
                      {pageNum}
                    </Button>
                  ))}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                    className="h-8 px-2.5 text-xs gap-1"
                    aria-label="Next Page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Optional search shortcut link for zero friction */}
            {onFindMoreClick && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onFindMoreClick}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover font-medium underline underline-offset-4"
                >
                  <Search className="h-3 w-3" />
                  Looking for a different route or specific time? Search rides here
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
