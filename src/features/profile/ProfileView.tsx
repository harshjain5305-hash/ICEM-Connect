import React, { useState } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { DEPARTMENTS } from '@/features/auth/auth.schema';
import { User, ShieldCheck, Star, Lock, LogOut, Check, Edit2 } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { profile, logout, updateProfile, roles } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [department, setDepartment] = useState(profile?.department || '');
  const [year, setYear] = useState<number | ''>(profile?.year || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'destructive'; text: string } | null>(null);

  if (!profile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await updateProfile({
        department: department || null,
        year: year ? Number(year) : null,
      });
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMessage({
        type: 'destructive',
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      {message && <Alert variant={message.type}>{message.text}</Alert>}

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#003C84]/10 text-primary">
              <User className="h-7 w-7 text-[#00A2A5]" />
            </div>
            <div>
              <CardTitle className="text-xl text-primary">{profile.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <Badge variant="cyan" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Verified Student</span>
            </Badge>
            {roles.includes('ADMIN') && (
              <Badge variant="navy" className="text-[10px]">
                Admin
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Trust & Reputation Metrics */}
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-base font-bold text-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                <span>{Number(profile.rating_average).toFixed(1)}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Campus Rating</span>
            </div>
            <div>
              <div className="text-base font-bold text-foreground">{profile.rating_count}</div>
              <span className="text-[11px] text-muted-foreground">Rides Completed</span>
            </div>
          </div>

          {/* Privacy Box - PRN Confidentiality Enforcement */}
          <div className="rounded-xl border border-primary/15 bg-[#003C84]/5 p-3.5 text-xs text-primary dark:text-[#43CBD0] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Lock className="h-3.5 w-3.5 text-[#00A2A5]" />
              <span>Internal Verification Identifier (PRN)</span>
            </div>
            <p className="font-mono text-xs text-foreground">
              {profile.prn.slice(0, 3)}••••{profile.prn.slice(-2)}
            </p>
            <p className="text-[11px] text-muted-foreground pt-1">
              Your PRN is confidential and verified against institutional records. It is never displayed publicly to passengers or hosts.
            </p>
          </div>

          {/* Profile Details or Edit Form */}
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Year of Study
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
                  className="flex h-11 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select Year</option>
                  <option value={1}>1st Year</option>
                  <option value={2}>2nd Year</option>
                  <option value={3}>3rd Year</option>
                  <option value={4}>4th Year</option>
                  <option value={5}>5th Year</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" size="sm" isLoading={saving} className="gap-1 flex-1">
                  <Check className="h-3.5 w-3.5" /> Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 text-xs divide-y divide-border pt-1">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-medium text-foreground">{profile.department || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Year:</span>
                <span className="font-medium text-foreground">
                  {profile.year ? `Year ${profile.year}` : 'Not specified'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Student Status:</span>
                <Badge variant={profile.status === 'ACTIVE' ? 'success' : 'destructive'}>
                  {profile.status}
                </Badge>
              </div>

              <div className="pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="w-full gap-2 text-xs"
                >
                  <Edit2 className="h-3.5 w-3.5 text-primary" /> Edit Profile Details
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t border-border pt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={logout}
            className="w-full gap-2 text-xs"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
