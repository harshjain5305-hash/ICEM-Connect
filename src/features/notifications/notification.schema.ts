import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'REQUEST_RECEIVED',
  'REQUEST_ACCEPTED',
  'REQUEST_REJECTED',
  'REQUEST_CANCELLED',
  'RIDE_CANCELLED',
  'RIDE_CONFIRMED',
  'RATING_RECEIVED',
  'PAYMENT_PENDING_CONFIRMATION',
  'PAYMENT_CONFIRMED',
  'PAYMENT_DISPUTED',
  'ADMIN_ALERT',
  'SYSTEM',
]);

export const createNotificationSchema = z.object({
  user_id: z.string().min(1, 'Target user ID is required'),
  title: z.string().min(1, 'Title is required').max(100),
  message: z.string().min(1, 'Message is required').max(300),
  type: notificationTypeSchema.default('SYSTEM'),
  data: z.record(z.unknown()).nullable().optional(),
});
