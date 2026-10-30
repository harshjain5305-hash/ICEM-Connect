-- ==============================================================================
-- ICEM Connect — Migration: Peer-to-Peer UPI Fuel-Sharing & Payment Ledger
-- File: supabase/migrations/20261028000002_p2p_upi_fuel_sharing.sql
-- Description: Zero-gateway peer-to-peer fuel cost sharing schema, student UPI VPA
--              storage, join request bidding, and settlement ledger.
-- ==============================================================================

-- 1. ADD UPI ID TO STUDENTS
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS upi_id TEXT;

DO $$ BEGIN
  ALTER TABLE public.students
    ADD CONSTRAINT ck_students_upi_format
    CHECK (upi_id IS NULL OR upi_id ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. ADD OFFERED AMOUNT TO JOIN REQUESTS
ALTER TABLE public.ride_join_requests
  ADD COLUMN IF NOT EXISTS offered_amount NUMERIC(8, 2) DEFAULT 0.00;

DO $$ BEGIN
  ALTER TABLE public.ride_join_requests
    ADD CONSTRAINT ck_join_requests_offered_amount
    CHECK (offered_amount >= 0.00 AND offered_amount <= 2000.00);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. PAYMENT STATUS ENUM
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PAID_PENDING_CONFIRMATION',
    'CONFIRMED',
    'WAIVED',
    'DISPUTED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'UPI',
    'CASH'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. RIDE PAYMENTS TABLE (Architecture.md §48)
CREATE TABLE IF NOT EXISTS public.ride_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.ride_join_requests(id) ON DELETE SET NULL,
  payer_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payee_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC(8, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0.00),
  method payment_method NOT NULL DEFAULT 'UPI',
  status payment_status NOT NULL DEFAULT 'PENDING',
  upi_intent_uri TEXT,
  payer_paid_at TIMESTAMPTZ,
  host_confirmed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_no_self_payment CHECK (payer_id <> payee_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_payments_payer ON public.ride_payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_ride_payments_payee ON public.ride_payments(payee_id);
CREATE INDEX IF NOT EXISTS idx_ride_payments_ride ON public.ride_payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_payments_status ON public.ride_payments(status);

-- 5. ROW LEVEL SECURITY (RLS) FOR RIDE PAYMENTS
ALTER TABLE public.ride_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their own payments" ON public.ride_payments;
CREATE POLICY "Participants can view their own payments"
  ON public.ride_payments FOR SELECT
  TO authenticated
  USING (
    payer_id = auth.uid() 
    OR payee_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Payers can create or update pending payments" ON public.ride_payments;
CREATE POLICY "Payers can create or update pending payments"
  ON public.ride_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    payer_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Involved parties can update payment status" ON public.ride_payments;
CREATE POLICY "Involved parties can update payment status"
  ON public.ride_payments FOR UPDATE
  TO authenticated
  USING (
    payer_id = auth.uid() 
    OR payee_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );
