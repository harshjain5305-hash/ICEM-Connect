import { describe, it, expect } from 'vitest';
import { validateInstitutionalEmail } from './domainValidation';

describe('Institutional Domain Validation (Phase 0)', () => {
  it('should accept valid @indiraicem.ac.in email addresses', () => {
    const validEmails = [
      'rahul.sharma@indiraicem.ac.in',
      'priya.patil@indiraicem.ac.in',
      'student123@indiraicem.ac.in',
      'ADMIN@INDIRAICEM.AC.IN', // Case insensitive
    ];

    validEmails.forEach((email) => {
      const result = validateInstitutionalEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.domain).toBe('indiraicem.ac.in');
      expect(result.error).toBeUndefined();
    });
  });

  it('should strictly reject public email domains', () => {
    const publicEmails = [
      'student@gmail.com',
      'user@yahoo.com',
      'rider@outlook.com',
      'host@hotmail.com',
      'test@icloud.com',
    ];

    publicEmails.forEach((email) => {
      const result = validateInstitutionalEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Only verified @indiraicem.ac.in');
    });
  });

  it('should reject other university or institution domains', () => {
    const otherColleges = [
      'student@mitpune.edu.in',
      'student@coep.ac.in',
      'user@sppu.ac.in',
    ];

    otherColleges.forEach((email) => {
      const result = validateInstitutionalEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Only verified @indiraicem.ac.in');
    });
  });

  it('should reject malformed or empty email values', () => {
    const invalidInputs = ['', '   ', 'not-an-email', 'missingdomain@', '@indiraicem.ac.in'];

    invalidInputs.forEach((input) => {
      const result = validateInstitutionalEmail(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
