import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveRideTrackingMap } from './LiveRideTrackingMap';
import type { Ride } from '@/features/rides/ride.types';
import type { LiveLocationUpdate } from './location.types';

describe('LiveRideTrackingMap Component', () => {
  const mockRide: Ride = {
    id: 'ride_icem_test_1',
    host_id: 'host_101',
    origin_location_id: 'loc_bhosari_stand',
    destination_location_id: 'loc_icem_campus',
    departure_date: '2026-10-26',
    departure_time: '17:30',
    total_seats: 2,
    available_seats: 2,
    vehicle_type: 'SCOOTER',
    note: 'Lab trip',
    published_at: '2026-10-22T10:00:00Z',
    status: 'ACTIVE',
    created_at: '2026-10-22T10:00:00Z',
    updated_at: '2026-10-22T10:00:00Z',
    origin: {
      id: 'loc_bhosari_stand',
      name: 'Bhosari Station',
      type: 'BUS_STOP',
      latitude: 18.6258,
      longitude: 73.8052,
    },
    destination: {
      id: 'loc_icem_campus',
      name: 'ICEM Parandwadi',
      type: 'ICEM',
      latitude: 18.7238,
      longitude: 73.6823,
    },
    route: {
      id: 'route_1',
      ride_id: 'ride_icem_test_1',
      provider: 'INTERNAL_OSRM',
      distance_meters: 15400,
      duration_seconds: 1800,
      encoded_polyline: '',
      geometry_json: {
        type: 'LineString',
        coordinates: [
          [73.8052, 18.6258],
          [73.7432, 18.6654],
          [73.6823, 18.7238],
        ],
      },
      created_at: '2026-10-22T10:00:00Z',
      updated_at: '2026-10-22T10:00:00Z',
    },
    waypoints: [
      {
        id: 'wp_1',
        ride_id: 'ride_icem_test_1',
        sequence: 1,
        label: 'Kiwale Chowk',
        type: 'WAYPOINT',
        latitude: 18.6654,
        longitude: 73.7432,
        created_at: '2026-10-22T10:00:00Z',
      },
    ],
  };

  const mockLiveLocation: LiveLocationUpdate = {
    ride_id: 'ride_icem_test_1',
    latitude: 18.6654,
    longitude: 73.7432,
    accuracy: 10,
    heading: 315,
    speed: 38,
    timestamp: new Date().toISOString(),
  };

  it('renders correct destination label when end of journey is ICEM', () => {
    render(
      <LiveRideTrackingMap
        ride={mockRide}
        liveLocation={mockLiveLocation}
        isHost={false}
      />
    );

    // Destination must reflect ICEM Parandwadi
    expect(screen.getByText(/DEST: ICEM/i)).toBeInTheDocument();
    // Start must reflect Bhosari
    expect(screen.getByText(/START: Bhosari/i)).toBeInTheDocument();
  });

  it('renders zoom in, zoom out, and fit controls and updates zoom level', () => {
    render(
      <LiveRideTrackingMap
        ride={mockRide}
        liveLocation={mockLiveLocation}
        isHost={true}
      />
    );

    expect(screen.getByText('1.0x')).toBeInTheDocument();

    const zoomInBtn = screen.getByTitle('Zoom in (+)');
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('1.4x')).toBeInTheDocument();

    const zoomOutBtn = screen.getByTitle('Zoom out (-)');
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('1.0x')).toBeInTheDocument();
  });

  it('renders live host marker with telemetry', () => {
    render(
      <LiveRideTrackingMap
        ride={mockRide}
        liveLocation={mockLiveLocation}
        isHost={false}
      />
    );

    expect(screen.getByText(/HOST 38kph/i)).toBeInTheDocument();
    expect(screen.getByText(/Speed: 38 km\/h/i)).toBeInTheDocument();
    expect(screen.getByText(/GPS Precision: ±10m/i)).toBeInTheDocument();
  });
});
