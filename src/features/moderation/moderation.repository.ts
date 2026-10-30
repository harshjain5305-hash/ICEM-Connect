import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { authService } from '@/features/auth/auth.service';
import type {
  UserReport,
  CreateReportInput,
  ReportStatus,
  UserBlock,
  CreateBlockInput,
} from './moderation.types';
import type { PublicStudentInfo } from '@/features/requests/request.types';

import { isValidUuid } from '@/lib/utils';
import { getLocalData, saveLocalData, STORAGE_KEYS } from '@/lib/localStorage';

const LOCAL_STORAGE_REPORTS_KEY = STORAGE_KEYS.REPORTS;
const LOCAL_STORAGE_BLOCKS_KEY = STORAGE_KEYS.BLOCKED_USERS;

async function getPublicStudentInfo(studentId: string): Promise<PublicStudentInfo> {
  const profile = await authService.getProfile(studentId);
  if (profile) {
    return {
      id: profile.id,
      name: profile.name,
      department: profile.department,
      year: profile.year,
      profile_image_url: profile.profile_image_url,
      rating: profile.rating_average,
      is_verified: profile.status === 'ACTIVE',
    };
  }
  return {
    id: studentId,
    name: 'ICEM Student',
    department: 'Engineering',
    year: 3,
    rating: 5.0,
    is_verified: true,
  };
}

