/**
 * Institutional Email Domain Validation Service
 * Enforces the strict @indiraicem.ac.in domain requirement according to
 * PRD.md §1.1, Architecture.md §5, and Phases.md §4.
 */

export const INSTITUTIONAL_DOMAIN = 
  import.meta.env.VITE_INSTITUTION_EMAIL_DOMAIN || 'indiraicem.ac.in';

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  domain?: string;
}

/**
 * Validates whether an email address strictly belongs to the ICEM institutional domain.
 * Rejects public domains (gmail.com, yahoo.com, outlook.com, etc.) and non-matching formats.
 */
export function validateInstitutionalEmail(
  email: string,
  allowedDomain: string = INSTITUTIONAL_DOMAIN
): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      error: 'Email address is required.',
    };
  }

  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalized)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address.',
    };
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return {
      isValid: false,
      error: 'Malformed email address.',
    };
  }

  const domain = parts[1];
  const targetDomain = allowedDomain.toLowerCase().replace(/^@/, '');

  if (domain !== targetDomain) {
    return {
      isValid: false,
      domain,
      error: `Only verified @${targetDomain} institutional email addresses are permitted.`,
    };
  }

  return {
    isValid: true,
    domain,
  };
}
