import { z } from 'zod';

export const sendRideMessageSchema = z.object({
  ride_id: z.string().uuid({ message: 'Valid ride ID is required' }),
  message: z
    .string()
    .trim()
    .min(1, { message: 'Message content cannot be empty' })
    .max(500, { message: 'Message exceeds 500 characters limit' }),
});

export type SendRideMessageSchemaType = z.infer<typeof sendRideMessageSchema>;