export const moderationRepository = {
  // ==========================================
  // REPORTS REPOSITORY
  // ==========================================
  async createReport(reporterId: string, input: CreateReportInput): Promise<UserReport> {
    const isLive = isSupabaseConfigured();
    let liveReport: UserReport | null = null;

    if (
      isLive &&
      isValidUuid(reporterId) &&
      isValidUuid(input.reported_id) &&
      (!input.ride_id || isValidUuid(input.ride_id))
    ) {
      try {
        const { data, error } = await supabase.rpc('create_user_report', {
          p_reporter_id: reporterId,
          p_reported_id: input.reported_id,
          p_ride_id: input.ride_id || null,
          p_reason: input.reason,
          p_details: input.details || null,
        });

        if (!error && data && (data as { report_id?: string }).report_id) {
          const reportId = (data as { report_id: string }).report_id;
          const reporterInfo = await getPublicStudentInfo(reporterId);
          const reportedInfo = await getPublicStudentInfo(input.reported_id);
          liveReport = {
            id: reportId,
            reporter_id: reporterId,
            reported_id: input.reported_id,
            ride_id: input.ride_id || null,
            reason: input.reason,
            details: input.details || null,
            status: 'PENDING',
            created_at: new Date().toISOString(),
            reporter: reporterInfo,
            reported: reportedInfo,
          };
        }
      } catch (err) {
        console.warn('Live createReport error, persisting locally:', err);
      }
    }

    const reports = getLocalData<UserReport>(LOCAL_STORAGE_REPORTS_KEY);
    const reportId = liveReport?.id || `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const reporterInfo = liveReport?.reporter || (await getPublicStudentInfo(reporterId));
    const reportedInfo = liveReport?.reported || (await getPublicStudentInfo(input.reported_id));

    const newReport: UserReport = liveReport || {
      id: reportId,
      reporter_id: reporterId,
      reported_id: input.reported_id,
      ride_id: input.ride_id || null,
      reason: input.reason,
      details: input.details || null,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      reporter: reporterInfo,
      reported: reportedInfo,
    };

    reports[newReport.id] = newReport;
    saveLocalData(LOCAL_STORAGE_REPORTS_KEY, reports);
    return newReport;
  },

  async listReportsByReporter(reporterId: string): Promise<UserReport[]> {
    const isLive = isSupabaseConfigured();
    const liveReports: UserReport[] = [];

    if (isLive && isValidUuid(reporterId)) {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .eq('reporter_id', reporterId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          for (const item of data) {
            const r = item as unknown as UserReport;
            r.reporter = await getPublicStudentInfo(r.reporter_id);
            r.reported = await getPublicStudentInfo(r.reported_id);
            liveReports.push(r);
          }
        }
      } catch (err) {
        console.warn('Live listReportsByReporter error:', err);
      }
    }

    const localReports = getLocalData<UserReport>(LOCAL_STORAGE_REPORTS_KEY);
    const localList = Object.values(localReports).filter((r) => r.reporter_id === reporterId);

    const map = new Map<string, UserReport>();
    for (const r of liveReports) map.set(r.id, r);
    for (const r of localList) {
      if (!map.has(r.id)) {
        if (!r.reporter) r.reporter = await getPublicStudentInfo(r.reporter_id);
        if (!r.reported) r.reported = await getPublicStudentInfo(r.reported_id);
        map.set(r.id, r);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async listAllReports(filterStatus?: ReportStatus): Promise<UserReport[]> {
    const isLive = isSupabaseConfigured();
    const liveReports: UserReport[] = [];

    if (isLive) {
      try {
        let query = supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (filterStatus) {
          query = query.eq('status', filterStatus);
        }
        const { data, error } = await query;
        if (!error && data) {
          for (const item of data) {
            const r = item as unknown as UserReport;
            r.reporter = await getPublicStudentInfo(r.reporter_id);
            r.reported = await getPublicStudentInfo(r.reported_id);
            liveReports.push(r);
          }
        }
      } catch (err) {
        console.warn('Live listAllReports error:', err);
      }
    }

    const localReports = getLocalData<UserReport>(LOCAL_STORAGE_REPORTS_KEY);
    let localList = Object.values(localReports);
    if (filterStatus) {
      localList = localList.filter((r) => r.status === filterStatus);
    }

    const map = new Map<string, UserReport>();
    for (const r of liveReports) map.set(r.id, r);
    for (const r of localList) {
      if (!map.has(r.id)) {
        if (!r.reporter) r.reporter = await getPublicStudentInfo(r.reporter_id);
        if (!r.reported) r.reported = await getPublicStudentInfo(r.reported_id);
        map.set(r.id, r);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async updateReportStatus(
    adminId: string,
    reportId: string,
    status: ReportStatus,
    resolutionNote?: string | null
  ): Promise<UserReport> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(adminId) && isValidUuid(reportId)) {
      try {
        const dbStatus = (status === 'REVIEWED' ? 'UNDER_REVIEW' : status) as 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
        await supabase.rpc('resolve_report', {
          p_admin_id: adminId,
          p_report_id: reportId,
          p_status: dbStatus,
          p_resolution_note: resolutionNote || null,
        });
      } catch (err) {
        console.warn('Live updateReportStatus error:', err);
      }
    }

    const reports = getLocalData<UserReport>(LOCAL_STORAGE_REPORTS_KEY);
    const existing = reports[reportId];
    if (!existing) {
      throw new Error(`Report with ID ${reportId} not found`);
    }

    existing.status = status;
    existing.resolved_by = adminId;
    existing.resolved_at = new Date().toISOString();
    existing.resolution_note = resolutionNote || null;

    reports[reportId] = existing;
    saveLocalData(LOCAL_STORAGE_REPORTS_KEY, reports);
    return existing;
  },

  // ==========================================
  // USER BLOCKING REPOSITORY
  // ==========================================
  async blockUser(blockerId: string, input: CreateBlockInput): Promise<UserBlock> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(blockerId) && isValidUuid(input.blocked_id)) {
      try {
        await supabase.rpc('block_user', {
          p_blocker_id: blockerId,
          p_blocked_id: input.blocked_id,
          p_reason: input.reason || null,
        });
      } catch (err) {
        console.warn('Live blockUser error, persisting locally:', err);
      }
    }

    const blocks = getLocalData<UserBlock>(LOCAL_STORAGE_BLOCKS_KEY);
    const blockKey = `${blockerId}_${input.blocked_id}`;
    const blockedInfo = await getPublicStudentInfo(input.blocked_id);

    const newBlock: UserBlock = {
      id: blockKey,
      blocker_id: blockerId,
      blocked_id: input.blocked_id,
      reason: input.reason || null,
      created_at: new Date().toISOString(),
      blocked_user: blockedInfo,
    };

    blocks[blockKey] = newBlock;
    saveLocalData(LOCAL_STORAGE_BLOCKS_KEY, blocks);
    return newBlock;
  },

  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(blockerId) && isValidUuid(blockedId)) {
      try {
        await supabase.rpc('unblock_user', {
          p_blocker_id: blockerId,
          p_blocked_id: blockedId,
        });
      } catch (err) {
        console.warn('Live unblockUser error:', err);
      }
    }

    const blocks = getLocalData<UserBlock>(LOCAL_STORAGE_BLOCKS_KEY);
    const blockKey = `${blockerId}_${blockedId}`;
    if (blocks[blockKey]) {
      delete blocks[blockKey];
      saveLocalData(LOCAL_STORAGE_BLOCKS_KEY, blocks);
      return true;
    }
    return false;
  },

  async listBlockedUsers(blockerId: string): Promise<UserBlock[]> {
    const isLive = isSupabaseConfigured();
    const liveBlocks: UserBlock[] = [];

    if (isLive && isValidUuid(blockerId)) {
      try {
        const { data, error } = await supabase
          .from('user_blocks')
          .select('*')
          .eq('blocker_id', blockerId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          for (const item of data) {
            const b = item as unknown as UserBlock;
            b.blocked_user = await getPublicStudentInfo(b.blocked_id);
            liveBlocks.push(b);
          }
        }
      } catch (err) {
        console.warn('Live listBlockedUsers error:', err);
      }
    }

    const localBlocks = getLocalData<UserBlock>(LOCAL_STORAGE_BLOCKS_KEY);
    const localList = Object.values(localBlocks).filter((b) => b.blocker_id === blockerId);

    const map = new Map<string, UserBlock>();
    for (const b of liveBlocks) map.set(b.id, b);
    for (const b of localList) {
      if (!map.has(b.id)) {
        if (!b.blocked_user) b.blocked_user = await getPublicStudentInfo(b.blocked_id);
        map.set(b.id, b);
      }
    }

    return Array.from(map.values());
  },

  /**
   * Checks bidirectional blocking between two users.
   */
  async isBlocked(userA: string, userB: string): Promise<boolean> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(userA) && isValidUuid(userB)) {
      try {
        const { data } = await supabase
          .from('user_blocks')
          .select('id')
          .or(`and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`)
          .maybeSingle();

        if (data) return true;
      } catch {
        // ignore
      }
    }

    const blocks = getLocalData<UserBlock>(LOCAL_STORAGE_BLOCKS_KEY);
    return Object.values(blocks).some(
      (b) =>
        (b.blocker_id === userA && b.blocked_id === userB) ||
        (b.blocker_id === userB && b.blocked_id === userA)
    );
  },

  /**
   * Returns a Set of user IDs that are blocked with the specified user in either direction.
   */
  async getBlockedUserIds(userId: string): Promise<Set<string>> {
    const blockedIds = new Set<string>();
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(userId)) {
      try {
        const { data } = await supabase
          .from('user_blocks')
          .select('blocker_id, blocked_id')
          .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

        if (data) {
          for (const b of data) {
            if (b.blocker_id === userId) blockedIds.add(b.blocked_id);
            if (b.blocked_id === userId) blockedIds.add(b.blocker_id);
          }
        }
      } catch {
        // ignore
      }
    }

    const localBlocks = getLocalData<UserBlock>(LOCAL_STORAGE_BLOCKS_KEY);
    for (const b of Object.values(localBlocks)) {
      if (b.blocker_id === userId) blockedIds.add(b.blocked_id);
      if (b.blocked_id === userId) blockedIds.add(b.blocker_id);
    }

    return blockedIds;
  },
};
