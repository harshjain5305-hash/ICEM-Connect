import { z } from 'zod';

export const createJoinRequestSchema = z.object({
  ride_id: z.string().min(1, 'Ride ID is required'),
  pickup_waypoint_id: z.string().nullable().optional(),
  drop_waypoint_id: z.string().nullable().optional(),
  seat_count: z
    .number()
    .int('Seats must be a whole number')
    .min(1, 'At least 1 seat must be requested')
    .max(4, 'A maximum of 4 seats can be requested'),
  specific_area_note: z
    .string()
    .max(140, 'Pickup note must be 140 characters or fewer')
    .nullable()
    .optional(),
});

export const acceptJoinRequestSchema = z.object({
  request_id: z.string().min(1, 'Request ID is required'),
});

export const rejectJoinRequestSchema = z.object({
  request_id: z.string().min(1, 'Request ID is required'),
  reason: z.string().max(200, 'Reason cannot exceed 200 characters').optional(),
});

export const cancelJoinRequestSchema = z.object({
  request_id: z.string().min(1, 'Request ID is required'),
});

export type CreateJoinRequestSchemaInput = z.infer<typeof createJoinRequestSchema>;
