import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ftssrejkpjyrzkgkkfnz.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_qujr9bzTWdjzezfoBAY7ZA_XUX9sAGs';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Public / client-side Supabase client (anon or publishable key)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Server-side Supabase client (uses SUPABASE_SERVICE_ROLE_KEY if present to bypass RLS, otherwise fallback to standard client)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseServer = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : supabase;

