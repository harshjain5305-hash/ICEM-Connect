import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { rideRepository } from '@/features/rides/ride.repository';
import { authService } from '@/features/auth/auth.service';
import { notificationService } from '@/features/notifications/notification.service';
import { realtimeService } from '@/features/realtime/realtime.service';
import { paymentRepository } from '@/features/payments/payment.repository';
import type {
  JoinRequest,
  RideParticipant,
  CreateJoinRequestInput,
  AcceptRequestResult,
  CancelRequestResult,
  PublicStudentInfo,
} from './request.types';

import { isValidUuid } from '@/lib/utils';
import { getLocalData, saveLocalData, STORAGE_KEYS } from '@/lib/localStorage';

const LOCAL_STORAGE_REQUESTS_KEY = STORAGE_KEYS.REQUESTS;
const LOCAL_STORAGE_PARTICIPANTS_KEY = STORAGE_KEYS.PARTICIPANTS;

function notifyRequestsChanged(rideId: string, eventType: string, reqId?: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('icem:join_requests_updated', {
          detail: { rideId, eventType, reqId },
        })
      );
    } catch {
      // ignore in non-browser environments
    }
  }
}

async function getPublicStudentInfo(studentId: string): Promise<PublicStudentInfo> {
  try {
    const profile = await authService.getProfile(studentId);
    if (profile) {
      return {
        id: profile.id,
        name: profile.name || 'ICEM Student',
        department: profile.department || 'Engineering',
        year: profile.year || 1,
        profile_image_url: profile.profile_image_url || null,
        rating: profile.rating_average ?? 5.0,
        is_verified: profile.status === 'ACTIVE',
      };
    }
  } catch (err) {
    console.warn('getPublicStudentInfo lookup warning:', err);
  }
  return {
    id: studentId,
    name: 'ICEM Student',
    department: 'Engineering',
    year: 1,
    rating: 5.0,
    is_verified: true,
  };
}

