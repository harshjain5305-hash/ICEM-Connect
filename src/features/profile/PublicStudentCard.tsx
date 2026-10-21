import React from 'react';
import type { PublicStudentProfile } from '@/features/auth/auth.types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { User, ShieldCheck, Star } from 'lucide-react';

interface PublicStudentCardProps {
  student: PublicStudentProfile;
  roleBadgeText?: string;
}

/**
 * Renders a public student profile card.
 * PRN and phone are strictly absent by design.
 */
export const PublicStudentCard: React.FC<PublicStudentCardProps> = ({
  student,
  roleBadgeText,
}) => {
  return (
    <Card className="border-border shadow-xs">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {student.profile_image_url ? (
              <img
                src={student.profile_image_url}
                alt={student.name}
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-foreground">{student.name}</span>
              {roleBadgeText && (
                <span className="text-[10px] font-medium text-muted-foreground">({roleBadgeText})</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {student.department && <span>{student.department}</span>}
              {student.year && <span>• Year {student.year}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Badge variant="cyan" className="gap-1 text-[10px] px-2 py-0.5">
            <ShieldCheck className="h-3 w-3" />
            <span>Verified</span>
          </Badge>
          <div className="flex items-center gap-1 text-xs text-foreground font-medium">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
            <span>{Number(student.rating_average).toFixed(1)}</span>
            <span className="text-muted-foreground text-[10px]">({student.rating_count})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
