import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MyRidesView } from './MyRidesView';
import { rideService } from './ride.service';
import * as useAuthModule from '@/features/auth/useAuth';

describe('MyRidesView Component (Phase 3)', () => {
  const mockUser = { id: 'student_host_1', email: 'host@indiraicem.ac.in', name: 'Host Student' };
  const mockProfile = {
    id: 'student_host_1',
    name: 'Host Student',
    email: 'host@indiraicem.ac.in',
    prn: 'PRN12345',
    department: 'Computer Science',
    year: 3,
    profile_image_url: null,
    status: 'ACTIVE' as const,
    rating_average: 4.8,
    rating_count: 5,
    created_at: '',
    updated_at: '',
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      roles: ['STUDENT'],
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshSession: vi.fn(),
    });
  });

  it('renders empty state when host has no rides', async () => {
    render(<MyRidesView />);

    await waitFor(() => {
      expect(screen.getByText('No rides offered yet')).toBeInTheDocument();
    });
  });

  it('renders hosted rides and displays appropriate status badges', async () => {
    await rideService.createRide(mockUser.id, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-25',
      departure_time: '17:30',
      total_seats: 1,
      vehicle_type: 'SCOOTER',
      note: 'ICEM gate after lab',
    });

    render(<MyRidesView />);

    await waitFor(() => {
      expect(screen.getByText('Published')).toBeInTheDocument();
      expect(screen.getByText(/1\/1 seats free/i)).toBeInTheDocument();
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });
  });

  it('allows starting a published ride from the dashboard', async () => {
    const published = await rideService.createRide(mockUser.id, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-25',
      departure_time: '17:30',
      total_seats: 1,
      vehicle_type: 'SCOOTER',
    });

    render(<MyRidesView />);

    await waitFor(() => {
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    const startBtn = screen.getByText('Start');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText('Active (On Route)')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    const updated = await rideService.getRide(published.id);
    expect(updated.status).toBe('ACTIVE');
  });

  it('filters rides when switching filter tabs', async () => {
    // 1 draft, 1 published
    await rideService.createRide(
      mockUser.id,
      {
        origin_location_id: 'loc_icem_campus',
        destination_location_id: 'loc_talegaon_station',
        departure_date: '2026-10-26',
        departure_time: '16:00',
        total_seats: 2,
        vehicle_type: 'BIKE',
      },
      true // asDraft
    );

    await rideService.createRide(mockUser.id, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-25',
      departure_time: '17:30',
      total_seats: 1,
      vehicle_type: 'SCOOTER',
    });

    render(<MyRidesView />);

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
    });

    // Click Drafts tab
    const draftsTab = screen.getByRole('button', { name: /Drafts/i });
    fireEvent.click(draftsTab);

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.queryByText('Published')).not.toBeInTheDocument();
    });
  });

  it('opens RideDetailModal when clicking Details button', async () => {
    await rideService.createRide(mockUser.id, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-25',
      departure_time: '17:30',
      total_seats: 1,
      vehicle_type: 'SCOOTER',
    });

    render(<MyRidesView />);

    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    const detailsBtn = screen.getByText('Details');
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Ride Details')).toBeInTheDocument();
      expect(screen.getByText('Manage Ride Lifecycle')).toBeInTheDocument();
    });
  });
});
