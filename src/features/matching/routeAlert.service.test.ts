import { describe, it, expect, beforeEach, vi } from 'vitest';
import { routeAlertService } from './routeAlert.service';
import { notificationService } from '@/features/notifications/notification.service';
import type { Ride } from '@/features/rides/ride.types';

describe('routeAlertService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('creates and retrieves a new route alert', async () => {
    const alert = await routeAlertService.createAlert({
      userId: 'student_123',
      email: 'rahul@indiraicem.ac.in',
      pickupLocationId: 'loc_akurdi_station',
      dropLocationId: 'loc_icem_campus',
      pickupName: 'Akurdi Railway Station Chowk',
      dropName: 'ICEM Main Campus (Parandwadi)',
      date: '2026-10-25',
    });

    expect(alert.id).toBeDefined();
    expect(alert.status).toBe('ACTIVE');
    expect(alert.email).toBe('rahul@indiraicem.ac.in');

    const userAlerts = await routeAlertService.getUserAlerts('student_123');
    expect(userAlerts).toHaveLength(1);
    expect(userAlerts[0].pickupLocationId).toBe('loc_akurdi_station');
  });

  it('deduplicates identical active alerts for the same user and date', async () => {
    const alert1 = await routeAlertService.createAlert({
      userId: 'student_123',
      email: 'rahul@indiraicem.ac.in',
      pickupLocationId: 'loc_akurdi_station',
      dropLocationId: 'loc_icem_campus',
      pickupName: 'Akurdi',
      dropName: 'ICEM',
      date: '2026-10-25',
    });

    const alert2 = await routeAlertService.createAlert({
      userId: 'student_123',
      email: 'rahul@indiraicem.ac.in',
      pickupLocationId: 'loc_akurdi_station',
      dropLocationId: 'loc_icem_campus',
      pickupName: 'Akurdi',
      dropName: 'ICEM',
      date: '2026-10-25',
    });

    expect(alert1.id).toBe(alert2.id);
    const userAlerts = await routeAlertService.getUserAlerts('student_123');
    expect(userAlerts).toHaveLength(1);
  });

  it('cancels an active alert', async () => {
    const alert = await routeAlertService.createAlert({
      userId: 'student_123',
      email: 'rahul@indiraicem.ac.in',
      pickupLocationId: 'loc_talegaon_station',
      dropLocationId: 'loc_icem_campus',
      pickupName: 'Talegaon',
      dropName: 'ICEM',
      date: '2026-10-25',
    });

    await routeAlertService.cancelAlert(alert.id);
    const activeAlerts = await routeAlertService.getUserAlerts('student_123');
    expect(activeAlerts).toHaveLength(0);
  });

  it('notifies subscribers and updates status when a matching ride is offered', async () => {
    const notifySpy = vi.spyOn(notificationService, 'notify').mockResolvedValue({
      id: 'notif_1',
      user_id: 'student_123',
      title: 'Alert',
      message: 'Msg',
      type: 'SYSTEM',
      read: false,
      data: null,
      created_at: new Date().toISOString(),
    });

    await routeAlertService.createAlert({
      userId: 'student_123',
      email: 'rahul@indiraicem.ac.in',
      pickupLocationId: 'loc_akurdi_station',
      dropLocationId: 'loc_icem_campus',
      pickupName: 'Akurdi Station',
      dropName: 'ICEM Campus',
      date: '2026-10-25',
    });

    const mockRide: Ride = {
      id: 'ride_999',
      host_id: 'host_456',
      origin_location_id: 'loc_akurdi_station',
      destination_location_id: 'loc_icem_campus',
      departure_date: '2026-10-25',
      departure_time: '08:30',
      total_seats: 1,
      available_seats: 1,
      vehicle_type: 'BIKE',
      note: 'Helmet provided for pillion',
      status: 'PUBLISHED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      waypoints: [],
    };

    const count = await routeAlertService.notifySubscribersOnNewRide(mockRide);
    expect(count).toBe(1);
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'student_123',
        type: 'SYSTEM',
      })
    );

    // Alert status should now be NOTIFIED, so it no longer shows in active alerts
    const activeAlerts = await routeAlertService.getUserAlerts('student_123');
    expect(activeAlerts).toHaveLength(0);
  });
});
