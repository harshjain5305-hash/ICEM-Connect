import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminService } from './admin.service';
import { authService } from '@/features/auth/auth.service';
import { rideService } from '@/features/rides/ride.service';
import { requestService } from '@/features/requests/request.service';
import { moderationService } from '@/features/moderation/moderation.service';
import { notificationService } from '@/features/notifications/notification.service';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
  isSupabaseConfigured: () => false,
}));

describe('Admin Service & Moderation Console (Phase 7)', () => {
  let adminId: string;
  let regularStudentId: string;

  beforeEach(async () => {
    localStorage.clear();

    // Provision admin user
    const adminAuth = await authService.login({
      email: 'admin.moderator@indiraicem.ac.in',
      password: 'AnyPassword123!',
    });
    adminId = adminAuth.user.id;

    // Provision regular student user
    const studentAuth = await authService.login({
      email: 'student.peer@indiraicem.ac.in',
      password: 'AnyPassword123!',
    });
    regularStudentId = studentAuth.user.id;

    // Switch active session back to admin
    await authService.login({
      email: 'admin.moderator@indiraicem.ac.in',
      password: 'AnyPassword123!',
    });
  });

  describe('Administrative Privilege Authorization Guard (Rules.md §24)', () => {
    it('permits authorized admin users to execute moderation operations', async () => {
      await expect(adminService.requireAdmin(adminId)).resolves.toBeUndefined();
    });

    it('strictly forbids regular students without ADMIN role from invoking admin operations', async () => {
      await expect(adminService.requireAdmin(regularStudentId)).rejects.toThrow(
        /Administrative privilege strictly required/i
      );
    });
  });

  describe('Campus Mobility & Health Metrics', () => {
    it('aggregates student, ride, request, and report metrics', async () => {
      // Create a ride
      await rideService.createRide(regularStudentId, {
        origin_location_id: 'loc_icem_campus',
        destination_location_id: 'loc_bhosari_stand',
        departure_date: '2026-10-30',
        departure_time: '18:00',
        total_seats: 1,
        vehicle_type: 'SCOOTER',
      });

      // Submit a report
      await moderationService.submitReport(regularStudentId, {
        reported_id: adminId,
        reason: 'OTHER',
        details: 'Testing campus reporting system for audit',
      });

      const metrics = await adminService.getCampusMetrics(adminId);

      expect(metrics.totalStudents).toBeGreaterThanOrEqual(2);
      expect(metrics.activeStudents).toBeGreaterThanOrEqual(2);
      expect(metrics.totalRides).toBe(1);
      expect(metrics.activeRides).toBe(1);
      expect(metrics.totalReports).toBe(1);
      expect(metrics.pendingReports).toBe(1);
    });

    it('rejects metrics inquiry from unauthorized student', async () => {
      await expect(adminService.getCampusMetrics(regularStudentId)).rejects.toThrow(/Forbidden/i);
    });
  });

  describe('Incident Investigation & Moderation Resolution', () => {
    it('allows admin to list and resolve reports with resolution notes', async () => {
      const report = await moderationService.submitReport(regularStudentId, {
        reported_id: 'target-student-xyz',
        reason: 'UNSAFE_DRIVING',
        details: 'Overspeeding at highway intersection',
      });

      const reportsBefore = await adminService.listReports(adminId);
      expect(reportsBefore.length).toBe(1);
      expect(reportsBefore[0].id).toBe(report.id);

      const resolved = await adminService.resolveReport(
        adminId,
        report.id,
        'RESOLVED',
        'Official warning issued to driver by Campus Safety Committee'
      );

      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolved_by).toBe(adminId);
      expect(resolved.resolution_note).toContain('Official warning issued');
    });

    it('blocks non-admin from listing or resolving reports', async () => {
      await expect(adminService.listReports(regularStudentId)).rejects.toThrow(/Forbidden/i);
      await expect(
        adminService.resolveReport(regularStudentId, 'some-id', 'RESOLVED', 'Note')
      ).rejects.toThrow(/Forbidden/i);
    });
  });

  describe('Administrative Ride Cancellation', () => {
    it('cancels an active ride, updating status and alerting host and confirmed passengers', async () => {
      // Create ride
      const ride = await rideService.createRide(regularStudentId, {
        origin_location_id: 'loc_icem_campus',
        destination_location_id: 'loc_bhosari_stand',
        departure_date: '2026-10-31',
        departure_time: '19:00',
        total_seats: 2,
        vehicle_type: 'SCOOTER',
      });

      // Passenger creates and gets accepted join request
      const passengerId = 'passenger_student_123';
      const req = await requestService.createRequest(passengerId, {
        ride_id: ride.id,
        seat_count: 1,
      });
      await requestService.acceptRequest(regularStudentId, req.id);

      // Admin cancels ride due to adverse weather / safety hazard
      const cancelledRide = await adminService.adminCancelRide(
        adminId,
        ride.id,
        'Campus emergency shutdown due to heavy thunderstorm'
      );

      expect(cancelledRide.status).toBe('CANCELLED');

      // Verify Host received ADMIN_ALERT notification
      const hostNotifs = await notificationService.getUserNotifications(regularStudentId);
      const hostAlert = hostNotifs.find((n) => n.type === 'ADMIN_ALERT');
      expect(hostAlert).toBeDefined();
      expect(hostAlert?.title).toContain('Cancelled by Campus Admin');
      expect(hostAlert?.message).toContain('heavy thunderstorm');

      // Verify Passenger received ADMIN_ALERT notification
      const passengerNotifs = await notificationService.getUserNotifications(passengerId);
      const passengerAlert = passengerNotifs.find((n) => n.type === 'ADMIN_ALERT');
      expect(passengerAlert).toBeDefined();
      expect(passengerAlert?.title).toContain('Booked Ride Cancelled by Admin');
      expect(passengerAlert?.message).toContain('heavy thunderstorm');
    });

    it('blocks regular students from executing administrative ride cancellation', async () => {
      await expect(
        adminService.adminCancelRide(regularStudentId, 'some-ride-id', 'Halt')
      ).rejects.toThrow(/Forbidden/i);
    });
  });

  describe('Student Registry & Account Status Moderation', () => {
    it('allows admin to list students and suspend a student account', async () => {
      const students = await adminService.getStudents(adminId);
      expect(students.length).toBeGreaterThanOrEqual(2);

      // Suspend the regular student
      await adminService.updateStudentStatus(adminId, regularStudentId, 'SUSPENDED');

      // Fetch profile to verify
      const profile = await authService.getProfile(regularStudentId);
      expect(profile?.status).toBe('SUSPENDED');
    });

    it('forbids unauthorized student from updating another student status', async () => {
      await expect(
        adminService.updateStudentStatus(regularStudentId, adminId, 'SUSPENDED')
      ).rejects.toThrow(/Forbidden/i);
    });
  });

  describe('Administrative Location & Waypoint Management', () => {
    it('allows admin to list, create, update, and toggle transit locations', async () => {
      const initialLocs = await adminService.listLocations(adminId);
      expect(initialLocs.length).toBeGreaterThanOrEqual(15);

      // Create new stop
      const created = await adminService.createLocation(adminId, {
        name: 'Talegaon Toll Plaza Junction',
        type: 'MAIN_ROAD',
        latitude: 18.735,
        longitude: 73.685,
        address: 'Old Mumbai-Pune Highway, Talegaon Toll',
        is_active: true,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Talegaon Toll Plaza Junction');
      expect(created.is_active).toBe(true);

      // Verify in list
      const afterCreate = await adminService.listLocations(adminId);
      expect(afterCreate.some((l) => l.id === created.id)).toBe(true);

      // Update location
      const updated = await adminService.updateLocation(adminId, created.id, {
        name: 'Talegaon Toll Plaza (Updated Bay)',
        type: 'BUS_STOP',
      });
      expect(updated.name).toBe('Talegaon Toll Plaza (Updated Bay)');
      expect(updated.type).toBe('BUS_STOP');

      // Toggle active status
      const deactivated = await adminService.toggleLocationStatus(adminId, created.id, false);
      expect(deactivated.is_active).toBe(false);
    });

    it('strictly forbids regular students from creating or editing transit locations', async () => {
      await expect(
        adminService.createLocation(regularStudentId, {
          name: 'Hacked Node',
          type: 'CUSTOM',
          latitude: 18.7,
          longitude: 73.7,
        })
      ).rejects.toThrow(/Forbidden/i);

      await expect(
        adminService.updateLocation(regularStudentId, 'loc_somatne_phata', {
          name: 'Defaced Name',
        })
      ).rejects.toThrow(/Forbidden/i);

      await expect(
        adminService.toggleLocationStatus(regularStudentId, 'loc_somatne_phata', false)
      ).rejects.toThrow(/Forbidden/i);
    });
  });
});
