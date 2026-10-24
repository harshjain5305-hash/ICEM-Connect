import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { adminService, type CampusMetrics } from './admin.service';
import type { StudentProfile } from '@/features/auth/auth.types';
import type { UserReport, ReportStatus } from '@/features/moderation/moderation.types';
import { reportCategoryLabels } from '@/features/moderation/moderation.schema';
import type { Ride } from '@/features/rides/ride.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { AdminRoute } from '@/features/auth/AdminRoute';
import {
  Shield,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Ban,
  Car,
  FileText,
  BarChart3,
  Search,
  Clock,
  Check,
  X,
} from 'lucide-react';

type AdminTab = 'metrics' | 'reports' | 'students' | 'rides';

const AdminPanelContent: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('metrics');
  const [metrics, setMetrics] = useState<CampusMetrics | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters & search states
  const [reportFilter, setReportFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [cancelRideModal, setCancelRideModal] = useState<Ride | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [m, s, r, rd] = await Promise.all([
        adminService.getCampusMetrics(user.id),
        adminService.getStudents(user.id),
        adminService.listReports(user.id),
        adminService.listAllRides(user.id),
      ]);
      setMetrics(m);
      setStudents(s);
      setReports(r);
      setRides(rd);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load administrative data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (
    targetId: string,
    newStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  ) => {
    if (!user) return;
    try {
      await adminService.updateStudentStatus(user.id, targetId, newStatus);
      setSuccess(`Student status updated to ${newStatus}.`);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update student status');
    }
  };

  const handleResolveReport = async (reportId: string, status: ReportStatus) => {
    if (!user) return;
    try {
      await adminService.resolveReport(user.id, reportId, status, resolutionNote);
      setSuccess(`Report status updated to ${status}.`);
      setSelectedReport(null);
      setResolutionNote('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve report');
    }
  };

  const handleAdminCancelRide = async () => {
    if (!user || !cancelRideModal) return;
    if (!cancelReason.trim()) {
      setError('Please provide an administrative cancellation reason');
      return;
    }
    try {
      await adminService.adminCancelRide(user.id, cancelRideModal.id, cancelReason.trim());
      setSuccess(`Ride cancelled successfully with administrative notices dispatched.`);
      setCancelRideModal(null);
      setCancelReason('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel ride');
    }
  };

  const filteredReports = reports.filter((r) =>
    reportFilter === 'ALL' ? true : r.status === reportFilter
  );

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.prn.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.department && s.department.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#003C84]/10 border border-[#003C84]/25 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Shield className="h-3.5 w-3.5 text-[#00A2A5]" />
            <span>Campus Admin Console &bull; ICEM Connect</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary mt-1">
            Administration &amp; Safety Moderation
          </h1>
          <p className="text-xs text-muted-foreground">
            Server-authorized campus oversight, incident investigation, and platform metrics
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="gap-1.5 text-xs self-start sm:self-auto"
        >
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          <span>Refresh Data</span>
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'metrics'
              ? 'bg-[#003C84] text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Campus Metrics</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'reports'
              ? 'bg-[#003C84] text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Incident Reports ({reports.filter((r) => r.status === 'PENDING').length} pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'students'
              ? 'bg-[#003C84] text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          <span>Student Registry ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rides')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'rides'
              ? 'bg-[#003C84] text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Car className="h-3.5 w-3.5" />
          <span>Ride Moderation ({rides.length})</span>
        </button>
      </div>

      {/* TAB 1: METRICS */}
      {activeTab === 'metrics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4 bg-card border-border">
              <div className="text-muted-foreground text-xs font-medium">Registered Students</div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {metrics?.totalStudents ?? 0}
              </div>
              <div className="text-[11px] text-emerald-600 mt-1">
                {metrics?.activeStudents ?? 0} active &bull; {metrics?.suspendedStudents ?? 0} suspended
              </div>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="text-muted-foreground text-xs font-medium">Total Rides Offered</div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {metrics?.totalRides ?? 0}
              </div>
              <div className="text-[11px] text-[#003C84] dark:text-[#00A2A5] mt-1">
                {metrics?.activeRides ?? 0} open &bull; {metrics?.completedRides ?? 0} completed
              </div>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="text-muted-foreground text-xs font-medium">Coordinated Bookings</div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {metrics?.confirmedBookings ?? 0}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                From {metrics?.totalRequests ?? 0} join requests
              </div>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="text-muted-foreground text-xs font-medium">Incident Reports</div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {metrics?.totalReports ?? 0}
              </div>
              <div className="text-[11px] text-amber-600 font-semibold mt-1">
                {metrics?.pendingReports ?? 0} require investigation
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Platform Operational Guardrails & Policies</CardTitle>
              <CardDescription>
                Zero PRN exposure to public clients, verified institutional domain enforcement (@indiraicem.ac.in), server-side capacity decrementing, and private incident logging.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* TAB 2: INCIDENT REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(['ALL', 'PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setReportFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    reportFilter === st
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{filteredReports.length} reports</span>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredReports.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No reports matching filter.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              rep.status === 'PENDING'
                                ? 'destructive'
                                : rep.status === 'RESOLVED'
                                ? 'success'
                                : 'secondary'
                            }
                          >
                            {rep.status}
                          </Badge>
                          <span className="font-semibold text-foreground">
                            {reportCategoryLabels[rep.reason] || rep.reason}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          Reporter: <span className="font-medium text-foreground">{rep.reporter?.name || rep.reporter_id}</span> &bull; Reported: <span className="font-medium text-red-600">{rep.reported?.name || rep.reported_id}</span>
                        </div>
                        {rep.details && (
                          <div className="text-muted-foreground/90 italic bg-muted/40 p-2 rounded-md max-w-xl">
                            "{rep.details}"
                          </div>
                        )}
                        {rep.resolution_note && (
                          <div className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                            Resolution: {rep.resolution_note}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReport(rep);
                            setResolutionNote(rep.resolution_note || '');
                          }}
                          className="text-xs"
                        >
                          Review &amp; Act
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: STUDENT REGISTRY */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name, email, PRN..."
                className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#003C84]"
              />
            </div>
            <span className="text-xs text-muted-foreground">{filteredStudents.length} students</span>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card"
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
                        PRN: <span className="font-mono font-semibold text-foreground">{student.prn}</span> &bull; {student.department || 'No dept'} &bull; Year {student.year || 'N/A'}
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
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: RIDE MODERATION */}
      {activeTab === 'rides' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {rides.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No rides found across campus.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {rides.map((ride) => (
                    <div
                      key={ride.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {ride.origin?.name || 'Origin'} &rarr; {ride.destination?.name || 'Destination'}
                          </span>
                          <Badge variant="secondary">{ride.status}</Badge>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{ride.departure_date} at {ride.departure_time}</span>
                          <span>&bull; {ride.available_seats}/{ride.total_seats} seats free</span>
                          <span>&bull; Vehicle: {ride.vehicle_type}</span>
                        </div>
                        <div className="text-muted-foreground font-mono text-[11px]">
                          Host ID: {ride.host_id}
                        </div>
                      </div>

                      {['DRAFT', 'PUBLISHED', 'CONFIRMED'].includes(ride.status) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setCancelRideModal(ride)}
                          className="text-xs gap-1 self-start sm:self-auto"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Force Cancel</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* REPORT RESOLUTION MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg border-border shadow-2xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Investigate Incident Report</CardTitle>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="space-y-1 bg-muted/40 p-3 rounded-lg">
                <div className="font-semibold text-foreground">
                  Category: {reportCategoryLabels[selectedReport.reason]}
                </div>
                <div>Reporter: {selectedReport.reporter?.name} ({selectedReport.reporter?.department})</div>
                <div>Reported: <span className="text-red-600 font-semibold">{selectedReport.reported?.name}</span></div>
                <div className="mt-2 text-foreground font-medium italic">"{selectedReport.details}"</div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  Administrative Resolution Note
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="E.g., Contacted student for verbal counseling; driver verified compliant..."
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs focus:ring-2 focus:ring-[#003C84]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResolveReport(selectedReport.id, 'DISMISSED')}
                  className="text-xs"
                >
                  Dismiss Report
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleResolveReport(selectedReport.id, 'REVIEWED')}
                  className="text-xs"
                >
                  Mark Reviewed
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleResolveReport(selectedReport.id, 'RESOLVED')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Mark Resolved
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ADMIN FORCE CANCEL RIDE MODAL */}
      {cancelRideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-border shadow-2xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <CardTitle className="text-base">Administrative Ride Cancellation</CardTitle>
              </div>
              <button
                onClick={() => setCancelRideModal(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-red-700 dark:text-red-400">
                You are about to force-cancel a scheduled ride. The host and all confirmed passengers will receive immediate administrative cancellation alerts.
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  Cancellation Reason (Will be sent to participants)
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="E.g., Host account suspended due to policy violation; campus safety advisory..."
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setCancelRideModal(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleAdminCancelRide}
                  className="text-xs"
                >
                  Confirm Force Cancellation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