export const requestRepository = {
  async createRequest(
    studentId: string,
    input: CreateJoinRequestInput
  ): Promise<JoinRequest> {
    const isLive = isSupabaseConfigured();
    let liveRequest: JoinRequest | null = null;
    const offeredAmount = Number(input.offered_amount) || 0;

    if (isLive && isValidUuid(studentId) && isValidUuid(input.ride_id)) {
      try {
        // Try calling stored procedure with p_offered_amount first
        let rpcRes = await supabase.rpc('create_ride_join_request', {
          p_student_id: studentId,
          p_ride_id: input.ride_id,
          p_pickup_waypoint_id: isValidUuid(input.pickup_waypoint_id) ? input.pickup_waypoint_id : null,
          p_drop_waypoint_id: isValidUuid(input.drop_waypoint_id) ? input.drop_waypoint_id : null,
          p_seat_count: input.seat_count,
          p_specific_area_note: input.specific_area_note || null,
          p_offered_amount: offeredAmount,
        });

        // If remote database still has 6-parameter signature, fallback cleanly
        if (
          rpcRes.error &&
          (rpcRes.error.message.includes('p_offered_amount') ||
            rpcRes.error.message.includes('schema cache') ||
            rpcRes.error.message.includes('function') ||
            rpcRes.error.code === 'PGRST202')
        ) {
          rpcRes = await supabase.rpc('create_ride_join_request', {
            p_student_id: studentId,
            p_ride_id: input.ride_id,
            p_pickup_waypoint_id: isValidUuid(input.pickup_waypoint_id) ? input.pickup_waypoint_id : null,
            p_drop_waypoint_id: isValidUuid(input.drop_waypoint_id) ? input.drop_waypoint_id : null,
            p_seat_count: input.seat_count,
            p_specific_area_note: input.specific_area_note || null,
          });
        }

        const { data, error } = rpcRes;

        if (error) {
          console.warn('Supabase create_ride_join_request returned error:', error.message, error.details);
          if (
            error.message.includes('already have an active pending request') ||
            error.message.includes('Not enough available seats') ||
            error.message.includes('Host cannot request a seat') ||
            error.message.includes('already a confirmed participant')
          ) {
            throw new Error(error.message);
          }
        } else if (data && (data as { request_id?: string }).request_id) {
          const reqId = (data as { request_id: string }).request_id;

          // Always guarantee offered_amount is updated directly in Supabase table
          if (offeredAmount > 0) {
            try {
              await supabase
                .from('ride_join_requests')
                .update({ offered_amount: offeredAmount })
                .eq('id', reqId);
            } catch (updErr) {
              console.warn('Failed to update offered_amount in Supabase:', updErr);
            }
          }

          liveRequest = await this.getRequestById(reqId);
          if (liveRequest) {
            liveRequest.offered_amount = offeredAmount;
          } else {
            const studentInfo = await getPublicStudentInfo(studentId);
            const ride = await rideRepository.getRideById(input.ride_id);
            liveRequest = {
              id: reqId,
              ride_id: input.ride_id,
              student_id: studentId,
              pickup_waypoint_id: input.pickup_waypoint_id || null,
              drop_waypoint_id: input.drop_waypoint_id || null,
              seat_count: input.seat_count,
              offered_amount: offeredAmount,
              specific_area_note: input.specific_area_note || null,
              status: 'PENDING',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              student: studentInfo,
              ride: ride || undefined,
            };
          }
        }
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message.includes('already have an active pending request') ||
            err.message.includes('Not enough available seats') ||
            err.message.includes('Host cannot request a seat') ||
            err.message.includes('already a confirmed participant'))
        ) {
          throw err;
        }
        console.warn('Live create join request error, falling back to local mode:', err);
      }
    }

    if (liveRequest) {
      liveRequest.offered_amount = offeredAmount;

      // Mirror in local store for instant reactive availability
      const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
      requests[liveRequest.id] = liveRequest;
      saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);

      // Mirror notification to host in local store & cross-tab bus
      const ride = liveRequest.ride || (await rideRepository.getRideById(input.ride_id));
      if (ride) {
        const shareNote = offeredAmount > 0 ? ` (Fuel share: ₹${offeredAmount} offered)` : '';
        notificationService.notify({
          user_id: ride.host_id,
          title: 'New Join Request',
          message: `${liveRequest.student?.name || 'A student'} requested ${input.seat_count} seat(s)${shareNote} for your ride.`,
          type: 'REQUEST_RECEIVED',
          data: {
            request_id: liveRequest.id,
            ride_id: ride.id,
            seat_count: input.seat_count,
            offered_amount: offeredAmount,
            specific_area_note: input.specific_area_note,
          },
        }).catch(() => {});
      }

      // Broadcast realtime event & dispatch local reactive change
      realtimeService.broadcastRideEvent(input.ride_id, {
        type: 'ride:join_request_created',
        ride_id: input.ride_id,
        payload: {
          request_id: liveRequest.id,
          requester_id: studentId,
          requester_name: liveRequest.student?.name || 'ICEM Student',
          seat_count: input.seat_count,
          offered_amount: offeredAmount,
        },
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      notifyRequestsChanged(input.ride_id, 'created', liveRequest.id);
      return liveRequest;
    }

    // Local / Offline fallback mode
    const ride = await rideRepository.getRideById(input.ride_id);
    if (!ride) {
      throw new Error(`Ride with ID ${input.ride_id} not found`);
    }

    if (ride.host_id === studentId) {
      throw new Error('Host cannot request a seat on their own ride');
    }

    if (!['PUBLISHED', 'CONFIRMED'].includes(ride.status)) {
      throw new Error(`Ride is not currently open for requests (Status: ${ride.status})`);
    }

    if (ride.available_seats < input.seat_count) {
      throw new Error(
        `Not enough available seats on this ride (Available: ${ride.available_seats}, Requested: ${input.seat_count})`
      );
    }

    const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    const existing = Object.values(requests).find(
      (r) => r.ride_id === input.ride_id && r.student_id === studentId && r.status === 'PENDING'
    );
    if (existing) {
      throw new Error('You already have an active pending request for this ride');
    }

    const participants = getLocalData<RideParticipant>(LOCAL_STORAGE_PARTICIPANTS_KEY);
    const alreadyParticipant = Object.values(participants).find(
      (p) => p.ride_id === input.ride_id && p.student_id === studentId && p.status === 'CONFIRMED'
    );
    if (alreadyParticipant) {
      throw new Error('You are already a confirmed participant in this ride');
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const studentInfo = await getPublicStudentInfo(studentId);

    const newRequest: JoinRequest = {
      id,
      ride_id: input.ride_id,
      student_id: studentId,
      pickup_waypoint_id: input.pickup_waypoint_id || null,
      drop_waypoint_id: input.drop_waypoint_id || null,
      seat_count: input.seat_count,
      offered_amount: offeredAmount,
      specific_area_note: input.specific_area_note?.trim() || null,
      status: 'PENDING',
      created_at: now,
      updated_at: now,
      student: studentInfo,
      ride,
    };

    requests[id] = newRequest;
    saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);

    // Notify host
    const shareNote = offeredAmount > 0 ? ` (Fuel share: ₹${offeredAmount} offered)` : '';
    await notificationService.notify({
      user_id: ride.host_id,
      title: 'New Join Request',
      message: `${studentInfo.name} requested ${input.seat_count} seat(s)${shareNote} for your ride.`,
      type: 'REQUEST_RECEIVED',
      data: {
        request_id: id,
        ride_id: ride.id,
        seat_count: input.seat_count,
        offered_amount: offeredAmount,
        specific_area_note: input.specific_area_note,
      },
    });

    realtimeService.broadcastRideEvent(input.ride_id, {
      type: 'ride:join_request_created',
      ride_id: input.ride_id,
      payload: {
        request_id: id,
        requester_id: studentId,
        requester_name: studentInfo.name || 'ICEM Student',
        seat_count: input.seat_count,
        offered_amount: offeredAmount,
      },
      timestamp: now,
    }).catch(() => {});

    notifyRequestsChanged(input.ride_id, 'created', id);

    return newRequest;
  },

  async getRequestById(requestId: string): Promise<JoinRequest | null> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(requestId)) {
      try {
        const { data, error } = await supabase
          .from('ride_join_requests')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (!error && data) {
          const req = data as unknown as JoinRequest;
          const localRequests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
          const localMatch = localRequests[req.id];
          const dbAmount = Number(req.offered_amount) || 0;
          const localAmount = Number(localMatch?.offered_amount) || 0;
          req.offered_amount = dbAmount > 0 ? dbAmount : localAmount;
          req.student = await getPublicStudentInfo(req.student_id);
          req.ride = (await rideRepository.getRideById(req.ride_id)) || undefined;
          return req;
        }
      } catch (err) {
        console.warn('Live getRequestById error, falling back to local mode:', err);
      }
    }

    const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    const req = requests[requestId] || null;
    if (req) {
      req.offered_amount = Number(req.offered_amount) || 0;
      if (!req.student) {
        req.student = await getPublicStudentInfo(req.student_id);
      }
      if (!req.ride) {
        req.ride = (await rideRepository.getRideById(req.ride_id)) || undefined;
      }
    }
    return req;
  },

  async listRequestsByRide(rideId: string): Promise<JoinRequest[]> {
    const isLive = isSupabaseConfigured();
    const liveResults: JoinRequest[] = [];
    const localRequests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);

    if (isLive && isValidUuid(rideId)) {
      try {
        const { data, error } = await supabase
          .from('ride_join_requests')
          .select('*')
          .eq('ride_id', rideId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          for (const item of data) {
            const req = item as unknown as JoinRequest;
            const localMatch = localRequests[req.id];
            const dbAmount = Number(req.offered_amount) || 0;
            const localAmount = Number(localMatch?.offered_amount) || 0;
            req.offered_amount = dbAmount > 0 ? dbAmount : localAmount;

            try {
              req.student = await getPublicStudentInfo(req.student_id);
            } catch {
              req.student = {
                id: req.student_id,
                name: 'ICEM Student',
                department: 'Engineering',
                year: 1,
                rating: 5.0,
                is_verified: true,
              };
            }
            liveResults.push(req);
          }
        }
      } catch (err) {
        console.warn('Live listRequestsByRide error, falling back to local mode:', err);
      }
    }

    // Always merge with local storage requests
    const localList = Object.values(localRequests).filter((r) => r.ride_id === rideId);

    const combinedMap = new Map<string, JoinRequest>();
    for (const r of liveResults) {
      combinedMap.set(r.id, r);
    }
    for (const r of localList) {
      if (!combinedMap.has(r.id)) {
        if (!r.student) {
          r.student = await getPublicStudentInfo(r.student_id);
        }
        r.offered_amount = Number(r.offered_amount) || 0;
        combinedMap.set(r.id, r);
      } else {
        const live = combinedMap.get(r.id)!;
        if ((!live.offered_amount || Number(live.offered_amount) === 0) && Number(r.offered_amount) > 0) {
          live.offered_amount = Number(r.offered_amount);
        }
      }
    }

    return Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async listRequestsByStudent(studentId: string): Promise<JoinRequest[]> {
    const isLive = isSupabaseConfigured();
    const liveResults: JoinRequest[] = [];
    const localRequests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);

    // Trigger auto-purge of join requests soft-deleted > 2 days ago
    await this.purgeExpiredDismissedRequests();

    const dismissedRequests = getLocalData<string>(STORAGE_KEYS.DISMISSED_REQUESTS);

    if (isLive && isValidUuid(studentId)) {
      try {
        const { data, error } = await supabase
          .from('ride_join_requests')
          .select('*')
          .eq('student_id', studentId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (!error && data) {
          for (const item of data) {
            if (dismissedRequests[item.id]) continue;
            const req = item as unknown as JoinRequest;
            const localMatch = localRequests[req.id];
            const dbAmount = Number(req.offered_amount) || 0;
            const localAmount = Number(localMatch?.offered_amount) || 0;
            req.offered_amount = dbAmount > 0 ? dbAmount : localAmount;

            req.ride = (await rideRepository.getRideById(req.ride_id)) || undefined;
            liveResults.push(req);
          }
        }
      } catch (err) {
        console.warn('Live listRequestsByStudent error, falling back to local mode:', err);
      }
    }

    // Always merge with local storage requests (excluding dismissed ones)
    const localList = Object.values(localRequests).filter((r) => {
      if (r.student_id !== studentId) return false;
      if (r.deleted_at) return false;
      if (dismissedRequests[r.id]) return false;
      return true;
    });

    const combinedMap = new Map<string, JoinRequest>();
    for (const r of liveResults) {
      if (!dismissedRequests[r.id] && !r.deleted_at) {
        combinedMap.set(r.id, r);
      }
    }
    for (const r of localList) {
      if (!combinedMap.has(r.id) && !dismissedRequests[r.id] && !r.deleted_at) {
        if (!r.ride) {
          r.ride = (await rideRepository.getRideById(r.ride_id)) || undefined;
        }
        r.offered_amount = Number(r.offered_amount) || 0;
        combinedMap.set(r.id, r);
      } else if (combinedMap.has(r.id)) {
        const live = combinedMap.get(r.id)!;
        if ((!live.offered_amount || Number(live.offered_amount) === 0) && Number(r.offered_amount) > 0) {
          live.offered_amount = Number(r.offered_amount);
        }
      }
    }

    return Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  /**
   * Soft-deletes / dismisses a join request from the passenger's UI.
   * Sets deleted_at = now(). The booking is immediately hidden from the UI
   * and auto-deleted from the database after 2 days (48 hours).
   * Live ACTIVE rides and PENDING host approval requests cannot be deleted.
   */
  async dismissRequest(_studentId: string, requestId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const isLive = isSupabaseConfigured();

    // Check restrictions: Live ride or pending host approval cannot be deleted
    const req = await this.getRequestById(requestId);
    if (req) {
      if (req.status === 'PENDING') {
        throw new Error('Cannot delete a request pending host approval. Please cancel the request first if you wish to withdraw.');
      }
      if (req.ride?.status === 'ACTIVE') {
        throw new Error('Cannot delete an active live ride in progress.');
      }
    }

    // Permanently record in dismissed set so it never reappears on refresh
    const dismissedRequests = getLocalData<string>(STORAGE_KEYS.DISMISSED_REQUESTS);
    dismissedRequests[requestId] = nowIso;
    saveLocalData(STORAGE_KEYS.DISMISSED_REQUESTS, dismissedRequests);

    if (isLive && isValidUuid(requestId)) {
      try {
        await supabase
          .from('ride_join_requests')
          .update({ deleted_at: nowIso })
          .eq('id', requestId);
      } catch (err) {
        console.warn('Live dismissRequest update error:', err);
      }
      try {
        await supabase
          .from('ride_join_requests')
          .delete()
          .eq('id', requestId);
      } catch (err) {
        console.warn('Live dismissRequest delete error:', err);
      }
    }

    const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    if (requests[requestId]) {
      requests[requestId].deleted_at = nowIso;
      saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);
    }
  },

  /**
   * Permanently purges join requests from storage/database that were soft-deleted > 2 days ago.
   */
  async purgeExpiredDismissedRequests(): Promise<void> {
    const isLive = isSupabaseConfigured();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (isLive) {
      try {
        await supabase.rpc('cleanup_dismissed_rides_and_requests');
      } catch {
        // Handled defensively
      }
    }

    const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    let changed = false;
    for (const [id, req] of Object.entries(requests)) {
      if (req.deleted_at) {
        const deletedTime = new Date(req.deleted_at).getTime();
        if (now - deletedTime >= twoDaysMs) {
          delete requests[id];
          changed = true;
        }
      }
    }
    if (changed) {
      saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);
    }
  },

  async listParticipantsByRide(rideId: string): Promise<RideParticipant[]> {
    const isLive = isSupabaseConfigured();
    const liveResults: RideParticipant[] = [];

    if (isLive && isValidUuid(rideId)) {
      try {
        const { data, error } = await supabase
          .from('ride_participants')
          .select('*')
          .eq('ride_id', rideId)
          .in('status', ['CONFIRMED', 'COMPLETED']);

        if (!error && data) {
          for (const item of data) {
            const p = item as unknown as RideParticipant;
            p.student = await getPublicStudentInfo(p.student_id);
            liveResults.push(p);
          }
        }
      } catch (err) {
        console.warn('Live listParticipantsByRide error, falling back to local mode:', err);
      }
    }

    const localParticipants = getLocalData<RideParticipant>(LOCAL_STORAGE_PARTICIPANTS_KEY);
    const localList = Object.values(localParticipants).filter(
      (p) => p.ride_id === rideId && (p.status === 'CONFIRMED' || p.status === 'COMPLETED')
    );

    const combinedMap = new Map<string, RideParticipant>();
    for (const p of liveResults) {
      combinedMap.set(p.student_id, p);
    }
    for (const p of localList) {
      if (!combinedMap.has(p.student_id)) {
        if (!p.student) {
          p.student = await getPublicStudentInfo(p.student_id);
        }
        combinedMap.set(p.student_id, p);
      }
    }

    // Automatically derive participants from accepted join requests
    // Guarantees any accepted passenger is recognized even if participants table sync lagged
    try {
      const requests = await this.listRequestsByRide(rideId);
      for (const req of requests) {
        if (req.status === 'ACCEPTED' && !combinedMap.has(req.student_id)) {
          const studentInfo = req.student || (await getPublicStudentInfo(req.student_id));
          const derived: RideParticipant = {
            id: `part_req_${req.id}`,
            ride_id: rideId,
            student_id: req.student_id,
            pickup_waypoint_id: req.pickup_waypoint_id,
            drop_waypoint_id: req.drop_waypoint_id,
            seat_count: req.seat_count,
            status: 'CONFIRMED',
            joined_at: req.created_at,
            confirmed_at: req.updated_at || req.created_at,
            student: studentInfo,
          };
          combinedMap.set(req.student_id, derived);
        }
      }
    } catch {
      // ignore
    }

    return Array.from(combinedMap.values());
  },

  async acceptRequest(hostId: string, requestId: string): Promise<AcceptRequestResult> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(hostId) && isValidUuid(requestId)) {
      try {
        const { data, error } = await supabase.rpc('accept_join_request', {
          p_request_id: requestId,
          p_host_id: hostId,
        });

        if (!error && data) {
          // Sync local storage state
          const req = await this.getRequestById(requestId);
          if (req) {
            const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
            req.status = 'ACCEPTED';
            requests[requestId] = req;
            saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);

            // Initialize fuel contribution payment if offered
            const offeredAmt = Number(req.offered_amount) || 0;
            if (offeredAmt > 0) {
              paymentRepository.createOrGetPayment({
                ride_id: req.ride_id,
                request_id: requestId,
                payer_id: req.student_id,
                payee_id: hostId,
                amount: offeredAmt,
              }).catch(() => {});
            }
            notifyRequestsChanged(req.ride_id, 'accepted', requestId);
            realtimeService.broadcastRideEvent(req.ride_id, {
              type: 'ride:join_request_accepted',
              ride_id: req.ride_id,
              payload: {
                request_id: requestId,
                passenger_id: req.student_id,
                available_seats: (data as AcceptRequestResult).available_seats ?? 0,
              },
              timestamp: new Date().toISOString(),
            }).catch(() => {});
          }
          return data as unknown as AcceptRequestResult;
        } else if (error) {
          console.warn('Live accept_join_request error:', error.message);
        }
      } catch (err) {
        console.warn('Live accept_join_request error, falling back to local mode:', err);
      }
    }

    // Local mode: Atomic capacity verification
    const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    const req = requests[requestId];
    if (!req) {
      throw new Error(`Join request with ID ${requestId} not found`);
    }

    if (req.status !== 'PENDING') {
      throw new Error(`Request is already in ${req.status} state and cannot be accepted`);
    }

    const ride = await rideRepository.getRideById(req.ride_id);
    if (!ride) {
      throw new Error(`Ride with ID ${req.ride_id} not found`);
    }

    if (ride.host_id !== hostId) {
      throw new Error('Unauthorized: only the host can accept join requests for this ride');
    }

    // Concurrency / Capacity Guard
    if (ride.available_seats < req.seat_count) {
      throw new Error(
        `Insufficient capacity: only ${ride.available_seats} seat(s) available, but request requires ${req.seat_count}`
      );
    }

    const newAvailable = ride.available_seats - req.seat_count;
    let newStatus = ride.status;
    if (newAvailable === 0 && ride.status === 'PUBLISHED') {
      newStatus = 'CONFIRMED';
    }

    // Update ride capacity
    await rideRepository.updateRide(ride.id, {
      available_seats: newAvailable,
      status: newStatus,
    });

    // Update request
    req.status = 'ACCEPTED';
    req.updated_at = new Date().toISOString();
    requests[requestId] = req;
    saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);

    // Create participant
    const participants = getLocalData<RideParticipant>(LOCAL_STORAGE_PARTICIPANTS_KEY);
    const participantId = `part_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const studentInfo = await getPublicStudentInfo(req.student_id);

    participants[participantId] = {
      id: participantId,
      ride_id: ride.id,
      student_id: req.student_id,
      pickup_waypoint_id: req.pickup_waypoint_id,
      drop_waypoint_id: req.drop_waypoint_id,
      seat_count: req.seat_count,
      status: 'CONFIRMED',
      joined_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      student: studentInfo,
    };
    saveLocalData(LOCAL_STORAGE_PARTICIPANTS_KEY, participants);

    // Initialize fuel contribution payment if offered
    const offeredAmt = Number(req.offered_amount) || 0;
    if (offeredAmt > 0) {
      paymentRepository.createOrGetPayment({
        ride_id: ride.id,
        request_id: requestId,
        payer_id: req.student_id,
        payee_id: hostId,
        amount: offeredAmt,
      }).catch(() => {});
    }

    // Send notification to passenger
    await notificationService.notify({
      user_id: req.student_id,
      title: 'Ride Request Accepted!',
      message: `Your request for ${req.seat_count} seat(s) has been accepted by the host.`,
      type: 'REQUEST_ACCEPTED',
      data: {
        request_id: requestId,
        ride_id: ride.id,
        seat_count: req.seat_count,
      },
    });

    notifyRequestsChanged(ride.id, 'accepted', requestId);
    realtimeService.broadcastRideEvent(ride.id, {
      type: 'ride:join_request_accepted',
      ride_id: ride.id,
      payload: {
        request_id: requestId,
        passenger_id: req.student_id,
        available_seats: newAvailable,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return {
      success: true,
      request_id: requestId,
      ride_id: ride.id,
      status: 'ACCEPTED',
      available_seats: newAvailable,
      ride_status: newStatus,
    };
  },

  async rejectRequest(
    hostId: string,
    requestId: string,
    reason?: string
  ): Promise<{ success: boolean; status: 'REJECTED' }> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(hostId) && isValidUuid(requestId)) {
      try {
        const { error } = await supabase.rpc('reject_join_request', {
          p_request_id: requestId,
          p_host_id: hostId,
          p_reason: reason || null,
        });

        if (!error) {
          const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
          if (requests[requestId]) {
            requests[requestId].status = 'REJECTED';
            requests[requestId].updated_at = new Date().toISOString();
            saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);
            notifyRequestsChanged(requests[requestId].ride_id, 'rejected', requestId);
            realtimeService.broadcastRideEvent(requests[requestId].ride_id, {
              type: 'ride:join_request_rejected',
              ride_id: requests[requestId].ride_id,
              payload: {
                request_id: requestId,
                passenger_id: requests[requestId].student_id,
              },
              timestamp: new Date().toISOString(),
            }).catch(() => {});
          }
          return { success: true, status: 'REJECTED' };
        } else if (error) {
          console.warn('Live reject_join_request error:', error.message);
        }
      } catch (err) {
        console.warn('Live reject_join_request error, falling back to local mode:', err);
      }
    }

    // Local mode
    const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    const req = requests[requestId];
    if (!req) {
      throw new Error(`Join request with ID ${requestId} not found`);
    }

    if (req.status !== 'PENDING') {
      throw new Error(`Request is in ${req.status} state and cannot be rejected`);
    }

    const ride = await rideRepository.getRideById(req.ride_id);
    if (!ride || ride.host_id !== hostId) {
      throw new Error('Unauthorized: only the host can reject requests for this ride');
    }

    req.status = 'REJECTED';
    req.updated_at = new Date().toISOString();
    requests[requestId] = req;
    saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);

    // Notify passenger
    await notificationService.notify({
      user_id: req.student_id,
      title: 'Ride Request Declined',
      message: reason || 'The host was unable to accommodate your request at this time.',
      type: 'REQUEST_REJECTED',
      data: {
        request_id: requestId,
        ride_id: ride.id,
      },
    });

    notifyRequestsChanged(ride.id, 'rejected', requestId);
    realtimeService.broadcastRideEvent(ride.id, {
      type: 'ride:join_request_rejected',
      ride_id: ride.id,
      payload: {
        request_id: requestId,
        passenger_id: req.student_id,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return { success: true, status: 'REJECTED' };
  },

  async cancelRequest(studentId: string, requestId: string): Promise<CancelRequestResult> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(studentId) && isValidUuid(requestId)) {
      try {
        const { data, error } = await supabase.rpc('cancel_join_request', {
          p_request_id: requestId,
          p_student_id: studentId,
        });

        if (!error && data) {
          const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
          if (requests[requestId]) {
            requests[requestId].status = 'CANCELLED';
            requests[requestId].updated_at = new Date().toISOString();
            saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);
            notifyRequestsChanged(requests[requestId].ride_id, 'cancelled', requestId);
          }
          return data as unknown as CancelRequestResult;
        } else if (error) {
          console.warn('Live cancel_join_request error:', error.message);
        }
      } catch (err) {
        console.warn('Live cancel_join_request error, falling back to local mode:', err);
      }
    }

    // Local mode / Fallback cancellation
    const requests = getLocalData<JoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    let req: JoinRequest | null | undefined = requests[requestId];
    if (!req) {
      req = await this.getRequestById(requestId);
    }
    if (!req) {
      const dismissed = getLocalData<string>(STORAGE_KEYS.DISMISSED_REQUESTS);
      dismissed[requestId] = new Date().toISOString();
      saveLocalData(STORAGE_KEYS.DISMISSED_REQUESTS, dismissed);
      return { success: true, status: 'CANCELLED' };
    }

    if (req.student_id !== studentId) {
      throw new Error('Unauthorized: you can only cancel your own requests');
    }

    const ride = await rideRepository.getRideById(req.ride_id);
    const studentInfo = await getPublicStudentInfo(studentId);

    if (req.status === 'PENDING') {
      req.status = 'CANCELLED';
      req.updated_at = new Date().toISOString();
      requests[requestId] = req;
      saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);

      if (ride) {
        await notificationService.notify({
          user_id: ride.host_id,
          title: 'Join Request Cancelled',
          message: `${studentInfo.name} cancelled their pending join request.`,
          type: 'REQUEST_CANCELLED',
          data: { request_id: requestId, ride_id: ride.id },
        });
        notifyRequestsChanged(ride.id, 'cancelled', requestId);
      }

      return { success: true, status: 'CANCELLED' };
    }

    if (req.status === 'ACCEPTED') {
      if (!ride) {
        throw new Error('Associated ride not found');
      }

      if (['ACTIVE', 'COMPLETED'].includes(ride.status)) {
        throw new Error('Cannot cancel ride request on an active or completed ride');
      }

      const newAvailable = Math.min(ride.total_seats, Math.max(0, ride.available_seats + req.seat_count));
      await rideRepository.updateRide(ride.id, {
        available_seats: newAvailable,
        status: ride.status === 'CONFIRMED' ? 'PUBLISHED' : ride.status,
      });

      // Update participant record
      const participants = getLocalData<RideParticipant>(LOCAL_STORAGE_PARTICIPANTS_KEY);
      for (const p of Object.values(participants)) {
        if (p.ride_id === ride.id && p.student_id === studentId) {
          p.status = 'CANCELLED';
          p.cancelled_at = new Date().toISOString();
        }
      }
      saveLocalData(LOCAL_STORAGE_PARTICIPANTS_KEY, participants);

      req.status = 'CANCELLED';
      req.updated_at = new Date().toISOString();
      requests[requestId] = req;
      saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);

      await notificationService.notify({
        user_id: ride.host_id,
        title: 'Confirmed Passenger Cancelled',
        message: `${studentInfo.name} cancelled their confirmed seat (${req.seat_count} seat restored).`,
        type: 'REQUEST_CANCELLED',
        data: { request_id: requestId, ride_id: ride.id },
      });
      notifyRequestsChanged(ride.id, 'cancelled', requestId);

      return {
        success: true,
        status: 'CANCELLED',
        restored_seats: req.seat_count,
        available_seats: newAvailable,
      };
    }

    if (req.status === 'CANCELLED') {
      return { success: true, status: 'CANCELLED' };
    }

    throw new Error(`Request cannot be cancelled in state ${req.status}`);
  },
};
