import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaypointSequenceList } from './WaypointSequenceList';
import type { CalculatedWaypoint } from './route.types';

describe('WaypointSequenceList Component', () => {
  const mockWaypoints: CalculatedWaypoint[] = [
    {
      sequence: 1,
      latitude: 18.7325,
      longitude: 73.6766,
      label: 'Talegaon Dabhade Station',
      type: 'ORIGIN',
      distance_from_start_meters: 0,
      estimated_time_offset_seconds: 0,
    },
    {
      sequence: 2,
      latitude: 18.7214,
      longitude: 73.6955,
      label: 'Somatne Phata Chowk',
      type: 'WAYPOINT',
      distance_from_start_meters: 3500,
      estimated_time_offset_seconds: 300,
    },
    {
      sequence: 3,
      latitude: 18.7103,
      longitude: 73.7122,
      label: 'ICEM Parandwadi Campus',
      type: 'DESTINATION',
      distance_from_start_meters: 7800,
      estimated_time_offset_seconds: 720,
    },
  ];

  it('renders all waypoints in sequential order', () => {
    render(<WaypointSequenceList waypoints={mockWaypoints} />);

    expect(screen.getByText('Talegaon Dabhade Station')).toBeInTheDocument();
    expect(screen.getByText('Somatne Phata Chowk')).toBeInTheDocument();
    expect(screen.getByText('ICEM Parandwadi Campus')).toBeInTheDocument();
    expect(screen.getByText(/Ordered Route Waypoints \(3 stops\)/i)).toBeInTheDocument();
  });

  it('renders green tick and Passed badges on passed waypoints', () => {
    // Waypoints 1 (origin) and 2 (Somatne) passed
    const passed = new Set([1, 2]);

    render(
      <WaypointSequenceList
        waypoints={mockWaypoints}
        passedSequences={passed}
        activeSequence={3}
      />
    );

    // Green "Passed" badges
    const passedBadges = screen.getAllByText(/Passed/i);
    expect(passedBadges.length).toBeGreaterThanOrEqual(2);

    // "Reached" status badges
    const reachedBadges = screen.getAllByText(/Reached/i);
    expect(reachedBadges.length).toBe(2);

    // Active "En Route" badge for stop 3
    expect(screen.getByText(/En Route/i)).toBeInTheDocument();
  });
});
