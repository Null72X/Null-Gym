'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import {
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  resendConfirmationEmail,
  getCurrentUser,
  onAuthChange,
} from '@/lib/authService';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    // If already authenticated, redirect immediately
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

  const handleTabChange = (newTab: 'login' | 'signup') => {
    setTab(newTab);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowResend(false);
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowResend(false);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMessage('Please fill in your email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (tab === 'signup') {
      // Verify password two times
      if (!confirmPassword) {
        setErrorMessage('Please confirm your password in the second field.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please verify both password fields.');
        return;
      }

      setIsLoading(true);
      try {
        const result = await signUpWithPassword(cleanEmail, password);
        if (result.error) {
          setErrorMessage(result.error.message || 'Unable to create account. Please try again.');
        } else if (result.hasSession) {
          // Auto logged in
          const searchParams = new URLSearchParams(window.location.search);
          const nextUrl = searchParams.get('next') || '/';
          router.replace(nextUrl);
        } else {
          // Requires email confirmation
          setSuccessMessage(
            'Account created successfully! Please check your email inbox to confirm your account, then log in.'
          );
          setShowResend(true);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'An unexpected error occurred during signup.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Log In
      setIsLoading(true);
      try {
        const result = await signInWithPassword(cleanEmail, password);
        if (result.error) {
          const msg = result.error.message || 'Invalid email or password.';
          if (msg.toLowerCase().includes('email not confirmed')) {
            setErrorMessage('Your email address has not been confirmed yet.');
            setShowResend(true);
          } else {
            setErrorMessage(msg);
          }
        } else {
          const searchParams = new URLSearchParams(window.location.search);
          const nextUrl = searchParams.get('next') || '/';
          router.replace(nextUrl);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'An unexpected error occurred during login.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address to resend confirmation.');
      return;
    }
    setIsResending(true);
    try {
      const res = await resendConfirmationEmail(cleanEmail);
      if (res.error) {
        setErrorMessage(res.error.message || 'Failed to resend confirmation email.');
      } else {
        setSuccessMessage('A fresh confirmation link has been sent to your email.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend confirmation email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setErrorMessage(null);

      const searchParams = new URLSearchParams(window.location.search);
      const nextUrl = searchParams.get('next') || '/';

      const { error } = await signInWithGoogle(nextUrl);
      if (error) {
        setErrorMessage(
          error.message ||
            'Google Sign-In is not currently enabled on your Supabase project. You can log in or create an account with any Email and Password above.'
        );
        setIsGoogleLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try using email and password.');
      setIsGoogleLoading(false);
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
          Engineering-grade progressive overload tracking, 1,300+ exercise library, and cloud synchronization.
        </p>

        {/* Auth Mode Tabs (Log In vs Create Account) */}
        <div className="auth-tabs" role="tablist" aria-label="Authentication Options">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
          >
            Log In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signup'}
            className={`auth-tab-btn ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => handleTabChange('signup')}
          >
            Create Account
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="auth-error-alert" role="alert" tabIndex={0}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="auth-success-alert" role="status" tabIndex={0}>
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{successMessage}</div>
          </div>
        )}

        {showResend && (
          <button
            type="button"
            className="btn-clean btn-sm"
            onClick={handleResendConfirmation}
            disabled={isResending}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.76rem',
              color: 'var(--accent-red)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
            }}
          >
            <RefreshCw size={12} className={isResending ? 'spin' : ''} />
            <span>{isResending ? 'Sending link...' : 'Resend Confirmation Email'}</span>
          </button>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuthSubmit} className="auth-form" style={{ marginTop: '14px' }}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">
              Email Address
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <Mail size={16} />
              </span>
              <input
                id="auth-email"
                type="email"
                className="auth-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">
              Password
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <Lock size={16} />
              </span>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder={tab === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Required on Create Account - verifies password 2 times) */}
          {tab === 'signup' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-confirm-password">
                Verify Password
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Re-enter password to verify"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading || isGoogleLoading}
            aria-label={tab === 'login' ? 'Log In' : 'Create Account'}
          >
            {isLoading ? (
              <>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span>{tab === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{tab === 'login' ? 'Log In' : 'Create Account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Continue with Google Button */}
        <button
          type="button"
          className="google-auth-btn"
          onClick={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
          aria-label="Continue with Google"
        >
          {isGoogleLoading ? (
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

        {/* Trust Badges */}
        <div className="auth-trust-footer">
          <div className="auth-trust-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>End-to-End Encrypted</span>
          </div>
          <div className="auth-trust-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>Cloud Synced</span>
          </div>
        </div>
      </div>
    </div>
  );
}
