import React, { useState } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { moderationService } from './moderation.service';
import {
  reportCategories,
  reportCategoryLabels,
} from './moderation.schema';
import type { ReportCategory } from './moderation.types';
import type { PublicStudentInfo } from '@/features/requests/request.types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { AlertTriangle, X, ShieldAlert, CheckCircle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedStudent: PublicStudentInfo;
  rideId?: string | null;
  onReportSubmitted?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  reportedStudent,
  rideId,
  onReportSubmitted,
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportCategory>('UNSAFE_DRIVING');
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to submit an incident report.');
      return;
    }

    if (details.trim().length < 5) {
      setError('Please provide at least 5 characters explaining what happened.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await moderationService.submitReport(user.id, {
        reported_id: reportedStudent.id,
        ride_id: rideId || null,
        reason,
        details: details.trim(),
      });

      setSuccess(true);
      if (onReportSubmitted) {
        onReportSubmitted();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <Card className="border border-border shadow-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">Submit Incident Report</CardTitle>
                <div className="text-[11px] text-muted-foreground">
                  Confidential review by ICEM campus moderators
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>

          <CardContent className="pt-4 space-y-4 text-xs">
            {error && <Alert variant="destructive">{error}</Alert>}

            {success ? (
              <div className="space-y-4 py-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Report Received</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your report has been logged confidentially and dispatched to the campus administration for review.
                  </p>
                </div>
                <Button
                  className="w-full bg-[#003C84] hover:bg-[#1D59A3] text-white"
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* REPORTED USER BANNER */}
                <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{reportedStudent.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {reportedStudent.department || 'Engineering'} &bull; Year {reportedStudent.year || '3'}
                    </div>
                  </div>
                  <div className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Flagged User
                  </div>
                </div>

                {/* CATEGORY SELECTOR */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    Incident Category
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReportCategory)}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#003C84]"
                  >
                    {reportCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {reportCategoryLabels[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* DETAILS TEXTAREA */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    Incident Details / Context
                  </label>
                  <textarea
                    rows={4}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Describe what occurred with as much factual detail as possible (e.g., date, exact location, conversation context)..."
                    maxLength={1000}
                    className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#003C84]"
                  />
                  <div className="text-right text-[10px] text-muted-foreground">
                    {details.length}/1000
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <span>Privacy Notice (Rules.md §23)</span>
                  </div>
                  <div>
                    The reported user is never notified of your identity or that a report was submitted against them. Reports remain private between you and campus moderators.
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
