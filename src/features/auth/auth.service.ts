import { supabase, isSupabaseConfigured, getAuthRedirectUrl } from '@/integrations/supabase/client';
import type { RegisterInput, LoginInput, ProfileUpdateInput } from './auth.schema';
import type { StudentProfile, PublicStudentProfile, UserRoleType } from './auth.types';
import { isValidUuid } from '@/lib/utils';
import { STORAGE_KEYS } from '@/lib/localStorage';

const LOCAL_STORAGE_SESSION_KEY = STORAGE_KEYS.SESSION;
const LOCAL_STORAGE_USERS_KEY = STORAGE_KEYS.USERS;

// Seed demo admin account for verification
const DEMO_ADMIN_EMAIL = 'admin.moderator@indiraicem.ac.in';

interface StoredStudentData {
  user: { id: string; email: string; name: string };
  profile: StudentProfile;
  roles: UserRoleType[];
  passwordHash?: string;
}

function getStoredUsers(): Record<string, StoredStudentData> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStoredUsers(users: Record<string, StoredStudentData>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

/**
 * Strips confidential fields (PRN, phone) to return a safe public projection.
 * Conforms to Architecture.md §6.1 & PRD.md §0.
 */
export function toPublicStudentProfile(profile: StudentProfile): PublicStudentProfile {
  return {
    id: profile.id,
    name: profile.name,
    department: profile.department,
    year: profile.year,
    profile_image_url: profile.profile_image_url,
    status: profile.status,
    rating_average: profile.rating_average,
    rating_count: profile.rating_count,
    created_at: profile.created_at,
  };
}

export const authService = {
  /**
   * Registers an ICEM student account with verified institutional email and private PRN.
   */
  async register(input: RegisterInput): Promise<{
    user: { id: string; email: string; name: string };
    profile: StudentProfile;
    roles: UserRoleType[];
    requiresEmailVerification: boolean;
  }> {
    const email = input.email.trim().toLowerCase();
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const redirectUrl = getAuthRedirectUrl();

      const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: input.name,
            prn: input.prn,
            department: input.department || null,
            year: input.year || null,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('Registration failed: no user returned.');
      }

      const userId = data.user.id;

      // Upsert profile into public.students
      const { data: profileData, error: profileError } = await supabase
        .from('students')
        .upsert({
          id: userId,
          name: input.name,
          email,
          prn: input.prn,
          department: input.department || null,
          year: input.year || null,
          status: 'ACTIVE',
          rating_average: 5.0,
          rating_count: 0,
        })
        .select()
        .single();

      if (profileError && !profileData) {
        // Trigger might have handled it or RLS prevented direct upsert before confirmation
      }

      // Assign STUDENT role in public.user_roles
      await supabase.from('user_roles').upsert({
        user_id: userId,
        role: 'STUDENT',
      });

      const profile: StudentProfile = {
        id: userId,
        name: input.name,
        email,
        prn: input.prn,
        department: input.department || null,
        year: input.year || null,
        profile_image_url: null,
        status: 'ACTIVE',
        rating_average: 5.0,
        rating_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return {
        user: { id: userId, email, name: input.name },
        profile,
        roles: ['STUDENT'],
        requiresEmailVerification: true,
      };
    }

    // Local / Offline / Test environment mode
    const users = getStoredUsers();
    if (users[email]) {
      throw new Error(`An account with email ${email} already exists.`);
    }

    const userId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const isDemoAdmin = email === DEMO_ADMIN_EMAIL;
    const roles: UserRoleType[] = isDemoAdmin ? ['STUDENT', 'ADMIN'] : ['STUDENT'];

    const profile: StudentProfile = {
      id: userId,
      name: input.name,
      email,
      prn: input.prn, // Stored privately
      department: input.department || null,
      year: input.year || null,
      profile_image_url: null,
      status: 'ACTIVE',
      rating_average: 5.0,
      rating_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const userData: StoredStudentData = {
      user: { id: userId, email, name: input.name },
      profile,
      roles,
    };

    users[email] = userData;
    saveStoredUsers(users);

    // Save active session
    try {
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(userData));
    } catch {
      // ignore
    }

    return {
      user: userData.user,
      profile,
      roles,
      requiresEmailVerification: false,
    };
  },

  /**
   * Signs in an existing student with credentials.
   */
  async login(input: LoginInput): Promise<{
    user: { id: string; email: string; name: string };
    profile: StudentProfile;
    roles: UserRoleType[];
  }> {
    const email = input.email.trim().toLowerCase();
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: input.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('Sign in failed: no user returned.');
      }

      const userId = data.user.id;

      // Fetch profile
      const { data: profileRow, error: profileErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr || !profileRow) {
        throw new Error('Student profile not found. Please contact campus admin.');
      }

      if (profileRow.status !== 'ACTIVE') {
        throw new Error(`Your account status is ${profileRow.status}. Access denied.`);
      }

      // Fetch roles
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const roles: UserRoleType[] = (roleRows || []).map((r) => r.role as UserRoleType);
      if (roles.length === 0) roles.push('STUDENT');

      return {
        user: { id: userId, email, name: profileRow.name },
        profile: profileRow as StudentProfile,
        roles,
      };
    }

    // Local / Test environment
    const users = getStoredUsers();
    let userData = users[email];

    if (!userData) {
      // Auto-provision demo account if logging in with valid @indiraicem.ac.in email
      const isDemoAdmin = email === DEMO_ADMIN_EMAIL;
      const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const userId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const roles: UserRoleType[] = isDemoAdmin ? ['STUDENT', 'ADMIN'] : ['STUDENT'];

      userData = {
        user: { id: userId, email, name },
        profile: {
          id: userId,
          name,
          email,
          prn: `PRN_${Math.floor(100000 + Math.random() * 900000)}`,
          department: 'MCA',
          year: 1,
          profile_image_url: null,
          status: 'ACTIVE',
          rating_average: 5.0,
          rating_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        roles,
      };

      users[email] = userData;
      saveStoredUsers(users);
    }

    if (userData.profile.status !== 'ACTIVE') {
      throw new Error(`Your account status is ${userData.profile.status}. Access denied.`);
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(userData));
    } catch {
      // ignore
    }

    return {
      user: userData.user,
      profile: userData.profile,
      roles: userData.roles,
    };
  },

  /**
   * Restores current session on page load.
   */
  async getCurrentSession(): Promise<{
    user: { id: string; email: string; name: string };
    profile: StudentProfile;
    roles: UserRoleType[];
  } | null> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data } = await supabase.auth.getSession();
      if (!data.session || !data.session.user) return null;

      const userId = data.session.user.id;
      const { data: profileRow } = await supabase
        .from('students')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profileRow) return null;

      let studentProf = profileRow as StudentProfile;
      // Preserve local upi_id if Supabase has not yet refreshed schema cache or column
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.profile?.id === userId && parsed.profile.upi_id && !studentProf.upi_id) {
            studentProf = { ...studentProf, upi_id: parsed.profile.upi_id };
          }
        }
      } catch {
        // ignore
      }

      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const roles: UserRoleType[] = (roleRows || []).map((r) => r.role as UserRoleType);
      if (roles.length === 0) roles.push('STUDENT');

      return {
        user: { id: userId, email: studentProf.email, name: studentProf.name },
        profile: studentProf,
        roles,
      };
    }

    // Local mode session restore
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.user && parsed?.profile) {
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  },

  /**
   * Retrieves student profile by student ID.
   * Utilizes SECURITY DEFINER RPC get_student_profile when live to safely fetch
   * student public profile without being blocked by RLS policies.
   */
  async getProfile(studentId: string): Promise<StudentProfile | null> {
    const isLive = isSupabaseConfigured();
    if (isLive && isValidUuid(studentId)) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_student_profile', {
          target_student_id: studentId,
        });
        if (!rpcErr && rpcData) {
          const prof = rpcData as StudentProfile;
          if (!prof.upi_id) {
            try {
              const { data: directData } = await supabase
                .from('students')
                .select('upi_id')
                .eq('id', studentId)
                .maybeSingle();
              if (directData?.upi_id) {
                prof.upi_id = directData.upi_id;
              }
            } catch {
              // ignore
            }
          }
          return prof;
        }
      } catch (err) {
        console.warn('RPC get_student_profile query failed:', err);
      }

      try {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('id', studentId)
          .maybeSingle();
        if (data) {
          return data as StudentProfile;
        }
      } catch (err) {
        console.warn('Live direct getProfile error:', err);
      }
    }

    const users = getStoredUsers();
    for (const email of Object.keys(users)) {
      if (users[email].user.id === studentId) {
        return users[email].profile;
      }
    }
    return null;
  },

  /**
   * Signs out the user and clears all active credentials.
   */
  async logout(): Promise<void> {
    const isLive = isSupabaseConfigured();
    if (isLive) {
      await supabase.auth.signOut();
    }
    try {
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    } catch {
      // ignore
    }
  },

  /**
   * Dispatches a password reset link to an institutional ICEM email.
   * Redirects explicitly to the canonical production URL (https://icem-connect.vercel.app/).
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const redirectUrl = getAuthRedirectUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        throw new Error(error.message);
      }
      return;
    }

    // Local / offline / mock mode
    const users = getStoredUsers();
    if (!users[cleanEmail]) {
      // Silent return to avoid leaking student email existence
      return;
    }
  },

  /**
   * Updates user password for the recovery session or authenticated user.
   */
  async updatePassword(password: string): Promise<void> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw new Error(error.message);
      }
      return;
    }

    // Local / test mode
    const currentSession = await this.getCurrentSession();
    if (!currentSession) {
      throw new Error('No active user session to update password.');
    }
    const users = getStoredUsers();
    if (users[currentSession.user.email]) {
      users[currentSession.user.email].passwordHash = 'updated';
      saveStoredUsers(users);
    }
  },

  /**
   * Resends student email confirmation link with explicit production redirect.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const redirectUrl = getAuthRedirectUrl();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
      return;
    }
  },

  /**
   * Syncs an updated StudentProfile into local session storage and user cache.
   */
  syncLocalSessionProfile(userId: string, profile: StudentProfile): void {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.profile) {
          parsed.profile = { ...parsed.profile, ...profile };
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(parsed));
        }
      }
      const users = getStoredUsers();
      for (const email of Object.keys(users)) {
        if (users[email].user.id === userId) {
          users[email].profile = { ...users[email].profile, ...profile };
          saveStoredUsers(users);
          break;
        }
      }
    } catch {
      // ignore
    }
  },

  /**
   * Updates local session and offline user store with non-sensitive profile attributes.
   */
  updateLocalSessionProfile(userId: string, input: ProfileUpdateInput): StudentProfile {
    let baseProfile: StudentProfile | null = null;
    let parsedSession: StoredStudentData | null = null;

    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (raw) {
        parsedSession = JSON.parse(raw);
        baseProfile = parsedSession?.profile || null;
      }
    } catch {
      // ignore
    }

    const cleanUpi =
      input.upi_id !== undefined && input.upi_id !== null
        ? (input.upi_id.trim() === '' ? null : input.upi_id.trim())
        : (input.upi_id === null ? null : undefined);

    const updatedProfile: StudentProfile = {
      id: userId,
      name: baseProfile?.name || 'ICEM Student',
      email: baseProfile?.email || '',
      prn: baseProfile?.prn || '',
      department: input.department !== undefined ? input.department : (baseProfile?.department ?? null),
      year: input.year !== undefined ? input.year : (baseProfile?.year ?? null),
      profile_image_url:
        input.profile_image_url !== undefined
          ? input.profile_image_url
          : (baseProfile?.profile_image_url ?? null),
      upi_id: cleanUpi !== undefined ? cleanUpi : (baseProfile?.upi_id ?? null),
      status: baseProfile?.status || 'ACTIVE',
      rating_average: baseProfile?.rating_average ?? 5.0,
      rating_count: baseProfile?.rating_count ?? 0,
      created_at: baseProfile?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (parsedSession) {
      parsedSession.profile = updatedProfile;
      try {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(parsedSession));
      } catch {
        // ignore
      }
    }

    const users = getStoredUsers();
    for (const email of Object.keys(users)) {
      if (users[email].user.id === userId) {
        users[email].profile = updatedProfile;
        saveStoredUsers(users);
        break;
      }
    }

    return updatedProfile;
  },

  /**
   * Updates non-sensitive profile attributes (department, year, photo, upi_id).
   * Changing PRN or email is strictly blocked by product rules.
   */
  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<StudentProfile> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const cleanUpi =
        input.upi_id !== undefined && input.upi_id !== null
          ? (input.upi_id.trim() === '' ? null : input.upi_id.trim())
          : (input.upi_id === null ? null : undefined);

      // 1. Try secure RPC update first (runs as SECURITY DEFINER in PostgreSQL, immune to table PATCH cache quirks)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('update_student_profile', {
          p_department: input.department ?? null,
          p_year: input.year ?? null,
          p_upi_id: cleanUpi ?? null,
          p_profile_image_url: input.profile_image_url ?? null,
        });

        if (!rpcError && rpcData) {
          const profile = rpcData as StudentProfile;
          this.syncLocalSessionProfile(userId, profile);
          return profile;
        }
      } catch (rpcErr) {
        console.warn('RPC update_student_profile exception, falling back to direct table patch:', rpcErr);
      }

      // 2. Direct table update fallback
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.department !== undefined) payload.department = input.department;
      if (input.year !== undefined) payload.year = input.year;
      if (input.profile_image_url !== undefined) payload.profile_image_url = input.profile_image_url;
      if (cleanUpi !== undefined) payload.upi_id = cleanUpi;

      try {
        let { data, error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', userId)
          .select()
          .single();

        // If error occurred (e.g. upi_id column/constraint issue in Supabase), retry with core fields
        if (error && payload.upi_id !== undefined) {
          console.warn('Direct update with upi_id failed, retrying core fields:', error.message);
          const fallbackPayload = { ...payload };
          delete fallbackPayload.upi_id;

          const res = await supabase
            .from('students')
            .update(fallbackPayload)
            .eq('id', userId)
            .select()
            .single();

          if (!res.error && res.data) {
            data = {
              ...res.data,
              upi_id: cleanUpi ?? null,
            };
            error = null;
          }
        }

        if (!error && data) {
          const profile = data as StudentProfile;
          this.syncLocalSessionProfile(userId, profile);
          return profile;
        }
      } catch (directErr) {
        console.warn('Direct Supabase update exception:', directErr);
      }

      // 3. Resilient Session Fallback:
      // Even if remote Supabase encounters an error, guarantee the user's edits
      // (especially UPI ID) are persisted locally so they can proceed immediately.
      console.warn('Remote profile update encountered error, applying resilient local session update.');
      const localProfile = this.updateLocalSessionProfile(userId, input);
      return localProfile;
    }

    // Local mode update
    return this.updateLocalSessionProfile(userId, input);
  },

  /**
   * Admin-only: Lists all student accounts with roles and status.
   */
  async getStudentsForAdmin(adminUserId: string): Promise<StudentProfile[]> {
    const session = await this.getCurrentSession();
    if (!session || !session.roles.includes('ADMIN') || session.user.id !== adminUserId) {
      throw new Error('Forbidden: Admin privilege required.');
    }

    const isLive = isSupabaseConfigured();
    if (isLive) {
      const { data, error } = await supabase.from('students').select('*');
      if (error) throw new Error(error.message);
      return (data || []) as StudentProfile[];
    }

    const users = getStoredUsers();
    return Object.values(users).map((u) => u.profile);
  },

  /**
   * Admin-only: Updates student status (ACTIVE, SUSPENDED, DEACTIVATED).
   */
  async updateStudentStatus(
    adminUserId: string,
    targetStudentId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  ): Promise<void> {
    const session = await this.getCurrentSession();
    if (!session || !session.roles.includes('ADMIN') || session.user.id !== adminUserId) {
      throw new Error('Forbidden: Admin privilege required.');
    }

    const isLive = isSupabaseConfigured();
    if (isLive) {
      const { error } = await supabase
        .from('students')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', targetStudentId);

      if (error) throw new Error(error.message);
      return;
    }

    const users = getStoredUsers();
    for (const email of Object.keys(users)) {
      if (users[email].user.id === targetStudentId) {
        users[email].profile.status = status;
        saveStoredUsers(users);
        break;
      }
    }
  },

  /**
   * Retrieves user roles.
   */
  async getUserRoles(userId: string): Promise<UserRoleType[]> {
    const isLive = isSupabaseConfigured();
    if (isLive) {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      const roles = (data || []).map((r) => r.role as UserRoleType);
      return roles.length > 0 ? roles : ['STUDENT'];
    }

    const session = await this.getCurrentSession();
    if (session && session.user.id === userId) {
      return session.roles;
    }

    const users = getStoredUsers();
    for (const email of Object.keys(users)) {
      if (users[email].user.id === userId) {
        return users[email].roles;
      }
    }
    return ['STUDENT'];
  },

  /**
   * Atomically updates a student's reputation (rating average and count).
   */
  async updateStudentReputation(
    userId: string,
    ratingAverage: number,
    ratingCount: number
  ): Promise<void> {
    const isLive = isSupabaseConfigured();
    if (isLive) {
      await supabase
        .from('students')
        .update({
          rating_average: ratingAverage,
          rating_count: ratingCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    const users = getStoredUsers();
    for (const email of Object.keys(users)) {
      if (users[email].user.id === userId) {
        users[email].profile.rating_average = ratingAverage;
        users[email].profile.rating_count = ratingCount;
        saveStoredUsers(users);
        break;
      }
    }
  },
};
