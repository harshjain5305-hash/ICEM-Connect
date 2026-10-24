import { describe, it, expect, beforeEach } from 'vitest';
import { GPSKalmanFilter } from './gpsKalmanFilter';
import { calculateHaversineDistance } from '@/features/routes/polyline.utils';

describe('GPSKalmanFilter (Noise & Drift Suppression)', () => {
  let filter: GPSKalmanFilter;

  beforeEach(() => {
    filter = new GPSKalmanFilter({
      processNoise: 0.00003,
      measurementNoise: 0.002,
      maxSpeedKph: 120,
    });
  });

  it('initializes on first coordinate update', () => {
    const res = filter.filter(18.7088, 73.6654, 10, 1000);
    expect(res.latitude).toBe(18.7088);
    expect(res.longitude).toBe(73.6654);
    expect(res.isOutlier).toBe(false);
  });

  it('smooths high-frequency GPS jitter around a stationary or slow-moving point', () => {
    const baseLat = 18.7088;
    const baseLng = 73.6654;

    // First reading
    filter.filter(baseLat, baseLng, 10, 1000);

    // Noisy reading bouncing 25 meters northeast
    const noisyLat = baseLat + 0.0002;
    const noisyLng = baseLng + 0.0002;
    const filtered = filter.filter(noisyLat, noisyLng, 15, 3000);

    // Filtered coordinate should be dampened significantly towards base, not jumping all the way to noisy
    const distToRaw = calculateHaversineDistance(filtered.latitude, filtered.longitude, noisyLat, noisyLng);
    const rawJump = calculateHaversineDistance(baseLat, baseLng, noisyLat, noisyLng);

    expect(distToRaw).toBeGreaterThan(0);
    expect(distToRaw).toBeLessThan(rawJump);
    expect(filtered.latitude).toBeLessThan(noisyLat);
    expect(filtered.longitude).toBeLessThan(noisyLng);
  });

  it('detects and heavily dampens impossible teleport jumps into fields', () => {
    const startLat = 18.7088;
    const startLng = 73.6654;

    filter.filter(startLat, startLng, 8, 1000);

    // Sudden 150m leap in 1 second (implies 540 km/h)
    const bogusLat = startLat + 0.00135; // ~150m north
    const bogusLng = startLng;

    const result = filter.filter(bogusLat, bogusLng, 30, 2000);

    expect(result.isOutlier).toBe(true);

    // The filter should barely deviate from startLat
    const deviation = calculateHaversineDistance(startLat, startLng, result.latitude, result.longitude);
    expect(deviation).toBeLessThan(35); // Filter restricted movement to <35m instead of 150m!
  });

  it('allows natural vehicle movement at highway speeds (e.g. 60 km/h)', () => {
    const startLat = 18.7088;
    const startLng = 73.6654;

    filter.filter(startLat, startLng, 8, 1000);

    // Driving at 60 km/h = 16.6 m/s -> over 3 seconds = 50m forward
    // 50m north is approx 0.00045 degrees
    const nextLat = startLat + 0.00045;
    const nextLng = startLng;

    const result = filter.filter(nextLat, nextLng, 8, 4000);

    expect(result.isOutlier).toBe(false);
    expect(result.latitude).toBeGreaterThan(startLat);
  });

  it('resets state correctly', () => {
    filter.filter(18.7088, 73.6654, 8, 1000);
    expect(filter.getCurrentPosition()).not.toBeNull();

    filter.reset();
    expect(filter.getCurrentPosition()).toBeNull();
  });
});
