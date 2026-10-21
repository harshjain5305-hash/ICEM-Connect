import {
  createReportSchema,
  createBlockSchema,
  updateReportStatusSchema,
} from './moderation.schema';
import { moderationRepository } from './moderation.repository';
import type {
  UserReport,
  CreateReportInput,
  ReportStatus,
  UserBlock,
  CreateBlockInput,
} from './moderation.types';

export const moderationService = {
  // ==========================================
  // REPORTING
  // ==========================================
  /**
   * Submits a private incident, safety, or misconduct report.
   * Conforms to PRD.md §15, Architecture.md §11, and Rules.md §23.
   */
  async submitReport(reporterId: string, input: CreateReportInput): Promise<UserReport> {
    const parseResult = createReportSchema.safeParse(input);
    if (!parseResult.success) {
      throw new Error(parseResult.error.errors[0]?.message || 'Invalid report data');
    }

    if (reporterId === input.reported_id) {
      throw new Error('You cannot submit a report against yourself');
    }

    return await moderationRepository.createReport(reporterId, input);
  },

  /**
   * Lists reports submitted by a specific student (reporter privacy).
   */
  async listMyReports(reporterId: string): Promise<UserReport[]> {
    return await moderationRepository.listReportsByReporter(reporterId);
  },

  /**
   * Admin-only: Lists all campus reports with optional status filtering.
   */
  async listAllReports(filterStatus?: ReportStatus): Promise<UserReport[]> {
    return await moderationRepository.listAllReports(filterStatus);
  },

  /**
   * Admin-only: Updates report resolution status and logs resolution notes.
   */
  async resolveReport(
    adminId: string,
    reportId: string,
    status: ReportStatus,
    resolutionNote?: string | null
  ): Promise<UserReport> {
    const parseResult = updateReportStatusSchema.safeParse({ status, resolution_note: resolutionNote });
    if (!parseResult.success) {
      throw new Error(parseResult.error.errors[0]?.message || 'Invalid resolution data');
    }

    return await moderationRepository.updateReportStatus(
      adminId,
      reportId,
      status,
      resolutionNote
    );
  },

  // ==========================================
  // USER BLOCKING
  // ==========================================
  /**
   * Blocks a student to prevent matching, ride join requests, and direct messaging.
   * Conforms to PRD.md §15 and Rules.md §23.
   */
  async blockUser(blockerId: string, input: CreateBlockInput): Promise<UserBlock> {
    const parseResult = createBlockSchema.safeParse(input);
    if (!parseResult.success) {
      throw new Error(parseResult.error.errors[0]?.message || 'Invalid block data');
    }

    if (blockerId === input.blocked_id) {
      throw new Error('You cannot block yourself');
    }

    return await moderationRepository.blockUser(blockerId, input);
  },

  /**
   * Unblocks a student.
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    return await moderationRepository.unblockUser(blockerId, blockedId);
  },

  /**
   * Lists all users blocked by the specified student.
   */
  async listBlockedUsers(blockerId: string): Promise<UserBlock[]> {
    return await moderationRepository.listBlockedUsers(blockerId);
  },

  /**
   * Checks if an interaction between userA and userB is blocked in either direction.
   */
  async isBlocked(userA: string, userB: string): Promise<boolean> {
    return await moderationRepository.isBlocked(userA, userB);
  },

  /**
   * Returns all user IDs that are blocked with the specified user.
   */
  async getBlockedUserIds(userId: string): Promise<Set<string>> {
    return await moderationRepository.getBlockedUserIds(userId);
  },
};
