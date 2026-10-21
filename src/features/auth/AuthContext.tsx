import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from './auth.service';
import type { RegisterInput, LoginInput, ProfileUpdateInput } from './auth.schema';
import type { AuthUser, StudentProfile, UserRoleType } from './auth.types';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

interface AuthContextType {
  user: AuthUser | null;
  profile: StudentProfile | null;
  roles: UserRoleType[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<{ requiresVerification: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [roles, setRoles] = useState<UserRoleType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async () => {
    try {
      const session = await authService.getCurrentSession();
      if (session) {
        setUser(session.user);
        setProfile(session.profile);
        setRoles(session.roles);
      } else {
        setUser(null);
        setProfile(null);
        setRoles([]);
      }
    } catch {
      setUser(null);
      setProfile(null);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();

    if (isSupabaseConfigured()) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => {
        refreshSession();
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [refreshSession]);

  const login = async (input: LoginInput) => {
    setIsLoading(true);
    try {
      const result = await authService.login(input);
      setUser(result.user);
      setProfile(result.profile);
      setRoles(result.roles);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (input: RegisterInput) => {
    setIsLoading(true);
    try {
      const result = await authService.register(input);
      setUser(result.user);
      setProfile(result.profile);
      setRoles(result.roles);
      return { requiresVerification: result.requiresEmailVerification };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setProfile(null);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (input: ProfileUpdateInput) => {
    if (!user) throw new Error('Not authenticated');
    const updated = await authService.updateProfile(user.id, input);
    setProfile(updated);
  };

  const isAuthenticated = Boolean(user && profile && profile.status === 'ACTIVE');
  const isAdmin = roles.includes('ADMIN');

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        roles,
        isLoading,
        isAuthenticated,
        isAdmin,
        login,
        register,
        logout,
        updateProfile,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
