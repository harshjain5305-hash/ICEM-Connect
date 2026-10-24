import type { Ride } from './ride.types';

export interface CommuteShareData {
  originName: string;
  destinationName: string;
  departureTime: string;
  departureDate?: string;
  availableSeats: number;
  vehicleType: string;
  rideId?: string;
  note?: string | null;
}

/**
 * Builds an authentic, attractive student WhatsApp broadcast message.
 */
export function buildWhatsAppShareText(data: CommuteShareData): string {
  const origin = data.originName.split('(')[0].trim();
  const dest = data.destinationName.split('(')[0].trim();
  const dateStr = data.departureDate ? ` (${data.departureDate})` : '';
  const noteStr = data.note ? `\n📝 _${data.note}_\n` : '';

  return (
    `🛵 *ICEM Ride Share*\n\n` +
    `Leaving *${origin}* for *${dest}*${dateStr} at *${data.departureTime}*.\n` +
    `🪖 *${data.availableSeats} seat available* on ${data.vehicleType.toLowerCase()}.\n` +
    noteStr +
    `\n👉 Reserve your seat on ICEM Connect:\n` +
    `https://icem-connect.vercel.app/?ride=${data.rideId || ''}`
  );
}

/**
 * Generates direct wa.me link for 1-click WhatsApp dispatch.
 */
export function generateWhatsAppShareUrl(data: CommuteShareData): string {
  const message = buildWhatsAppShareText(data);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Dispatches WhatsApp share link or triggers native mobile share sheet.
 */
export async function triggerWhatsAppShare(data: CommuteShareData): Promise<void> {
  const url = generateWhatsAppShareUrl(data);
  const text = buildWhatsAppShareText(data);

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: 'ICEM Student Ride Share',
        text: text,
      });
      return;
    } catch {
      // Fallback to direct WhatsApp window if user cancelled or system failed
    }
  }

  // Open direct WhatsApp web/app link
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Helper to build share data directly from a Ride entity.
 */
export function getRideShareData(ride: Ride): CommuteShareData {
  return {
    originName: ride.origin?.name || 'ICEM Campus',
    destinationName: ride.destination?.name || 'Destination',
    departureTime: ride.departure_time,
    departureDate: ride.departure_date,
    availableSeats: ride.available_seats,
    vehicleType: ride.vehicle_type,
    rideId: ride.id,
    note: ride.note,
  };
}
