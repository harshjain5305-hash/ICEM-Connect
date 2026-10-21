import { z } from 'zod';

export const vehicleTypeSchema = z.enum(['BIKE', 'SCOOTER', 'OTHER']);
export const waypointTypeSchema = z.enum(['ORIGIN', 'WAYPOINT', 'DESTINATION']);
export const rideStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);

export const createRideSchema = z
  .object({
    origin_location_id: z.string().min(1, 'Origin location is required'),
    destination_location_id: z.string().min(1, 'Destination location is required'),
    departure_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Departure date must be YYYY-MM-DD'),
    departure_time: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Departure time must be HH:MM'),
    total_seats: z
      .number()
      .int()
      .min(1, 'Must offer at least 1 seat')
      .max(4, 'Maximum 4 passenger seats permitted on campus network'),
    available_seats: z.number().int().min(0).max(4).optional(),
    vehicle_type: vehicleTypeSchema.default('SCOOTER'),
    note: z.string().max(300, 'Note cannot exceed 300 characters').optional().nullable(),
  })
  .refine((data) => data.origin_location_id !== data.destination_location_id, {
    message: 'Origin and destination cannot be the same place',
    path: ['destination_location_id'],
  })
  .refine(
    (data) =>
      data.available_seats === undefined || data.available_seats <= data.total_seats,
    {
      message: 'Available seats cannot exceed total seats',
      path: ['available_seats'],
    }
  );

export const updateRideSchema = z
  .object({
    origin_location_id: z.string().min(1, 'Origin location is required').optional(),
    destination_location_id: z.string().min(1, 'Destination location is required').optional(),
    departure_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Departure date must be YYYY-MM-DD')
      .optional(),
    departure_time: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Departure time must be HH:MM')
      .optional(),
    total_seats: z
      .number()
      .int()
      .min(1, 'Must offer at least 1 seat')
      .max(4, 'Maximum 4 passenger seats permitted on campus network')
      .optional(),
    vehicle_type: vehicleTypeSchema.optional(),
    note: z.string().max(300, 'Note cannot exceed 300 characters').optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.origin_location_id && data.destination_location_id) {
        return data.origin_location_id !== data.destination_location_id;
      }
      return true;
    },
    {
      message: 'Origin and destination cannot be the same place',
      path: ['destination_location_id'],
    }
  );

export const transitionRideStatusSchema = z.object({
  target_status: rideStatusSchema,
  reason: z.string().max(250, 'Reason cannot exceed 250 characters').optional().nullable(),
});

export const createWaypointSchema = z.object({
  sequence: z.number().int().min(1, 'Sequence must be at least 1'),
  label: z.string().min(1, 'Waypoint label is required'),
  type: waypointTypeSchema.default('WAYPOINT'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location_id: z.string().optional().nullable(),
  distance_from_start_meters: z.number().int().min(0).optional().nullable(),
});

export const createJoinRequestSchema = z
  .object({
    ride_id: z.string().min(1, 'Ride ID is required'),
    pickup_waypoint_id: z.string().min(1, 'Pickup point is required'),
    drop_waypoint_id: z.string().min(1, 'Drop point is required'),
    seat_count: z.number().int().min(1, 'At least 1 seat must be requested').max(4),
    // Design.md §73: specific area / pickup note (optional, landmark clarification only)
    specific_area_note: z
      .string()
      .max(150, 'Pickup note must be under 150 characters')
      .optional()
      .nullable(),
  })
  .refine((data) => data.pickup_waypoint_id !== data.drop_waypoint_id, {
    message: 'Pickup and drop waypoints cannot be identical',
    path: ['drop_waypoint_id'],
  });

export type CreateRideInput = z.infer<typeof createRideSchema>;
export type UpdateRideInput = z.infer<typeof updateRideSchema>;
export type TransitionRideStatusInput = z.infer<typeof transitionRideStatusSchema>;
export type CreateWaypointInput = z.infer<typeof createWaypointSchema>;
export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>;
