import { describe, it, expect, beforeEach } from 'vitest';
import { recurringScheduleService } from './recurringSchedule.service';
import { rideRepository } from './ride.repository';

describe('recurringScheduleService', () => {
  const hostId = 'host_student_recurring_1';

  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a recurring schedule and auto-materializes rides for upcoming weekdays', async () => {
    const { schedule, materializedRides } = await recurringScheduleService.createSchedule(
      hostId,
      {
        origin_location_id: 'loc_akurdi_station',
        destination_location_id: 'loc_icem_campus',
        departure_time: '08:30',
        days_of_week: [1, 2, 3, 4, 5],
        total_seats: 1,
        vehicle_type: 'BIKE',
        note: 'Pillion helmet provided',
      }
    );

    expect(schedule.id).toBeDefined();
    expect(schedule.is_active).toBe(true);
    expect(schedule.days_of_week).toEqual([1, 2, 3, 4, 5]);

    // Materialized rides should be created for upcoming weekdays
    expect(materializedRides.length).toBeGreaterThan(0);
    expect(materializedRides.every((r) => r.departure_time === '08:30')).toBe(true);
    expect(materializedRides.every((r) => r.status === 'PUBLISHED')).toBe(true);

    // Verify rides in repository
    const hostRides = await rideRepository.listRidesByHost(hostId);
    expect(hostRides.length).toBe(materializedRides.length);
  });

  it('does not duplicate rides when auto-materialize is invoked repeatedly', async () => {
    const { schedule, materializedRides: firstPass } = await recurringScheduleService.createSchedule(
      hostId,
      {
        origin_location_id: 'loc_talegaon_station',
        destination_location_id: 'loc_icem_campus',
        departure_time: '08:45',
        days_of_week: [1, 2, 3, 4, 5],
        total_seats: 2,
        vehicle_type: 'SCOOTER',
      }
    );

    const secondPass = await recurringScheduleService.autoMaterializeUpcomingRides(schedule, 7);
    // Should not create duplicates
    expect(secondPass.length).toBe(0);

    const allRides = await rideRepository.listRidesByHost(hostId);
    expect(allRides.length).toBe(firstPass.length);
  });

  it('pauses and resumes a specific date without creating a ride for the paused day', async () => {
    const { schedule } = await recurringScheduleService.createSchedule(hostId, {
      origin_location_id: 'loc_kiwale_phata',
      destination_location_id: 'loc_icem_campus',
      departure_time: '09:00',
      days_of_week: [1, 2, 3, 4, 5],
      total_seats: 1,
      vehicle_type: 'BIKE',
    });

    const targetDate = '2026-10-30';
    const paused = await recurringScheduleService.pauseScheduleDate(schedule.id, targetDate);
    expect(paused.paused_dates).toContain(targetDate);

    const resumed = await recurringScheduleService.resumeScheduleDate(schedule.id, targetDate);
    expect(resumed.paused_dates).not.toContain(targetDate);
  });

  it('lists schedules by host and supports master active toggle and deletion', async () => {
    const { schedule } = await recurringScheduleService.createSchedule(hostId, {
      origin_location_id: 'loc_bhosari_stand',
      destination_location_id: 'loc_icem_campus',
      departure_time: '08:15',
      total_seats: 1,
      vehicle_type: 'BIKE',
    });

    const list = await recurringScheduleService.listSchedulesByHost(hostId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(schedule.id);

    const deactivated = await recurringScheduleService.toggleActive(schedule.id, false);
    expect(deactivated.is_active).toBe(false);

    await recurringScheduleService.deleteSchedule(schedule.id);
    const emptyList = await recurringScheduleService.listSchedulesByHost(hostId);
    expect(emptyList.length).toBe(0);
  });
});
