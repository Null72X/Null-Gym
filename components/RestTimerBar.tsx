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
  Dumbbell,
  Coffee,
  ArrowRight,
} from 'lucide-react';

export interface RestTimerBarProps {
  initialSeconds: number | null;
  mode?: 'rest' | 'exercise';
  exerciseName?: string;
  onDismiss: () => void;
  onCompleteExerciseSet?: () => void;
  onSwitchToRest?: (restSeconds?: number) => void;
}

export default function RestTimerBar({
  initialSeconds,
  mode = 'rest',
  exerciseName = '',
  onDismiss,
  onCompleteExerciseSet,
  onSwitchToRest,
}: RestTimerBarProps) {
  const [currentMode, setCurrentMode] = useState<'rest' | 'exercise'>('rest');
  const [currentExerciseName, setCurrentExerciseName] = useState<string>('');
  const [totalSeconds, setTotalSeconds] = useState<number>(90);
  const [seconds, setSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const intervalRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);

  // Setup / Reset timer when initialSeconds or mode changes
  useEffect(() => {
    if (initialSeconds !== null && initialSeconds > 0) {
      setCurrentMode(mode);
      setCurrentExerciseName(exerciseName);
      setTotalSeconds(initialSeconds);
      setSeconds(initialSeconds);
      setIsRunning(true);
      setIsFinished(false);
      setIsExpanded(true);
    }
  }, [initialSeconds, mode, exerciseName]);

  // Screen Wake Lock API to keep phone screen awake during active workout/rest
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if (typeof window !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Ignored if unsupported or visibility hidden
      }
    };

    if (isRunning && seconds > 0) {
      requestWakeLock();
    }

    return () => {
      if (wakeLock && typeof wakeLock.release === 'function') {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isRunning, seconds]);

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

  // Play celebration chime when timer finishes
  const playChime = (isExercise: boolean) => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (isExercise) {
        // High-energy 3-tone celebration for exercise set completion: D5 (587Hz) -> G5 (784Hz) -> B5 (987Hz)
        [587, 784, 987].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0.32, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.3);
        });
      } else {
        // Double chime for rest completion: E5 (659Hz) -> A5 (880Hz)
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
      }
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
          playChime(currentMode === 'exercise');
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([100, 60, 100, 60, 250]);
          }

          // If exercise finished, trigger set complete
          if (currentMode === 'exercise' && onCompleteExerciseSet) {
            onCompleteExerciseSet();
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
  }, [isRunning, seconds, isMuted, currentMode]);

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

  // Finish Exercise early and transition to rest
  const handleFinishExerciseNow = () => {
    setSeconds(0);
    setIsFinished(true);
    setIsRunning(false);
    playChime(true);
    if (onCompleteExerciseSet) {
      onCompleteExerciseSet();
    }
  };

  // Transition to Rest Timer
  const handleTransitionToRest = (restSecs = 90) => {
    if (onSwitchToRest) {
      onSwitchToRest(restSecs);
    } else {
      setCurrentMode('rest');
      setTotalSeconds(restSecs);
      setSeconds(restSecs);
      setIsRunning(true);
      setIsFinished(false);
    }
  };

  // Switch mode directly
  const handleSwitchMode = (targetMode: 'rest' | 'exercise') => {
    setCurrentMode(targetMode);
    const defaultSecs = targetMode === 'exercise' ? 45 : 90;
    setTotalSeconds(defaultSecs);
    setSeconds(defaultSecs);
    setIsRunning(true);
    setIsFinished(false);
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

  const isExerciseMode = currentMode === 'exercise';

  const getRingColor = () => {
    if (isFinished) return 'var(--accent-green)';
    if (isExerciseMode) {
      return seconds <= 10 ? 'var(--accent-amber)' : 'var(--accent-red)';
    }
    if (seconds <= 10) return 'var(--accent-amber)';
    return '#38bdf8'; // Cyan for rest
  };

  const exercisePresets = [20, 30, 45, 60, 90];
  const restPresets = [30, 60, 90, 120, 180];
  const activePresets = isExerciseMode ? exercisePresets : restPresets;

  return (
    <div
      className={`floating-rest-bar ${initialSeconds !== null ? 'active' : ''}`}
      style={{
        position: 'fixed',
        bottom: 'calc(64px + var(--safe-bottom) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 20px)',
        maxWidth: '480px',
        background: 'rgba(14, 14, 20, 0.96)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${
          isFinished
            ? 'rgba(34, 197, 94, 0.5)'
            : isExerciseMode
            ? 'rgba(239, 68, 68, 0.45)'
            : 'rgba(56, 189, 248, 0.4)'
        }`,
        boxShadow: isFinished
          ? '0 8px 30px rgba(34, 197, 94, 0.25)'
          : isExerciseMode
          ? '0 8px 30px rgba(239, 68, 68, 0.3)'
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
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0, flex: 1 }}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {/* Animated SVG Progress Ring */}
          <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
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

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: isFinished
                  ? 'var(--accent-green)'
                  : seconds <= 10
                  ? 'var(--accent-amber)'
                  : isExerciseMode
                  ? '#f87171'
                  : '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span>
                {isFinished
                  ? isExerciseMode
                    ? '🎉 SET COMPLETE!'
                    : '🎉 READY TO LIFT!'
                  : isRunning
                  ? isExerciseMode
                    ? '⚡ Active Exercise'
                    : '💤 Rest Timer'
                  : 'Paused'}
              </span>
              {currentExerciseName && isExerciseMode && (
                <span
                  style={{
                    color: '#e2e8f0',
                    fontWeight: 700,
                    textTransform: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '140px',
                  }}
                >
                  · {currentExerciseName}
                </span>
              )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {isExerciseMode && !isFinished && (
            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleFinishExerciseNow}
              title="Finish Set & Start Rest"
              style={{
                background: 'rgba(34, 197, 94, 0.2)',
                borderColor: 'rgba(34, 197, 94, 0.4)',
                color: '#86efac',
                fontSize: '0.68rem',
                padding: '3px 8px',
                fontWeight: 700,
              }}
            >
              <Check size={12} />
              <span>Done</span>
            </button>
          )}

          {isFinished && isExerciseMode && (
            <button
              type="button"
              className="btn-clean btn-sm btn-primary"
              onClick={() => handleTransitionToRest(90)}
              title="Start Rest Timer"
              style={{
                fontSize: '0.68rem',
                padding: '3px 8px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>Rest (90s)</span>
              <ArrowRight size={11} />
            </button>
          )}

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
              minWidth: '28px',
            }}
            onClick={togglePause}
            title={isRunning ? 'Pause' : 'Resume'}
          >
            {isRunning ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            type="button"
            className="timer-action-btn"
            onClick={onDismiss}
            title="Close timer"
            style={{ color: 'var(--text-dim)', minWidth: '28px' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Expanded Quick Presets & Mode Toggle Bar */}
      {isExpanded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            gap: '6px',
            flexWrap: 'wrap',
          }}
        >
          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '3px' }}>
            <button
              type="button"
              onClick={() => handleSwitchMode('exercise')}
              style={{
                background: isExerciseMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${isExerciseMode ? 'var(--accent-red)' : 'var(--border)'}`,
                color: isExerciseMode ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.63rem',
                fontWeight: isExerciseMode ? 800 : 600,
                padding: '2px 6px',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Zap size={10} color={isExerciseMode ? 'var(--accent-red)' : 'currentColor'} />
              <span>Work</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('rest')}
              style={{
                background: !isExerciseMode ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${!isExerciseMode ? '#38bdf8' : 'var(--border)'}`,
                color: !isExerciseMode ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.63rem',
                fontWeight: !isExerciseMode ? 800 : 600,
                padding: '2px 6px',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Coffee size={10} color={!isExerciseMode ? '#38bdf8' : 'currentColor'} />
              <span>Rest</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {activePresets.map((preset) => {
              const isSelected = totalSeconds === preset;
              const label =
                preset < 60
                  ? `${preset}s`
                  : preset === 60
                  ? '1m'
                  : preset === 90
                  ? '90s'
                  : `${preset / 60}m`;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPreset(preset)}
                  style={{
                    background: isSelected
                      ? isExerciseMode
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(56, 189, 248, 0.25)'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${
                      isSelected
                        ? isExerciseMode
                          ? 'var(--accent-red)'
                          : '#38bdf8'
                        : 'var(--border)'
                    }`,
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.64rem',
                    fontWeight: isSelected ? 800 : 600,
                    padding: '2px 6px',
                    borderRadius: '5px',
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

          {/* Utilities: Restart, Mute & Finish/Skip */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              type="button"
              className="timer-action-btn"
              onClick={restartTimer}
              title="Restart timer"
              style={{ padding: '2px 6px', fontSize: '0.64rem' }}
            >
              <RotateCcw size={11} />
            </button>

            <button
              type="button"
              className="timer-action-btn"
              onClick={() => setIsMuted((prev) => !prev)}
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              style={{ color: isMuted ? 'var(--text-dim)' : 'var(--accent-amber)', padding: '2px 6px', fontSize: '0.64rem' }}
            >
              {isMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
            </button>

            <button
              type="button"
              onClick={() => {
                setSeconds(0);
                setIsFinished(true);
                setIsRunning(false);
                playChime(isExerciseMode);
                if (isExerciseMode && onCompleteExerciseSet) {
                  onCompleteExerciseSet();
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-green)',
                fontSize: '0.64rem',
                fontWeight: 800,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
              title={isExerciseMode ? 'Complete set' : 'Skip rest'}
            >
              {isExerciseMode ? 'Finish Set ✓' : 'Skip Rest ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
