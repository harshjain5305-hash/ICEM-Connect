import { z } from 'zod';

export const createRatingSchema = z.object({
  ride_id: z.string().min(1, 'Ride ID is required'),
  reviewee_id: z.string().min(1, 'Reviewee student ID is required'),
  score: z
    .number({ invalid_type_error: 'Score must be a number' })
    .int('Score must be an integer')
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars'),
  feedback: z
    .string()
    .trim()
    .max(500, 'Feedback cannot exceed 500 characters')
    .nullable()
    .optional(),
});

export type CreateRatingSchemaInput = z.infer<typeof createRatingSchema>;
