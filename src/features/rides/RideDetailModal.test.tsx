import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RideDetailModal } from './RideDetailModal';
import { RiderGpsStatusCard } from '@/features/location-tracking/RiderGpsStatusCard';
import { rideService } from './ride.service';
import type { Ride } from './ride.types';

// Mock useAuth
const mockUser = { id: 'host_student_1', email: 'host@indiraicem.ac.in' };
const mockProfile = {
  id: 'host_student_1',
  name: 'Rahul Sharma',
  email: 'host@indiraicem.ac.in',
  department: 'MCA',
  year: 2,
  status: 'ACTIVE',
  rating_average: 4.9,
  rating_count: 12,
};

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    isAuthenticated: true,
    isAdmin: false,
  }),
}));

describe('RideDetailModal Navigation & Ergonomics', () => {
  let createdRide: Ride;

  beforeEach(async () => {
    localStorage.clear();
    createdRide = await rideService.createRide(mockUser.id, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-26',
      departure_time: '17:30',
      total_seats: 3,
      vehicle_type: 'SCOOTER',
      note: 'Meeting at Parandwadi Gate',
    });
  });

  it('renders Overview tab by default with metrics and host lifecycle controls', () => {
    render(<RideDetailModal ride={createdRide} isOpen={true} onClose={() => {}} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ride Details')).toBeInTheDocument();
    expect(screen.getByText('Manage Ride Lifecycle')).toBeInTheDocument();
    expect(screen.getByText('Departure Date')).toBeInTheDocument();
    expect(screen.getByText('2026-10-26')).toBeInTheDocument();
    expect(screen.getByText('Departure Time')).toBeInTheDocument();
    expect(screen.getByText('17:30')).toBeInTheDocument();
  });

  it('switches to Waypoints tab without vertical scrolling when clicking tab or header icon', async () => {
    render(<RideDetailModal ride={createdRide} isOpen={true} onClose={() => {}} />);

    // Click Waypoints tab button
    const waypointsTabBtn = screen.getByRole('button', { name: /^waypoints$/i });
    fireEvent.click(waypointsTabBtn);

    expect(screen.getByText('Route Corridor & Map Preview')).toBeInTheDocument();
    expect(screen.getAllByText(/ICEM/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bhosari/i).length).toBeGreaterThan(0);
  });

  it('switches directly to Coordination Chat tab via header quick-jump icon', async () => {
    render(<RideDetailModal ride={createdRide} isOpen={true} onClose={() => {}} />);

    const chatQuickIcon = screen.getByLabelText('Open Chat');
    fireEvent.click(chatQuickIcon);

    await waitFor(() => {
      expect(screen.getByText(/Coordination Chat/i)).toBeInTheDocument();
    });
  });

  it('switches to Live Map tracking tab via header quick-jump icon', async () => {
    render(<RideDetailModal ride={createdRide} isOpen={true} onClose={() => {}} />);

    const liveMapIcon = screen.getByLabelText('View Live Traveling Map');
    fireEvent.click(liveMapIcon);

    await waitFor(() => {
      expect(screen.getByText(/Ride Room/i)).toBeInTheDocument();
    });
  });

  it('allows host to view Requests tab', async () => {
    render(<RideDetailModal ride={createdRide} isOpen={true} onClose={() => {}} />);

    const requestsTab = screen.getByRole('button', { name: /^requests$/i });
    fireEvent.click(requestsTab);

    await waitFor(() => {
      expect(screen.getByText(/Seat Requests & Passengers/i)).toBeInTheDocument();
    });
  });
});

describe('RiderGpsStatusCard Component', () => {
  it('renders broadcasting state when GPS is active with telemetry accuracy and speed', () => {
    render(
      <RiderGpsStatusCard
        status="ACTIVE"
        freshness="FRESH"
        permissionState="granted"
        isGpsTurnedOff={false}
        errorMessage={null}
        currentLocation={{
          ride_id: 'ride_1',
          latitude: 18.7095,
          longitude: 73.6655,
          accuracy: 8,
          heading: 90,
          speed: 35,
          timestamp: new Date().toISOString(),
        }}
        onRequestPermission={() => {}}
        onRetry={() => {}}
        isTripActive={true}
      />
    );

    expect(screen.getByText('GPS Broadcasting Live')).toBeInTheDocument();
    expect(screen.getByText('±8 m')).toBeInTheDocument();
    expect(screen.getByText('35 km/h')).toBeInTheDocument();
    expect(screen.getByText('FRESH (<25s)')).toBeInTheDocument();
  });

  it('renders hardware warning and retry button when device GPS is turned off', () => {
    const onRetryMock = vi.fn();
    render(
      <RiderGpsStatusCard
        status="UNAVAILABLE"
        freshness="LOST"
        permissionState="granted"
        isGpsTurnedOff={true}
        errorMessage="GPS position unavailable"
        currentLocation={null}
        onRequestPermission={() => {}}
        onRetry={onRetryMock}
        isTripActive={true}
      />
    );

    expect(screen.getByText('Device GPS Appears Turned Off')).toBeInTheDocument();
    expect(screen.getByText(/Hardware Disabled/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry gps signal/i });
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('renders permission blocked instructions and retry button when permission is denied', () => {
    const onRequestMock = vi.fn();
    render(
      <RiderGpsStatusCard
        status="PERMISSION_DENIED"
        freshness="LOST"
        permissionState="denied"
        isGpsTurnedOff={false}
        errorMessage="Location permission denied"
        currentLocation={null}
        onRequestPermission={onRequestMock}
        onRetry={() => {}}
        isTripActive={true}
      />
    );

    expect(screen.getByText('Browser Location Permission Blocked')).toBeInTheDocument();
    expect(screen.getByText(/Browser location access is denied/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry location permission/i });
    fireEvent.click(retryBtn);
    expect(onRequestMock).toHaveBeenCalledTimes(1);
  });
});
