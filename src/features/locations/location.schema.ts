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

export type Location = z.infer<typeof locationSchema>;
export type LocationSearchInput = z.input<typeof locationSearchSchema>;
