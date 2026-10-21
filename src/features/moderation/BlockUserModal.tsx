import React, { useState } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { moderationService } from './moderation.service';
import type { PublicStudentInfo } from '@/features/requests/request.types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Ban, X, CheckCircle, ShieldOff } from 'lucide-react';

interface BlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStudent: PublicStudentInfo;
  onBlocked?: () => void;
}

export const BlockUserModal: React.FC<BlockUserModalProps> = ({
  isOpen,
  onClose,
  targetStudent,
  onBlocked,
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to block a student.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await moderationService.blockUser(user.id, {
        blocked_id: targetStudent.id,
        reason: reason.trim() || null,
      });

      setSuccess(true);
      if (onBlocked) {
        onBlocked();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to block student');
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
              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-700">
                <ShieldOff className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">Block Student Interaction</CardTitle>
                <div className="text-[11px] text-muted-foreground">
                  Prevent future mutual coordination
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
                  <h4 className="text-sm font-semibold text-foreground">Student Blocked</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    You and {targetStudent.name} will no longer see each other's ride offers or be able to request seats.
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
              <form onSubmit={handleBlock} className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <div className="font-semibold text-foreground text-sm">{targetStudent.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {targetStudent.department || 'Engineering'} &bull; Year {targetStudent.year || '3'}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 space-y-2 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground">What happens when you block:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>This student will not appear in your ride matching search results.</li>
                    <li>You will not appear in their search results.</li>
                    <li>Neither of you can send join requests to each other.</li>
                    <li>Historical completed ride data is preserved for safety audit.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-foreground">
                    Optional Private Reason (For your reference)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="E.g., Repeatedly late, uncomfortable driving..."
                    maxLength={250}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-amber-700 hover:bg-amber-800 text-white gap-1"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    {isSubmitting ? 'Blocking...' : 'Block Student'}
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
