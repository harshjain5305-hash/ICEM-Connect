import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { adminService, type CampusMetrics } from './admin.service';
import type { Location, LocationType } from '@/features/locations/location.schema';
import type { StudentProfile } from '@/features/auth/auth.types';
import type { UserReport, ReportStatus } from '@/features/moderation/moderation.types';
import { reportCategoryLabels } from '@/features/moderation/moderation.schema';
import type { Ride } from '@/features/rides/ride.types';
import type { RideStatus } from '@/types/database';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { AdminRoute } from '@/features/auth/AdminRoute';
import { BackendStatusBadge } from '@/features/health/BackendStatusBadge';
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
  MapPin,
  Plus,
  Edit2,
  Eye,
  EyeOff,
  Navigation as NavIcon,
} from 'lucide-react';

type AdminTab = 'metrics' | 'reports' | 'students' | 'rides' | 'locations';

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  ICEM: 'ICEM Campus Node',
  MAIN_ROAD: 'Main Highway / Road',
  BUS_STOP: 'Bus Stop / Transit Bay',
  LANDMARK: 'Prominent Landmark',
  AREA: 'Campus Neighborhood / Area',
  CUSTOM: 'Custom Route Point',
};

const DEFAULT_LOCATION_FORM = {
  name: '',
  type: 'BUS_STOP' as LocationType,
  latitude: 18.7238,
  longitude: 73.6823,
  address: '',
  is_active: true,
};

