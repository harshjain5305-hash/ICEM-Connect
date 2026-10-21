import { createClient } from '@supabase/supabase-js';
export type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
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

export const getSupabaseConfig = () => ({
  url: supabaseUrl,
  hasKey: Boolean(supabaseAnonKey),
  isConfigured: isSupabaseConfigured(),
  institutionalDomain: import.meta.env.VITE_INSTITUTION_EMAIL_DOMAIN || 'indiraicem.ac.in',
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
