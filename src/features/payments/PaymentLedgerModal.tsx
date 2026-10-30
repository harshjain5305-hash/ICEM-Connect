import React, { useState, useEffect, useCallback } from 'react';
import { paymentService } from './payment.service';
import type { RidePayment, StudentPaymentStats } from './payment.types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  X,
  IndianRupee,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  QrCode,
  Banknote,
} from 'lucide-react';

export interface PaymentLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

export const PaymentLedgerModal: React.FC<PaymentLedgerModalProps> = ({
  isOpen,
  onClose,
  studentId,
}) => {
  const [payments, setPayments] = useState<RidePayment[]>([]);
  const [stats, setStats] = useState<StudentPaymentStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    if (!studentId) return;
    setIsLoading(true);
    try {
      const [list, userStats] = await Promise.all([
        paymentService.listStudentPayments(studentId),
        paymentService.getStudentPaymentStats(studentId),
      ]);
      setPayments(list);
      setStats(userStats);
    } catch (err) {
      console.error('Failed to load student payments ledger:', err);
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const filteredPayments = payments.filter((p) => {
    if (filter === 'received') return p.payee_id === studentId;
    if (filter === 'sent') return p.payer_id === studentId;
    return true;
  });

  const getStatusBadge = (status: RidePayment['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <Badge variant="success" className="text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" /> Confirmed
          </Badge>
        );
      case 'PAID_PENDING_CONFIRMATION':
        return (
          <Badge variant="warning" className="text-[10px] gap-1">
            <Clock className="h-3 w-3" /> Sent &bull; Awaiting Confirmation
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> Pending Payment
          </Badge>
        );
      case 'DISPUTED':
        return (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertCircle className="h-3 w-3" /> Disputed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50 duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Fuel Contribution Ledger
              </h3>
              <p className="text-xs text-muted-foreground">
                Peer-to-peer fuel cost sharing record
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Refresh ledger"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 p-4 bg-muted/10 border-b border-border shrink-0">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1 font-medium">
                  <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" /> Received
                </span>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
                  {stats.receivedCount} ride{stats.receivedCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                ₹{stats.totalEarned.toFixed(0)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Total fuel share received as host
              </p>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1 font-medium">
                  <ArrowUpRight className="h-3.5 w-3.5 text-blue-600" /> Contributed
                </span>
                <span className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                  {stats.paidCount} ride{stats.paidCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                ₹{stats.totalPaid.toFixed(0)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Total fuel share paid as passenger
              </p>
            </div>
          </div>
        )}

        {/* FILTER TABS */}
        <div className="flex border-b border-border px-4 py-2 bg-muted/5 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            All ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('received')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'received'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Received ({payments.filter((p) => p.payee_id === studentId).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('sent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'sent'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Contributed ({payments.filter((p) => p.payer_id === studentId).length})
          </button>
        </div>

        {/* TRANSACTIONS LIST */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {isLoading ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              Loading ledger...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div className="text-xs font-semibold text-foreground">No Transactions Found</div>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                {filter === 'received'
                  ? "You haven't received any fuel contributions as a host yet."
                  : filter === 'sent'
                  ? "You haven't contributed fuel share for any rides yet."
                  : 'All voluntary fuel contributions with student peers will be recorded here.'}
              </p>
            </div>
          ) : (
            filteredPayments.map((item) => {
              const isReceived = item.payee_id === studentId;
              const otherParty = isReceived
                ? item.payer?.name || 'Passenger'
                : item.payee?.name || 'Host';

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card p-3 text-xs space-y-2 hover:border-primary/40 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isReceived
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {isReceived ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{isReceived ? `From ${otherParty}` : `To ${otherParty}`}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({isReceived ? 'Received' : 'Contributed'})
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString([], {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          &bull;{' '}
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-sm font-bold ${
                          isReceived
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-foreground'
                        }`}
                      >
                        {isReceived ? '+' : '-'}₹{item.amount.toFixed(0)}
                      </div>
                      <div className="pt-0.5">{getStatusBadge(item.status)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      {item.method === 'UPI' ? (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <QrCode className="h-3 w-3 text-emerald-600" /> UPI Direct
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Banknote className="h-3 w-3 text-amber-600" /> Cash in Hand
                        </span>
                      )}
                    </div>
                    {item.dispute_reason && (
                      <span className="text-destructive font-medium truncate max-w-[150px]">
                        Note: {item.dispute_reason}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-border px-5 py-3 bg-muted/20 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
            Direct peer settlement &bull; Zero commission
          </p>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
