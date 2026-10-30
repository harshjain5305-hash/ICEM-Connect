import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { STORAGE_KEYS, getLocalData, saveLocalData } from '@/lib/localStorage';
import { isValidUuid } from '@/lib/utils';
import type { RidePayment, CreatePaymentInput, StudentPaymentStats, PaymentMethod } from './payment.types';
import { authService } from '@/features/auth/auth.service';
import { rideRepository } from '@/features/rides/ride.repository';

const LOCAL_STORAGE_PAYMENTS_KEY = STORAGE_KEYS.PAYMENTS;

function notifyPaymentsChanged(paymentId: string, eventType: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('icem:payment_updated', {
          detail: { paymentId, eventType, timestamp: new Date().toISOString() },
        })
      );
    } catch {
      // ignore
    }
  }
}

export const paymentRepository = {
  /**
   * Creates or gets existing pending payment for a ride & passenger.
   */
  async createOrGetPayment(input: CreatePaymentInput): Promise<RidePayment> {
    const isLive = isSupabaseConfigured();

    // Check existing first
    const existing = await this.getPaymentByRequest(input.request_id || '', input.ride_id, input.payer_id);
    if (existing) {
      if (existing.amount !== input.amount && existing.status === 'PENDING') {
        return await this.updatePaymentAmount(existing.id, input.amount);
      }
      return existing;
    }

    if (isLive && isValidUuid(input.payer_id) && isValidUuid(input.payee_id) && isValidUuid(input.ride_id)) {
      try {
        const { data, error } = await supabase
          .from('ride_payments')
          .insert({
            ride_id: input.ride_id,
            request_id: input.request_id && isValidUuid(input.request_id) ? input.request_id : null,
            payer_id: input.payer_id,
            payee_id: input.payee_id,
            amount: input.amount,
            method: input.method || 'UPI',
            status: 'PENDING',
          })
          .select('*')
          .single();

        if (!error && data) {
          const payment = data as unknown as RidePayment;
          notifyPaymentsChanged(payment.id, 'created');
          return payment;
        }
      } catch (err) {
        console.warn('Live create payment error, falling back to local storage:', err);
      }
    }

    // Local / Offline fallback
    const id = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newPayment: RidePayment = {
      id,
      ride_id: input.ride_id,
      request_id: input.request_id || null,
      payer_id: input.payer_id,
      payee_id: input.payee_id,
      amount: input.amount,
      method: input.method || 'UPI',
      status: 'PENDING',
      created_at: now,
      updated_at: now,
    };

    const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
    store[id] = newPayment;
    saveLocalData(LOCAL_STORAGE_PAYMENTS_KEY, store);

    notifyPaymentsChanged(id, 'created');
    return newPayment;
  },

  async getPaymentById(paymentId: string): Promise<RidePayment | null> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(paymentId)) {
      try {
        const { data, error } = await supabase
          .from('ride_payments')
          .select('*')
          .eq('id', paymentId)
          .maybeSingle();

        if (!error && data) {
          return await this.hydratePayment(data as unknown as RidePayment);
        }
      } catch (err) {
        console.warn('Live getPaymentById error:', err);
      }
    }

    const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
    const item = store[paymentId] || null;
    return item ? await this.hydratePayment(item) : null;
  },

  async getPaymentByRequest(
    requestId: string,
    rideId: string,
    payerId: string
  ): Promise<RidePayment | null> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        let query = supabase.from('ride_payments').select('*').eq('ride_id', rideId).eq('payer_id', payerId);
        if (requestId && isValidUuid(requestId)) {
          query = query.eq('request_id', requestId);
        }
        const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!error && data) {
          return await this.hydratePayment(data as unknown as RidePayment);
        }
      } catch (err) {
        console.warn('Live getPaymentByRequest error:', err);
      }
    }

    const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
    const found = Object.values(store).find(
      (p) => p.ride_id === rideId && p.payer_id === payerId && (!requestId || p.request_id === requestId)
    );
    return found ? await this.hydratePayment(found) : null;
  },

  async listPaymentsByRide(rideId: string): Promise<RidePayment[]> {
    const isLive = isSupabaseConfigured();
    let payments: RidePayment[] = [];

    if (isLive && isValidUuid(rideId)) {
      try {
        const { data, error } = await supabase
          .from('ride_payments')
          .select('*')
          .eq('ride_id', rideId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          payments = data as unknown as RidePayment[];
        }
      } catch (err) {
        console.warn('Live listPaymentsByRide error:', err);
      }
    }

    if (payments.length === 0) {
      const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
      payments = Object.values(store).filter((p) => p.ride_id === rideId);
    }

    return await Promise.all(payments.map((p) => this.hydratePayment(p)));
  },

  async listPaymentsByStudent(studentId: string): Promise<RidePayment[]> {
    const isLive = isSupabaseConfigured();
    let payments: RidePayment[] = [];

    if (isLive && isValidUuid(studentId)) {
      try {
        const { data, error } = await supabase
          .from('ride_payments')
          .select('*')
          .or(`payer_id.eq.${studentId},payee_id.eq.${studentId}`)
          .order('created_at', { ascending: false });

        if (!error && data) {
          payments = data as unknown as RidePayment[];
        }
      } catch (err) {
        console.warn('Live listPaymentsByStudent error:', err);
      }
    }

    const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
    const local = Object.values(store).filter((p) => p.payer_id === studentId || p.payee_id === studentId);

    const merged = new Map<string, RidePayment>();
    for (const p of payments) merged.set(p.id, p);
    for (const p of local) if (!merged.has(p.id)) merged.set(p.id, p);

    const result = Array.from(merged.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return await Promise.all(result.map((p) => this.hydratePayment(p)));
  },

  async markPaidByPassenger(
    paymentId: string,
    method: PaymentMethod,
    upiUri?: string | null
  ): Promise<RidePayment> {
    const now = new Date().toISOString();
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(paymentId)) {
      try {
        const { data, error } = await supabase
          .from('ride_payments')
          .update({
            status: 'PAID_PENDING_CONFIRMATION',
            method,
            upi_intent_uri: upiUri || null,
            payer_paid_at: now,
            updated_at: now,
          })
          .eq('id', paymentId)
          .select('*')
          .single();

        if (!error && data) {
          const updated = await this.hydratePayment(data as unknown as RidePayment);
          notifyPaymentsChanged(paymentId, 'paid');
          return updated;
        }
      } catch (err) {
        console.warn('Live markPaidByPassenger error:', err);
      }
    }

    const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
    const existing = store[paymentId];
    if (!existing) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    existing.status = 'PAID_PENDING_CONFIRMATION';
    existing.method = method;
    existing.upi_intent_uri = upiUri || null;
    existing.payer_paid_at = now;
    existing.updated_at = now;

    store[paymentId] = existing;
    saveLocalData(LOCAL_STORAGE_PAYMENTS_KEY, store);

    notifyPaymentsChanged(paymentId, 'paid');
    return await this.hydratePayment(existing);
  },

  async confirmPaymentByHost(paymentId: string, hostId: string): Promise<RidePayment> {
    const now = new Date().toISOString();
    const isLive = isSupabaseConfigured();

    const existing = await this.getPaymentById(paymentId);
    if (!existing) throw new Error('Payment record not found');
    if (existing.payee_id !== hostId) {
      throw new Error('Only the ride host can confirm receipt of payment');
    }

    if (isLive && isValidUuid(paymentId)) {
      try {
        const { data, error } = await supabase
          .from('ride_payments')
          .update({
            status: 'CONFIRMED',
            host_confirmed_at: now,
            updated_at: now,
          })
          .eq('id', paymentId)
          .select('*')
          .single();

        if (!error && data) {
          const updated = await this.hydratePayment(data as unknown as RidePayment);
          notifyPaymentsChanged(paymentId, 'confirmed');
          return updated;
        }
      } catch (err) {
        console.warn('Live confirmPaymentByHost error:', err);
      }
    }

    const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
    const item = store[paymentId] || existing;
    item.status = 'CONFIRMED';
    item.host_confirmed_at = now;
    item.updated_at = now;

    store[paymentId] = item;
    saveLocalData(LOCAL_STORAGE_PAYMENTS_KEY, store);

    notifyPaymentsChanged(paymentId, 'confirmed');
    return await this.hydratePayment(item);
  },

  async disputePaymentByHost(paymentId: string, hostId: string, reason: string): Promise<RidePayment> {
    const now = new Date().toISOString();
    const isLive = isSupabaseConfigured();

    const existing = await this.getPaymentById(paymentId);
    if (!existing) throw new Error('Payment record not found');
    if (existing.payee_id !== hostId) {
      throw new Error('Only the ride host can report non-receipt of payment');
    }

    if (isLive && isValidUuid(paymentId)) {
      try {
        const { data, error } = await supabase
          .from('ride_payments')
          .update({
            status: 'DISPUTED',
            dispute_reason: reason.trim(),
            updated_at: now,
          })
          .eq('id', paymentId)
          .select('*')
          .single();

        if (!error && data) {
          const updated = await this.hydratePayment(data as unknown as RidePayment);
          notifyPaymentsChanged(paymentId, 'disputed');
          return updated;
        }
      } catch (err) {
        console.warn('Live disputePaymentByHost error:', err);
      }
    }

    const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
    const item = store[paymentId] || existing;
    item.status = 'DISPUTED';
    item.dispute_reason = reason.trim();
    item.updated_at = now;

    store[paymentId] = item;
    saveLocalData(LOCAL_STORAGE_PAYMENTS_KEY, store);

    notifyPaymentsChanged(paymentId, 'disputed');
    return await this.hydratePayment(item);
  },

  async updatePaymentAmount(paymentId: string, amount: number): Promise<RidePayment> {
    const isLive = isSupabaseConfigured();
    const now = new Date().toISOString();

    if (isLive && isValidUuid(paymentId)) {
      try {
        const { data, error } = await supabase
          .from('ride_payments')
          .update({ amount, updated_at: now })
          .eq('id', paymentId)
          .select('*')
          .single();
        if (!error && data) return data as unknown as RidePayment;
      } catch {
        // ignore
      }
    }

    const store = getLocalData<RidePayment>(LOCAL_STORAGE_PAYMENTS_KEY);
    if (store[paymentId]) {
      store[paymentId].amount = amount;
      store[paymentId].updated_at = now;
      saveLocalData(LOCAL_STORAGE_PAYMENTS_KEY, store);
      return store[paymentId];
    }
    throw new Error('Payment not found');
  },

  async getStudentPaymentStats(studentId: string): Promise<StudentPaymentStats> {
    const payments = await this.listPaymentsByStudent(studentId);

    let totalEarned = 0;
    let totalPaid = 0;
    let receivedCount = 0;
    let paidCount = 0;
    let pendingConfirmationCount = 0;

    for (const p of payments) {
      if (p.payee_id === studentId) {
        if (p.status === 'CONFIRMED') {
          totalEarned += Number(p.amount) || 0;
          receivedCount += 1;
        } else if (p.status === 'PAID_PENDING_CONFIRMATION') {
          pendingConfirmationCount += 1;
        }
      } else if (p.payer_id === studentId) {
        if (p.status === 'CONFIRMED') {
          totalPaid += Number(p.amount) || 0;
          paidCount += 1;
        }
      }
    }

    return {
      totalEarned,
      totalPaid,
      receivedCount,
      paidCount,
      pendingConfirmationCount,
    };
  },

  async hydratePayment(payment: RidePayment): Promise<RidePayment> {
    try {
      if (!payment.payer && payment.payer_id) {
        const p = await authService.getProfile(payment.payer_id);
        if (p) payment.payer = { id: p.id, name: p.name, department: p.department, year: p.year, profile_image_url: p.profile_image_url };
      }
      if (!payment.payee && payment.payee_id) {
        const h = await authService.getProfile(payment.payee_id);
        if (h) payment.payee = { id: h.id, name: h.name, department: h.department, year: h.year, profile_image_url: h.profile_image_url };
      }
      if (!payment.ride && payment.ride_id) {
        const r = await rideRepository.getRideById(payment.ride_id);
        if (r) payment.ride = r;
      }
    } catch {
      // ignore
    }
    return payment;
  },
};
