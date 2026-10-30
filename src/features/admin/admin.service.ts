import { authService } from '@/features/auth/auth.service';
import { moderationService } from '@/features/moderation/moderation.service';
import { rideRepository } from '@/features/rides/ride.repository';
import { notificationService } from '@/features/notifications/notification.service';
import { requestRepository } from '@/features/requests/request.repository';
import { locationService } from '@/features/locations/location.service';
import type { Location, CreateLocationInput, UpdateLocationInput } from '@/features/locations/location.schema';
import type { StudentProfile } from '@/features/auth/auth.types';
import type { UserReport, ReportStatus } from '@/features/moderation/moderation.types';
import type { Ride } from '@/features/rides/ride.types';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/lib/localStorage';

export interface CampusMetrics {
  totalStudents: number;
  activeStudents: number;
  suspendedStudents: number;
  totalRides: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  totalRequests: number;
  confirmedBookings: number;
  totalReports: number;
  pendingReports: number;
}

async function hydrateAdminRideLocations(rides: Ride[]): Promise<Ride[]> {
  return Promise.all(
    rides.map(async (ride) => {
      let origin = ride.origin;
      let destination = ride.destination;

      if (!origin && ride.origin_location_id) {
        const loc = await locationService.getById(ride.origin_location_id);
        if (loc) {
          origin = {
            id: loc.id,
            name: loc.name,
            type: loc.type,
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: loc.address,
          };
        }
      }

      if (!destination && ride.destination_location_id) {
        const loc = await locationService.getById(ride.destination_location_id);
        if (loc) {
          destination = {
            id: loc.id,
            name: loc.name,
            type: loc.type,
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: loc.address,
          };
        }
      }

      return {
        ...ride,
        origin,
        destination,
      };
    })
  );
}

