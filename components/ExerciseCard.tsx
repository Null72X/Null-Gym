'use client';

import React, { useState } from 'react';
import {
  Exercise,
  WorkoutSet,
  SavedExercisePerformance,
  SetType,
  WeightUnit,
} from '../types/workout';
import { getExerciseMuscleInfo } from '../lib/muscleMetadata';
import SetRow from './SetRow';
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Plus,
  Play,
  CheckCircle2,
  ExternalLink,
  Clock,
  History,
} from 'lucide-react';
import HighlightedText from './HighlightedText';

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  totalExercises: number;
  defaultUnit: WeightUnit;
  lastPerformance: SavedExercisePerformance | null;
  mode?: 'planner' | 'tracker';
  weekNumber?: number;
  highlightQuery?: string;
  onUpdate: (updated: Exercise) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onStartRest: (restStr: string) => void;
  onStartExerciseTimer?: (exerciseName: string, durationSecs: number, setIdx: number) => void;
}

export default function ExerciseCard({
  exercise,
  index,
  totalExercises,
  defaultUnit,
  lastPerformance,
  mode = 'planner',
  weekNumber,
  highlightQuery,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onStartRest,
  onStartExerciseTimer,
}: ExerciseCardProps) {
  const [showNotesEdit, setShowNotesEdit] = useState(false);
  const [notesDraft, setNotesDraft] = useState(exercise.notes || '');

  const muscleInfo = getExerciseMuscleInfo(exercise);

  // Sets count
  const wuCount = exercise.sets.filter((s) => s.type === 'warmup').length;
  const wkCount = exercise.sets.filter((s) => s.type === 'working').length;
  const allSetsCompleted =
    exercise.sets.length > 0 && exercise.sets.every((s) => s.completed);

  // Add new set
  const handleAddSet = (type: SetType = 'working') => {
    // If there is an existing set of this type, copy its load & reps
    const lastSet = [...exercise.sets].reverse().find((s) => s.type === type) || exercise.sets[exercise.sets.length - 1];
    const newSet: WorkoutSet = {
      id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      load: lastSet ? lastSet.load : '',
      unit: (lastSet?.unit as WeightUnit) || defaultUnit,
      reps: lastSet ? lastSet.reps : '10',
      rpe: lastSet ? lastSet.rpe : '9',
      rest: lastSet ? lastSet.rest : '90s',
      completed: false,
    };

    onUpdate({
      ...exercise,
      sets: [...exercise.sets, newSet],
    });
  };

  // Update specific set
  const handleUpdateSet = (sIdx: number, updatedSet: WorkoutSet) => {
    const updatedSets = [...exercise.sets];
    updatedSets[sIdx] = updatedSet;
    onUpdate({
      ...exercise,
      sets: updatedSets,
      completed: updatedSets.every((s) => s.completed),
    });
  };

  // Delete set
  const handleDeleteSet = (sIdx: number) => {
    const updatedSets = exercise.sets.filter((_, idx) => idx !== sIdx);
    onUpdate({
      ...exercise,
      sets: updatedSets,
      completed: updatedSets.length > 0 && updatedSets.every((s) => s.completed),
    });
  };

  // Toggle all sets completed
  const handleToggleAllSets = () => {
    const nextState = !allSetsCompleted;
    const updatedSets = exercise.sets.map((s) => ({ ...s, completed: nextState }));
    onUpdate({
      ...exercise,
      sets: updatedSets,
      completed: nextState,
    });
  };

  // Save notes
  const handleSaveNotes = () => {
    onUpdate({
      ...exercise,
      notes: notesDraft,
    });
    setShowNotesEdit(false);
  };

  // Helper for numbering sets of each type
  let warmupCounter = 0;
  let workingCounter = 0;
  let dropsetCounter = 0;
  let failureCounter = 0;

  const handleStartTimer = () => {
    if (!onStartExerciseTimer) return;
    const incompleteIdx = exercise.sets.findIndex((s) => !s.completed);
    const targetIdx = incompleteIdx >= 0 ? incompleteIdx : 0;
    const targetSet = exercise.sets[targetIdx];

    let duration = 45;
    if (targetSet?.duration) {
      const match = String(targetSet.duration).match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        if (parsed > 0) duration = parsed;
      }
    } else if (exercise.trackingType === 'time_only') {
      duration = 45;
    }

    onStartExerciseTimer(exercise.name, duration, targetIdx);
  };

  return (
    <div className={`clean-card ${allSetsCompleted ? 'exercise-done' : ''}`}>
      {/* Header */}
      <div className="clean-card-header">
        <div className="clean-ex-title" style={{ flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', flexShrink: 0 }}>
            #{index + 1}
          </span>
          <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
            <HighlightedText text={exercise.name} query={highlightQuery} />
          </span>
          {/* Prominent Master Muscle Pillar Badge */}
          <span
            className="clean-badge"
            style={{
              fontSize: '0.64rem',
              padding: '2px 7px',
              background: muscleInfo.pillarMeta.bg,
              color: muscleInfo.pillarMeta.color,
              borderColor: muscleInfo.pillarMeta.border,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <span>{muscleInfo.pillarMeta.icon}</span>
            <span>{muscleInfo.displayPillar}</span>
          </span>
        </div>

        <div className="card-actions-group">
          {/* Start Exercise Work Timer Button */}
          {onStartExerciseTimer && (
            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={handleStartTimer}
              title={`Start work timer for ${exercise.name}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                cursor: 'pointer',
              }}
            >
              <Clock size={11} color="var(--accent-red)" />
              <span>Start Timer</span>
            </button>
          )}

          {/* Reorder Up/Down (Only in Planner) */}
          {mode === 'planner' && index > 0 && onMoveUp && (
            <button
              type="button"
              className="icon-action-btn"
              onClick={onMoveUp}
              title="Move up"
            >
              <ChevronUp size={14} />
            </button>
          )}
          {mode === 'planner' && index < totalExercises - 1 && onMoveDown && (
            <button
              type="button"
              className="icon-action-btn"
              onClick={onMoveDown}
              title="Move down"
            >
              <ChevronDown size={14} />
            </button>
          )}

          {/* YouTube Search Link (Always accessible) */}
          <a
            className="yt-link-btn"
            href={
              exercise.videoUrl ||
              `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(exercise.name)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            title={`Search how to do ${exercise.name} on YouTube`}
          >
            <Play size={10} fill="#ef4444" color="#ef4444" />
            <span>YT ↗</span>
          </a>

          {/* Duplicate (Only in Planner) */}
          {mode === 'planner' && onDuplicate && (
            <button
              type="button"
              className="icon-action-btn"
              onClick={onDuplicate}
              title="Duplicate exercise"
            >
              <Copy size={13} />
            </button>
          )}

          {/* Delete (Only in Planner) */}
          {mode === 'planner' && onDelete && (
            <button
              type="button"
              className="icon-action-btn delete-btn"
              onClick={onDelete}
              title="Delete exercise"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Meta Row */}
      <div className="clean-meta-row" style={{ flexWrap: 'wrap', gap: '5px' }}>
        {weekNumber && weekNumber > 1 && (
          <span
            className="clean-badge"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              borderColor: 'rgba(239, 68, 68, 0.35)',
              fontWeight: 800,
            }}
          >
            ⚡ Week {weekNumber} Overload
          </span>
        )}
        <span className="clean-badge red">
          {wkCount} Working · {wuCount} Warmup
        </span>
        {exercise.equipment && (
          <span className="clean-badge" style={{ color: '#93c5fd', borderColor: 'rgba(147, 197, 253, 0.2)' }}>
            {exercise.equipment}
          </span>
        )}
        {muscleInfo.subMuscle && (
          <span
            className="clean-badge"
            style={{
              color: '#fed7aa',
              borderColor: 'rgba(254, 215, 170, 0.25)',
              fontWeight: 700,
              fontSize: '0.66rem',
            }}
          >
            {muscleInfo.subMuscle}
          </span>
        )}
        {exercise.movementPattern && (
          <span
            className="clean-badge"
            style={{
              color: '#cbd5e1',
              borderColor: 'rgba(203, 213, 225, 0.2)',
              fontSize: '0.64rem',
            }}
          >
            {exercise.movementPattern}
          </span>
        )}
        {exercise.requiresLoad === false && (
          <span className="clean-badge" style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
            Bodyweight / Cardio
          </span>
        )}
        {exercise.sets.length > 0 && (
          <span className="clean-badge">
            {exercise.sets[exercise.sets.length - 1].reps} Reps
          </span>
        )}
        {exercise.sets.length > 0 && exercise.sets[exercise.sets.length - 1].rpe && (
          <span className="clean-badge amber">
            RPE {exercise.sets[exercise.sets.length - 1].rpe}
          </span>
        )}
        {exercise.sets.length > 0 && exercise.sets[exercise.sets.length - 1].rest && (
          <span
            className="clean-badge"
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            onClick={() => onStartRest(exercise.sets[exercise.sets.length - 1].rest)}
            title="Start Rest Timer"
          >
            <Clock size={11} />
            <span>{exercise.sets[exercise.sets.length - 1].rest.replace('~', '')}</span>
          </span>
        )}
        <button
          type="button"
          onClick={handleToggleAllSets}
          title={allSetsCompleted ? 'Mark all incomplete' : 'Mark all sets complete'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: allSetsCompleted ? 'var(--accent-green)' : 'var(--text-dim)',
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={13} />
          <span>{allSetsCompleted ? 'ALL DONE' : 'FINISH'}</span>
        </button>
      </div>

      {/* Form Cues / Notes */}
      {exercise.notes ? (
        <div
          className="clean-notes-box"
          onClick={() => {
            if (mode === 'planner') setShowNotesEdit(true);
          }}
          style={{ cursor: mode === 'planner' ? 'pointer' : 'default' }}
          title={mode === 'planner' ? 'Click to edit notes' : undefined}
        >
          <span className="notes-tag">CUE</span>
          <span>{exercise.notes}</span>
        </div>
      ) : mode === 'planner' && showNotesEdit ? (
        <div style={{ marginBottom: '8px' }}>
          <textarea
            className="clean-input"
            rows={2}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add form cues, bench angle, tips..."
            style={{ fontSize: '0.76rem', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn-clean btn-sm"
              style={{ fontSize: '0.7rem', padding: '3px 8px' }}
              onClick={handleSaveNotes}
            >
              Save Cue
            </button>
            <button
              type="button"
              className="btn-clean btn-sm"
              style={{ fontSize: '0.7rem', padding: '3px 8px' }}
              onClick={() => setShowNotesEdit(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : mode === 'planner' ? (
        <button
          type="button"
          onClick={() => setShowNotesEdit(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: '0.68rem',
            cursor: 'pointer',
            marginBottom: '6px',
            display: 'block',
          }}
        >
          + Add form cue / notes
        </button>
      ) : null}

      {/* PREVIOUS PERFORMANCE ("LAST TIME") */}
      {lastPerformance && lastPerformance.sets.length > 0 && (
        <div className="last-time-box">
          <div className="last-time-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <History size={11} color="var(--accent-red)" />
              <span>LAST TIME (Week {lastPerformance.weekNumber} · {lastPerformance.dayOfWeek})</span>
            </span>
            <span style={{ opacity: 0.7 }}>Actual Saved</span>
          </div>
          <div className="last-time-content">
            {lastPerformance.sets.map((set, sIdx) => {
              const label = set.type === 'warmup' ? `W${sIdx + 1}` : `S${sIdx + 1}`;
              return (
                <span key={sIdx} className="last-time-item">
                  <strong style={{ color: set.type === 'warmup' ? '#fde68a' : '#fca5a5' }}>
                    {label}:
                  </strong>{' '}
                  {set.load ? `${set.load} ${set.unit}` : 'BW'} × {set.reps}
                  {set.rpe ? ` @ RPE ${set.rpe}` : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Sets List */}
      <div className="set-rows-wrap">
        {exercise.sets.map((set, sIdx) => {
          let typeIdx = 1;
          if (set.type === 'warmup') {
            warmupCounter++;
            typeIdx = warmupCounter;
          } else if (set.type === 'working') {
            workingCounter++;
            typeIdx = workingCounter;
          } else if (set.type === 'dropset') {
            dropsetCounter++;
            typeIdx = dropsetCounter;
          } else {
            failureCounter++;
            typeIdx = failureCounter;
          }

          return (
            <SetRow
              key={set.id || sIdx}
              set={set}
              index={sIdx}
              typeIndex={typeIdx}
              defaultUnit={defaultUnit}
              mode={mode}
              requiresLoad={exercise.requiresLoad !== false}
              trackingType={exercise.trackingType || (exercise.requiresLoad === false ? 'bodyweight_reps' : 'weight_reps')}
              onUpdate={(updated) => handleUpdateSet(sIdx, updated)}
              onDelete={() => handleDeleteSet(sIdx)}
              onStartRest={onStartRest}
            />
          );
        })}
      </div>

      {/* Add Set Quick Controls (Available in both Planner & Tracker mode) */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginTop: '8px',
          justifyContent: 'flex-start',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="btn-clean"
          style={{ fontSize: '0.72rem', padding: '5px 11px', borderRadius: '7px' }}
          onClick={() => handleAddSet('working')}
          title="Add a set to this exercise"
        >
          <Plus size={12} />
          <span>Add Set</span>
        </button>
        {mode === 'planner' ? (
          <>
            <button
              type="button"
              className="btn-clean"
              style={{ fontSize: '0.72rem', padding: '5px 10px', borderRadius: '7px', color: '#fde68a' }}
              onClick={() => handleAddSet('warmup')}
            >
              <Plus size={12} />
              <span>Warmup</span>
            </button>
            <button
              type="button"
              className="btn-clean"
              style={{ fontSize: '0.72rem', padding: '5px 9px', borderRadius: '7px', color: '#d8b4fe' }}
              onClick={() => handleAddSet('dropset')}
              title="Add Drop Set"
            >
              Drop
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-clean"
            style={{ fontSize: '0.72rem', padding: '5px 9px', borderRadius: '7px', color: '#fde68a' }}
            onClick={() => handleAddSet('warmup')}
            title="Add Warmup Set"
          >
            <Plus size={12} />
            <span>Warmup</span>
          </button>
        )}
      </div>
    </div>
  );
}
