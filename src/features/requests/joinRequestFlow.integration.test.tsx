import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rideService } from '@/features/rides/ride.service';
import { requestService } from './request.service';
import { notificationService } from '@/features/notifications/notification.service';
import { MyRidesView } from '@/features/rides/MyRidesView';
import { MyRequestsView } from './MyRequestsView';
import * as useAuthModule from '@/features/auth/useAuth';

describe('End-to-End Join Request, Host Card Display & Passenger Booking Flow (Phase 6 Integration)', () => {
  const hostUser = {
    id: 'student_host_400',
    email: 'host400@indiraicem.ac.in',
    name: 'Sameer Kulkarni',
  };

  const passengerUser = {
    id: 'student_passenger_500',
    email: 'passenger500@indiraicem.ac.in',
    name: 'Sneha Patil',
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  function setAuthUser(user: typeof hostUser, department = 'Computer Science') {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        prn: `PRN_${user.id}`,
        department,
        year: 3,
        profile_image_url: null,
        status: 'ACTIVE' as const,
        rating_average: 4.9,
        rating_count: 8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
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
  }

  it('completes the entire real-world lifecycle: request creation -> host card display -> notification -> host accept -> passenger booking update', async () => {
    // 1. Host creates a 2-seat ride: ICEM Campus -> Bhosari
    const ride = await rideService.createRide(hostUser.id, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-28',
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
      note: 'Leaving from campus main gate',
    });

    // 2. Passenger submits a join request with pickup note
    const joinReq = await requestService.createRequest(passengerUser.id, {
      ride_id: ride.id,
      seat_count: 1,
      specific_area_note: 'Near the HP petrol pump; I can walk 100 m',
    });

    expect(joinReq).toBeDefined();
    expect(joinReq.status).toBe('PENDING');

    // 3. Verify notification was sent to host
    const hostNotifs = await notificationService.getUserNotifications(hostUser.id);
    expect(hostNotifs.length).toBeGreaterThan(0);
    expect(hostNotifs[0].type).toBe('REQUEST_RECEIVED');
    expect(hostNotifs[0].title).toBe('New Join Request');

    // 4. Host opens My Rides — request MUST display directly on the host card!
    setAuthUser(hostUser, 'Mechanical');
    const { unmount } = render(<MyRidesView />);

    await waitFor(() => {
      // Must show pending requests badge on host card
      expect(screen.getByText(/1 Pending Request/i)).toBeInTheDocument();
      // Must show incoming request section directly on card
      expect(screen.getByText(/Incoming Join Request/i)).toBeInTheDocument();
      // Must display the pickup note on host card
      expect(screen.getByText(/Near the HP petrol pump/i)).toBeInTheDocument();
      // Must provide Accept and Reject buttons directly on card
      expect(screen.getByText('Accept Seat')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    // 5. Host clicks "Accept Seat" directly from the card
    const acceptBtn = screen.getByText('Accept Seat');
    fireEvent.click(acceptBtn);

    // Wait for the capacity to update
    await waitFor(() => {
      // 2 - 1 = 1 seat free remaining
      expect(screen.getByText(/1\/2 seats free/i)).toBeInTheDocument();
    });

    unmount();

    // 6. Verify passenger received an ACCEPTED notification
    const passengerNotifs = await notificationService.getUserNotifications(passengerUser.id);
    expect(passengerNotifs.length).toBeGreaterThan(0);
    expect(passengerNotifs[0].type).toBe('REQUEST_ACCEPTED');

    // 7. Passenger opens My Booked Seats & Requests — booking MUST display with confirmed status!
    setAuthUser(passengerUser, 'Information Technology');
    render(<MyRequestsView />);

    await waitFor(() => {
      expect(screen.getByText('Seat Confirmed')).toBeInTheDocument();
      expect(screen.getByText(/Near the HP petrol pump/i)).toBeInTheDocument();
      expect(screen.getByText(/ICEM Main Campus/i)).toBeInTheDocument();
    });
  });
});
