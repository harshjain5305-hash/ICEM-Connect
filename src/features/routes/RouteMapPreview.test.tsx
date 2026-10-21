import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteMapPreview } from './RouteMapPreview';
import type { CalculatedRoute } from './route.types';

describe('RouteMapPreview Component (Phase 4)', () => {
  const mockRoute: CalculatedRoute = {
    provider: 'test-provider',
    distance_meters: 31200,
    duration_seconds: 2880,
    encoded_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    geometry_json: {
      type: 'LineString',
      coordinates: [
        [73.6644, 18.7095],
        [73.6894, 18.7182],
        [73.8465, 18.6277],
      ],
    },
    waypoints: [
      {
        sequence: 1,
        label: 'ICEM Campus Parandwadi',
        type: 'ORIGIN',
        latitude: 18.7095,
        longitude: 73.6644,
        distance_from_start_meters: 0,
      },
      {
        sequence: 2,
        label: 'Somatne Phata',
        type: 'WAYPOINT',
        latitude: 18.7182,
        longitude: 73.6894,
        distance_from_start_meters: 2800,
      },
      {
        sequence: 3,
        label: 'Bhosari Bus Terminus',
        type: 'DESTINATION',
        latitude: 18.6277,
        longitude: 73.8465,
        distance_from_start_meters: 31200,
      },
    ],
  };

  it('renders route stats and waypoint labels', () => {
    render(<RouteMapPreview route={mockRoute} waypoints={mockRoute.waypoints} />);

    expect(screen.getByText(/31.2 km/i)).toBeInTheDocument();
    expect(screen.getByText(/48 mins/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Route Stops/i)).toBeInTheDocument();
    expect(screen.getByText(/ICEM Campus/i)).toBeInTheDocument();
    expect(screen.getByText(/Bhosari/i)).toBeInTheDocument();
  });

  it('renders fallback prompt when route is null', () => {
    render(<RouteMapPreview route={null} waypoints={[]} />);

    expect(
      screen.getByText(/Select origin and destination to preview/i)
    ).toBeInTheDocument();
  });
});
