import { z } from 'zod';

export const liveLocationUpdateSchema = z.object({
  ride_id: z.string().min(1, 'Ride ID is required'),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  accuracy: z.number().nonnegative('Accuracy must be non-negative'),
  heading: z.number().min(0).max(360).nullable().optional(),
  speed: z.number().nonnegative().nullable().optional(),
  timestamp: z.string().refine((ts) => !isNaN(Date.parse(ts)), {
    message: 'Invalid ISO timestamp string',
  }),
});

export type LiveLocationUpdateInput = z.infer<typeof liveLocationUpdateSchema>;
