import { calculateHaversineDistance } from '@/features/routes/polyline.utils';

export interface KalmanFilterOptions {
  /**
   * Process noise covariance Q: models vehicle maneuverability and true movement.
   * Lower values = smoother trajectory; higher values = more responsive to sudden turns.
   * Default: 0.00003
   */
  processNoise?: number;
  /**
   * Measurement noise covariance R: models smartphone GPS sensor uncertainty.
   * Higher values = distrust noisy GPS points more.
   * Default: 0.002
   */
  measurementNoise?: number;
  /**
   * Maximum physically feasible speed in km/h for student campus vehicles.
   * Implied movements exceeding this threshold (e.g. 140 km/h) are flagged and dampened.
   * Default: 130 km/h
   */
  maxSpeedKph?: number;
}

export interface FilteredLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  isOutlier: boolean;
  estimatedSpeedKph: number | null;
}

/**
 * 2D Adaptive GPS Kalman Filter for vehicle trajectory tracking.
 * Suppresses multipath jitter, eliminates sudden leaps into roadside fields,
 * and produces a smooth, physically-constrained coordinate progression.
 */
export class GPSKalmanFilter {
  private processNoise: number;
  private measurementNoise: number;
  private maxSpeedKph: number;

  private lat: number | null = null;
  private lng: number | null = null;
  private variance: number = 1.0;
  private lastTimestampMs: number | null = null;
  private lastCalculatedSpeedKph: number | null = null;

  constructor(options: KalmanFilterOptions = {}) {
    this.processNoise = options.processNoise ?? 0.00003;
    this.measurementNoise = options.measurementNoise ?? 0.002;
    this.maxSpeedKph = options.maxSpeedKph ?? 130;
  }

  /**
   * Resets the filter state (e.g. when beginning a completely new ride session).
   */
  public reset(): void {
    this.lat = null;
    this.lng = null;
    this.variance = 1.0;
    this.lastTimestampMs = null;
    this.lastCalculatedSpeedKph = null;
  }

  /**
   * Filters an incoming raw GPS coordinate and returns the cleaned, physically constrained point.
   *
   * @param rawLat Raw measured latitude
   * @param rawLng Raw measured longitude
   * @param accuracyMeters GPS accuracy reported by device (e.g. 10m)
   * @param timestampMs Timestamp of the measurement in epoch milliseconds
   */
  public filter(
    rawLat: number,
    rawLng: number,
    accuracyMeters: number = 10,
    timestampMs: number = Date.now()
  ): FilteredLocationResult {
    // Initial point: initialize state directly
    if (this.lat === null || this.lng === null || this.lastTimestampMs === null) {
      this.lat = rawLat;
      this.lng = rawLng;
      this.variance = (accuracyMeters / 1000) ** 2;
      this.lastTimestampMs = timestampMs;
      return {
        latitude: rawLat,
        longitude: rawLng,
        accuracy: accuracyMeters,
        isOutlier: false,
        estimatedSpeedKph: null,
      };
    }

    const deltaSec = Math.max(0.1, (timestampMs - this.lastTimestampMs) / 1000);
    const distanceMeters = calculateHaversineDistance(this.lat, this.lng, rawLat, rawLng);
    const impliedSpeedMps = distanceMeters / deltaSec;
    const impliedSpeedKph = impliedSpeedMps * 3.6;

    let isOutlier = false;
    let effectiveMeasurementNoise = this.measurementNoise;

    // Scale measurement noise by device accuracy: poor accuracy (e.g. 50m) = distrust measurement more
    const accuracyFactor = Math.max(1, accuracyMeters / 8);
    effectiveMeasurementNoise *= accuracyFactor;

    // Outlier detection: if vehicle supposedly moved at impossible speed (e.g. >130 km/h leap),
    // strongly penalize the measurement noise so the filter barely moves toward the bogus point.
    if (impliedSpeedKph > this.maxSpeedKph) {
      isOutlier = true;
      const speedExcessRatio = impliedSpeedKph / this.maxSpeedKph;
      effectiveMeasurementNoise *= speedExcessRatio * 8; // Heavy dampening
    }

    // 1. Prediction Update: variance grows with elapsed time and process noise
    this.variance += this.processNoise * deltaSec;

    // 2. Kalman Gain Calculation: K = P / (P + R)
    const kalmanGain = this.variance / (this.variance + effectiveMeasurementNoise);

    // 3. Measurement Update: pull state toward measurement proportionally to Kalman Gain
    this.lat = this.lat + kalmanGain * (rawLat - this.lat);
    this.lng = this.lng + kalmanGain * (rawLng - this.lng);

    // 4. Update Error Covariance: P = (1 - K) * P
    this.variance = (1 - kalmanGain) * this.variance;

    // Compute smoothed velocity
    const filteredDistanceMeters = calculateHaversineDistance(
      this.lat,
      this.lng,
      rawLat,
      rawLng
    );
    this.lastCalculatedSpeedKph = Math.min(
      this.maxSpeedKph,
      Math.round((filteredDistanceMeters / deltaSec) * 3.6)
    );
    this.lastTimestampMs = timestampMs;

    // Estimated filtered accuracy
    const filteredAccuracy = Math.max(4, Math.round(Math.sqrt(this.variance) * 500));

    return {
      latitude: Number(this.lat.toFixed(6)),
      longitude: Number(this.lng.toFixed(6)),
      accuracy: Math.min(accuracyMeters, filteredAccuracy),
      isOutlier,
      estimatedSpeedKph: this.lastCalculatedSpeedKph,
    };
  }

  /**
   * Returns current internal state coordinates without updating.
   */
  public getCurrentPosition(): { latitude: number; longitude: number } | null {
    if (this.lat === null || this.lng === null) return null;
    return {
      latitude: Number(this.lat.toFixed(6)),
      longitude: Number(this.lng.toFixed(6)),
    };
  }
}
