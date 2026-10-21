import { describe, it, expect, beforeEach, vi } from 'vitest';
import { moderationService } from './moderation.service';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        or: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
  isSupabaseConfigured: () => false,
}));

describe('Incident Reporting & Moderation Service (Phase 7)', () => {
  const reporterId = '11111111-1111-4111-a111-111111111111';
  const reportedId = '22222222-2222-4222-a222-222222222222';
  const adminId = '99999999-9999-4999-a999-999999999999';

  beforeEach(() => {
    localStorage.clear();
  });

  it('submits a private incident report successfully', async () => {
    const report = await moderationService.submitReport(reporterId, {
      reported_id: reportedId,
      reason: 'HARASSMENT',
      details: 'Host made inappropriate remarks during the trip.',
      ride_id: '44444444-4444-4444-a444-444444444444',
    });

    expect(report.id).toBeDefined();
    expect(report.reporter_id).toBe(reporterId);
    expect(report.reported_id).toBe(reportedId);
    expect(report.reason).toBe('HARASSMENT');
    expect(report.status).toBe('PENDING');
    expect(report.details).toContain('inappropriate remarks');
  });

  it('enforces self-report invariant: user cannot report themselves', async () => {
    await expect(
      moderationService.submitReport(reporterId, {
        reported_id: reporterId,
        reason: 'OTHER',
        details: 'Self reporting test',
      })
    ).rejects.toThrow('You cannot submit a report against yourself');
  });

  it('validates report schema and rejects invalid report submissions', async () => {
    await expect(
      moderationService.submitReport(reporterId, {
        reported_id: '',
        // @ts-expect-error Testing invalid enum
        reason: 'INVALID_CATEGORY',
        details: 'Details',
      })
    ).rejects.toThrow();
  });

  it('guarantees report privacy: reporter sees their own reports, reported peer sees nothing', async () => {
    await moderationService.submitReport(reporterId, {
      reported_id: reportedId,
      reason: 'UNSAFE_DRIVING',
      details: 'Overspeeding on expressway near ICEM campus',
    });

    const reporterReports = await moderationService.listMyReports(reporterId);
    expect(reporterReports.length).toBe(1);
    expect(reporterReports[0].reported_id).toBe(reportedId);

    // The reported user must NEVER see reports lodged against them in their personal report list
    const reportedUserReports = await moderationService.listMyReports(reportedId);
    expect(reportedUserReports.length).toBe(0);
  });

  it('resolves an incident report with admin notes', async () => {
    const report = await moderationService.submitReport(reporterId, {
      reported_id: reportedId,
      reason: 'INAPPROPRIATE_BEHAVIOUR',
      details: 'Uncooperative and disruptive behaviour during transit',
    });

    const resolved = await moderationService.resolveReport(
      adminId,
      report.id,
      'RESOLVED',
      'Mediated by Campus Office: warning issued'
    );

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolved_by).toBe(adminId);
    expect(resolved.resolution_note).toBe('Mediated by Campus Office: warning issued');
    expect(resolved.resolved_at).toBeDefined();
  });
});

describe('User Blocking Service (Phase 7)', () => {
  const userA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const userC = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

  beforeEach(() => {
    localStorage.clear();
  });

  it('blocks a user successfully', async () => {
    const block = await moderationService.blockUser(userA, {
      blocked_id: userB,
      reason: 'Do not want to ride together',
    });

    expect(block.blocker_id).toBe(userA);
    expect(block.blocked_id).toBe(userB);
    expect(block.reason).toBe('Do not want to ride together');
  });

  it('prevents self-blocking invariant', async () => {
    await expect(
      moderationService.blockUser(userA, {
        blocked_id: userA,
      })
    ).rejects.toThrow('You cannot block yourself');
  });

  it('enforces bidirectional blocking invariant (A blocks B -> isBlocked(A, B) AND isBlocked(B, A))', async () => {
    expect(await moderationService.isBlocked(userA, userB)).toBe(false);
    expect(await moderationService.isBlocked(userB, userA)).toBe(false);

    await moderationService.blockUser(userA, { blocked_id: userB });

    // Both directions must report blocked
    expect(await moderationService.isBlocked(userA, userB)).toBe(true);
    expect(await moderationService.isBlocked(userB, userA)).toBe(true);

    // Unrelated user is not blocked
    expect(await moderationService.isBlocked(userA, userC)).toBe(false);
    expect(await moderationService.isBlocked(userB, userC)).toBe(false);
  });

  it('returns all blocked user IDs in getBlockedUserIds in both directions', async () => {
    await moderationService.blockUser(userA, { blocked_id: userB });
    await moderationService.blockUser(userC, { blocked_id: userA });

    const blockedForA = await moderationService.getBlockedUserIds(userA);
    expect(blockedForA.has(userB)).toBe(true);
    expect(blockedForA.has(userC)).toBe(true);

    const blockedForB = await moderationService.getBlockedUserIds(userB);
    expect(blockedForB.has(userA)).toBe(true);
  });

  it('unblocks a user and restores unblocked state', async () => {
    await moderationService.blockUser(userA, { blocked_id: userB });
    expect(await moderationService.isBlocked(userA, userB)).toBe(true);

    const unblocked = await moderationService.unblockUser(userA, userB);
    expect(unblocked).toBe(true);
    expect(await moderationService.isBlocked(userA, userB)).toBe(false);
    expect(await moderationService.isBlocked(userB, userA)).toBe(false);
  });

  it('lists blocked users for profile management', async () => {
    await moderationService.blockUser(userA, { blocked_id: userB, reason: 'Harassment' });
    const list = await moderationService.listBlockedUsers(userA);

    expect(list.length).toBe(1);
    expect(list[0].blocked_id).toBe(userB);
  });
});
