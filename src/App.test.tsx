import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from './App';

// Mock health check to resolve synchronously and cleanly in test
vi.mock('@/features/health/healthService', () => ({
  checkBackendHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    message: 'Backend baseline operational',
    latencyMs: 15,
    timestamp: '2026-10-21T12:00:00.000Z',
    config: {
      url: 'https://placeholder-project.supabase.co',
      isConfigured: true,
      institutionalDomain: 'indiraicem.ac.in',
    },
  }),
}));

describe('App Shell & Design System (Phase 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the ICEM Connect branding and campus verification badge', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('ICEM Connect')).toBeInTheDocument();
    expect(screen.getByText(/Campus Verified/i)).toBeInTheDocument();
  });

  it('renders navigation tabs for Home, Offer, My Rides, and Profile', async () => {
    await act(async () => {
      render(<App />);
    });
    const homeElements = screen.getAllByText('Home');
    expect(homeElements.length).toBeGreaterThan(0);

    const offerElements = screen.getAllByText('Offer');
    expect(offerElements.length).toBeGreaterThan(0);

    const ridesElements = screen.getAllByText('My Rides');
    expect(ridesElements.length).toBeGreaterThan(0);

    const profileElements = screen.getAllByText('Profile');
    expect(profileElements.length).toBeGreaterThan(0);
  });

  it('renders Popular Campus Commute Corridors and student commute features', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText(/Popular Campus Commute Corridors/i)).toBeInTheDocument();
    expect(screen.getByText(/Talegaon Station/i)).toBeInTheDocument();
    expect(screen.getByText(/How ICEM Connect Works/i)).toBeInTheDocument();
  });

  it('renders with Indira ICEM brand palette and Electric Cyan accents', async () => {
    await act(async () => {
      render(<App />);
    });
    const campusBadge = screen.getByText(/Campus Verified/i);
    expect(campusBadge).toHaveClass('text-[#00A2A5]');
  });

  it('pre-fills corridor and executes search when clicking a popular corridor card', async () => {
    await act(async () => {
      render(<App />);
    });

    // Find the Akurdi corridor card
    const akurdiCard = screen.getByText(/Akurdi \/ Nigdi/i);
    expect(akurdiCard).toBeInTheDocument();

    // Click the card
    await act(async () => {
      akurdiCard.click();
    });

    // Pickup should be populated with resolved location name
    const pickupInput = screen.getByLabelText('Pickup (Origin)');
    expect(pickupInput).toHaveValue('Akurdi Railway Station Chowk');
  });
});
