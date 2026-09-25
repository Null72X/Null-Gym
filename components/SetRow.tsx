'use client';

import React from 'react';
import { WorkoutSet, SetType, TrackingType } from '../types/workout';
import { Trash2, Clock, Zap } from 'lucide-react';

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  typeIndex: number; // e.g. 1st warmup set -> 1, 2nd warmup set -> 2, etc.
  defaultUnit: string;
  mode?: 'planner' | 'tracker';
  requiresLoad?: boolean;
  trackingType?: TrackingType;
  onUpdate: (updated: WorkoutSet) => void;
  onDelete: () => void;
  onStartRest?: (restStr: string, setIndex?: number) => void;
  onStartTimer?: (durationSecs?: number) => void;
  isActiveTimerSet?: boolean;
}

export default function SetRow({
  set,
  index,
  typeIndex,
  defaultUnit,
  mode = 'planner',
  requiresLoad = true,
  trackingType = 'weight_reps',
  onUpdate,
  onDelete,
  onStartRest,
  onStartTimer,
  isActiveTimerSet = false,
}: SetRowProps) {
  // Stepper adjustment for load
  const handleStep = (delta: number) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }
    const cur = typeof set.load === 'number' ? set.load : 0;
    const next = Math.max(0, Math.round((cur + delta) * 2) / 2);
    onUpdate({
      ...set,
      load: next > 0 ? next : '',
    });
  };

  const handleLoadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onUpdate({
      ...set,
      load: isNaN(val) || val <= 0 ? '' : val,
    });
  };

  const handleToggleCheck = () => {
    const nextCompleted = !set.completed;
    onUpdate({
      ...set,
      completed: nextCompleted,
    });

    if (nextCompleted) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(35);
      }
      if (onStartRest) {
        onStartRest(set.rest || '90s', index);
      }
    }
  };

  // Badge prefix and class
  let badgeLabel = `S${typeIndex}`;
  let badgeClass = 'wk';
  if (set.type === 'warmup') {
    badgeLabel = `W${typeIndex}`;
    badgeClass = 'wu';
  } else if (set.type === 'dropset') {
    badgeLabel = `D${typeIndex}`;
    badgeClass = 'drop';
  } else if (set.type === 'failure') {
    badgeLabel = `F${typeIndex}`;
    badgeClass = 'fail';
  }

  // Cycle set type when badge is clicked
  const handleCycleType = () => {
    if (mode === 'tracker') return;
    const types: SetType[] = ['working', 'warmup', 'dropset', 'failure'];
    const curIdx = types.indexOf(set.type);
    const nextType = types[(curIdx + 1) % types.length];
    onUpdate({ ...set, type: nextType });
  };

  return (
    <div className={`clean-set-row ${mode === 'tracker' && set.completed ? 'done' : ''}`}>
      {/* Badge / Type toggle */}
      <button
        type="button"
        title="Click to cycle type (Warmup / Working / Dropset / Failure)"
        className={`set-tag-badge ${badgeClass}`}
        style={{ border: 'none', cursor: mode === 'planner' ? 'pointer' : 'default' }}
        onClick={handleCycleType}
      >
        {badgeLabel}
      </button>

      {/* INTELLIGENT INPUT FIELDS BASED ON TRACKING TYPE & LOAD REQUIREMENT */}
      {requiresLoad ? (
        <>
          {/* Reps Input */}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="set-reps-input"
            value={set.reps}
            placeholder="Reps"
            title="Target / Achieved Reps"
            onChange={(e) => onUpdate({ ...set, reps: e.target.value })}
          />

          {/* Stepper with Load Input & Unit */}
          <div className="clean-stepper">
            <button
              type="button"
              className="clean-step-btn"
              onClick={() => handleStep(-2.5)}
              title="Decrease load (-2.5)"
            >
              -
            </button>
            <input
              type="number"
              step="0.5"
              inputMode="decimal"
              className="clean-load-input"
              value={set.load}
              placeholder="--"
              onChange={handleLoadChange}
            />
            <span className="clean-load-unit">{set.unit || defaultUnit}</span>
            <button
              type="button"
              className="clean-step-btn"
              onClick={() => handleStep(2.5)}
              title="Increase load (+2.5)"
            >
              +
            </button>
          </div>
        </>
      ) : trackingType === 'cardio_metrics' ? (
        <>
          {/* Cardio Duration */}
          <input
            type="text"
            className="set-reps-target"
            value={set.duration !== undefined ? set.duration : set.reps}
            placeholder="Time (e.g. 20m)"
            title="Duration / Time"
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              padding: '4px 6px',
              color: '#38bdf8',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
            }}
            onChange={(e) => onUpdate({ ...set, duration: e.target.value, reps: e.target.value })}
          />

          {/* Cardio Distance / Intensity */}
          <input
            type="text"
            value={set.distance || ''}
            placeholder="Dist / Speed"
            title="Distance or Speed / Incline"
            style={{
              width: '80px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              padding: '4px 6px',
              color: '#a7f3d0',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              textAlign: 'center',
            }}
            onChange={(e) => onUpdate({ ...set, distance: e.target.value })}
          />
        </>
      ) : trackingType === 'time_only' ? (
        <>
          {/* Hold / Duration */}
          <input
            type="text"
            className="set-reps-target"
            value={set.duration !== undefined ? set.duration : set.reps}
            placeholder="Hold time (e.g. 45s)"
            title="Hold duration / Time"
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              padding: '4px 8px',
              color: '#e2e8f0',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
            }}
            onChange={(e) => onUpdate({ ...set, duration: e.target.value, reps: e.target.value })}
          />
        </>
      ) : trackingType === 'distance_time' ? (
        <>
          {/* Distance */}
          <input
            type="text"
            value={set.distance !== undefined ? set.distance : set.reps}
            placeholder="Distance (m/km)"
            title="Distance"
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              padding: '4px 6px',
              color: '#fde68a',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
            }}
            onChange={(e) => onUpdate({ ...set, distance: e.target.value, reps: e.target.value })}
          />
          {/* Duration */}
          <input
            type="text"
            value={set.duration || ''}
            placeholder="Time"
            title="Duration"
            style={{
              width: '65px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              padding: '4px 6px',
              color: '#cbd5e1',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              textAlign: 'center',
            }}
            onChange={(e) => onUpdate({ ...set, duration: e.target.value })}
          />
        </>
      ) : (
        <>
          {/* Pure Bodyweight Reps (No weight stepper) */}
          <input
            type="text"
            className="set-reps-target"
            value={set.reps}
            placeholder="Reps (e.g. 15)"
            title="Completed Reps"
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              padding: '4px 8px',
              color: '#cbd5e1',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
            }}
            onChange={(e) => onUpdate({ ...set, reps: e.target.value })}
          />
        </>
      )}

      {/* RPE input */}
      <input
        type="text"
        inputMode="decimal"
        className="set-rpe-input"
        title="RPE (Rate of Perceived Exertion: 1-10)"
        placeholder="@"
        value={set.rpe}
        onChange={(e) => onUpdate({ ...set, rpe: e.target.value })}
      />

      {/* Delete Set Button (Only in planner mode) */}
      {mode === 'planner' && (
        <button
          type="button"
          title="Delete set"
          className="set-delete-btn"
          onClick={onDelete}
        >
          <Trash2 size={13} />
        </button>
      )}

      {/* 1-Tap 90s Work Timer Button for this set (Tracker Mode) */}
      {mode === 'tracker' && !set.completed && onStartTimer && (
        <button
          type="button"
          className={`set-timer-trigger-btn ${isActiveTimerSet ? 'active-pulse' : ''}`}
          onClick={() => {
            let duration = 90;
            if (set.duration) {
              const match = String(set.duration).match(/\d+/);
              if (match) duration = parseInt(match[0], 10) || 90;
            }
            onStartTimer(duration);
          }}
          title={isActiveTimerSet ? '90s Set Timer is running' : 'Start 90s Work Timer for this set'}
        >
          {isActiveTimerSet ? <Zap size={11} color="var(--accent-red)" /> : <Clock size={11} />}
          <span>90s</span>
        </button>
      )}

      {/* Checkmark Button (Tracker Mode Only) */}
      {mode === 'tracker' && (
        <button
          type="button"
          className={`clean-check-btn ${set.completed ? 'checked' : ''}`}
          onClick={handleToggleCheck}
          title={set.completed ? 'Completed' : 'Mark Complete'}
        >
          {set.completed ? '✓' : '○'}
        </button>
      )}
    </div>
  );
}
