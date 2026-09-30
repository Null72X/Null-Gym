'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { initAuth, getCurrentUser } from '@/lib/authService';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState('Verifying your sign in...');
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    async function processAuthCallback() {
      let nextUrl = '/';

      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        nextUrl = searchParams.get('next') || '/';

        // Check for error in query or hash
        const queryError = searchParams.get('error_description') || searchParams.get('error');
        if (queryError) {
          console.error('[Auth Callback] OAuth query error:', queryError);
          window.location.replace(`/login?error=${encodeURIComponent(queryError)}`);
          return;
        }

        if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const hashError = hashParams.get('error_description') || hashParams.get('error');
          if (hashError) {
            console.error('[Auth Callback] OAuth hash error:', hashError);
            window.location.replace(`/login?error=${encodeURIComponent(hashError)}`);
            return;
          }
        }
      }

      // Check if user is already authenticated
      const existingUser = getCurrentUser();
      if (existingUser) {
        window.location.replace(nextUrl || '/');
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        window.location.replace('/login');
        return;
      }

      // Handle PKCE code if present
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
          } catch (e) {
            console.warn('[Auth Callback] Exchange warning:', e);
          }
        }
      }

      try {
        setStatusMessage('Syncing your account...');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          await initAuth();
          window.location.replace(nextUrl || '/');
          return;
        }

        // Listen for delayed token processing
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (newSession?.user) {
            subscription.unsubscribe();
            await initAuth();
            window.location.replace(nextUrl || '/');
          }
        });

        // Fail-safe redirect after 1.5s
        const timer = setTimeout(() => {
          subscription.unsubscribe();
          window.location.replace(nextUrl || '/');
        }, 1500);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      } catch (err: any) {
        console.error('[Auth Callback] Exception:', err);
        const errMsg = err?.message || 'Failed to complete sign in.';
        setError(errMsg);
        setTimeout(() => {
          window.location.replace(`/login?error=${encodeURIComponent(errMsg)}`);
        }, 1200);
      }
    }

    processAuthCallback();
  }, [router]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '36px 28px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
          }}
        >
          <div
            className="auth-spinner"
            style={{
              width: '24px',
              height: '24px',
              borderWidth: '3px',
            }}
          />
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: '#fff' }}>
          Null Gym Cloud Sync
        </h2>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          {error ? <span style={{ color: '#fca5a5' }}>{error}</span> : statusMessage}
        </p>
      </div>
    </div>
  );
}
