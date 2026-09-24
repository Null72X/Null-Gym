'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Smartphone,
  Laptop,
  Check,
  Copy,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { createDeviceSyncCode, redeemDeviceSyncCode } from '../lib/storage';

interface DeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (message: string) => void;
}

export default function DeviceSyncModal({
  isOpen,
  onClose,
  onSyncComplete,
}: DeviceSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [syncUrl, setSyncUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [inputCode, setInputCode] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generate QR Code and 6-digit sync token when modal opens in "send" mode
  useEffect(() => {
    if (!isOpen || activeTab !== 'send') return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    const generateCode = async () => {
      try {
        const result = await createDeviceSyncCode();
        if (!isMounted) return;

        if (result.success && result.code) {
          setSyncCode(result.code);
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const url = `${origin}/?sync=${result.code}`;
          setSyncUrl(url);

          // Generate high-contrast crisp QR code
          const qr = await QRCode.toDataURL(url, {
            width: 260,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
          if (isMounted) setQrDataUrl(qr);
        } else {
          if (isMounted) setErrorMessage(result.error || 'Failed to generate sync code.');
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage(err?.message || 'Error creating sync token.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    generateCode();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!syncUrl) return;
    navigator.clipboard.writeText(syncUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyCode = () => {
    if (!syncCode) return;
    navigator.clipboard.writeText(syncCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRedeemCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputCode.trim().replace(/\s+/g, '');
    if (!clean) {
      setErrorMessage('Please enter a 6-digit sync code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await redeemDeviceSyncCode(clean);
      if (res.success) {
        setSuccessMessage('🎉 Workouts successfully synced!');
        if (onSyncComplete) onSyncComplete('Workouts successfully synced to this device!');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Invalid or expired code. Generate a fresh code on your PC.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sync redemption failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="clean-modal-backdrop" onClick={onClose}>
      <div
        className="clean-modal"
        style={{ maxWidth: '440px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="clean-modal-header" style={{ paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-red)',
              }}
            >
              <Smartphone size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>Sync PC &amp; Phone</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Transfer workouts, 6-week plan &amp; history in 1 tap
              </div>
            </div>
          </div>

          <button
            type="button"
            className="icon-action-btn"
            onClick={onClose}
            style={{ width: '28px', height: '28px' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '4px',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('send')}
            style={{
              padding: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'send' ? 'var(--accent-red)' : 'transparent',
              color: activeTab === 'send' ? '#ffffff' : 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Laptop size={14} />
            <span>Send to Phone</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receive')}
            style={{
              padding: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'receive' ? 'var(--accent-red)' : 'transparent',
              color: activeTab === 'receive' ? '#ffffff' : 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={14} />
            <span>Receive on Phone</span>
          </button>
        </div>

        {/* TAB 1: SEND TO PHONE (QR CODE) */}
        {activeTab === 'send' && (
          <div style={{ textAlign: 'center' }}>
            {isLoading ? (
              <div style={{ padding: '36px 0' }}>
                <RefreshCw size={28} className="spin" color="var(--accent-red)" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>
                  Generating encrypted sync code...
                </div>
              </div>
            ) : qrDataUrl ? (
              <div>
                {/* QR Code Container */}
                <div
                  style={{
                    background: '#ffffff',
                    padding: '12px',
                    borderRadius: '12px',
                    display: 'inline-block',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    marginBottom: '14px',
                  }}
                >
                  <img
                    src={qrDataUrl}
                    alt="Scan with phone camera to sync"
                    style={{ width: '180px', height: '180px', display: 'block' }}
                  />
                </div>

                {/* 6-Digit PIN Display */}
                {syncCode && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.70rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      OR ENTER THIS 6-DIGIT CODE ON YOUR PHONE
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '6px 14px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.4rem',
                          fontWeight: 900,
                          letterSpacing: '4px',
                          color: '#fff',
                        }}
                      >
                        {syncCode.slice(0, 3)} {syncCode.slice(3)}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="btn-clean btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.68rem' }}
                        title="Copy code"
                      >
                        {isCopied ? <Check size={12} color="var(--accent-green)" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Direct Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn-clean btn-sm"
                    style={{ fontSize: '0.72rem', padding: '6px 12px' }}
                    onClick={handleCopyLink}
                  >
                    {isCopied ? <Check size={13} color="var(--accent-green)" /> : <Copy size={13} />}
                    <span>{isCopied ? 'Link Copied!' : 'Copy Direct Link'}</span>
                  </button>
                </div>

                <div
                  style={{
                    marginTop: '16px',
                    fontSize: '0.72rem',
                    color: 'var(--text-dim)',
                    lineHeight: 1.5,
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    paddingTop: '12px',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    📱 Quick 2-Step Instructions:
                  </div>
                  <div>1. Open your phone camera and point it at this QR code.</div>
                  <div>2. Tap the notification banner to instantly open and sync your plan!</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 0', color: 'var(--accent-red)' }}>
                {errorMessage || 'Failed to initialize QR sync.'}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RECEIVE ON PHONE (PIN INPUT) */}
        {activeTab === 'receive' && (
          <form onSubmit={handleRedeemCode}>
            <div style={{ marginBottom: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Enter the 6-digit sync code displayed on your PC:
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.replace(/\D/g, ''));
                  setErrorMessage(null);
                }}
                placeholder="• • • • • •"
                style={{
                  width: '100%',
                  maxWidth: '220px',
                  padding: '10px 14px',
                  fontSize: '1.5rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  outline: 'none',
                  margin: '0 auto',
                  display: 'block',
                }}
                autoFocus
              />
            </div>

            {errorMessage && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  marginBottom: '12px',
                  textAlign: 'center',
                }}
              >
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#86efac',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  marginBottom: '12px',
                  textAlign: 'center',
                }}
              >
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || inputCode.length < 6}
              className="btn-clean btn-primary"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '0.84rem',
                justifyContent: 'center',
                opacity: inputCode.length < 6 ? 0.6 : 1,
              }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Syncing Workouts...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Import &amp; Apply Plan</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
