import React, { useState } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { ratingService } from './rating.service';
import type { Ride } from '@/features/rides/ride.types';
import type { PublicStudentInfo } from '@/features/requests/request.types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Star, X, CheckCircle, Shield } from 'lucide-react';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ride: Ride;
  reviewee: PublicStudentInfo;
  onRatingSubmitted?: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  ride,
  reviewee,
  onRatingSubmitted,
}) => {
  const { user } = useAuth();
  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const scoreLabels: Record<number, string> = {
    1: 'Poor — Significant issues encountered',
    2: 'Fair — Needs noticeable improvement',
    3: 'Good — Smooth and timely journey',
    4: 'Very Good — Punctual and courteous',
    5: 'Excellent — Highly recommended peer!',
  };

  const activeScore = hoverScore !== null ? hoverScore : score;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to submit a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await ratingService.submitRating(user.id, {
        ride_id: ride.id,
        reviewee_id: reviewee.id,
        score,
        feedback: feedback.trim() || null,
      });

      setSuccess(true);
      if (onRatingSubmitted) {
        onRatingSubmitted();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
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
              <div className="h-8 w-8 rounded-full bg-[#003C84]/10 dark:bg-[#00A2A5]/15 flex items-center justify-center">
                <Star className="h-4 w-4 text-[#EAA023]" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">Rate Peer Experience</CardTitle>
                <div className="text-[11px] text-muted-foreground">
                  Trip on {ride.departure_date} &bull; {ride.departure_time}
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
                  <h4 className="text-sm font-semibold text-foreground">Rating Submitted!</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Thank you for helping keep the ICEM campus community dependable and safe.
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
                {/* REVIEWEE PROFILE PREVIEW */}
                <div className="rounded-xl border border-primary/20 bg-[#003C84]/5 p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{reviewee.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {reviewee.department || 'Engineering'} &bull; Year {reviewee.year || '3'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#EAA023] bg-[#EAA023]/10 px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3 fill-current" />
                    <span>{reviewee.rating?.toFixed(1) || '5.0'}</span>
                  </div>
                </div>

                {/* STAR SELECTOR */}
                <div className="space-y-2 text-center py-2">
                  <label className="block text-xs font-semibold text-foreground">
                    How was your coordination experience?
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setScore(star)}
                        onMouseEnter={() => setHoverScore(star)}
                        onMouseLeave={() => setHoverScore(null)}
                        className="p-1 transition-transform hover:scale-110 focus:outline-none"
                      >
                        <Star
                          className={`h-7 w-7 ${
                            star <= activeScore
                              ? 'text-[#EAA023] fill-[#EAA023]'
                              : 'text-muted-foreground/30'
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-medium text-[#003C84] dark:text-[#00A2A5] h-5">
                    {scoreLabels[activeScore]}
                  </div>
                </div>

                {/* OPTIONAL FEEDBACK */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-foreground">
                    Optional Feedback / Peer Note
                  </label>
                  <textarea
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="E.g., On time at the gate, very polite and safe driving..."
                    maxLength={500}
                    className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#003C84]"
                  />
                  <div className="text-right text-[10px] text-muted-foreground">
                    {feedback.length}/500
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#00A2A5] shrink-0" />
                  <span>Ratings are private to verified campus participants and update peer reputation safely.</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#003C84] hover:bg-[#1D59A3] text-white"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Rating'}
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
