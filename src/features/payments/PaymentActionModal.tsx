import React, { useState } from 'react';
import type { RidePayment } from './payment.types';
import { paymentService } from './payment.service';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  X,
  CreditCard,
  CheckCircle,
  Copy,
  Check,
  AlertTriangle,
  Smartphone,
  Banknote,
  ExternalLink,
} from 'lucide-react';

export interface PaymentActionModalProps {
  payment: RidePayment;
  hostUpiId?: string | null;
  hostName: string;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: () => void;
}

export const PaymentActionModal: React.FC<PaymentActionModalProps> = ({
  payment,
  hostUpiId,
  hostName,
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'CASH'>('UPI');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const cleanUpi = (hostUpiId || '').trim();
  const upiUri = cleanUpi
    ? paymentService.generateUpiIntentUri({
        upiId: cleanUpi,
        payeeName: hostName,
        amount: payment.amount,
        note: `ICEM Ride Fuel Contribution`,
      })
    : '';

  // Generate a standard high-quality QR code image using a public reliable encoded SVG endpoint
  const qrCodeUrl = cleanUpi
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`
    : '';

  const handleCopyUpi = () => {
    if (!cleanUpi) return;
    try {
      navigator.clipboard.writeText(cleanUpi);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleOpenUpiApp = () => {
    if (!upiUri) return;
    window.location.href = upiUri;
  };

  const handleConfirmPaid = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await paymentService.markPaid(
        payment.payer_id,
        payment.id,
        selectedMethod,
        selectedMethod === 'UPI' ? upiUri : null
      );
      setSuccess(true);
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <Card className="relative w-full max-w-md border-border bg-card shadow-2xl overflow-hidden my-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base text-foreground">Settle Fuel Contribution</CardTitle>
              <p className="text-xs text-muted-foreground">Direct peer-to-peer student transfer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="pt-4 space-y-4 text-xs">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-foreground">Payment Marked Sent!</h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  We alerted {hostName} to verify receipt. Once confirmed, this will reflect in your ride ledger.
                </p>
              </div>
              <Button onClick={onClose} className="w-full bg-[#003C84] hover:bg-[#1D59A3] text-white">
                Done
              </Button>
            </div>
          ) : (
            <>
              {/* AMOUNT BANNER */}
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Voluntary Fuel Contribution</span>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{Number(payment.amount).toFixed(0)}
                </div>
                <span className="text-[11px] text-muted-foreground block">
                  Payable to host <strong className="text-foreground">{hostName}</strong>
                </span>
              </div>

              {/* PAYMENT METHOD SELECTION */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('UPI')}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    selectedMethod === 'UPI'
                      ? 'bg-[#003C84] text-white border-[#003C84] dark:bg-[#00A2A5]'
                      : 'border-input hover:bg-muted text-foreground'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>UPI Apps (GPay/PhonePe)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMethod('CASH')}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    selectedMethod === 'CASH'
                      ? 'bg-[#003C84] text-white border-[#003C84] dark:bg-[#00A2A5]'
                      : 'border-input hover:bg-muted text-foreground'
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  <span>Cash in Person</span>
                </button>
              </div>

              {selectedMethod === 'UPI' ? (
                cleanUpi ? (
                  <div className="space-y-3 pt-1">
                    {/* MOBILE DIRECT LAUNCH */}
                    <Button
                      onClick={handleOpenUpiApp}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 gap-2 shadow-sm text-xs"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open Installed UPI App (GPay, PhonePe, Paytm)</span>
                    </Button>

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground my-1 justify-center">
                      <span className="h-px bg-border flex-1" />
                      <span>OR SCAN WITH PHONE</span>
                      <span className="h-px bg-border flex-1" />
                    </div>

                    {/* QR CODE & VPA DISPLAY */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                      <div className="h-28 w-28 bg-white p-1 rounded-lg border border-border flex items-center justify-center shrink-0 shadow-sm">
                        <img
                          src={qrCodeUrl}
                          alt="UPI Payment QR Code"
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>

                      <div className="space-y-1.5 flex-1 text-center sm:text-left min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                          Host UPI VPA
                        </span>
                        <div className="font-mono text-xs font-bold text-foreground break-all bg-background p-1.5 rounded border border-input">
                          {cleanUpi}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyUpi}
                          className="h-7 text-[11px] gap-1 w-full sm:w-auto"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy UPI ID</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>Host has not set a UPI ID</span>
                    </div>
                    <p className="text-[11px]">
                      {hostName} hasn't configured a UPI ID in their profile yet. You can hand over cash in person, or ask them via ride chat to add their UPI ID.
                    </p>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-foreground">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    <span>Pay Cash Directly to Driver</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Please give exactly ₹{Number(payment.amount).toFixed(0)} in cash to {hostName} during the commute. Once paid, click the button below so the host can confirm.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {error}
                </div>
              )}

              {/* CONFIRMATION SUBMIT BUTTON */}
              <div className="pt-2 border-t border-border">
                <Button
                  onClick={handleConfirmPaid}
                  disabled={isSubmitting}
                  className="w-full bg-[#003C84] hover:bg-[#1D59A3] text-white py-2.5 text-xs gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{isSubmitting ? 'Recording Payment...' : 'I Have Sent This Contribution'}</span>
                </Button>
                <p className="text-[10px] text-center text-muted-foreground mt-1.5">
                  Host will receive an instant notification to confirm receipt on their dashboard.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
