import { describe, it, expect, vi } from 'vitest';
import {
  buildWhatsAppShareText,
  generateWhatsAppShareUrl,
  triggerWhatsAppShare,
} from './commuteShare.utils';

describe('commuteShare utils', () => {
  const sampleShare = {
    originName: 'Akurdi Railway Station Chowk',
    destinationName: 'ICEM Main Campus (Parandwadi)',
    departureTime: '08:30',
    departureDate: '2026-10-26',
    availableSeats: 1,
    vehicleType: 'BIKE',
    rideId: 'ride_test_123',
  };

  it('builds authentic student WhatsApp message with origin, destination, time, and seat count', () => {
    const text = buildWhatsAppShareText(sampleShare);

    expect(text).toContain('Akurdi Railway Station Chowk');
    expect(text).toContain('ICEM Main Campus');
    expect(text).toContain('08:30');
    expect(text).toContain('1 seat available');
    expect(text).toContain('https://icem-connect.vercel.app/?ride=ride_test_123');
  });

  it('generates valid encoded wa.me URL', () => {
    const url = generateWhatsAppShareUrl(sampleShare);

    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url).toContain('Akurdi');
    expect(url).toContain('08%3A30');
  });

  it('invokes window.open with wa.me link as fallback when navigator.share is unavailable', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await triggerWhatsAppShare(sampleShare);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/?text='),
      '_blank',
      'noopener,noreferrer'
    );
  });
});
