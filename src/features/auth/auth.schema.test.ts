import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, profileUpdateSchema } from './auth.schema';

describe('Auth Validation Schemas (Phase 1)', () => {
  it('validates a complete student registration payload', () => {
    const validData = {
      name: 'Rahul Sharma',
      email: 'rahul.sharma@indiraicem.ac.in',
      prn: 'PRN123456',
      department: 'MCA',
      year: 1,
      password: 'SafePassword123!',
      confirmPassword: 'SafePassword123!',
    };

    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects registration with non-institutional email', () => {
    const invalidData = {
      name: 'Rahul Sharma',
      email: 'rahul.sharma@gmail.com',
      prn: 'PRN123456',
      password: 'SafePassword123!',
      confirmPassword: 'SafePassword123!',
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('@indiraicem.ac.in');
    }
  });

  it('rejects registration when PRN is empty or too short', () => {
    const invalidData = {
      name: 'Rahul Sharma',
      email: 'rahul.sharma@indiraicem.ac.in',
      prn: '12',
      password: 'SafePassword123!',
      confirmPassword: 'SafePassword123!',
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rejects registration when passwords do not match', () => {
    const invalidData = {
      name: 'Rahul Sharma',
      email: 'rahul.sharma@indiraicem.ac.in',
      prn: 'PRN123456',
      password: 'SafePassword123!',
      confirmPassword: 'DifferentPassword456!',
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Passwords do not match');
    }
  });

  it('validates login schema correctly', () => {
    const validLogin = {
      email: 'student@indiraicem.ac.in',
      password: 'SecretPassword',
    };
    expect(loginSchema.safeParse(validLogin).success).toBe(true);

    const invalidLogin = {
      email: 'student@gmail.com',
      password: 'SecretPassword',
    };
    expect(loginSchema.safeParse(invalidLogin).success).toBe(false);
  });

  it('validates profile updates and rejects invalid year or photo URL', () => {
    const validUpdate = {
      department: 'Computer Engineering',
      year: 3,
      profile_image_url: 'https://images.example.com/avatar.jpg',
    };
    expect(profileUpdateSchema.safeParse(validUpdate).success).toBe(true);

    const invalidYear = { year: 7 }; // Out of range (1..5)
    expect(profileUpdateSchema.safeParse(invalidYear).success).toBe(false);

    const invalidUrl = { profile_image_url: 'not-a-url' };
    expect(profileUpdateSchema.safeParse(invalidUrl).success).toBe(false);
  });
});
