import { z } from 'zod';

export const rideSearchSchema = z
  .object({
    pickup_location_id: z.string().min(1, 'Pickup location is required'),
    drop_location_id: z.string().min(1, 'Drop destination is required'),
    departure_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Departure date must be YYYY-MM-DD'),
    departure_time: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Departure time must be HH:MM')
      .optional()
      .nullable(),
    flexibility_minutes: z.number().int().min(0).max(180).default(30),
    requested_seats: z.number().int().min(1).max(4).default(1),
    passenger_id: z.string().optional().nullable(),
  })
  .refine((data) => data.pickup_location_id !== data.drop_location_id, {
    message: 'Pickup and destination cannot be the same transit point',
    path: ['drop_location_id'],
  });

export type RideSearchInput = z.infer<typeof rideSearchSchema>;
