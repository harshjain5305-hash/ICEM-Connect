import type { VehicleType } from '@/types/database';
import type { LocationReference } from './ride.types';

export interface RecurringSchedule {
  id: string;
  host_id: string;
  origin_location_id: string;
  destination_location_id: string;
  origin?: LocationReference;
  destination?: LocationReference;
  departure_time: string; // "HH:MM" e.g. "08:30"
  return_time?: string | null; // Optional afternoon return trip e.g. "17:00"
  days_of_week: number[]; // 1 = Monday, 2 = Tuesday ... 5 = Friday
  total_seats: number;
  vehicle_type: VehicleType;
  note?: string | null;
  is_active: boolean;
  paused_dates: string[]; // e.g. ['2026-10-26']
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringScheduleInput {
  origin_location_id: string;
  destination_location_id: string;
  departure_time: string;
  return_time?: string | null;
  days_of_week?: number[]; // Defaults to [1, 2, 3, 4, 5] (Mon-Fri)
  total_seats: number;
  vehicle_type: VehicleType;
  note?: string | null;
}
