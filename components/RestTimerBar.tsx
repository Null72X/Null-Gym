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
  Check,
  Zap,
  Dumbbell,
  Coffee,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';

export interface RestTimerBarProps {
  initialSeconds: number | null;
  mode?: 'rest' | 'exercise';
  exerciseName?: string;
  setIndex?: number;
  totalSets?: number;
  autoFlow?: boolean;
  onDismiss: () => void;
  onCompleteExerciseSet?: () => void;
  onSwitchToRest?: (restSeconds?: number) => void;
  onStartNextSet?: () => void;
}

export default function RestTimerBar({
  initialSeconds,
  mode = 'rest',
  exerciseName = '',
  setIndex,
  totalSets,
  autoFlow = true,
  onDismiss,
  onCompleteExerciseSet,
  onSwitchToRest,
  onStartNextSet,
}: RestTimerBarProps) {
  const [currentMode, setCurrentMode] = useState<'rest' | 'exercise'>('rest');
  const [currentExerciseName, setCurrentExerciseName] = useState<string>('');
  const [totalSeconds, setTotalSeconds] = useState<number>(90);
  const [seconds, setSeconds] = useState<number>(90);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isAutoFlow, setIsAutoFlow] = useState<boolean>(autoFlow);
  const [transitionPrompt, setTransitionPrompt] = useState<string | null>(null);

  const intervalRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);
  const autoAdvanceTimeoutRef = useRef<any>(null);

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
      setTransitionPrompt(null);
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    }
  }, [initialSeconds, mode, exerciseName]);

  // Keep phone screen awake during active exercise & rest intervals
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if (typeof window !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Ignored if unsupported or hidden
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

  // Audio tone generator using native Web Audio API
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

  // Play countdown tick tone for 3, 2, 1 seconds
  const playTick = () => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  };

  // Halfway audio alert (e.g. 45 seconds of 90s)
  const playHalfway = () => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [700, 850].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.2, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.22);
      });
    } catch {}
  };

  // 10s warning alert tone
  const playTenSecWarning = () => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [640, 640].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.14);
        gain.gain.setValueAtTime(0.25, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.14 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.15);
      });
    } catch {}
  };

  // Play celebration fanfare when timer completes
  const playChime = (isExercise: boolean) => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (isExercise) {
        // High-energy 3-tone celebration chord: D5 (587Hz) -> G5 (784Hz) -> B5 (987Hz)
        [587, 784, 987].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0.35, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.35);
        });
      } else {
        // Double resonant chime for rest completion: E5 (659Hz) -> A5 (880Hz)
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
        gain2.gain.setValueAtTime(0.42, now + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.65);
      }
    } catch {}
  };

  // Main countdown timer loop with automatic progression
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

          // AUTOMATION 1: Exercise work timer finished
          if (currentMode === 'exercise') {
            if (onCompleteExerciseSet) {
              onCompleteExerciseSet();
            }
            if (isAutoFlow) {
              setTransitionPrompt('⚡ Set Finished! Starting 90s Rest...');
              autoAdvanceTimeoutRef.current = setTimeout(() => {
                handleTransitionToRest(90);
              }, 1200);
            }
          }

          // AUTOMATION 2: Rest timer finished
          if (currentMode === 'rest' && isAutoFlow && onStartNextSet) {
            setTransitionPrompt('🚀 Rest Over! Auto-Starting Next Set in 2s...');
            autoAdvanceTimeoutRef.current = setTimeout(() => {
              onStartNextSet();
            }, 2000);
          }

          return 0;
        }

        // Halfway tone cue (at 45s for a 90s duration)
        if (prev === Math.floor(totalSeconds / 2) + 1 && totalSeconds >= 40) {
          playHalfway();
        }

        // 10-second intensity alert
        if (prev === 11) {
          playTenSecWarning();
        }

        // 3, 2, 1 second countdown beeps
        if (prev === 4 || prev === 3 || prev === 2) {
          playTick();
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(25);
          }
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds, isMuted, currentMode, isAutoFlow, totalSeconds]);

  // Adjust seconds (+ / -)
  const adjustSeconds = (delta: number) => {
    setSeconds((prev) => {
      const next = Math.max(5, prev + delta);
      setTotalSeconds((t) => Math.max(next, t));
      return next;
    });
    setIsFinished(false);
    setTransitionPrompt(null);
  };

  // 1-Tap preset selection (e.g. 90s default)
  const setPreset = (presetSecs: number) => {
    setTotalSeconds(presetSecs);
    setSeconds(presetSecs);
    setIsRunning(true);
    setIsFinished(false);
    setTransitionPrompt(null);
  };

  // Restart current timer
  const restartTimer = () => {
    setSeconds(totalSeconds);
    setIsRunning(true);
    setIsFinished(false);
    setTransitionPrompt(null);
  };

  const togglePause = () => {
    setIsRunning((prev) => !prev);
  };

  // Finish Exercise early and immediately transition to 90s Rest
  const handleFinishExerciseNow = () => {
    setSeconds(0);
    setIsFinished(true);
    setIsRunning(false);
    playChime(true);
    if (onCompleteExerciseSet) {
      onCompleteExerciseSet();
    }
    if (isAutoFlow) {
      handleTransitionToRest(90);
    }
  };

  // Transition to Rest Timer (Default: 90s)
  const handleTransitionToRest = (restSecs = 90) => {
    setTransitionPrompt(null);
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
    setTotalSeconds(90);
    setSeconds(90);
    setIsRunning(true);
    setIsFinished(false);
    setTransitionPrompt(null);
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

  const presets = [30, 45, 60, 90, 120, 180];

  return (
    <div
      className={`floating-rest-bar ${initialSeconds !== null ? 'active' : ''}`}
      style={{
        position: 'fixed',
        bottom: 'calc(64px + var(--safe-bottom) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(500px, calc(100% - 16px))',
        background: 'rgba(14, 14, 20, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${
          isFinished
            ? 'rgba(34, 197, 94, 0.55)'
            : isExerciseMode
            ? 'rgba(239, 68, 68, 0.5)'
            : 'rgba(56, 189, 248, 0.45)'
        }`,
        boxShadow: isFinished
          ? '0 8px 32px rgba(34, 197, 94, 0.28)'
          : isExerciseMode
          ? '0 8px 32px rgba(239, 68, 68, 0.35)'
          : '0 8px 32px rgba(0, 0, 0, 0.8)',
        borderRadius: '16px',
        zIndex: 900,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        padding: '10px 14px',
      }}
    >
      {/* Auto-Flow Transition Banner */}
      {transitionPrompt && (
        <div
          style={{
            background: isExerciseMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
            border: `1px solid ${isExerciseMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
            borderRadius: '8px',
            padding: '4px 10px',
            marginBottom: '8px',
            fontSize: '0.70rem',
            fontWeight: 800,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            animation: 'pulse 1.5s infinite',
          }}
        >
          <Sparkles size={12} color={isExerciseMode ? '#fca5a5' : '#86efac'} />
          <span>{transitionPrompt}</span>
        </div>
      )}

      {/* Top Main Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
        {/* Left Side: Circular Ring + Time + Info */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0, flex: 1 }}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {/* Animated SVG Progress Ring */}
          <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
            <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="4"
              />
              <circle
                cx="24"
                cy="24"
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
                <Zap size={15} color={getRingColor()} />
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
                    : '🎉 REST COMPLETE · READY!'
                  : isRunning
                  ? isExerciseMode
                    ? '⚡ 90s WORK INTERVAL'
                    : '☕ 90s REST RECOVERY'
                  : '⏸ PAUSED'}
              </span>

              {setIndex !== undefined && totalSets !== undefined && (
                <span
                  style={{
                    background: isExerciseMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontSize: '0.60rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Set {setIndex + 1}/{totalSets}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.30rem',
                  fontWeight: 900,
                  lineHeight: 1.1,
                  color: isFinished ? 'var(--accent-green)' : '#ffffff',
                  letterSpacing: '-0.5px',
                }}
              >
                {isFinished ? '00:00' : timeFormatted}
              </div>

              {currentExerciseName && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '160px',
                  }}
                >
                  · {currentExerciseName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {/* Finish Set early button in Exercise mode */}
          {isExerciseMode && !isFinished && (
            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleFinishExerciseNow}
              title="Finish set early and start 90s rest"
              style={{
                background: 'rgba(34, 197, 94, 0.2)',
                borderColor: 'rgba(34, 197, 94, 0.4)',
                color: '#86efac',
                fontSize: '0.68rem',
                padding: '4px 8px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Check size={12} />
              <span>Done Set</span>
            </button>
          )}

          {/* Quick Start Next Set in Rest Mode */}
          {!isExerciseMode && onStartNextSet && (
            <button
              type="button"
              className="btn-clean btn-sm btn-primary"
              onClick={() => onStartNextSet()}
              title="Skip rest and start 90s Work Timer for next set"
              style={{
                fontSize: '0.68rem',
                padding: '4px 8px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Zap size={11} />
              <span>Next Set</span>
            </button>
          )}

          <button
            type="button"
            className="timer-action-btn timer-secondary-actions"
            onClick={() => adjustSeconds(-15)}
            title="Subtract 15 seconds"
          >
            -15s
          </button>

          <button
            type="button"
            className="timer-action-btn timer-secondary-actions"
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
              minWidth: '30px',
              height: '30px',
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
            style={{ color: 'var(--text-dim)', minWidth: '30px', height: '30px' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Expanded Quick Presets, Auto-Flow & Mode Controls */}
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
          {/* Mode Switcher & Auto-Flow Badge */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => handleSwitchMode('exercise')}
              style={{
                background: isExerciseMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${isExerciseMode ? 'var(--accent-red)' : 'var(--border)'}`,
                color: isExerciseMode ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.64rem',
                fontWeight: isExerciseMode ? 800 : 600,
                padding: '3px 7px',
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
                fontSize: '0.64rem',
                fontWeight: !isExerciseMode ? 800 : 600,
                padding: '3px 7px',
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

            {/* Auto-Flow Toggle Button */}
            <button
              type="button"
              onClick={() => setIsAutoFlow((prev) => !prev)}
              style={{
                background: isAutoFlow ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${isAutoFlow ? 'rgba(34, 197, 94, 0.45)' : 'var(--border)'}`,
                color: isAutoFlow ? '#86efac' : 'var(--text-dim)',
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '3px 7px',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontFamily: 'var(--font-mono)',
              }}
              title="Automatically advance from Set (90s) -> Rest (90s) -> Next Set"
            >
              <Sparkles size={10} />
              <span>Auto-Flow: {isAutoFlow ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Quick Presets with 90s Highlighted */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {presets.map((preset) => {
              const isSelected = totalSeconds === preset;
              const isDefault90 = preset === 90;
              const label =
                preset < 60
                  ? `${preset}s`
                  : preset === 60
                  ? '1m'
                  : preset === 90
                  ? '90s ⭐'
                  : `${preset / 60}m`;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPreset(preset)}
                  style={{
                    background: isSelected
                      ? isExerciseMode
                        ? 'rgba(239, 68, 68, 0.35)'
                        : 'rgba(56, 189, 248, 0.35)'
                      : isDefault90
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${
                      isSelected
                        ? isExerciseMode
                          ? 'var(--accent-red)'
                          : '#38bdf8'
                        : isDefault90
                        ? 'rgba(239, 68, 68, 0.35)'
                        : 'var(--border)'
                    }`,
                    color: isSelected ? '#ffffff' : isDefault90 ? '#fca5a5' : 'var(--text-muted)',
                    fontSize: '0.62rem',
                    fontWeight: isSelected || isDefault90 ? 800 : 600,
                    padding: '2px 5px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    transition: 'all 0.15s ease',
                  }}
                  title={isDefault90 ? 'Recommended Standard 90s' : undefined}
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
              title="Restart 90s timer"
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
                } else if (!isExerciseMode && onStartNextSet) {
                  onStartNextSet();
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
