'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Pause, Play, X, Plus, Minus } from 'lucide-react';

interface RestTimerBarProps {
  initialSeconds: number | null;
  onDismiss: () => void;
}

export default function RestTimerBar({ initialSeconds, onDismiss }: RestTimerBarProps) {
  const [seconds, setSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const intervalRef = useRef<any>(null);

  // Parse and trigger new timer when initialSeconds changes
  useEffect(() => {
    if (initialSeconds !== null && initialSeconds > 0) {
      setSeconds(initialSeconds);
      setIsRunning(true);
      setIsFinished(false);
    }
  }, [initialSeconds]);

  // Audio tone generator using Web Audio API
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // Audio might be blocked until user gesture, safe to ignore
    }
  };

  // Timer interval loop
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
          playBeep();
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 200]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds]);

  const adjustSeconds = (delta: number) => {
    setSeconds((prev) => Math.max(5, prev + delta));
    setIsFinished(false);
  };

  const togglePause = () => {
    setIsRunning((prev) => !prev);
  };

  if (initialSeconds === null) return null;

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <div className={`floating-rest-bar ${initialSeconds !== null ? 'active' : ''}`}>
      <div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {isFinished ? '🎉 TIME UP!' : isRunning ? 'Rest Timer' : 'Paused'}
        </div>
        <div
          className="timer-text"
          style={{ color: isFinished ? 'var(--accent-green)' : '#ffffff' }}
        >
          {isFinished ? '00:00' : timeFormatted}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          type="button"
          className="timer-action-btn"
          onClick={() => adjustSeconds(-30)}
          title="Subtract 30 seconds"
        >
          -30s
        </button>
        <button
          type="button"
          className="timer-action-btn"
          onClick={() => adjustSeconds(30)}
          title="Add 30 seconds"
        >
          +30s
        </button>
        <button
          type="button"
          className="timer-action-btn"
          onClick={togglePause}
          title={isRunning ? 'Pause' : 'Resume'}
        >
          {isRunning ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          type="button"
          className="timer-action-btn"
          onClick={onDismiss}
          title="Dismiss rest bar"
          style={{ color: 'var(--text-dim)' }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
