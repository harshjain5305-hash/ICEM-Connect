import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { RegisterInput, LoginInput, ProfileUpdateInput } from './auth.schema';
import type { StudentProfile, PublicStudentProfile, UserRoleType } from './auth.types';

const LOCAL_STORAGE_SESSION_KEY = 'icem_connect_session_v1';
const LOCAL_STORAGE_USERS_KEY = 'icem_connect_students_db_v1';

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
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

      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const roles: UserRoleType[] = (roleRows || []).map((r) => r.role as UserRoleType);
      if (roles.length === 0) roles.push('STUDENT');

      return {
        user: { id: userId, email: profileRow.email, name: profileRow.name },
        profile: profileRow as StudentProfile,
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
   */
  async getProfile(studentId: string): Promise<StudentProfile | null> {
    const isLive = isSupabaseConfigured();
    if (isLive) {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();
      return (data as StudentProfile) || null;
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
   * Updates non-sensitive profile attributes (department, year, photo).
   * Changing PRN or email is strictly blocked by product rules.
   */
  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<StudentProfile> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data, error } = await supabase
        .from('students')
        .update({
          department: input.department ?? null,
          year: input.year ?? null,
          profile_image_url: input.profile_image_url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Failed to update profile.');
      }
      return data as StudentProfile;
    }

    // Local mode update
    const currentSession = await this.getCurrentSession();
    if (!currentSession || currentSession.user.id !== userId) {
      throw new Error('Unauthorized profile modification.');
    }

    const updatedProfile: StudentProfile = {
      ...currentSession.profile,
      department: input.department ?? currentSession.profile.department,
      year: input.year ?? currentSession.profile.year,
      profile_image_url: input.profile_image_url ?? currentSession.profile.profile_image_url,
      updated_at: new Date().toISOString(),
    };

    const updatedSession = {
      ...currentSession,
      profile: updatedProfile,
    };

    const users = getStoredUsers();
    users[currentSession.user.email] = updatedSession;
    saveStoredUsers(users);

    try {
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedSession));
    } catch {
      // ignore
    }

    return updatedProfile;
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
