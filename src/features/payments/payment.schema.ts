import { z } from 'zod';

export const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export const upiIdSchema = z
  .string()
  .trim()
  .regex(UPI_ID_REGEX, 'Please enter a valid UPI ID (e.g., mobile@paytm or name@okhdfcbank)');

export const createPaymentSchema = z.object({
  ride_id: z.string().min(1, 'Ride ID is required'),
  request_id: z.string().nullable().optional(),
  payer_id: z.string().min(1, 'Payer ID is required'),
  payee_id: z.string().min(1, 'Payee ID is required'),
  amount: z
    .number()
    .min(0, 'Amount must be at least ₹0')
    .max(2000, 'Amount cannot exceed ₹2000 per contribution'),
  method: z.enum(['UPI', 'CASH']).default('UPI'),
});

export const markPaidSchema = z.object({
  payment_id: z.string().min(1, 'Payment ID is required'),
  method: z.enum(['UPI', 'CASH']).default('UPI'),
  upi_intent_uri: z.string().optional().nullable(),
});

export const confirmPaymentSchema = z.object({
  payment_id: z.string().min(1, 'Payment ID is required'),
});

export const disputePaymentSchema = z.object({
  payment_id: z.string().min(1, 'Payment ID is required'),
  reason: z.string().trim().min(3, 'Please describe why payment was not received').max(300),
});
