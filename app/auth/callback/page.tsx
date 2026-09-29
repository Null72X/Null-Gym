'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { initAuth } from '@/lib/authService';
import { forcePullAllFromCloud } from '@/lib/storage';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState('Verifying your sign in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuth() {
      if (!isSupabaseConfigured || !supabase) {
        router.replace('/');
        return;
      }

      try {
        setStatusMessage('Syncing your account...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          await initAuth();
          setStatusMessage('Synchronizing workouts...');
          await forcePullAllFromCloud().catch(() => {});
          router.replace('/');
          return;
        }

        // Wait a short moment in case hash fragment is processing
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (newSession) {
            await initAuth();
            await forcePullAllFromCloud().catch(() => {});
            router.replace('/');
          }
        });

        setTimeout(() => {
          router.replace('/');
        }, 3000);

        return () => {
          authListener?.subscription?.unsubscribe();
        };
      } catch (err: any) {
        console.error('[Auth Callback] Error:', err);
        setError(err?.message || 'Failed to complete sign in.');
        setTimeout(() => {
          router.replace('/');
        }, 2500);
      }
    }

    handleAuth();
  }, [router]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '75vh',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '36px 28px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '3px solid rgba(239, 68, 68, 0.2)',
              borderTopColor: 'var(--accent-red)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
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

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
