'use client';

import React, { useState } from 'react';
import { X, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { signInWithGoogle, signInWithMagicLink, signInWithPassword, signUpWithPassword } from '../lib/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'magic' | 'password'>('magic');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    const { error } = await signInWithGoogle();
    if (error) {
      const msg = error.message || '';
      if (msg.includes('provider is not enabled') || msg.includes('validation_failed') || msg.includes('Unsupported provider')) {
        setErrorMessage('google_not_enabled');
      } else {
        setErrorMessage(error.message || 'Google sign-in failed.');
      }
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMessage(null);
    const { error } = await signInWithMagicLink(email);
    setLoading(false);

    if (error) {
      setErrorMessage(error.message || 'Failed to send magic link.');
    } else {
      setMagicLinkSent(true);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMessage(null);

    if (isSignUp) {
      const { error, user } = await signUpWithPassword(email, password);
      setLoading(false);
      if (error) {
        setErrorMessage(error.message || 'Failed to create account.');
      } else {
        if (user) {
          onSuccess?.();
          onClose();
        } else {
          setErrorMessage('Account created! Please check your email to confirm.');
        }
      }
    } else {
      const { error } = await signInWithPassword(email, password);
      setLoading(false);
      if (error) {
        setErrorMessage(error.message || 'Invalid email or password.');
      } else {
        onSuccess?.();
        onClose();
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0d111a',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '420px',
          padding: '28px 24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Sparkles size={20} color="var(--accent-red)" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
            Sync Across All Devices
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            Sign in to unlock private multi-device cloud synchronization.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '16px',
              fontSize: '0.74rem',
              color: '#fca5a5',
              lineHeight: 1.5,
            }}
          >
            {errorMessage === 'google_not_enabled' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '4px' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, color: '#f87171' }} />
                  <span>Google Sign-In is not enabled in Supabase yet</span>
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.72rem', marginBottom: '8px' }}>
                  To enable Google 1-Tap, turn on Google in your Supabase Auth Providers.
                  <br />
                  💡 <strong>Tip:</strong> You can use <strong>1-Tap Magic Link</strong> or <strong>Email &amp; Password</strong> below right now!
                </div>
                <a
                  href="https://supabase.com/dashboard/project/ftssrejkpjyrzkgkkfnz/auth/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#7dd3fc',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  Enable Google in Supabase Dashboard ↗
                </a>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* 1-Tap Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#ffffff',
            color: '#1f2937',
            border: 'none',
            borderRadius: '12px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            marginBottom: '18px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.94 0 12s.45 3.84 1.24 5.42l4.04-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            or with email
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '10px',
            padding: '3px',
            marginBottom: '16px',
          }}
        >
          <button
            type="button"
            onClick={() => { setTab('magic'); setMagicLinkSent(false); }}
            style={{
              flex: 1,
              padding: '7px',
              background: tab === 'magic' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              color: tab === 'magic' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            1-Tap Magic Link
          </button>
          <button
            type="button"
            onClick={() => { setTab('password'); setMagicLinkSent(false); }}
            style={{
              flex: 1,
              padding: '7px',
              background: tab === 'password' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              color: tab === 'password' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Email & Password
          </button>
        </div>

        {/* Tab 1: Magic Link */}
        {tab === 'magic' && (
          magicLinkSent ? (
            <div
              style={{
                textAlign: 'center',
                padding: '16px 8px',
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '12px',
              }}
            >
              <CheckCircle2 size={32} color="#86efac" style={{ margin: '0 auto 8px' }} />
              <h4 style={{ color: '#86efac', margin: '0 0 4px', fontSize: '0.9rem' }}>Check your email!</h4>
              <p style={{ color: '#cbd5e1', fontSize: '0.76rem', margin: 0, lineHeight: 1.5 }}>
                We sent a 1-tap sign-in link to <strong>{email}</strong>. Click the link in your email to sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="btn-clean btn-primary"
                style={{ width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>{loading ? 'Sending link...' : 'Send 1-Tap Sign-In Link'}</span>
                <ArrowRight size={15} />
              </button>
            </form>
          )
        )}

        {/* Tab 2: Email & Password */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordAuth}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-clean btn-primary"
              style={{ width: '100%', padding: '11px', marginBottom: '12px' }}
            >
              <span>{loading ? 'Processing...' : isSignUp ? 'Create Free Account' : 'Sign In'}</span>
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-red)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        )}

        {/* Footer: Offline mode option */}
        <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
          >
            Continue as Guest (Offline Local Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
