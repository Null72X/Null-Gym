'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { initAuth } from '@/lib/authService';
import { forcePullAllFromCloud } from '@/lib/storage';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState('Verifying your sign in...');
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    async function processAuthCallback() {
      if (!isSupabaseConfigured || !supabase) {
        router.replace('/login');
        return;
      }

      let nextUrl = '/';

      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        nextUrl = searchParams.get('next') || '/';

        // Check for error in query or hash
        const queryError = searchParams.get('error_description') || searchParams.get('error');
        if (queryError) {
          console.error('[Auth Callback] OAuth query error:', queryError);
          router.replace(`/login?error=${encodeURIComponent(queryError)}`);
          return;
        }

        // Also check hash for error parameters (implicit flow)
        if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const hashError = hashParams.get('error_description') || hashParams.get('error');
          if (hashError) {
            console.error('[Auth Callback] OAuth hash error:', hashError);
            router.replace(`/login?error=${encodeURIComponent(hashError)}`);
            return;
          }
        }

        // PKCE Code Exchange
        const code = searchParams.get('code');
        if (code) {
          try {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              console.warn('[Auth Callback] Code exchange warning:', exchangeError.message);
            }
          } catch (err) {
            console.warn('[Auth Callback] Code exchange caught error:', err);
          }
        }
      }

      try {
        setStatusMessage('Syncing your account...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[Auth Callback] Session retrieval error:', sessionError);
        }

        if (session?.user) {
          await initAuth();
          setStatusMessage('Synchronizing workouts...');
          try {
            await forcePullAllFromCloud();
          } catch (e) {
            console.warn('[Auth Callback] Cloud pull notice:', e);
          }
          router.replace(nextUrl);
          return;
        }

        // If session not immediately available (e.g. hash processing in progress), wait for onAuthStateChange
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (newSession?.user) {
            subscription.unsubscribe();
            await initAuth();
            try {
              await forcePullAllFromCloud();
            } catch (e) {}
            router.replace(nextUrl);
          }
        });

        // Fail-safe redirect after 2.5s
        const timer = setTimeout(() => {
          subscription.unsubscribe();
          router.replace(nextUrl);
        }, 2500);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      } catch (err: any) {
        console.error('[Auth Callback] Exception:', err);
        const errMsg = err?.message || 'Failed to complete sign in.';
        setError(errMsg);
        setTimeout(() => {
          router.replace(`/login?error=${encodeURIComponent(errMsg)}`);
        }, 1500);
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
