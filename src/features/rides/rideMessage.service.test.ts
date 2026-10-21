import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rideMessageService } from './rideMessage.service';
import { rideRepository } from './ride.repository';
import { requestRepository } from '@/features/requests/request.repository';
import { realtimeService } from '@/features/realtime/realtime.service';
import type { Ride } from './ride.types';
import type { JoinRequest, RideParticipant } from '@/features/requests/request.types';

describe('rideMessageService — Coordination Chat & Retention (Architecture.md §47)', () => {
  const hostId = '11111111-1111-1111-1111-111111111111';
  const passengerId = '22222222-2222-2222-2222-222222222222';
  const requesterId = '33333333-3333-3333-3333-333333333333';
  const strangerId = '44444444-4444-4444-4444-444444444444';
  const rideId = '99999999-9999-9999-9999-999999999999';

  const mockRide: Ride = {
    id: rideId,
    host_id: hostId,
    origin_location_id: 'loc-1',
    destination_location_id: 'loc-2',
    departure_date: new Date().toISOString().slice(0, 10),
    departure_time: '09:00',
    available_seats: 1,
    total_seats: 2,
    status: 'PUBLISHED',
    vehicle_type: 'SCOOTER',
    note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockParticipant: RideParticipant = {
    id: 'part-1',
    ride_id: rideId,
    student_id: passengerId,
    seat_count: 1,
    status: 'CONFIRMED',
    joined_at: new Date().toISOString(),
  };

  const mockRequest: JoinRequest = {
    id: 'req-1',
    ride_id: rideId,
    student_id: requesterId,
    seat_count: 1,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    rideMessageService.clearRateLimitCache();
    vi.restoreAllMocks();

    vi.spyOn(rideRepository, 'getRideById').mockImplementation(async (id) => {
      if (id === rideId) return { ...mockRide };
      return null;
    });

    vi.spyOn(requestRepository, 'listParticipantsByRide').mockImplementation(async (id) => {
      if (id === rideId) return [{ ...mockParticipant }];
      return [];
    });

    vi.spyOn(requestRepository, 'listRequestsByRide').mockImplementation(async (id) => {
      if (id === rideId) return [{ ...mockRequest }];
      return [];
    });
  });

  describe('Validation & Input Constraints', () => {
    it('rejects empty or whitespace-only messages', async () => {
      await expect(
        rideMessageService.sendMessage(rideId, hostId, '   ')
      ).rejects.toThrow('Message content cannot be empty');
    });

    it('rejects messages longer than 500 characters', async () => {
      const longText = 'a'.repeat(501);
      await expect(
        rideMessageService.sendMessage(rideId, hostId, longText)
      ).rejects.toThrow('Message exceeds 500 characters limit');
    });

    it('rejects messages with invalid ride ID format', async () => {
      await expect(
        rideMessageService.sendMessage('not-a-uuid', hostId, 'Hello')
      ).rejects.toThrow('Valid ride ID is required');
    });
  });

  describe('Authorization Policy (Architecture.md §47.4)', () => {
    it('allows the ride host to send messages', async () => {
      const msg = await rideMessageService.sendMessage(rideId, hostId, 'Pickup at Gate 2');
      expect(msg).toBeDefined();
      expect(msg.sender_id).toBe(hostId);
      expect(msg.message).toBe('Pickup at Gate 2');
    });

    it('allows a confirmed passenger to send messages', async () => {
      const msg = await rideMessageService.sendMessage(rideId, passengerId, 'I am waiting at the bus stop');
      expect(msg).toBeDefined();
      expect(msg.sender_id).toBe(passengerId);
      expect(msg.message).toBe('I am waiting at the bus stop');
    });

    it('allows a pending requester to coordinate when seats are available', async () => {
      const msg = await rideMessageService.sendMessage(rideId, requesterId, 'Will you be passing Somatne Phata?');
      expect(msg).toBeDefined();
      expect(msg.sender_id).toBe(requesterId);
    });

    it('denies a pending requester when ride is at full capacity', async () => {
      vi.spyOn(rideRepository, 'getRideById').mockImplementation(async () => ({
        ...mockRide,
        available_seats: 0,
      }));

      await expect(
        rideMessageService.sendMessage(rideId, requesterId, 'Can I still join?')
      ).rejects.toThrow(/full capacity/i);
    });

    it('denies an unaffiliated student (stranger) with Forbidden 403', async () => {
      await expect(
        rideMessageService.sendMessage(rideId, strangerId, 'Hey there')
      ).rejects.toThrow(/forbidden/i);
    });
  });

  describe('Read-Only Policy on Completed/Cancelled Rides (Architecture.md §47.8)', () => {
    it('rejects new messages when ride is COMPLETED', async () => {
      vi.spyOn(rideRepository, 'getRideById').mockImplementation(async () => ({
        ...mockRide,
        status: 'COMPLETED',
      }));

      await expect(
        rideMessageService.sendMessage(rideId, hostId, 'Thanks for the ride')
      ).rejects.toThrow(/read-only/i);
    });

    it('rejects new messages when ride is CANCELLED', async () => {
      vi.spyOn(rideRepository, 'getRideById').mockImplementation(async () => ({
        ...mockRide,
        status: 'CANCELLED',
      }));

      await expect(
        rideMessageService.sendMessage(rideId, hostId, 'Trip cancelled sorry')
      ).rejects.toThrow(/read-only/i);
    });
  });

  describe('Retention & Expiry Filtering (Architecture.md §47.7)', () => {
    it('filters out expired messages on read', async () => {
      // Send a valid message
      const activeMsg = await rideMessageService.sendMessage(rideId, hostId, 'Active message');

      // Add an artificially expired message to local storage
      const raw = localStorage.getItem('icem_ride_messages_v1');
      const list = raw ? JSON.parse(raw) : [];
      list.push({
        id: 'msg-expired-1',
        ride_id: rideId,
        sender_id: hostId,
        sender_name: 'Host',
        message: 'Expired message',
        created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        expires_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // expired 1h ago
      });
      localStorage.setItem('icem_ride_messages_v1', JSON.stringify(list));

      const retrieved = await rideMessageService.getMessages(rideId, hostId);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].id).toBe(activeMsg.id);
      expect(retrieved[0].message).toBe('Active message');
    });

    it('caps message expiry to 3 hours on completion and cleans up expired ones', async () => {
      await rideMessageService.sendMessage(rideId, hostId, 'Pre-completion message');

      // Simulate completion capping
      await rideMessageService.capMessagesExpiryOnCompletion(rideId);

      const raw = localStorage.getItem('icem_ride_messages_v1');
      const list = raw ? JSON.parse(raw) : [];
      expect(list.length).toBe(1);

      const expiryDate = new Date(list[0].expires_at).getTime();
      const threeHoursFromNow = Date.now() + 3 * 3600 * 1000;
      // Expiration should be roughly 3 hours from now (+/- 5 seconds)
      expect(Math.abs(expiryDate - threeHoursFromNow)).toBeLessThan(5000);

      // Now run cleanup — active should remain
      const deletedCount = await rideMessageService.cleanupExpiredMessages();
      expect(deletedCount).toBe(0);
    });
  });

  describe('Realtime & Privacy Logging (Architecture.md §47.6, §47.10)', () => {
    it('broadcasts ride:message:new event to ride room on send', async () => {
      const broadcastSpy = vi.spyOn(realtimeService, 'broadcastRideEvent').mockResolvedValue(true as unknown as void);

      const msg = await rideMessageService.sendMessage(rideId, hostId, 'Heading out now');

      expect(broadcastSpy).toHaveBeenCalledWith(
        rideId,
        expect.objectContaining({
          type: 'ride:message:new',
          ride_id: rideId,
          payload: expect.objectContaining({
            message_id: msg.id,
            ride_id: rideId,
            message: 'Heading out now',
          }),
        })
      );
    });

    it('logs metadata only and never prints message body to logs (Architecture.md §47.10)', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      await rideMessageService.sendMessage(rideId, hostId, 'TopSecretCoordinationBody');

      expect(infoSpy).toHaveBeenCalledWith(
        'ride.message.sent',
        expect.objectContaining({
          rideId,
          senderId: hostId,
          messageId: expect.any(String),
        })
      );

      // Verify that the logged object does NOT contain the message body
      const loggedMetadata = infoSpy.mock.calls[0][1];
      expect(loggedMetadata).not.toHaveProperty('message');
      expect(JSON.stringify(loggedMetadata)).not.toContain('TopSecretCoordinationBody');
    });
  });
});
