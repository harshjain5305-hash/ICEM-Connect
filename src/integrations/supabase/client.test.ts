import { describe, it, expect } from 'vitest';
import { getAuthRedirectUrl, CANONICAL_SITE_URL, getSupabaseConfig } from './client';

describe('Supabase Client & Auth Redirect Configuration', () => {
  it('strictly defaults redirect URL to canonical production Vercel app', () => {
    const url = getAuthRedirectUrl();
    expect(url).toBe(CANONICAL_SITE_URL);
    expect(url).toBe('https://icem-connect.vercel.app/');
    expect(url).not.toContain('localhost');
  });

  it('includes canonical siteUrl in getSupabaseConfig output', () => {
    const config = getSupabaseConfig();
    expect(config.siteUrl).toBe('https://icem-connect.vercel.app/');
    expect(config.institutionalDomain).toBe('indiraicem.ac.in');
  });
});
