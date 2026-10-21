import { z } from 'zod';

export const reportCategories = [
  'UNSAFE_DRIVING',
  'HARASSMENT',
  'INAPPROPRIATE_BEHAVIOUR',
  'NO_SHOW',
  'MISREPRESENTATION',
  'ROUTE_PICKUP_ABUSE',
  'SUSPICIOUS_ACTIVITY',
  'OTHER',
] as const;

export const reportCategoryLabels: Record<(typeof reportCategories)[number], string> = {
  UNSAFE_DRIVING: 'Unsafe Driving / Speeding',
  HARASSMENT: 'Harassment / Verbal Abuse',
  INAPPROPRIATE_BEHAVIOUR: 'Inappropriate Behaviour',
  NO_SHOW: 'No-Show / Abandoned Trip',
  MISREPRESENTATION: 'Identity / Vehicle Misrepresentation',
  ROUTE_PICKUP_ABUSE: 'Route or Pickup Disruption',
  SUSPICIOUS_ACTIVITY: 'Suspicious / Unauthorised Activity',
  OTHER: 'Other Policy Violation',
};

export const createReportSchema = z.object({
  reported_id: z.string().min(1, 'Reported student ID is required'),
  ride_id: z.string().nullable().optional(),
  reason: z.enum(reportCategories, {
    errorMap: () => ({ message: 'Please select a valid report reason' }),
  }),
  details: z
    .string()
    .trim()
    .min(5, 'Please provide at least 5 characters of context')
    .max(1000, 'Report details cannot exceed 1000 characters'),
});

export type CreateReportSchemaInput = z.infer<typeof createReportSchema>;

export const createBlockSchema = z.object({
  blocked_id: z.string().min(1, 'Target student ID is required'),
  reason: z
    .string()
    .trim()
    .max(250, 'Block reason cannot exceed 250 characters')
    .nullable()
    .optional(),
});

export type CreateBlockSchemaInput = z.infer<typeof createBlockSchema>;

export const updateReportStatusSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']),
  resolution_note: z
    .string()
    .trim()
    .max(500, 'Resolution note cannot exceed 500 characters')
    .nullable()
    .optional(),
});

export type UpdateReportStatusSchemaInput = z.infer<typeof updateReportStatusSchema>;