export const adminService = {
  /**
   * Internal guard to enforce server-authoritative admin privilege.
   * Conforms to Rules.md §24 and Architecture.md §16.
   */
  async requireAdmin(adminUserId: string): Promise<void> {
    const roles = await authService.getUserRoles(adminUserId);
    if (!roles.includes('ADMIN')) {
      throw new Error('Forbidden: Administrative privilege strictly required.');
    }
  },

  /**
   * Retrieves aggregated campus mobility & moderation health metrics.
   */
  async getCampusMetrics(adminUserId: string): Promise<CampusMetrics> {
    await this.requireAdmin(adminUserId);

    const students = await authService.getStudentsForAdmin(adminUserId);
    const reports = await moderationService.listAllReports();

    // Fetch rides
    let rides: Ride[] = [];
    const isLive = isSupabaseConfigured();
    if (isLive) {
      try {
        const { data } = await supabase.from('rides').select('*');
        if (data) rides = data as unknown as Ride[];
      } catch {
        // fallback
      }
    }
    if (rides.length === 0) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.RIDES);
        if (raw) rides = Object.values(JSON.parse(raw));
      } catch {
        // ignore
      }
    }

    // Fetch requests (live count query or local fallback)
    let totalRequests = 0;
    if (isLive) {
      try {
        const { count } = await supabase
          .from('ride_join_requests')
          .select('*', { count: 'exact', head: true });
        if (typeof count === 'number') totalRequests = count;
      } catch {
        // fallback
      }
    }
    if (totalRequests === 0) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
        if (raw) totalRequests = Object.keys(JSON.parse(raw)).length;
      } catch {
        // ignore
      }
    }

    // Fetch confirmed participants (live count query or local fallback)
    let confirmedBookings = 0;
    if (isLive) {
      try {
        const { count } = await supabase
          .from('ride_participants')
          .select('*', { count: 'exact', head: true });
        if (typeof count === 'number') confirmedBookings = count;
      } catch {
        // fallback
      }
    }
    if (confirmedBookings === 0) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
        if (raw) confirmedBookings = Object.keys(JSON.parse(raw)).length;
      } catch {
        // ignore
      }
    }

    return {
      totalStudents: students.length,
      activeStudents: students.filter((s) => s.status === 'ACTIVE').length,
      suspendedStudents: students.filter((s) => s.status === 'SUSPENDED').length,
      totalRides: rides.length,
      activeRides: rides.filter((r) => ['PUBLISHED', 'CONFIRMED', 'ACTIVE'].includes(r.status)).length,
      completedRides: rides.filter((r) => r.status === 'COMPLETED').length,
      cancelledRides: rides.filter((r) => r.status === 'CANCELLED').length,
      totalRequests,
      confirmedBookings,
      totalReports: reports.length,
      pendingReports: reports.filter((r) => r.status === 'PENDING').length,
    };
  },

  /**
   * Lists all incident reports with optional status filtering.
   */
  async listReports(adminUserId: string, filterStatus?: ReportStatus): Promise<UserReport[]> {
    await this.requireAdmin(adminUserId);
    return await moderationService.listAllReports(filterStatus);
  },

  /**
   * Updates report status and logs resolution note.
   */
  async resolveReport(
    adminUserId: string,
    reportId: string,
    status: ReportStatus,
    resolutionNote?: string | null
  ): Promise<UserReport> {
    await this.requireAdmin(adminUserId);
    return await moderationService.resolveReport(adminUserId, reportId, status, resolutionNote);
  },

  /**
   * Lists all rides across campus with hydrated origin & destination names.
   */
  async listAllRides(adminUserId: string): Promise<Ride[]> {
    await this.requireAdmin(adminUserId);

    let rawRides: Ride[] = [];
    const isLive = isSupabaseConfigured();
    if (isLive) {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('*')
          .order('departure_date', { ascending: false });
        if (!error && data) {
          rawRides = data as unknown as Ride[];
        }
      } catch (err) {
        console.warn('Live listAllRides error:', err);
      }
    }

    if (rawRides.length === 0) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.RIDES);
        if (raw) rawRides = Object.values(JSON.parse(raw));
      } catch {
        rawRides = [];
      }
    }

    return await hydrateAdminRideLocations(rawRides);
  },

  /**
   * Lists all locations/waypoints across campus for administrative management.
   */
  async listLocations(adminUserId: string): Promise<Location[]> {
    await this.requireAdmin(adminUserId);
    return await locationService.listAll();
  },

  /**
   * Creates a new location / transit waypoint.
   */
  async createLocation(adminUserId: string, input: CreateLocationInput): Promise<Location> {
    await this.requireAdmin(adminUserId);
    return await locationService.createLocation(input);
  },

  /**
   * Updates an existing location / waypoint.
   */
  async updateLocation(
    adminUserId: string,
    locationId: string,
    updates: UpdateLocationInput
  ): Promise<Location> {
    await this.requireAdmin(adminUserId);
    return await locationService.updateLocation(locationId, updates);
  },

  /**
   * Toggles active state of a location.
   */
  async toggleLocationStatus(
    adminUserId: string,
    locationId: string,
    isActive: boolean
  ): Promise<Location> {
    await this.requireAdmin(adminUserId);
    return await locationService.toggleActive(locationId, isActive);
  },

  /**
   * Administrative ride cancellation with reason and automatic participant notifications.
   */
  async adminCancelRide(
    adminUserId: string,
    rideId: string,
    reason: string
  ): Promise<Ride> {
    await this.requireAdmin(adminUserId);

    const ride = await rideRepository.getRideById(rideId);
    if (!ride) {
      throw new Error(`Ride with ID ${rideId} not found`);
    }

    const updated = await rideRepository.updateRideStatus(rideId, 'CANCELLED');

    // Notify host
    await notificationService.notify({
      user_id: ride.host_id,
      title: 'Ride Cancelled by Campus Admin',
      message: `Your ride scheduled for ${ride.departure_date} was cancelled by Campus Administration. Reason: ${reason}`,
      type: 'ADMIN_ALERT',
      data: { ride_id: rideId, admin_reason: reason },
    });

    // Notify all confirmed participants
    const participants = await requestRepository.listParticipantsByRide(rideId);
    for (const p of participants) {
      await notificationService.notify({
        user_id: p.student_id,
        title: 'Booked Ride Cancelled by Admin',
        message: `Your booked ride for ${ride.departure_date} was cancelled by Administration. Reason: ${reason}`,
        type: 'ADMIN_ALERT',
        data: { ride_id: rideId, admin_reason: reason },
      });
    }

    return updated;
  },

  /**
   * Lists students with private PRN for administrative identity verification.
   */
  async getStudents(adminUserId: string): Promise<StudentProfile[]> {
    await this.requireAdmin(adminUserId);
    return await authService.getStudentsForAdmin(adminUserId);
  },

  /**
   * Updates student account status (ACTIVE, SUSPENDED, DEACTIVATED).
   */
  async updateStudentStatus(
    adminUserId: string,
    targetStudentId: string,
    newStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  ): Promise<void> {
    await this.requireAdmin(adminUserId);
    await authService.updateStudentStatus(adminUserId, targetStudentId, newStatus);
  },
};
