'use client';

import React, { useState } from 'react';
import { X, Mail, Lock, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck, Dumbbell } from 'lucide-react';
import { signInWithPassword, signUpWithPassword, resendConfirmationEmail, ADMIN_EMAIL } from '../lib/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTabSwitch = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (!confirmPassword) {
        setErrorMessage('Please verify your password in the confirmation field.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match! Please make sure both password fields match.');
        return;
      }

      setLoading(true);
      const { error, user, hasSession } = await signUpWithPassword(cleanEmail, password);
      setLoading(false);

      if (error) {
        setErrorMessage(error.message || 'Failed to create account.');
      } else {
        if (hasSession) {
          setSuccessMessage('Account created successfully! Synchronizing workouts...');
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 1000);
        } else {
          setErrorMessage('email_not_confirmed');
        }
      }
    } else {
      // Mode: login
      setLoading(true);
      const { error } = await signInWithPassword(cleanEmail, password);
      setLoading(false);

      if (error) {
        const msg = error.message || '';
        if (msg.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('email_not_confirmed');
        } else if (msg.toLowerCase().includes('invalid login credentials')) {
          setErrorMessage('Invalid email or password. If you do not have an account yet, click "Create Account".');
        } else {
          setErrorMessage(error.message || 'Failed to sign in.');
        }
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
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
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
          maxWidth: '430px',
          padding: '28px 24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
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
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Dumbbell size={22} color="var(--accent-red)" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
            Null Gym Cloud
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            {mode === 'login'
              ? 'Log in to sync your workouts across all your devices.'
              : 'Create an account with any email & password to start private syncing.'}
          </p>
        </div>

        {/* Two-Section Tab Selector: Log In vs Create Account */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '18px',
          }}
        >
          <button
            type="button"
            onClick={() => handleTabSwitch('login')}
            style={{
              flex: 1,
              padding: '9px 12px',
              background: mode === 'login' ? 'var(--accent-red)' : 'transparent',
              color: mode === 'login' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '9px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('signup')}
            style={{
              flex: 1,
              padding: '9px 12px',
              background: mode === 'signup' ? 'var(--accent-red)' : 'transparent',
              color: mode === 'signup' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '9px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '0.74rem',
              color: '#fca5a5',
              lineHeight: 1.5,
            }}
          >
            {errorMessage === 'email_not_confirmed' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#f87171', marginBottom: '4px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>Email Confirmation Required</span>
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.72rem', marginBottom: '8px', lineHeight: 1.5 }}>
                  A confirmation email has been sent to <strong>{email || 'your email'}</strong>. Please check your inbox and spam folder, then tap the link to verify your account.
                  {email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
                    <div style={{ marginTop: '6px', color: '#93c5fd' }}>
                      🛡️ <strong>Admin Tip:</strong> You can turn OFF &quot;Confirm email&quot; in Supabase to allow instant logins with any email.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {email && (
                    <button
                      type="button"
                      onClick={async () => {
                        setResendLoading(true);
                        const { error } = await resendConfirmationEmail(email);
                        setResendLoading(false);
                        if (!error) {
                          setSuccessMessage(`Confirmation email resent to ${email}! Please check your inbox or spam.`);
                          setErrorMessage(null);
                        } else {
                          setErrorMessage(error.message);
                        }
                      }}
                      disabled={resendLoading}
                      style={{
                        background: 'rgba(255, 255, 255, 0.12)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {resendLoading ? 'Sending...' : 'Resend Confirmation Email'}
                    </button>
                  )}
                  {email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
                    <a
                      href="https://supabase.com/dashboard/project/ftssrejkpjyrzkgkkfnz/auth/providers"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#7dd3fc',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      Supabase Auth Settings ↗
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, color: '#f87171' }} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Success Alert Box */}
        {successMessage && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '16px',
              fontSize: '0.74rem',
              color: '#86efac',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: 1.4,
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#86efac' }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Main Authentication Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 38px',
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

          {/* Password Field */}
          <div style={{ marginBottom: mode === 'signup' ? '14px' : '20px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 38px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field (Only in Create Account mode) */}
          {mode === 'signup' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                Verify Password (Confirm)
              </label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck
                  size={16}
                  color={confirmPassword && password === confirmPassword ? '#86efac' : 'var(--text-muted)'}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 38px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${
                      confirmPassword
                        ? password === confirmPassword
                          ? 'rgba(34, 197, 94, 0.45)'
                          : 'rgba(239, 68, 68, 0.45)'
                        : 'rgba(255, 255, 255, 0.12)'
                    }`,
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div style={{ fontSize: '0.68rem', color: '#fca5a5', marginTop: '4px' }}>
                  Passwords do not match yet
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email || !password || (mode === 'signup' && !confirmPassword)}
            className="btn-clean btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.86rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <span>{loading ? 'Please wait...' : mode === 'login' ? 'Log In to Account' : 'Create Account & Sync'}</span>
            <ArrowRight size={16} />
          </button>

          {/* Switch Tab Prompt */}
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => handleTabSwitch(mode === 'login' ? 'signup' : 'login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-red)',
                fontSize: '0.76rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {mode === 'login'
                ? "Don't have an account? Create one"
                : 'Already have an account? Log in'}
            </button>
          </div>
        </form>

        {/* Footer: Offline Guest Mode */}
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
