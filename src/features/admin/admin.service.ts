import { authService } from '@/features/auth/auth.service';
import { moderationService } from '@/features/moderation/moderation.service';
import { rideRepository } from '@/features/rides/ride.repository';
import { notificationService } from '@/features/notifications/notification.service';
import { requestRepository } from '@/features/requests/request.repository';
import type { StudentProfile } from '@/features/auth/auth.types';
import type { UserReport, ReportStatus } from '@/features/moderation/moderation.types';
import type { Ride } from '@/features/rides/ride.types';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

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
        const raw = localStorage.getItem('icem_connect_rides_db_v1');
        if (raw) rides = Object.values(JSON.parse(raw));
      } catch {
        // ignore
      }
    }

    // Fetch requests
    let totalRequests = 0;
    try {
      const raw = localStorage.getItem('icem_join_requests_v1');
      if (raw) totalRequests = Object.keys(JSON.parse(raw)).length;
    } catch {
      // ignore
    }

    // Fetch confirmed participants
    let confirmedBookings = 0;
    try {
      const raw = localStorage.getItem('icem_participants_v1');
      if (raw) confirmedBookings = Object.keys(JSON.parse(raw)).length;
    } catch {
      // ignore
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
   * Lists all rides across campus.
   */
  async listAllRides(adminUserId: string): Promise<Ride[]> {
    await this.requireAdmin(adminUserId);

    const isLive = isSupabaseConfigured();
    if (isLive) {
      try {
        const { data } = await supabase
          .from('rides')
          .select('*')
          .order('departure_date', { ascending: false });
        if (data && data.length > 0) {
          return data as unknown as Ride[];
        }
      } catch (err) {
        console.warn('Live listAllRides error:', err);
      }
    }

    try {
      const raw = localStorage.getItem('icem_connect_rides_db_v1');
      return raw ? Object.values(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
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
