import { z } from 'zod';
import type { LocationType } from '@/types/database';

export const LOCATION_TYPES: LocationType[] = [
  'ICEM',
  'MAIN_ROAD',
  'BUS_STOP',
  'LANDMARK',
  'AREA',
  'CUSTOM',
];

export const locationSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string().min(2, 'Location name is required'),
  type: z.enum(['ICEM', 'MAIN_ROAD', 'BUS_STOP', 'LANDMARK', 'AREA', 'CUSTOM']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export const locationSearchSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['ICEM', 'MAIN_ROAD', 'BUS_STOP', 'LANDMARK', 'AREA', 'CUSTOM']).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type { LocationType };

export const createLocationSchema = z.object({
  name: z.string().trim().min(2, 'Location name must be at least 2 characters'),
  type: z.enum(['ICEM', 'MAIN_ROAD', 'BUS_STOP', 'LANDMARK', 'AREA', 'CUSTOM']).default('AREA'),
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  address: z.string().trim().optional().nullable(),
  is_active: z.boolean().default(true).optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

export type Location = z.infer<typeof locationSchema>;
export type LocationSearchInput = z.input<typeof locationSearchSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
