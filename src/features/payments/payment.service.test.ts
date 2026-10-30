import { describe, it, expect, beforeEach } from 'vitest';
import { paymentService } from './payment.service';
import { rideService } from '@/features/rides/ride.service';
import { requestService } from '@/features/requests/request.service';
import { notificationService } from '@/features/notifications/notification.service';

describe('P2P UPI Fuel Sharing Payment Service', () => {
  const hostId = 'student_host_payment_1';
  const passengerId = 'student_passenger_payment_1';
  let rideId: string;
  let requestId: string;

  beforeEach(async () => {
    localStorage.clear();

    // Create a ride
    const ride = await rideService.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-30',
      departure_time: '08:30',
      total_seats: 1,
      vehicle_type: 'SCOOTER',
      note: 'Morning commute',
    });
    rideId = ride.id;

    // Create a join request with fuel share offer of ₹30
    const req = await requestService.createRequest(passengerId, {
      ride_id: rideId,
      seat_count: 1,
      offered_amount: 30,
      specific_area_note: 'Main gate',
    });
    requestId = req.id;
  });

  describe('NPCI UPI Intent URI Generation', () => {
    it('generates a valid upi://pay URI with all NPCI required parameters', () => {
      const uri = paymentService.generateUpiIntentUri({
        upiId: 'rohit@okhdfcbank',
        payeeName: 'Rohit Sharma',
        amount: 30,
        note: 'ICEM Fuel Share',
      });

      expect(uri).toContain('upi://pay?');
      expect(uri).toContain('pa=rohit%40okhdfcbank');
      expect(uri).toContain('pn=Rohit%20Sharma');
      expect(uri).toContain('am=30.00');
      expect(uri).toContain('cu=INR');
      expect(uri).toContain('tn=ICEM%20Fuel%20Share');
    });

    it('handles special characters and whitespace safely', () => {
      const uri = paymentService.generateUpiIntentUri({
        upiId: '  aniket.shinde@upi  ',
        payeeName: 'Aniket Shinde & Co.',
        amount: 45.5,
      });

      expect(uri).toContain('pa=aniket.shinde%40upi');
      expect(uri).toContain('am=45.50');
      expect(uri).toContain('cu=INR');
    });
  });

  describe('Payment Initialization and Idempotency', () => {
    it('prevents self-payment if payer and payee are identical', async () => {
      await expect(
        paymentService.createOrGetPayment({
          ride_id: rideId,
          request_id: requestId,
          payer_id: hostId,
          payee_id: hostId,
          amount: 50,
        })
      ).rejects.toThrow(/self-payment is prohibited/i);
    });

    it('creates a new payment record in PENDING status', async () => {
      const payment = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });

      expect(payment).toBeDefined();
      expect(payment.id).toBeDefined();
      expect(payment.amount).toBe(30);
      expect(payment.status).toBe('PENDING');
      expect(payment.method).toBe('UPI');
    });

    it('returns the existing payment record idempotently on duplicate creation', async () => {
      const payment1 = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });

      const payment2 = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });

      expect(payment1.id).toBe(payment2.id);
    });
  });

  describe('Payment Lifecycle Transitions', () => {
    it('allows passenger to mark contribution as sent via UPI and notifies host', async () => {
      const payment = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });

      const updated = await paymentService.markPaid(
        passengerId,
        payment.id,
        'UPI',
        'upi://pay?pa=host@upi&pn=Host&am=30.00&cu=INR'
      );

      expect(updated.status).toBe('PAID_PENDING_CONFIRMATION');
      expect(updated.payer_paid_at).toBeDefined();
      expect(updated.upi_intent_uri).toContain('upi://pay');

      // Verify host was notified
      const notifs = await notificationService.getUserNotifications(hostId);
      const paymentNotif = notifs.find((n) => n.type === 'PAYMENT_PENDING_CONFIRMATION');
      expect(paymentNotif).toBeDefined();
      expect(paymentNotif?.message).toContain('₹30');
    });

    it('rejects markPaid if called by a user who is not the contributing passenger', async () => {
      const payment = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });

      await expect(
        paymentService.markPaid('impostor_student', payment.id, 'UPI')
      ).rejects.toThrow(/only the passenger/i);
    });

    it('allows host to confirm receipt of fuel contribution and notifies passenger', async () => {
      const payment = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });

      await paymentService.markPaid(passengerId, payment.id, 'UPI');
      const confirmed = await paymentService.confirmPayment(hostId, payment.id);

      expect(confirmed.status).toBe('CONFIRMED');
      expect(confirmed.host_confirmed_at).toBeDefined();

      // Verify passenger received confirmation alert
      const notifs = await notificationService.getUserNotifications(passengerId);
      const confNotif = notifs.find((n) => n.type === 'PAYMENT_CONFIRMED');
      expect(confNotif).toBeDefined();
      expect(confNotif?.message).toContain('₹30');
    });

    it('rejects confirmation by anyone other than the ride host', async () => {
      const payment = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });

      await expect(
        paymentService.confirmPayment(passengerId, payment.id)
      ).rejects.toThrow(/only the ride host/i);
    });

    it('allows host to report payment dispute / non-receipt', async () => {
      const payment = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });

      await paymentService.markPaid(passengerId, payment.id, 'UPI');
      const disputed = await paymentService.disputePayment(
        hostId,
        payment.id,
        'Amount did not arrive in bank account'
      );

      expect(disputed.status).toBe('DISPUTED');
      expect(disputed.dispute_reason).toBe('Amount did not arrive in bank account');

      // Passenger notified
      const notifs = await notificationService.getUserNotifications(passengerId);
      const dispNotif = notifs.find((n) => n.type === 'PAYMENT_DISPUTED');
      expect(dispNotif).toBeDefined();
    });
  });

  describe('Student Fuel Stats Calculation', () => {
    it('computes accurate earnings and contributions across rides', async () => {
      // Payment 1: Host receives ₹30 confirmed from passengerId
      const p1 = await paymentService.createOrGetPayment({
        ride_id: rideId,
        request_id: requestId,
        payer_id: passengerId,
        payee_id: hostId,
        amount: 30,
      });
      await paymentService.markPaid(passengerId, p1.id, 'UPI');
      await paymentService.confirmPayment(hostId, p1.id);

      // Payment 2: Host receives ₹40 confirmed from passengerId on another ride
      const p2 = await paymentService.createOrGetPayment({
        ride_id: 'ride_2',
        request_id: 'req_2',
        payer_id: passengerId,
        payee_id: hostId,
        amount: 40,
      });
      await paymentService.markPaid(passengerId, p2.id, 'UPI');
      await paymentService.confirmPayment(hostId, p2.id);

      const hostStats = await paymentService.getStudentPaymentStats(hostId);
      expect(hostStats.totalEarned).toBe(70);
      expect(hostStats.receivedCount).toBe(2);

      const passengerStats = await paymentService.getStudentPaymentStats(passengerId);
      expect(passengerStats.totalPaid).toBe(70);
      expect(passengerStats.paidCount).toBe(2);
    });
  });
});
