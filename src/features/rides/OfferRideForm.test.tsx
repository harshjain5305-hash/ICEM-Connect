import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfferRideForm } from './OfferRideForm';
import * as useAuthModule from '@/features/auth/useAuth';
import { locationService } from '@/features/locations/location.service';

describe('OfferRideForm Component (Phase 3)', () => {
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

  it('renders the form elements correctly', () => {
    render(<OfferRideForm />);

    expect(screen.getByText('Offer a Student Ride')).toBeInTheDocument();
    expect(screen.getByText('1. Route Corridor')).toBeInTheDocument();
    expect(screen.getByText('2. Schedule & Timing')).toBeInTheDocument();
    expect(screen.getByText('3. Vehicle & Available Seats')).toBeInTheDocument();
    expect(screen.getByText('Publish Ride')).toBeInTheDocument();
    expect(screen.getByText('Save as Draft')).toBeInTheDocument();
  });

  it('displays a validation error when attempting to submit without origin or destination', async () => {
    render(<OfferRideForm />);

    const publishBtn = screen.getByText('Publish Ride');
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Please select a starting pickup origin point/i)
      ).toBeInTheDocument();
    });
  });

  it('submits a valid ride and displays the success screen', async () => {
    const icemLoc = await locationService.getById('loc_icem_campus');
    const bhosariLoc = (await locationService.search({ query: 'Bhosari' }))[0];

    const onSuccessMock = vi.fn();

    render(
      <OfferRideForm
        initialOrigin={icemLoc}
        initialDestination={bhosariLoc}
        onSuccess={onSuccessMock}
      />
    );

    // Enter note
    const noteInput = screen.getByPlaceholderText(/Leaving from ICEM main gate/i);
    fireEvent.change(noteInput, { target: { value: 'Leaving at 5:30 PM sharp.' } });

    // Click Publish Ride
    const publishBtn = screen.getByText('Publish Ride');
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByText('Ride Published Successfully!')).toBeInTheDocument();
    });

    expect(onSuccessMock).toHaveBeenCalled();
  });

  it('saves a ride as draft when Save as Draft is clicked', async () => {
    const icemLoc = await locationService.getById('loc_icem_campus');
    const bhosariLoc = (await locationService.search({ query: 'Bhosari' }))[0];

    render(
      <OfferRideForm
        initialOrigin={icemLoc}
        initialDestination={bhosariLoc}
      />
    );

    const draftBtn = screen.getByText('Save as Draft');
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(screen.getByText('Ride Saved as Draft')).toBeInTheDocument();
      expect(screen.getByText('DRAFT')).toBeInTheDocument();
    });
  });
});
