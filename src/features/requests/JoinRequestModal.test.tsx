import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JoinRequestModal } from './JoinRequestModal';
import { rideService } from '@/features/rides/ride.service';
import type { Ride } from '@/features/rides/ride.types';
import * as useAuthModule from '@/features/auth/useAuth';

describe('JoinRequestModal Component (Phase 6)', () => {
  const mockUser = {
    id: 'passenger_student_1',
    email: 'passenger@indiraicem.ac.in',
    name: 'Passenger Student',
  };

  const mockProfile = {
    id: mockUser.id,
    name: mockUser.name,
    email: mockUser.email,
    prn: 'ICEM2026CS101',
    department: 'Computer Science',
    year: 3,
    profile_image_url: null,
    status: 'ACTIVE' as const,
    rating_average: 5.0,
    rating_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let testRide: Ride;

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: mockUser,
      profile: mockProfile,
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

    testRide = await rideService.createRide('host_student_99', {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-27',
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
      note: 'Gate 1 departure',
    });
  });

  it('renders modal with ride details, seat count options, and optional pickup note field', () => {
    render(
      <JoinRequestModal
        ride={testRide}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Request a Seat')).toBeInTheDocument();
    expect(screen.getByText(/17:30/)).toBeInTheDocument();
    expect(screen.getByText(/SCOOTER/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Specific area \/ pickup note/i)).toBeInTheDocument();
    expect(screen.getByText('Send Request')).toBeInTheDocument();
  });

  it('submits a join request with custom pickup note and renders success state', async () => {
    const handleSuccess = vi.fn();

    render(
      <JoinRequestModal
        ride={testRide}
        isOpen={true}
        onClose={vi.fn()}
        onRequestSubmitted={handleSuccess}
      />
    );

    const noteInput = screen.getByLabelText(/Specific area \/ pickup note/i);
    fireEvent.change(noteInput, {
      target: { value: 'Near the HP petrol pump; I can walk 100 m' },
    });

    const submitBtn = screen.getByText('Send Request');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Request Sent!')).toBeInTheDocument();
      expect(
        screen.getByText(/Waiting for the host to accept your request/i)
      ).toBeInTheDocument();
      expect(handleSuccess).toHaveBeenCalled();
    });
  });
});
