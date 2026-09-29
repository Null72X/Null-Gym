'use client';

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider?: string;
}

type AuthListener = (user: AppUser | null) => void;
const listeners = new Set<AuthListener>();

let currentUser: AppUser | null = null;
let isInitialized = false;

function mapSupabaseUser(user: SupabaseUser | null): AppUser | null {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const name =
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    (user.email ? user.email.split('@')[0] : 'Athlete');
  const avatarUrl = meta.avatar_url || meta.picture || undefined;
  const provider = user.app_metadata?.provider || 'email';

  return {
    id: user.id,
    email: user.email || '',
    name,
    avatarUrl,
    provider,
  };
}

export function getCurrentUser(): AppUser | null {
  return currentUser;
}

export function onAuthChange(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(currentUser);
  return () => {
    listeners.delete(listener);
  };
}

function notifyAuthChange(user: AppUser | null) {
  currentUser = user;
  listeners.forEach((l) => l(user));
}

/**
 * Initialize Supabase Auth listener and restore persisted session
 */
export async function initAuth(): Promise<AppUser | null> {
  if (typeof window === 'undefined' || !isSupabaseConfigured || !supabase) {
    return null;
  }

  if (isInitialized) return currentUser;
  isInitialized = true;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUser = mapSupabaseUser(session.user);
      notifyAuthChange(currentUser);
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = mapSupabaseUser(session?.user || null);
      notifyAuthChange(user);
    });

    return currentUser;
  } catch (err) {
    console.error('[Auth] Failed to initialize session:', err);
    return null;
  }
}

/**
 * Sign In with 1-Tap Google OAuth
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') };
  }

  try {
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    console.error('[Auth] Google sign in error:', err);
    return { error: err };
  }
}

/**
 * Sign In with Magic Link (Passwordless 1-Tap Email Link)
 */
export async function signInWithMagicLink(email: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') };
  }

  try {
    const emailRedirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo,
      },
    });

    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    console.error('[Auth] Magic link error:', err);
    return { error: err };
  }
}

/**
 * Sign In with Email & Password
 */
export async function signInWithPassword(email: string, password: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;
    notifyAuthChange(mapSupabaseUser(data.user));
    return { error: null };
  } catch (err: any) {
    return { error: err };
  }
}

/**
 * Sign Up with Email & Password
 */
export async function signUpWithPassword(email: string, password: string): Promise<{ error: Error | null; user: AppUser | null; hasSession: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.'), user: null, hasSession: false };
  }

  try {
    const emailRedirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) throw error;
    const user = mapSupabaseUser(data.user);
    if (data.session) {
      notifyAuthChange(user);
    }
    return { error: null, user, hasSession: Boolean(data.session) };
  } catch (err: any) {
    return { error: err, user: null, hasSession: false };
  }
}

/**
 * Resend email confirmation
 */
export async function resendConfirmationEmail(email: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') };
  }
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    return { error: err };
  }
}

/**
 * Sign Out
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    notifyAuthChange(null);
    return { error: null };
  }

  try {
    await supabase.auth.signOut();
    notifyAuthChange(null);
    return { error: null };
  } catch (err: any) {
    notifyAuthChange(null);
    return { error: err };
  }
}