const AdminPanelContent: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('metrics');
  const [metrics, setMetrics] = useState<CampusMetrics | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters & search states
  const [reportFilter, setReportFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [rideFilterStatus, setRideFilterStatus] = useState<RideStatus | 'ALL'>('ALL');
  const [rideSearch, setRideSearch] = useState<string>('');
  const [locationSearch, setLocationSearch] = useState<string>('');
  const [locationTypeFilter, setLocationTypeFilter] = useState<LocationType | 'ALL'>('ALL');

  // Modals
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [cancelRideModal, setCancelRideModal] = useState<Ride | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Location Management Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationFormData, setLocationFormData] = useState(DEFAULT_LOCATION_FORM);
  const [locationFormError, setLocationFormError] = useState<string | null>(null);
  const [locationSubmitting, setLocationSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [m, s, r, rd, locs] = await Promise.all([
        adminService.getCampusMetrics(user.id),
        adminService.getStudents(user.id),
        adminService.listReports(user.id),
        adminService.listAllRides(user.id),
        adminService.listLocations(user.id),
      ]);
      setMetrics(m);
      setStudents(s);
      setReports(r);
      setRides(rd);
      setLocations(locs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load administrative data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Student Actions
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

  // Report Actions
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

  // Ride Cancellation Action
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

  // Location Actions
  const handleOpenCreateLocation = () => {
    setEditingLocation(null);
    setLocationFormData(DEFAULT_LOCATION_FORM);
    setLocationFormError(null);
    setIsLocationModalOpen(true);
  };

  const handleOpenEditLocation = (loc: Location) => {
    setEditingLocation(loc);
    setLocationFormData({
      name: loc.name,
      type: loc.type,
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address || '',
      is_active: loc.is_active,
    });
    setLocationFormError(null);
    setIsLocationModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!locationFormData.name.trim()) {
      setLocationFormError('Location name is required.');
      return;
    }
    if (
      locationFormData.latitude < -90 ||
      locationFormData.latitude > 90 ||
      locationFormData.longitude < -180 ||
      locationFormData.longitude > 180
    ) {
      setLocationFormError('Latitude must be between -90 and 90, Longitude between -180 and 180.');
      return;
    }

    setLocationSubmitting(true);
    setLocationFormError(null);
    try {
      if (editingLocation) {
        await adminService.updateLocation(user.id, editingLocation.id, {
          name: locationFormData.name.trim(),
          type: locationFormData.type,
          latitude: locationFormData.latitude,
          longitude: locationFormData.longitude,
          address: locationFormData.address.trim() || null,
          is_active: locationFormData.is_active,
        });
        setSuccess(`Location "${locationFormData.name}" updated successfully.`);
      } else {
        await adminService.createLocation(user.id, {
          name: locationFormData.name.trim(),
          type: locationFormData.type,
          latitude: locationFormData.latitude,
          longitude: locationFormData.longitude,
          address: locationFormData.address.trim() || null,
          is_active: locationFormData.is_active,
        });
        setSuccess(`New location "${locationFormData.name}" added to campus directory.`);
      }
      setIsLocationModalOpen(false);
      loadData();
    } catch (err) {
      setLocationFormError(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setLocationSubmitting(false);
    }
  };

  const handleToggleLocationActive = async (loc: Location) => {
    if (!user) return;
    try {
      const updatedStatus = !loc.is_active;
      await adminService.toggleLocationStatus(user.id, loc.id, updatedStatus);
      setSuccess(`Location "${loc.name}" ${updatedStatus ? 'activated' : 'deactivated'}.`);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update location status');
    }
  };

  // Filtered views
  const filteredReports = reports.filter((r) =>
    reportFilter === 'ALL'
      ? true
      : reportFilter === 'REVIEWED'
      ? r.status === 'REVIEWED' || r.status === 'UNDER_REVIEW'
      : r.status === reportFilter
  );

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.prn.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.department && s.department.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  const filteredRides = rides.filter((r) => {
    if (rideFilterStatus !== 'ALL' && r.status !== rideFilterStatus) return false;
    if (!rideSearch.trim()) return true;
    const query = rideSearch.toLowerCase();
    const originMatch = r.origin?.name.toLowerCase().includes(query);
    const destMatch = r.destination?.name.toLowerCase().includes(query);
    const hostMatch = r.host_id.toLowerCase().includes(query);
    const vehicleMatch = r.vehicle_type.toLowerCase().includes(query);
    return originMatch || destMatch || hostMatch || vehicleMatch;
  });

  const filteredLocations = locations.filter((loc) => {
    if (locationTypeFilter !== 'ALL' && loc.type !== locationTypeFilter) return false;
    if (!locationSearch.trim()) return true;
    const query = locationSearch.toLowerCase();
    const nameMatch = loc.name.toLowerCase().includes(query);
    const addrMatch = loc.address ? loc.address.toLowerCase().includes(query) : false;
    return nameMatch || addrMatch;
  });

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
            Server-authorized campus oversight, incident investigation, transit locations, and platform metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <BackendStatusBadge />
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
            activeTab === 'metrics'
              ? 'bg-[#003C84] text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Campus Metrics</span>
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
            activeTab === 'locations'
              ? 'bg-[#003C84] text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <MapPin className="h-3.5 w-3.5 text-emerald-400" />
          <span>Locations &amp; Stops ({locations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
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
              <CardTitle className="text-sm">Platform Operational Guardrails &amp; Policies</CardTitle>
              <CardDescription>
                Zero PRN exposure to public clients, verified institutional domain enforcement (@indiraicem.ac.in), server-side capacity decrementing, and verified transit waypoint corridors.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* TAB 2: LOCATIONS & WAYPOINTS MANAGEMENT (NEW) */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#00A2A5]" />
                <span>Transit Nodes &amp; Waypoints Directory</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage campus nodes, bus stands, and corridor waypoints available for ride creation and matching.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleOpenCreateLocation}
              className="bg-[#003C84] hover:bg-[#002b5e] text-white text-xs gap-1.5 self-start sm:self-auto shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Location / Stop</span>
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card p-3 rounded-lg border border-border">
              <div className="text-[11px] text-muted-foreground font-medium">Total Locations</div>
              <div className="text-xl font-bold text-foreground mt-0.5">{locations.length}</div>
            </div>
            <div className="bg-card p-3 rounded-lg border border-border">
              <div className="text-[11px] text-muted-foreground font-medium">Active Stops</div>
              <div className="text-xl font-bold text-emerald-600 mt-0.5">
                {locations.filter((l) => l.is_active).length}
              </div>
            </div>
            <div className="bg-card p-3 rounded-lg border border-border">
              <div className="text-[11px] text-muted-foreground font-medium">ICEM Campus Nodes</div>
              <div className="text-xl font-bold text-[#003C84] dark:text-[#00A2A5] mt-0.5">
                {locations.filter((l) => l.type === 'ICEM').length}
              </div>
            </div>
            <div className="bg-card p-3 rounded-lg border border-border">
              <div className="text-[11px] text-muted-foreground font-medium">Bus Stops &amp; Roads</div>
              <div className="text-xl font-bold text-purple-600 mt-0.5">
                {locations.filter((l) => l.type === 'BUS_STOP' || l.type === 'MAIN_ROAD').length}
              </div>
            </div>
          </div>

          {/* Search & Type Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search stop name, landmark, address..."
                className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#003C84]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {(['ALL', 'ICEM', 'BUS_STOP', 'MAIN_ROAD', 'LANDMARK', 'AREA', 'CUSTOM'] as const).map(
                (lt) => (
                  <button
                    key={lt}
                    onClick={() => setLocationTypeFilter(lt)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                      locationTypeFilter === lt
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {lt}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Locations Table / List */}
          <Card>
            <CardContent className="p-0">
              {filteredLocations.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No transit locations match your current filter.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{loc.name}</span>
                          <Badge
                            variant={
                              loc.type === 'ICEM'
                                ? 'default'
                                : loc.type === 'BUS_STOP'
                                ? 'success'
                                : 'secondary'
                            }
                          >
                            {LOCATION_TYPE_LABELS[loc.type] || loc.type}
                          </Badge>
                          {!loc.is_active && (
                            <Badge variant="destructive" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </div>

                        {loc.address && (
                          <div className="text-muted-foreground text-xs">{loc.address}</div>
                        )}

                        <div className="text-muted-foreground font-mono text-[11px] flex items-center gap-2">
                          <NavIcon className="h-3 w-3 text-emerald-500" />
                          <span>
                            Coordinates: {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditLocation(loc)}
                          className="text-xs gap-1"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Edit</span>
                        </Button>

                        <Button
                          variant={loc.is_active ? 'outline' : 'secondary'}
                          size="sm"
                          onClick={() => handleToggleLocationActive(loc)}
                          className={`text-xs gap-1 ${
                            loc.is_active
                              ? 'text-amber-700 hover:text-amber-800'
                              : 'text-emerald-700 hover:text-emerald-800'
                          }`}
                        >
                          {loc.is_active ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              <span>Activate</span>
                            </>
                          )}
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

      {/* TAB 3: INCIDENT REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(['ALL', 'PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setReportFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 ${
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

      {/* TAB 4: STUDENT REGISTRY */}
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

      {/* TAB 5: RIDE MODERATION */}
      {activeTab === 'rides' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={rideSearch}
                onChange={(e) => setRideSearch(e.target.value)}
                placeholder="Search origin, destination, vehicle, host..."
                className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#003C84]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {(['ALL', 'PUBLISHED', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => setRideFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                      rideFilterStatus === st
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredRides.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No rides found matching your criteria.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredRides.map((ride) => (
                    <div
                      key={ride.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {ride.origin?.name || 'Origin'} &rarr; {ride.destination?.name || 'Destination'}
                          </span>
                          <Badge
                            variant={
                              ride.status === 'ACTIVE'
                                ? 'default'
                                : ride.status === 'COMPLETED'
                                ? 'success'
                                : ride.status === 'CANCELLED'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {ride.status}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {ride.departure_date} at {ride.departure_time}
                          </span>
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

      {/* CREATE / EDIT LOCATION MODAL */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg border-border shadow-2xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">
                  {editingLocation ? 'Edit Transit Location' : 'Add Campus Location / Stop'}
                </CardTitle>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSaveLocation} className="space-y-4 text-xs">
                {locationFormError && <Alert variant="destructive">{locationFormError}</Alert>}

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Location Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={locationFormData.name}
                    onChange={(e) =>
                      setLocationFormData({ ...locationFormData, name: e.target.value })
                    }
                    placeholder="E.g., Somatne Toll Plaza, Kiwale BRTS Bay..."
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs text-foreground focus:ring-2 focus:ring-[#003C84]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Location Type *
                    </label>
                    <select
                      value={locationFormData.type}
                      onChange={(e) =>
                        setLocationFormData({
                          ...locationFormData,
                          type: e.target.value as LocationType,
                        })
                      }
                      className="w-full rounded-lg border border-input bg-background p-2 text-xs text-foreground focus:ring-2 focus:ring-[#003C84]"
                    >
                      <option value="ICEM">ICEM Campus Node</option>
                      <option value="BUS_STOP">Bus Stop / Transit Bay</option>
                      <option value="MAIN_ROAD">Main Highway / Road</option>
                      <option value="LANDMARK">Prominent Landmark</option>
                      <option value="AREA">Campus Neighborhood / Area</option>
                      <option value="CUSTOM">Custom Route Point</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Status
                    </label>
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="loc_is_active"
                        checked={locationFormData.is_active}
                        onChange={(e) =>
                          setLocationFormData({
                            ...locationFormData,
                            is_active: e.target.checked,
                          })
                        }
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      <label htmlFor="loc_is_active" className="text-xs font-medium text-foreground cursor-pointer">
                        Active for route matching
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Street Address / Detailed Landmark Note
                  </label>
                  <input
                    type="text"
                    value={locationFormData.address}
                    onChange={(e) =>
                      setLocationFormData({ ...locationFormData, address: e.target.value })
                    }
                    placeholder="E.g., Old Mumbai-Pune Highway, Talegaon Dabhade"
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs text-foreground focus:ring-2 focus:ring-[#003C84]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-foreground">
                      Geographic Coordinates (WGS84) *
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setLocationFormData({
                          ...locationFormData,
                          latitude: 18.7238,
                          longitude: 73.6823,
                        })
                      }
                      className="text-[11px] text-[#00A2A5] hover:underline"
                    >
                      Fill ICEM Campus Center
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Latitude (-90 to 90)</span>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={locationFormData.latitude}
                        onChange={(e) =>
                          setLocationFormData({
                            ...locationFormData,
                            latitude: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs font-mono text-foreground focus:ring-2 focus:ring-[#003C84]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Longitude (-180 to 180)</span>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={locationFormData.longitude}
                        onChange={(e) =>
                          setLocationFormData({
                            ...locationFormData,
                            longitude: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs font-mono text-foreground focus:ring-2 focus:ring-[#003C84]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setIsLocationModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={locationSubmitting}
                    className="bg-[#003C84] hover:bg-[#002b5e] text-white text-xs gap-1"
                  >
                    {locationSubmitting ? 'Saving...' : editingLocation ? 'Update Location' : 'Add Location'}
                  </Button>
                </div>
              </form>
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
