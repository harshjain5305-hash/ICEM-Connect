import type {
  RecurringSchedule,
  CreateRecurringScheduleInput,
} from './recurringSchedule.types';
import type { Ride } from './ride.types';
import { rideRepository } from './ride.repository';
import { locationService } from '@/features/locations/location.service';

const LOCAL_STORAGE_RECURRING_KEY = 'icem_connect_recurring_schedules_v1';

function getLocalSchedules(): Record<string, RecurringSchedule> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RECURRING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSchedules(schedules: Record<string, RecurringSchedule>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_RECURRING_KEY, JSON.stringify(schedules));
  } catch {
    // ignore
  }
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function hydrateScheduleLocations(schedule: RecurringSchedule): Promise<RecurringSchedule> {
  const [origin, destination] = await Promise.all([
    locationService.getById(schedule.origin_location_id),
    locationService.getById(schedule.destination_location_id),
  ]);

  return {
    ...schedule,
    origin: origin
      ? {
          id: origin.id,
          name: origin.name,
          type: origin.type,
          latitude: origin.latitude,
          longitude: origin.longitude,
          address: origin.address,
        }
      : undefined,
    destination: destination
      ? {
          id: destination.id,
          name: destination.name,
          type: destination.type,
          latitude: destination.latitude,
          longitude: destination.longitude,
          address: destination.address,
        }
      : undefined,
  };
}

export const recurringScheduleService = {
  /**
   * Creates a new recurring commute schedule and materializes rides for upcoming weekdays.
   */
  async createSchedule(
    hostId: string,
    input: CreateRecurringScheduleInput
  ): Promise<{ schedule: RecurringSchedule; materializedRides: Ride[] }> {
    if (!hostId) {
      throw new Error('Host student ID is required to create a recurring commute schedule');
    }
    if (!input.origin_location_id || !input.destination_location_id) {
      throw new Error('Origin and destination locations are required');
    }
    if (input.origin_location_id === input.destination_location_id) {
      throw new Error('Origin and destination cannot be identical');
    }

    const schedules = getLocalSchedules();
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const daysOfWeek = input.days_of_week && input.days_of_week.length > 0
      ? input.days_of_week
      : [1, 2, 3, 4, 5]; // Default: Mon-Fri

    const newSchedule: RecurringSchedule = {
      id,
      host_id: hostId,
      origin_location_id: input.origin_location_id,
      destination_location_id: input.destination_location_id,
      departure_time: input.departure_time,
      return_time: input.return_time || null,
      days_of_week: daysOfWeek,
      total_seats: input.total_seats,
      vehicle_type: input.vehicle_type,
      note: input.note || 'Daily Campus Commute (Mon–Fri)',
      is_active: true,
      paused_dates: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    schedules[id] = newSchedule;
    saveLocalSchedules(schedules);

    // Automatically materialize published rides for the upcoming 7 weekdays
    const materializedRides = await this.autoMaterializeUpcomingRides(newSchedule, 7);
    const hydratedSchedule = await hydrateScheduleLocations(newSchedule);

    return { schedule: hydratedSchedule, materializedRides };
  },

  /**
   * Lists all recurring schedules for a specific student host.
   */
  async listSchedulesByHost(hostId: string): Promise<RecurringSchedule[]> {
    const schedules = getLocalSchedules();
    const list = Object.values(schedules).filter((s) => s.host_id === hostId);
    return await Promise.all(list.map((s) => hydrateScheduleLocations(s)));
  },

  /**
   * Pauses a schedule for a single calendar date (e.g. sick day, exam, holiday).
   */
  async pauseScheduleDate(scheduleId: string, date: string): Promise<RecurringSchedule> {
    const schedules = getLocalSchedules();
    const schedule = schedules[scheduleId];
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    if (!schedule.paused_dates.includes(date)) {
      schedule.paused_dates.push(date);
      schedule.updated_at = new Date().toISOString();
      schedules[scheduleId] = schedule;
      saveLocalSchedules(schedules);
    }

    return await hydrateScheduleLocations(schedule);
  },

  /**
   * Resumes a previously paused date.
   */
  async resumeScheduleDate(scheduleId: string, date: string): Promise<RecurringSchedule> {
    const schedules = getLocalSchedules();
    const schedule = schedules[scheduleId];
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    schedule.paused_dates = schedule.paused_dates.filter((d) => d !== date);
    schedule.updated_at = new Date().toISOString();
    schedules[scheduleId] = schedule;
    saveLocalSchedules(schedules);

    // Re-materialize for this resumed date
    await this.autoMaterializeUpcomingRides(schedule, 7);
    return await hydrateScheduleLocations(schedule);
  },

  /**
   * Toggles master active status of a recurring commute routine.
   */
  async toggleActive(scheduleId: string, isActive: boolean): Promise<RecurringSchedule> {
    const schedules = getLocalSchedules();
    const schedule = schedules[scheduleId];
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    schedule.is_active = isActive;
    schedule.updated_at = new Date().toISOString();
    schedules[scheduleId] = schedule;
    saveLocalSchedules(schedules);

    if (isActive) {
      await this.autoMaterializeUpcomingRides(schedule, 7);
    }

    return await hydrateScheduleLocations(schedule);
  },

  /**
   * Deletes a recurring schedule.
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    const schedules = getLocalSchedules();
    delete schedules[scheduleId];
    saveLocalSchedules(schedules);
  },

  /**
   * Generates published rides for the upcoming N days for an active recurring schedule.
   */
  async autoMaterializeUpcomingRides(
    schedule: RecurringSchedule,
    daysAhead: number = 7
  ): Promise<Ride[]> {
    if (!schedule.is_active) return [];

    const existingRides = await rideRepository.listRidesByHost(schedule.host_id);
    const existingDates = new Set(
      existingRides
        .filter((r) => r.status !== 'CANCELLED')
        .map((r) => `${r.departure_date}_${r.departure_time}`)
    );

    const generatedRides: Ride[] = [];
    const today = new Date();

    for (let i = 0; i < daysAhead; i++) {
      const targetDate = new Date();
      targetDate.setDate(today.getDate() + i);

      // In JS, getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
      const jsDay = targetDate.getDay();
      // Map to 1 = Mon ... 7 = Sun (ISO)
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;

      // Skip if this day of week is not in schedule
      if (!schedule.days_of_week.includes(dayOfWeek)) {
        continue;
      }

      const dateStr = formatDate(targetDate);

      // Skip if explicitly paused for this date
      if (schedule.paused_dates.includes(dateStr)) {
        continue;
      }

      const key = `${dateStr}_${schedule.departure_time}`;
      if (existingDates.has(key)) {
        continue; // Ride already materialized/exists for this date and time
      }

      // Materialize morning commute ride
      const newRide = await rideRepository.createRide(
        schedule.host_id,
        {
          origin_location_id: schedule.origin_location_id,
          destination_location_id: schedule.destination_location_id,
          departure_date: dateStr,
          departure_time: schedule.departure_time,
          total_seats: schedule.total_seats,
          vehicle_type: schedule.vehicle_type,
          note: `⚡ Daily Commuter Routine: ${schedule.note || 'Mon–Fri Campus Commute'}`,
        },
        'PUBLISHED'
      );

      existingDates.add(key);
      generatedRides.push(newRide);
    }

    return generatedRides;
  },
};
