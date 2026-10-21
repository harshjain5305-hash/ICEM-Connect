import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import * as useAuthModule from './useAuth';

describe('Route Authorization Guards (Phase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ProtectedRoute renders fallback or auth prompt when unauthenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      roles: [],
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <ProtectedRoute fallback={<div>Please sign in to proceed</div>}>
        <div>Secret Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Please sign in to proceed')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('ProtectedRoute renders children when authenticated as active student', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u1', email: 'student@indiraicem.ac.in', name: 'Student' },
      profile: {
        id: 'u1',
        name: 'Student',
        email: 'student@indiraicem.ac.in',
        prn: 'PRN123',
        department: 'MCA',
        year: 1,
        profile_image_url: null,
        status: 'ACTIVE',
        rating_average: 5,
        rating_count: 0,
        created_at: '',
        updated_at: '',
      },
      roles: ['STUDENT'],
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <ProtectedRoute>
        <div>Verified Student Area</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Verified Student Area')).toBeInTheDocument();
  });

  it('ProtectedRoute blocks suspended students with clear notification', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u2', email: 'suspended@indiraicem.ac.in', name: 'Suspended Student' },
      profile: {
        id: 'u2',
        name: 'Suspended Student',
        email: 'suspended@indiraicem.ac.in',
        prn: 'PRN999',
        department: 'Mechanical Engineering',
        year: 2,
        profile_image_url: null,
        status: 'SUSPENDED',
        rating_average: 3.5,
        rating_count: 2,
        created_at: '',
        updated_at: '',
      },
      roles: ['STUDENT'],
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <ProtectedRoute>
        <div>Protected Ride Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Account Restricted')).toBeInTheDocument();
    expect(screen.queryByText('Protected Ride Content')).not.toBeInTheDocument();
  });

  it('AdminRoute rejects ordinary students with Access Denied', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u3', email: 'ordinary@indiraicem.ac.in', name: 'Ordinary Student' },
      profile: {
        id: 'u3',
        name: 'Ordinary Student',
        email: 'ordinary@indiraicem.ac.in',
        prn: 'PRN555',
        department: 'Civil Engineering',
        year: 3,
        profile_image_url: null,
        status: 'ACTIVE',
        rating_average: 5,
        rating_count: 0,
        created_at: '',
        updated_at: '',
      },
      roles: ['STUDENT'], // ordinary student, NOT admin
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <AdminRoute>
        <div>Administrative Controls</div>
      </AdminRoute>
    );

    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Ordinary verified student accounts cannot access administrative or moderation controls/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Administrative Controls')).not.toBeInTheDocument();
  });

  it('AdminRoute renders content when user has ADMIN role', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin1', email: 'admin.moderator@indiraicem.ac.in', name: 'Admin User' },
      profile: {
        id: 'admin1',
        name: 'Admin User',
        email: 'admin.moderator@indiraicem.ac.in',
        prn: 'ADMIN_PRN_01',
        department: null,
        year: null,
        profile_image_url: null,
        status: 'ACTIVE',
        rating_average: 5,
        rating_count: 0,
        created_at: '',
        updated_at: '',
      },
      roles: ['STUDENT', 'ADMIN'],
      isLoading: false,
      isAuthenticated: true,
      isAdmin: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <AdminRoute>
        <div>Administrative Controls</div>
      </AdminRoute>
    );

    expect(screen.getByText('Administrative Controls')).toBeInTheDocument();
    expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
  });
});
