'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Pause,
  Play,
  X,
  Plus,
  Minus,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Check,
  Zap,
} from 'lucide-react';

interface RestTimerBarProps {
  initialSeconds: number | null;
  onDismiss: () => void;
}

export default function RestTimerBar({ initialSeconds, onDismiss }: RestTimerBarProps) {
  const [totalSeconds, setTotalSeconds] = useState<number>(90);
  const [seconds, setSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const intervalRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);

  // Setup / Reset timer when initialSeconds changes
  useEffect(() => {
    if (initialSeconds !== null && initialSeconds > 0) {
      setTotalSeconds(initialSeconds);
      setSeconds(initialSeconds);
      setIsRunning(true);
      setIsFinished(false);
      setIsExpanded(true);
    }
  }, [initialSeconds]);

  // Audio tone generator using Web Audio API
  const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Play short soft tick tone for 3, 2, 1
  const playTick = () => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  };

  // Play double celebration chime when rest is complete
  const playChime = () => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Note 1: E5 (659Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: A5 (880Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.18);
      gain2.gain.setValueAtTime(0.4, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);
    } catch {}
  };

  // Main timer tick effect
  useEffect(() => {
    if (!isRunning || seconds <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsFinished(true);
          setIsRunning(false);
          playChime();
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([100, 60, 100, 60, 250]);
          }
          return 0;
        }

        // Countdown tick sounds on 3, 2, 1
        if (prev === 4 || prev === 3 || prev === 2) {
          playTick();
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds, isMuted]);

  // Actions
  const adjustSeconds = (delta: number) => {
    setSeconds((prev) => {
      const next = Math.max(5, prev + delta);
      setTotalSeconds((t) => Math.max(next, t));
      return next;
    });
    setIsFinished(false);
  };

  const setPreset = (presetSecs: number) => {
    setTotalSeconds(presetSecs);
    setSeconds(presetSecs);
    setIsRunning(true);
    setIsFinished(false);
  };

  const restartTimer = () => {
    setSeconds(totalSeconds);
    setIsRunning(true);
    setIsFinished(false);
  };

  const togglePause = () => {
    setIsRunning((prev) => !prev);
  };

  if (initialSeconds === null) return null;

  // Format MM:SS
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  // SVG circular progress calculation
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = totalSeconds > 0 ? Math.max(0, Math.min(1, seconds / totalSeconds)) : 0;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const getRingColor = () => {
    if (isFinished) return 'var(--accent-green)';
    if (seconds <= 10) return 'var(--accent-amber)';
    return 'var(--accent-red)';
  };

  return (
    <div
      className={`floating-rest-bar ${initialSeconds !== null ? 'active' : ''}`}
      style={{
        position: 'fixed',
        bottom: '68px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '480px',
        background: 'rgba(14, 14, 20, 0.96)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${isFinished ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.4)'}`,
        boxShadow: isFinished
          ? '0 8px 30px rgba(34, 197, 94, 0.25)'
          : '0 8px 30px rgba(0, 0, 0, 0.7)',
        borderRadius: '14px',
        padding: isExpanded ? '10px 14px' : '8px 12px',
        zIndex: 900,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Top Main Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        {/* Left Side: Circular Ring + Time */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {/* Animated SVG Progress Ring */}
          <div style={{ position: 'relative', width: '46px', height: '46px' }}>
            <svg width="46" height="46" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background Track */}
              <circle
                cx="23"
                cy="23"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="4"
              />
              {/* Animated Progress Ring */}
              <circle
                cx="23"
                cy="23"
                r={radius}
                fill="none"
                stroke={getRingColor()}
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.3s ease' }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
              }}
            >
              {isFinished ? (
                <Check size={16} color="var(--accent-green)" />
              ) : isRunning ? (
                <Zap size={14} color={getRingColor()} />
              ) : (
                <Pause size={13} color="var(--accent-amber)" />
              )}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: isFinished ? 'var(--accent-green)' : seconds <= 10 ? 'var(--accent-amber)' : 'var(--text-dim)',
              }}
            >
              {isFinished ? '🎉 READY TO LIFT!' : isRunning ? 'Rest Timer' : 'Paused'}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.25rem',
                fontWeight: 800,
                lineHeight: 1.1,
                color: isFinished ? 'var(--accent-green)' : '#ffffff',
                letterSpacing: '-0.5px',
              }}
            >
              {isFinished ? '00:00' : timeFormatted}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="timer-action-btn"
            onClick={() => adjustSeconds(-15)}
            title="Subtract 15 seconds"
          >
            -15s
          </button>

          <button
            type="button"
            className="timer-action-btn"
            onClick={() => adjustSeconds(15)}
            title="Add 15 seconds"
          >
            +15s
          </button>

          <button
            type="button"
            className="timer-action-btn"
            style={{
              background: isRunning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              borderColor: isRunning ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
              color: isRunning ? '#fca5a5' : '#86efac',
            }}
            onClick={togglePause}
            title={isRunning ? 'Pause' : 'Resume'}
          >
            {isRunning ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            type="button"
            className="timer-action-btn"
            onClick={restartTimer}
            title="Restart timer"
          >
            <RotateCcw size={13} />
          </button>

          <button
            type="button"
            className="timer-action-btn"
            onClick={() => setIsMuted((prev) => !prev)}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            style={{ color: isMuted ? 'var(--text-dim)' : 'var(--accent-amber)' }}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>

          <button
            type="button"
            className="timer-action-btn"
            onClick={onDismiss}
            title="Close timer"
            style={{ color: 'var(--text-dim)' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Expanded Quick Presets Bar */}
      {isExpanded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Presets:
          </span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {[30, 60, 90, 120, 180].map((preset) => {
              const isSelected = totalSeconds === preset;
              const label = preset < 60 ? `${preset}s` : preset === 60 ? '1m' : preset === 90 ? '90s' : `${preset / 60}m`;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPreset(preset)}
                  style={{
                    background: isSelected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isSelected ? 'var(--accent-red)' : 'var(--border)'}`,
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.65rem',
                    fontWeight: isSelected ? 800 : 600,
                    padding: '3px 7px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setSeconds(0);
              setIsFinished(true);
              setIsRunning(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-green)',
              fontSize: '0.65rem',
              fontWeight: 800,
              cursor: 'pointer',
              padding: '2px 4px',
            }}
            title="Skip rest"
          >
            Skip ✓
          </button>
        </div>
      )}
    </div>
  );
}
