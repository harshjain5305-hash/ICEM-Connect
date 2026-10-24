import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FindRideView } from './FindRideView';
import { rideService } from '@/features/rides/ride.service';
import * as useAuthModule from '@/features/auth/useAuth';

describe('FindRideView Component (Phase 5)', () => {
  const mockPassenger = {
    id: 'passenger_student_1',
    email: 'passenger@indiraicem.ac.in',
    name: 'Passenger Student',
  };

  const mockProfile = {
    id: 'passenger_student_1',
    name: 'Passenger Student',
    email: 'passenger@indiraicem.ac.in',
    prn: 'PRN998877',
    department: 'Civil',
    year: 2,
    profile_image_url: null,
    status: 'ACTIVE' as const,
    rating_average: 5.0,
    rating_count: 2,
    created_at: '',
    updated_at: '',
  };

  const testDate = '2026-10-25';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: mockPassenger,
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

  it('renders search form fields properly', () => {
    render(<FindRideView />);

    expect(screen.getByText('Find a Verified Student Ride')).toBeInTheDocument();
    expect(screen.getByText('Pickup Spot')).toBeInTheDocument();
    expect(screen.getByText('Drop Destination')).toBeInTheDocument();
    expect(screen.getByText('Date of Travel')).toBeInTheDocument();
    expect(screen.getByText('Search Compatible Rides')).toBeInTheDocument();
  });

  it('displays validation error if search is triggered without locations', async () => {
    render(<FindRideView />);

    const searchBtn = screen.getByText('Search Compatible Rides');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Please choose your starting pickup location/i)
      ).toBeInTheDocument();
    });
  });

  it('searches and renders matching ride candidate cards', async () => {
    // 1. Create a published ride
    await rideService.createRide('host_student_xyz', {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: testDate,
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
      note: 'Helmet provided for pillion',
    });

    render(<FindRideView />);

    // Change date
    const dateInput = screen.getByLabelText(/Date of Travel/i);
    fireEvent.change(dateInput, { target: { value: testDate } });

    // Mock search directly or simulate inputs
    const searchBtn = screen.getByText('Search Compatible Rides');

    // To select locations in LocationSelect in test environment, we can set search inputs or test matchingService
    // Let's trigger search with simulated select
    const inputs = screen.getAllByRole('textbox');
    // First input is pickup
    fireEvent.change(inputs[0], { target: { value: 'ICEM' } });
    await waitFor(() => {
      expect(screen.getAllByText(/ICEM Main Campus/i).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/ICEM Main Campus/i)[0]);

    // Second input is drop
    fireEvent.change(inputs[1], { target: { value: 'Bhosari' } });
    await waitFor(() => {
      expect(screen.getAllByText(/Bhosari Bus/i).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Bhosari Bus/i)[0]);

    // Now click Search
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Compatible Rides Found/i)).toBeInTheDocument();
      expect(screen.getByText(/% Match/i)).toBeInTheDocument();
      expect(screen.getByText('View Route')).toBeInTheDocument();
      expect(screen.getByText('Request Seat')).toBeInTheDocument();
    });
  });

  it('renders empty state when no rides exist for requested segment', async () => {
    render(<FindRideView />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'ICEM' } });
    await waitFor(() => {
      expect(screen.getAllByText(/ICEM Main Campus/i).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/ICEM Main Campus/i)[0]);

    fireEvent.change(inputs[1], { target: { value: 'Bhosari' } });
    await waitFor(() => {
      expect(screen.getAllByText(/Bhosari Bus/i).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Bhosari Bus/i)[0]);

    const dateInput = screen.getByLabelText(/Date of Travel/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-30' } }); // Future date with no rides

    const searchBtn = screen.getByText('Search Compatible Rides');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/No compatible rides found for this segment/i)).toBeInTheDocument();
    });
  });

  it('renders guest banner and prompts auth when unauthenticated visitor clicks Request Seat', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      roles: [],
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshSession: vi.fn(),
    });

    await rideService.createRide('host_student_xyz', {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: testDate,
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
      note: 'Helmet provided',
    });

    render(<FindRideView />);

    // Verify guest banner
    expect(screen.getByText(/Browsing as Guest:/i)).toBeInTheDocument();

    const dateInput = screen.getByLabelText(/Date of Travel/i);
    fireEvent.change(dateInput, { target: { value: testDate } });

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'ICEM' } });
    await waitFor(() => {
      expect(screen.getAllByText(/ICEM Main Campus/i).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/ICEM Main Campus/i)[0]);

    fireEvent.change(inputs[1], { target: { value: 'Bhosari' } });
    await waitFor(() => {
      expect(screen.getAllByText(/Bhosari Bus/i).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Bhosari Bus/i)[0]);

    const searchBtn = screen.getByText('Search Compatible Rides');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText('Request Seat')).toBeInTheDocument();
    });

    // Clicking Request Seat as a guest should open the auth prompt modal
    fireEvent.click(screen.getByText('Request Seat'));

    await waitFor(() => {
      expect(screen.getByText('Student Login Required')).toBeInTheDocument();
      expect(
        screen.getByText(/To reserve a seat and coordinate directly with your student rider/i)
      ).toBeInTheDocument();
    });
  });

  it('auto-resolves and auto-searches when initialCorridor prop is provided', async () => {
    await rideService.createRide('host_student_xyz', {
      origin_location_id: 'loc_akurdi_station',
      destination_location_id: 'loc_icem_campus',
      departure_date: '2026-10-24', // Today's date mock
      departure_time: '08:30',
      total_seats: 1,
      vehicle_type: 'BIKE',
    });

    render(
      <FindRideView
        initialCorridor={{
          pickupLocationId: 'loc_akurdi_station',
          dropLocationId: 'loc_icem_campus',
        }}
      />
    );

    // Initial corridor should automatically trigger search
    await waitFor(() => {
      expect(screen.getByText(/^Compatible Rides Found/i)).toBeInTheDocument();
    });
  });

  it('allows user to set a route alert when search returns empty results', async () => {
    render(<FindRideView />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'ICEM' } });
    await waitFor(() => {
      expect(screen.getAllByText(/ICEM Main Campus/i).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/ICEM Main Campus/i)[0]);

    fireEvent.change(inputs[1], { target: { value: 'Bhosari' } });
    await waitFor(() => {
      expect(screen.getAllByText(/Bhosari Bus/i).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Bhosari Bus/i)[0]);

    const dateInput = screen.getByLabelText(/Date of Travel/i);
    fireEvent.change(dateInput, { target: { value: '2026-12-15' } }); // Future empty date

    const searchBtn = screen.getByText('Search Compatible Rides');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Set a Route Alert for This Trip/i)).toBeInTheDocument();
    });

    const setAlertBtn = screen.getByText('Notify Me When a Ride is Available');
    fireEvent.click(setAlertBtn);

    await waitFor(() => {
      expect(screen.getByText(/Route Alert Active/i)).toBeInTheDocument();
    });
  });

  it('displays Daily Commuter (Mon-Fri) badge for rides generated from a recurring routine', async () => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    await rideService.createRide(
      'host_daily_1',
      {
        origin_location_id: 'loc_akurdi_station',
        destination_location_id: 'loc_icem_campus',
        departure_date: today,
        departure_time: '08:30',
        total_seats: 1,
        vehicle_type: 'SCOOTER',
        note: '⚡ Daily Commuter Routine: Mon–Fri Campus Commute',
      },
      false
    );

    render(
      <FindRideView
        initialCorridor={{
          pickupLocationId: 'loc_akurdi_station',
          dropLocationId: 'loc_icem_campus',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Commuter (Mon–Fri)')).toBeInTheDocument();
    });
  });
});
