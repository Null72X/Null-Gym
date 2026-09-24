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
  Coffee,
  Sparkles,
  ChevronDown,
  ChevronUp,
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
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isAutoFlow, setIsAutoFlow] = useState<boolean>(autoFlow);
  const [completedTickSet, setCompletedTickSet] = useState<number | null>(null);
  const [transitionPrompt, setTransitionPrompt] = useState<string | null>(null);

  const intervalRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);
  const autoAdvanceTimeoutRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);

  // Stop timer completely and cancel all background intervals, timeouts, and audio
  const handleDismiss = () => {
    // 1. Clear countdown interval immediately
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // 2. Clear any pending auto-advance timeouts
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    // 3. Reset all state to inactive
    setIsRunning(false);
    setSeconds(0);
    setIsFinished(false);
    setTransitionPrompt(null);
    setCompletedTickSet(null);

    // 4. Release screen wake lock immediately
    if (wakeLockRef.current && typeof wakeLockRef.current.release === 'function') {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    // 5. Suspend or close audio context if active so no lingering tones play
    if (audioCtxRef.current) {
      try {
        if (typeof audioCtxRef.current.close === 'function') {
          audioCtxRef.current.close().catch(() => {});
        }
      } catch {}
      audioCtxRef.current = null;
    }

    // 6. Stop any active device vibration immediately
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }

    // 7. Fire dismissal callback to parent
    onDismiss();
  };

  // Component unmount cleanup: ensure ZERO background execution when unmounted
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
      if (wakeLockRef.current && typeof wakeLockRef.current.release === 'function') {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          if (typeof audioCtxRef.current.close === 'function') {
            audioCtxRef.current.close().catch(() => {});
          }
        } catch {}
        audioCtxRef.current = null;
      }
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(0);
        } catch {}
      }
    };
  }, []);

  // Setup / Reset timer when initialSeconds or mode changes
  useEffect(() => {
    if (initialSeconds === null || initialSeconds <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
      if (wakeLockRef.current && typeof wakeLockRef.current.release === 'function') {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      setIsRunning(false);
      setSeconds(0);
      setIsFinished(false);
      setTransitionPrompt(null);
      setCompletedTickSet(null);
      return;
    }

    setCurrentMode(mode);
    setCurrentExerciseName(exerciseName);
    setTotalSeconds(initialSeconds);
    setSeconds(initialSeconds);
    setIsRunning(true);
    setIsFinished(false);
    setTransitionPrompt(null);
    if (mode === 'exercise') {
      setCompletedTickSet(null);
    }
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, [initialSeconds, mode, exerciseName]);

  // Screen Wake Lock API: Keeps phone screen awake while timer runs
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if (typeof window !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };

    if (isRunning && seconds > 0) {
      requestWakeLock();
    } else if (wakeLockRef.current && typeof wakeLockRef.current.release === 'function') {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    return () => {
      if (wakeLockRef.current && typeof wakeLockRef.current.release === 'function') {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
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

  // Halfway audio alert (at 45 seconds of 90s)
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

  // 10-second intensity alert
  const playTenSecWarning = () => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [640, 640].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.14);
        gain.gain.setValueAtTime(0.28, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.14 + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.1);
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
        // Double resonant chime for rest completion
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
            const currentFinishedSet = setIndex !== undefined ? setIndex + 1 : 1;
            setCompletedTickSet(currentFinishedSet);
            if (onCompleteExerciseSet) {
              onCompleteExerciseSet();
            }
            if (isAutoFlow) {
              setTransitionPrompt(`⚡ Set ${currentFinishedSet} Ticked Complete! Starting 90s Rest`);
              autoAdvanceTimeoutRef.current = setTimeout(() => {
                handleTransitionToRest(90);
              }, 1200);
            }
          }

          // AUTOMATION 2: Rest timer finished
          if (currentMode === 'rest' && isAutoFlow && onStartNextSet) {
            setTransitionPrompt('🚀 Rest Complete! Starting Next Set');
            autoAdvanceTimeoutRef.current = setTimeout(() => {
              onStartNextSet();
            }, 1800);
          }

          return 0;
        }

        // Halfway tone cue (at 45s for 90s duration)
        if (prev === Math.floor(totalSeconds / 2) + 1 && totalSeconds >= 40) {
          playHalfway();
        }

        // 10-second intensity alert
        if (prev === 11) {
          playTenSecWarning();
        }

        // 3-2-1 countdown ticks
        if (prev <= 4 && prev >= 2) {
          playTick();
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([40]);
          }
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds, isMuted, currentMode, isAutoFlow, totalSeconds, setIndex]);

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

  // Finish Exercise early, tick the set as completed, and start 90s Rest
  const handleFinishExerciseNow = () => {
    setSeconds(0);
    setIsFinished(true);
    setIsRunning(false);
    playChime(true);
    const finishedSetNum = setIndex !== undefined ? setIndex + 1 : 1;
    setCompletedTickSet(finishedSetNum);
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

  const presets = [30, 60, 90, 120];

  return (
    <div
      className={`floating-rest-bar ${initialSeconds !== null ? 'active' : ''}`}
      style={{
        position: 'fixed',
        bottom: 'calc(62px + var(--safe-bottom) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(500px, calc(100% - 16px))',
        background: 'linear-gradient(180deg, rgba(20, 20, 28, 0.96) 0%, rgba(12, 12, 18, 0.98) 100%)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: `1px solid ${
          isFinished
            ? 'rgba(34, 197, 94, 0.6)'
            : isExerciseMode
            ? 'rgba(239, 68, 68, 0.45)'
            : 'rgba(56, 189, 248, 0.35)'
        }`,
        boxShadow: isFinished
          ? '0 12px 36px rgba(34, 197, 94, 0.25), 0 0 0 1px rgba(34, 197, 94, 0.2)'
          : isExerciseMode
          ? '0 12px 36px rgba(239, 68, 68, 0.25), 0 0 0 1px rgba(239, 68, 68, 0.15)'
          : '0 12px 36px rgba(0, 0, 0, 0.7)',
        borderRadius: '16px',
        zIndex: 900,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        padding: '10px 14px',
      }}
    >
      {/* Set Completed Visual Notification Pill */}
      {(completedTickSet !== null || transitionPrompt) && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '8px',
            padding: '4px 10px',
            marginBottom: '8px',
            fontSize: '0.70rem',
            fontWeight: 800,
            color: '#86efac',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Check size={13} color="var(--accent-green)" />
          <span>
            {transitionPrompt || `Set ${completedTickSet} marked complete! ✓ Checkbox ticked`}
          </span>
        </div>
      )}

      {/* Main Bar Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
        {/* Left Side: Circular Progress Ring + Time + Info */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0, flex: 1 }}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {/* Animated SVG Progress Ring */}
          <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
            <svg width="46" height="46" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="23"
                cy="23"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="3.5"
              />
              <circle
                cx="23"
                cy="23"
                r={radius}
                fill="none"
                stroke={getRingColor()}
                strokeWidth="3.5"
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
            {/* Header Status Tag */}
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.5px',
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
                    ? '🎉 SET COMPLETE ✓'
                    : '🎉 REST OVER · READY'
                  : isExerciseMode
                  ? '⚡ 90s WORK INTERVAL'
                  : '☕ 90s REST RECOVERY'}
              </span>

              {setIndex !== undefined && totalSets !== undefined && (
                <span
                  style={{
                    background: isExerciseMode ? 'rgba(239, 68, 68, 0.22)' : 'rgba(56, 189, 248, 0.22)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.58rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Set {setIndex + 1}/{totalSets}
                </span>
              )}

              {completedTickSet !== null && !isExerciseMode && (
                <span
                  style={{
                    background: 'rgba(34, 197, 94, 0.2)',
                    color: '#86efac',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontSize: '0.58rem',
                    fontWeight: 800,
                  }}
                >
                  ✓ Set {completedTickSet} Done
                </span>
              )}
            </div>

            {/* Time Display: Rock-solid tabular-nums, NO trailing ellipsis, NO glitching */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '1.38rem',
                  fontWeight: 900,
                  lineHeight: 1.1,
                  color: isFinished ? 'var(--accent-green)' : '#ffffff',
                  letterSpacing: '0px',
                  display: 'inline-block',
                }}
              >
                {isFinished ? '00:00' : timeFormatted}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Primary Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {/* Work Mode: Done Set Button */}
          {isExerciseMode && !isFinished && (
            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleFinishExerciseNow}
              title="Finish set, tick completed on screen, and start 90s rest"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(16, 185, 129, 0.3) 100%)',
                borderColor: 'rgba(34, 197, 94, 0.5)',
                color: '#86efac',
                fontSize: '0.70rem',
                padding: '5px 10px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: '8px',
              }}
            >
              <Check size={13} color="var(--accent-green)" />
              <span>Done Set</span>
            </button>
          )}

          {/* Rest Mode: Next Set Button */}
          {!isExerciseMode && onStartNextSet && (
            <button
              type="button"
              className="btn-clean btn-sm btn-primary"
              onClick={() => onStartNextSet()}
              title="Skip remaining rest and start 90s Work Timer for next set"
              style={{
                fontSize: '0.70rem',
                padding: '5px 10px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: '8px',
              }}
            >
              <Zap size={12} />
              <span>Next Set</span>
            </button>
          )}

          {/* Quick Adjustment */}
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

          {/* Play/Pause */}
          <button
            type="button"
            className="timer-action-btn"
            style={{
              background: isRunning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              borderColor: isRunning ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.35)',
              color: isRunning ? '#fca5a5' : '#86efac',
              minWidth: '30px',
              height: '30px',
            }}
            onClick={togglePause}
            title={isRunning ? 'Pause' : 'Resume'}
          >
            {isRunning ? <Pause size={13} /> : <Play size={13} />}
          </button>

          {/* Expand/Collapse Chevron */}
          <button
            type="button"
            className="timer-action-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Collapse Presets' : 'Expand Presets & Modes'}
            style={{ color: 'var(--text-dim)', minWidth: '28px', height: '30px' }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {/* Close Timer */}
          <button
            type="button"
            className="timer-action-btn"
            onClick={handleDismiss}
            title="Close timer"
            style={{ color: 'var(--text-dim)', minWidth: '28px', height: '30px' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Controls Drawer */}
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
          {currentExerciseName && (
            <div
              style={{
                width: '100%',
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                marginBottom: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>Exercise:</span>
              <strong style={{ color: '#ffffff' }}>{currentExerciseName}</strong>
            </div>
          )}
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
                padding: '3px 8px',
                borderRadius: '6px',
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
                padding: '3px 8px',
                borderRadius: '6px',
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
                padding: '3px 8px',
                borderRadius: '6px',
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
                  ? '60s'
                  : preset === 90
                  ? '90s ⭐'
                  : `${preset}s`;
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

          {/* Utilities: Restart & Mute */}
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
          </div>
        </div>
      )}
    </div>
  );
}
