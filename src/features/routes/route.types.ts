import type { WaypointType } from '@/types/database';

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
  label?: string;
  location_id?: string | null;
}

export interface CalculatedWaypoint {
  sequence: number;
  label: string;
  type: WaypointType;
  latitude: number;
  longitude: number;
  location_id?: string | null;
  distance_from_start_meters: number;
  estimated_time_offset_seconds?: number;
}

export interface CalculatedRoute {
  provider: string;
  provider_route_id?: string | null;
  distance_meters: number;
  duration_seconds: number;
  encoded_polyline: string;
  geometry_json: {
    type: 'LineString';
    coordinates: [number, number][]; // [longitude, latitude] GeoJSON format
  };
  waypoints: CalculatedWaypoint[];
}

export interface RouteProvider {
  readonly name: string;
  calculateRoute(
    origin: CoordinatePoint,
    destination: CoordinatePoint,
    selectedIntermediateWaypoints?: CoordinatePoint[]
  ): Promise<CalculatedRoute>;
}
