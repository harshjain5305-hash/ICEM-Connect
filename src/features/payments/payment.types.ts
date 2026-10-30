import type { PaymentStatus, PaymentMethod } from '@/types/database';
import type { PublicStudentInfo } from '@/features/requests/request.types';
import type { Ride } from '@/features/rides/ride.types';

export type { PaymentStatus, PaymentMethod };

export interface RidePayment {
  id: string;
  ride_id: string;
  request_id?: string | null;
  payer_id: string;
  payee_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  upi_intent_uri?: string | null;
  payer_paid_at?: string | null;
  host_confirmed_at?: string | null;
  dispute_reason?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated references
  payer?: PublicStudentInfo;
  payee?: PublicStudentInfo;
  ride?: Ride;
}

export interface CreatePaymentInput {
  ride_id: string;
  request_id?: string | null;
  payer_id: string;
  payee_id: string;
  amount: number;
  method?: PaymentMethod;
}

export interface StudentPaymentStats {
  totalEarned: number;
  totalPaid: number;
  receivedCount: number;
  paidCount: number;
  pendingConfirmationCount: number;
}
