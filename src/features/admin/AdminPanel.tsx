import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { authService } from '@/features/auth/auth.service';
import type { StudentProfile } from '@/features/auth/auth.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { AdminRoute } from '@/features/auth/AdminRoute';
import { Shield, UserCheck, AlertTriangle, RefreshCw, CheckCircle, Ban } from 'lucide-react';

const AdminPanelContent: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStudents = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authService.getStudentsForAdmin(user.id);
      setStudents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [user]);

  const handleStatusChange = async (targetId: string, newStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') => {
    if (!user) return;
    try {
      await authService.updateStudentStatus(user.id, targetId, newStatus);
      setSuccess(`Student status updated to ${newStatus}.`);
      loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update student status');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#003C84]/10 border border-[#003C84]/25 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Shield className="h-3.5 w-3.5 text-[#00A2A5]" />
            <span>Campus Admin Console</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary mt-1">
            Student Verification &amp; Moderation
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage ICEM student accounts, roles, and suspension states
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadStudents} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          <span>Refresh</span>
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <span>Registered Student Accounts ({students.length})</span>
          </CardTitle>
          <CardDescription>
            Row Level Security prevents ordinary students from modifying account statuses or accessing this registry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Loading student accounts...
            </div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No registered students found.
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 bg-card"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{student.name}</span>
                      <Badge
                        variant={
                          student.status === 'ACTIVE'
                            ? 'success'
                            : student.status === 'SUSPENDED'
                            ? 'warning'
                            : 'destructive'
                        }
                      >
                        {student.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground font-mono">{student.email}</div>
                    <div className="text-muted-foreground">
                      PRN: <span className="font-mono">{student.prn}</span> • {student.department || 'No dept'} • Year {student.year || 'N/A'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {student.status === 'ACTIVE' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(student.id, 'SUSPENDED')}
                        className="text-amber-700 hover:text-amber-800 text-xs gap-1"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(student.id, 'ACTIVE')}
                        className="text-emerald-700 hover:text-emerald-800 text-xs gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Activate
                      </Button>
                    )}

                    {student.status !== 'DEACTIVATED' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleStatusChange(student.id, 'DEACTIVATED')}
                        className="text-xs gap-1"
                      >
                        <Ban className="h-3.5 w-3.5" /> Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const AdminPanel: React.FC = () => {
  return (
    <AdminRoute>
      <AdminPanelContent />
    </AdminRoute>
  );
};
