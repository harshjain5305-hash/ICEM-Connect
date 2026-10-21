import { describe, it, expect } from 'vitest';
import { toPublicStudentProfile } from './auth.service';
import type { StudentProfile } from './auth.types';

describe('Student Privacy & PRN Protection (Phase 1)', () => {
  it('strictly omits PRN, phone, and credentials from public profile projections', () => {
    const internalProfile: StudentProfile = {
      id: 'student_uuid_123',
      name: 'Sneha More',
      email: 'sneha.more@indiraicem.ac.in',
      prn: 'CONFIDENTIAL_PRN_987654',
      department: 'Artificial Intelligence & Data Science',
      year: 3,
      profile_image_url: 'https://cdn.example.com/sneha.png',
      status: 'ACTIVE',
      rating_average: 4.9,
      rating_count: 14,
      created_at: '2026-10-21T10:00:00Z',
      updated_at: '2026-10-21T10:00:00Z',
    };

    const publicProfile = toPublicStudentProfile(internalProfile);

    // 1. Verify PRN is NOT present on public profile object
    expect('prn' in publicProfile).toBe(false);
    expect((publicProfile as unknown as Record<string, unknown>).prn).toBeUndefined();

    // 2. Verify JSON serialization never includes the PRN string
    const serialized = JSON.stringify(publicProfile);
    expect(serialized).not.toContain('CONFIDENTIAL_PRN_987654');
    expect(serialized).not.toContain('prn');

    // 3. Verify public non-sensitive attributes are preserved
    expect(publicProfile.id).toBe(internalProfile.id);
    expect(publicProfile.name).toBe('Sneha More');
    expect(publicProfile.department).toBe('Artificial Intelligence & Data Science');
    expect(publicProfile.year).toBe(3);
    expect(publicProfile.rating_average).toBe(4.9);
  });
});
