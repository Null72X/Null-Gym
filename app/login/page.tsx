'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, getCurrentUser, onAuthChange } from '@/lib/authService';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // If already authenticated, redirect
    const user = getCurrentUser();
    if (user) {
      const searchParams = new URLSearchParams(window.location.search);
      const nextUrl = searchParams.get('next') || '/';
      router.replace(nextUrl);
      return;
    }

    // Check for error in query string
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const error = searchParams.get('error');
      if (error) {
        setErrorMessage(decodeURIComponent(error));
      }
    }

    const unsub = onAuthChange((updatedUser) => {
      if (updatedUser) {
        const searchParams = new URLSearchParams(window.location.search);
        const nextUrl = searchParams.get('next') || '/';
        router.replace(nextUrl);
      }
    });

    return () => unsub();
  }, [router]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const searchParams = new URLSearchParams(window.location.search);
      const nextUrl = searchParams.get('next') || '/';

      const { error } = await signInWithGoogle(nextUrl);
      if (error) {
        setErrorMessage(error.message || 'Unable to connect to Google Sign-In. Please check your connection and try again.');
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-wrap">
      <div className="login-card" role="main" aria-labelledby="login-heading">
        <div className="login-brand-icon" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-red)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 5v14" />
            <path d="M18 5v14" />
            <path d="M2 9h4" />
            <path d="M18 9h4" />
            <path d="M2 15h4" />
            <path d="M18 15h4" />
            <path d="M6 12h12" />
          </svg>
        </div>

        <h1 id="login-heading" className="login-title">
          NULL GYM
        </h1>
        <p className="login-subtitle">
          Engineering-grade progressive overload tracking, 1,300+ ExerciseDB library, and cloud synchronization.
        </p>

        {errorMessage && (
          <div className="auth-error-alert" role="alert" tabIndex={0}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>{errorMessage}</div>
          </div>
        )}

        <button
          type="button"
          className="google-auth-btn"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          style={{ marginTop: errorMessage ? '16px' : '8px' }}
          aria-label="Continue with Google"
        >
          {isLoading ? (
            <>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(0, 0, 0, 0.2)',
                  borderTopColor: '#000',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="auth-trust-footer">
          <div className="auth-trust-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Private & Encrypted</span>
          </div>
          <div className="auth-trust-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Instant Sync</span>
          </div>
        </div>
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
