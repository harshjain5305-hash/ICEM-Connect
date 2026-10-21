import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from './auth.service';

describe('Auth Service Lifecycle & Roles (Phase 1)', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('registers a new student with private PRN and STUDENT role', async () => {
    const input = {
      name: 'Aditi Deshmukh',
      email: 'aditi.deshmukh@indiraicem.ac.in',
      prn: 'PRN_ADITI_99',
      department: 'Computer Engineering',
      year: 2,
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    };

    const result = await authService.register(input);

    expect(result.user.email).toBe('aditi.deshmukh@indiraicem.ac.in');
    expect(result.profile.prn).toBe('PRN_ADITI_99');
    expect(result.roles).toContain('STUDENT');
    expect(result.roles).not.toContain('ADMIN');
  });

  it('rejects duplicate registration for the same institutional email', async () => {
    const input = {
      name: 'Pooja Patil',
      email: 'pooja.patil@indiraicem.ac.in',
      prn: 'PRN_POOJA_01',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    };

    await authService.register(input);

    await expect(authService.register(input)).rejects.toThrow(/already exists/i);
  });

  it('supports login, session restoration, and logout', async () => {
    const input = {
      name: 'Amit Kulkarni',
      email: 'amit.kulkarni@indiraicem.ac.in',
      prn: 'PRN_AMIT_42',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    };

    await authService.register(input);

    const loginResult = await authService.login({
      email: input.email,
      password: input.password,
    });
    expect(loginResult.user.email).toBe(input.email);

    const session = await authService.getCurrentSession();
    expect(session).not.toBeNull();
    expect(session?.user.email).toBe(input.email);

    await authService.logout();
    const sessionAfterLogout = await authService.getCurrentSession();
    expect(sessionAfterLogout).toBeNull();
  });

  it('allows student to update department and year', async () => {
    const input = {
      name: 'Rohan Joshi',
      email: 'rohan.joshi@indiraicem.ac.in',
      prn: 'PRN_ROHAN_88',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    };

    const reg = await authService.register(input);
    const updated = await authService.updateProfile(reg.user.id, {
      department: 'Mechanical Engineering',
      year: 4,
    });

    expect(updated.department).toBe('Mechanical Engineering');
    expect(updated.year).toBe(4);
    expect(updated.prn).toBe('PRN_ROHAN_88'); // Preserved unchanged
  });

  it('enforces that admin endpoints reject ordinary students', async () => {
    const studentInput = {
      name: 'Normal Student',
      email: 'student.ordinary@indiraicem.ac.in',
      prn: 'PRN_STUDENT_01',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    };

    const reg = await authService.register(studentInput);

    // Ordinary student attempts to fetch admin student list
    await expect(authService.getStudentsForAdmin(reg.user.id)).rejects.toThrow(
      /Forbidden: Admin privilege required/i
    );

    // Ordinary student attempts to update another student's status
    await expect(
      authService.updateStudentStatus(reg.user.id, 'some_other_id', 'SUSPENDED')
    ).rejects.toThrow(/Forbidden: Admin privilege required/i);
  });
});
