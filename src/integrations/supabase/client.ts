import { createClient } from '@supabase/supabase-js';
export type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  // During automated unit testing, use deterministic local storage to avoid remote email rate-limiting
  if (import.meta.env.MODE === 'test') {
    return false;
  }
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (
    supabaseUrl.includes('placeholder-project') ||
    supabaseAnonKey.includes('placeholder-anon-key') ||
    supabaseUrl.includes('your-project')
  ) {
    return false;
  }
  return true;
};

export const CANONICAL_SITE_URL = 'https://icem-connect.vercel.app/';

/**
 * Returns the canonical redirect URL for Supabase Auth flows
 * (email confirmation links, password reset links, and recovery).
 * Strictly defaults to production (https://icem-connect.vercel.app/) to eliminate
 * unwanted local (localhost:3000) redirects in student verification emails.
 */
export const getAuthRedirectUrl = (): string => {
  const envUrl = import.meta.env.VITE_SITE_URL || import.meta.env.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const trimmed = envUrl.trim();
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }
  return CANONICAL_SITE_URL;
};

export const getSupabaseConfig = () => ({
  url: supabaseUrl,
  hasKey: Boolean(supabaseAnonKey),
  isConfigured: isSupabaseConfigured(),
  institutionalDomain: import.meta.env.VITE_INSTITUTION_EMAIL_DOMAIN || 'indiraicem.ac.in',
  siteUrl: getAuthRedirectUrl(),
});

// Provide a stable client instance
// If placeholder is in use, createClient still initializes without crashing Vite,
// allowing offline/mock verification and health reporting.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
