import { paymentRepository } from './payment.repository';
import type { RidePayment, CreatePaymentInput, StudentPaymentStats, PaymentMethod } from './payment.types';
import { notificationService } from '@/features/notifications/notification.service';
import { authService } from '@/features/auth/auth.service';

export interface GenerateUpiParams {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}

export const paymentService = {
  /**
   * Constructs an official NPCI standard UPI Intent URI.
   * On mobile devices, this URI is intercepted by Android/iOS to open
   * native UPI applications (Google Pay, PhonePe, Paytm, BHIM).
   */
  generateUpiIntentUri(params: GenerateUpiParams): string {
    const { upiId, payeeName, amount, note = 'ICEM Ride Share Fuel Contribution' } = params;
    const cleanUpi = upiId.trim();
    const cleanName = payeeName.trim().substring(0, 50);
    const cleanAmount = amount.toFixed(2);
    const cleanNote = note.trim().substring(0, 50);

    return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
  },

  async createOrGetPayment(input: CreatePaymentInput): Promise<RidePayment> {
    if (input.payer_id === input.payee_id) {
      throw new Error('Self-payment is prohibited');
    }
    return await paymentRepository.createOrGetPayment(input);
  },

  async getPaymentById(paymentId: string): Promise<RidePayment | null> {
    return await paymentRepository.getPaymentById(paymentId);
  },

  async getPaymentByRequest(requestId: string, rideId: string, payerId: string): Promise<RidePayment | null> {
    return await paymentRepository.getPaymentByRequest(requestId, rideId, payerId);
  },

  async listPaymentsByRide(rideId: string): Promise<RidePayment[]> {
    return await paymentRepository.listPaymentsByRide(rideId);
  },

  async listStudentPayments(studentId: string): Promise<RidePayment[]> {
    return await paymentRepository.listPaymentsByStudent(studentId);
  },

  /**
   * Passenger marks the contribution as completed via UPI app or in cash.
   * Dispatches an alert to the host to verify and confirm receipt.
   */
  async markPaid(
    passengerId: string,
    paymentId: string,
    method: PaymentMethod = 'UPI',
    upiUri?: string | null
  ): Promise<RidePayment> {
    const payment = await paymentRepository.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment record not found');
    if (payment.payer_id !== passengerId) {
      throw new Error('Only the passenger contributing can mark payment as sent');
    }

    const updated = await paymentRepository.markPaidByPassenger(paymentId, method, upiUri);

    // Notify Host to verify receipt
    const passengerProfile = await authService.getProfile(passengerId);
    await notificationService.notify({
      user_id: payment.payee_id,
      title: 'Payment Sent — Please Confirm',
      message: `${passengerProfile?.name || 'Your passenger'} sent ₹${payment.amount} via ${method}. Please confirm once received.`,
      type: 'PAYMENT_PENDING_CONFIRMATION',
      data: { payment_id: paymentId, ride_id: payment.ride_id, amount: payment.amount, method },
    });

    return updated;
  },

  /**
   * Host confirms receipt of the fuel contribution.
   * Updates student ledger and congratulates the passenger.
   */
  async confirmPayment(hostId: string, paymentId: string): Promise<RidePayment> {
    const payment = await paymentRepository.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment record not found');
    if (payment.payee_id !== hostId) {
      throw new Error('Only the ride host can confirm receipt of payment');
    }

    const updated = await paymentRepository.confirmPaymentByHost(paymentId, hostId);

    // Notify Passenger that payment is confirmed
    const hostProfile = await authService.getProfile(hostId);
    await notificationService.notify({
      user_id: payment.payer_id,
      title: 'Fuel Contribution Confirmed! 🎉',
      message: `${hostProfile?.name || 'Ride host'} confirmed receipt of ₹${payment.amount}. Thank you for sharing fuel costs!`,
      type: 'PAYMENT_CONFIRMED',
      data: { payment_id: paymentId, ride_id: payment.ride_id, amount: payment.amount },
    });

    return updated;
  },

  /**
   * Host reports payment not received.
   */
  async disputePayment(hostId: string, paymentId: string, reason: string): Promise<RidePayment> {
    const payment = await paymentRepository.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment record not found');
    if (payment.payee_id !== hostId) {
      throw new Error('Only the ride host can report non-receipt of payment');
    }

    const updated = await paymentRepository.disputePaymentByHost(paymentId, hostId, reason);

    // Notify Passenger to coordinate
    await notificationService.notify({
      user_id: payment.payer_id,
      title: 'Payment Status Update',
      message: `Host indicated they haven't received ₹${payment.amount} yet: "${reason}". Please verify your UPI transaction.`,
      type: 'PAYMENT_DISPUTED',
      data: { payment_id: paymentId, ride_id: payment.ride_id },
    });

    return updated;
  },

  async getStudentPaymentStats(studentId: string): Promise<StudentPaymentStats> {
    return await paymentRepository.getStudentPaymentStats(studentId);
  },
};
