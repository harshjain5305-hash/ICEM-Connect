import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HostRequestsSection } from './HostRequestsSection';
import { rideService } from '@/features/rides/ride.service';
import { requestService } from './request.service';
import type { Ride } from '@/features/rides/ride.types';
import * as useAuthModule from '@/features/auth/useAuth';

describe('HostRequestsSection Component (Phase 6)', () => {
  const hostUser = {
    id: 'student_host_42',
    email: 'host@indiraicem.ac.in',
    name: 'Host Student',
  };

  const passengerUser = {
    id: 'student_passenger_88',
    email: 'passenger@indiraicem.ac.in',
    name: 'Rahul Sharma',
  };

  let testRide: Ride;

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: hostUser,
      profile: {
        id: hostUser.id,
        name: hostUser.name,
        email: hostUser.email,
        prn: 'ICEM2026HOST',
        department: 'Mechanical',
        year: 4,
        profile_image_url: null,
        status: 'ACTIVE' as const,
        rating_average: 5.0,
        rating_count: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      roles: ['STUDENT'],
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshSession: vi.fn(),
    });

    testRide = await rideService.createRide(hostUser.id, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-27',
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
    });
  });

  it('renders empty state when there are no requests', async () => {
    render(<HostRequestsSection ride={testRide} />);

    await waitFor(() => {
      expect(screen.getByText(/No pending requests for this ride yet/i)).toBeInTheDocument();
    });
  });

  it('renders pending request card with pickup note and allows host to accept (Design.md §73)', async () => {
    // Create a pending request
    await requestService.createRequest(passengerUser.id, {
      ride_id: testRide.id,
      seat_count: 1,
      specific_area_note: 'Near the HP petrol pump; I can walk 100 m',
    });

    const handleCapacityChanged = vi.fn();

    render(
      <HostRequestsSection
        ride={testRide}
        onRideCapacityChanged={handleCapacityChanged}
      />
    );

    // Wait for request to render
    await waitFor(() => {
      expect(screen.getByText('1 Pending')).toBeInTheDocument();
      expect(screen.getByText(/Near the HP petrol pump/i)).toBeInTheDocument();
      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    // Host clicks Accept
    const acceptBtn = screen.getByText('Accept');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(handleCapacityChanged).toHaveBeenCalled();
      expect(screen.getByText(/Confirmed Participants \(1\)/i)).toBeInTheDocument();
    });
  });

  it('allows host to reject a pending request', async () => {
    const req = await requestService.createRequest(passengerUser.id, {
      ride_id: testRide.id,
      seat_count: 1,
    });

    render(<HostRequestsSection ride={testRide} />);

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    const rejectBtn = screen.getByText('Reject');
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(screen.getByText(/No pending requests for this ride yet/i)).toBeInTheDocument();
    });

    const updatedReq = await requestService.getRequest(req.id);
    expect(updatedReq.status).toBe('REJECTED');
  });
});
