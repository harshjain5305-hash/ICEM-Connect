import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AvailableCampusRides } from './AvailableCampusRides';
import { rideRepository } from '@/features/rides/ride.repository';
import type { Ride } from '@/features/rides/ride.types';

const mockRides: Ride[] = [
  {
    id: 'ride-1',
    host_id: 'host-1',
    origin_location_id: 'loc_talegaon_station',
    destination_location_id: 'loc_icem_campus',
    origin: {
      id: 'loc_talegaon_station',
      name: 'Talegaon Station',
      type: 'BUS_STOP',
      latitude: 18.7302,
      longitude: 73.6749,
    },
    destination: {
      id: 'loc_icem_campus',
      name: 'ICEM Main Campus',
      type: 'ICEM',
      latitude: 18.7238,
      longitude: 73.6823,
    },
    departure_date: '2026-10-27',
    departure_time: '08:30:00',
    total_seats: 1,
    available_seats: 1,
    vehicle_type: 'BIKE',
    note: 'Starting at station',
    status: 'PUBLISHED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ride-2',
    host_id: 'host-2',
    origin_location_id: 'loc_akurdi_station',
    destination_location_id: 'loc_icem_campus',
    origin: {
      id: 'loc_akurdi_station',
      name: 'Akurdi Station',
      type: 'BUS_STOP',
      latitude: 18.6498,
      longitude: 73.7712,
    },
    destination: {
      id: 'loc_icem_campus',
      name: 'ICEM Main Campus',
      type: 'ICEM',
      latitude: 18.7238,
      longitude: 73.6823,
    },
    departure_date: '2026-10-27',
    departure_time: '08:45:00',
    total_seats: 1,
    available_seats: 1,
    vehicle_type: 'SCOOTER',
    note: null,
    status: 'PUBLISHED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ride-3',
    host_id: 'host-3',
    origin_location_id: 'loc_kiwale_phata',
    destination_location_id: 'loc_icem_campus',
    origin: {
      id: 'loc_kiwale_phata',
      name: 'Kiwale Phata',
      type: 'MAIN_ROAD',
      latitude: 18.6654,
      longitude: 73.7432,
    },
    destination: {
      id: 'loc_icem_campus',
      name: 'ICEM Main Campus',
      type: 'ICEM',
      latitude: 18.7238,
      longitude: 73.6823,
    },
    departure_date: '2026-10-27',
    departure_time: '09:00:00',
    total_seats: 3,
    available_seats: 2,
    vehicle_type: 'OTHER',
    note: 'Carpooling in car',
    status: 'PUBLISHED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ride-4',
    host_id: 'host-4',
    origin_location_id: 'loc_icem_campus',
    destination_location_id: 'loc_somatne_phata',
    origin: {
      id: 'loc_icem_campus',
      name: 'ICEM Main Campus',
      type: 'ICEM',
      latitude: 18.7238,
      longitude: 73.6823,
    },
    destination: {
      id: 'loc_somatne_phata',
      name: 'Somatne Phata',
      type: 'BUS_STOP',
      latitude: 18.7182,
      longitude: 73.6894,
    },
    departure_date: '2026-10-27',
    departure_time: '16:30:00',
    total_seats: 1,
    available_seats: 1,
    vehicle_type: 'SCOOTER',
    note: null,
    status: 'PUBLISHED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ride-5',
    host_id: 'host-5',
    origin_location_id: 'loc_bhosari_stand',
    destination_location_id: 'loc_icem_campus',
    origin: {
      id: 'loc_bhosari_stand',
      name: 'Bhosari Stand',
      type: 'BUS_STOP',
      latitude: 18.6273,
      longitude: 73.8448,
    },
    destination: {
      id: 'loc_icem_campus',
      name: 'ICEM Main Campus',
      type: 'ICEM',
      latitude: 18.7238,
      longitude: 73.6823,
    },
    departure_date: '2026-10-28',
    departure_time: '08:15:00',
    total_seats: 2,
    available_seats: 2,
    vehicle_type: 'OTHER',
    note: null,
    status: 'PUBLISHED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ride-6',
    host_id: 'host-6',
    origin_location_id: 'loc_icem_campus',
    destination_location_id: 'loc_ravet_bridge',
    origin: {
      id: 'loc_icem_campus',
      name: 'ICEM Main Campus',
      type: 'ICEM',
      latitude: 18.7238,
      longitude: 73.6823,
    },
    destination: {
      id: 'loc_ravet_bridge',
      name: 'Ravet Bridge',
      type: 'LANDMARK',
      latitude: 18.6478,
      longitude: 73.7489,
    },
    departure_date: '2026-10-28',
    departure_time: '17:00:00',
    total_seats: 1,
    available_seats: 1,
    vehicle_type: 'BIKE',
    note: null,
    status: 'PUBLISHED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe('AvailableCampusRides Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state and then populates published rides', async () => {
    vi.spyOn(rideRepository, 'listPublishedRides').mockResolvedValue(mockRides);

    render(<AvailableCampusRides />);
    expect(screen.getByText(/loading active campus rides/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Available Campus Rides')).toBeInTheDocument();
      expect(screen.getByText('Talegaon Station')).toBeInTheDocument();
    });
  });

  it('paginates rides strictly at 4 rides per page with <- 1 2 -> controls', async () => {
    vi.spyOn(rideRepository, 'listPublishedRides').mockResolvedValue(mockRides);

    render(<AvailableCampusRides />);

    await waitFor(() => {
      expect(screen.getByText('Talegaon Station')).toBeInTheDocument();
    });

    // Page 1 should show rides 1 through 4
    expect(screen.getByText('Talegaon Station')).toBeInTheDocument();
    expect(screen.getByText('Akurdi Station')).toBeInTheDocument();
    expect(screen.getByText('Kiwale Phata')).toBeInTheDocument();
    // Ride 5 & 6 should not be on page 1
    expect(screen.queryByText('Bhosari Stand')).not.toBeInTheDocument();
    expect(screen.queryByText('Ravet Bridge')).not.toBeInTheDocument();

    // Check pagination summary
    expect(screen.getByText(/Showing/i)).toHaveTextContent('Showing 1-4 of 6 rides');

    // Page 1 button active, Page 2 button available
    const page1Btn = screen.getByRole('button', { name: 'Page 1' });
    const page2Btn = screen.getByRole('button', { name: 'Page 2' });
    expect(page1Btn).toHaveAttribute('aria-current', 'page');

    // Click Page 2
    fireEvent.click(page2Btn);

    // Page 2 should now display ride 5 & 6
    expect(screen.getByText('Bhosari Stand')).toBeInTheDocument();
    expect(screen.getByText('Ravet Bridge')).toBeInTheDocument();
    expect(screen.queryByText('Talegaon Station')).not.toBeInTheDocument();

    expect(screen.getByText(/Showing/i)).toHaveTextContent('Showing 5-6 of 6 rides');
  });

  it('navigates pagination using Next and Prev buttons', async () => {
    vi.spyOn(rideRepository, 'listPublishedRides').mockResolvedValue(mockRides);

    render(<AvailableCampusRides />);

    await waitFor(() => {
      expect(screen.getByText('Talegaon Station')).toBeInTheDocument();
    });

    const prevBtn = screen.getByRole('button', { name: /previous page/i });
    const nextBtn = screen.getByRole('button', { name: /next page/i });

    // On page 1, Prev is disabled
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Click Next
    fireEvent.click(nextBtn);

    expect(screen.getByText('Bhosari Stand')).toBeInTheDocument();
    expect(prevBtn).toBeEnabled();
    expect(nextBtn).toBeDisabled();

    // Click Prev
    fireEvent.click(prevBtn);
    expect(screen.getByText('Talegaon Station')).toBeInTheDocument();
  });

  it('filters rides by corridor direction (To Campus / From Campus)', async () => {
    vi.spyOn(rideRepository, 'listPublishedRides').mockResolvedValue(mockRides);

    render(<AvailableCampusRides />);

    await waitFor(() => {
      expect(screen.getByText('Talegaon Station')).toBeInTheDocument();
    });

    // Click "From Campus" filter tab
    const fromCampusTab = screen.getByRole('tab', { name: /from campus/i });
    fireEvent.click(fromCampusTab);

    // Ride 4 (ICEM -> Talegaon) and Ride 6 (ICEM -> Ravet)
    expect(screen.getByText('Ravet Bridge')).toBeInTheDocument();
    // Ride 1 (Talegaon -> ICEM) should not be shown
    expect(screen.queryByText('Akurdi Station')).not.toBeInTheDocument();
  });

  it('calls onInspectRide when clicking View Details & Request', async () => {
    vi.spyOn(rideRepository, 'listPublishedRides').mockResolvedValue(mockRides);
    const inspectMock = vi.fn();

    render(<AvailableCampusRides onInspectRide={inspectMock} />);

    await waitFor(() => {
      expect(screen.getByText('Talegaon Station')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole('button', { name: /view details & request/i });
    expect(actionButtons.length).toBeGreaterThan(0);

    fireEvent.click(actionButtons[0]);
    expect(inspectMock).toHaveBeenCalledWith(mockRides[0]);
  });

  it('displays empty state with "Sorry, currently no rides available" when there are no rides', async () => {
    vi.spyOn(rideRepository, 'listPublishedRides').mockResolvedValue([]);

    render(<AvailableCampusRides />);

    await waitFor(() => {
      expect(screen.getByText('Sorry, currently no rides available')).toBeInTheDocument();
    });
    expect(screen.getByText(/there are no active rides scheduled right now/i)).toBeInTheDocument();
  });
});
