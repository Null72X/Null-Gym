'use client';

import React, { useState, useEffect } from 'react';
import WeekSelector from '../../components/WeekSelector';
import DayGrid from '../../components/DayGrid';
import ExerciseCard from '../../components/ExerciseCard';
import RestTimerBar from '../../components/RestTimerBar';
import CopyModal from '../../components/CopyModal';
import ExerciseLibraryModal from '../../components/ExerciseLibraryModal';
import {
  WeekPlan,
  Exercise,
  WeightUnit,
  WorkoutHistoryEntry,
  ExerciseLibraryItem,
} from '../../types/workout';
import {
  getSavedWeeks,
  saveWeeks,
  getSavedHistory,
  getSavedLibrary,
  saveLibrary,
  getActiveSelection,
  saveActiveSelection,
  applyAutoScaleToAllWeeks,
  getProgressionConfig,
} from '../../lib/storage';
import { getLastPerformance } from '../../lib/history';
import {
  Plus,
  Copy,
  Edit2,
  Check,
  Moon,
  Dumbbell,
  Clock,
  Sparkles,
  Layers,
  Trash2,
  Zap,
} from 'lucide-react';

export default function PlannerPage() {
  const [weeks, setWeeks] = useState<WeekPlan[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(0);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [copyModalState, setCopyModalState] = useState<{ isOpen: boolean; mode: 'day' | 'week' }>({
    isOpen: false,
    mode: 'day',
  });
  const [activeRestSeconds, setActiveRestSeconds] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isEditingHeader, setIsEditingHeader] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>('');
  const [focusDraft, setFocusDraft] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const loadedWeeks = getSavedWeeks();
    const loadedHistory = getSavedHistory();
    const loadedLibrary = getSavedLibrary();
    const active = getActiveSelection();

    setWeeks(loadedWeeks);
    setHistory(loadedHistory);
    setLibrary(loadedLibrary);
    setCurrentWeek(active.weekNumber || 1);
    setCurrentDayIndex(active.dayIndex || 0);
    setUnit(active.unit || 'kg');
    setIsLoaded(true);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  const handleSelectWeek = (w: number) => {
    setCurrentWeek(w);
    setIsEditingHeader(false);
    saveActiveSelection({ weekNumber: w, dayIndex: currentDayIndex, unit });
  };

  const handleSelectDay = (d: number) => {
    setCurrentDayIndex(d);
    setIsEditingHeader(false);
    saveActiveSelection({ weekNumber: currentWeek, dayIndex: d, unit });
  };

  const currentWeekData = weeks[currentWeek - 1] || weeks[0];
  const currentDayData = currentWeekData?.days[currentDayIndex] || currentWeekData?.days[0];

  // Open edit workout header
  const handleOpenEditHeader = () => {
    if (!currentDayData) return;
    setTitleDraft(currentDayData.title);
    setFocusDraft(currentDayData.focus);
    setIsEditingHeader(true);
  };

  // Save workout header
  const handleSaveHeader = () => {
    if (!currentDayData) return;
    const updatedWeeks = [...weeks];
    const day = updatedWeeks[currentWeek - 1].days[currentDayIndex];
    day.title = titleDraft.trim() || 'Workout';
    day.focus = focusDraft.trim() || 'General Focus';
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
    setIsEditingHeader(false);
    triggerToast('Workout updated');
  };

  // Toggle rest day
  const handleToggleRestDay = () => {
    if (!currentDayData) return;
    const updatedWeeks = [...weeks];
    const day = updatedWeeks[currentWeek - 1].days[currentDayIndex];
    day.isRestDay = !day.isRestDay;
    if (day.isRestDay) {
      day.title = 'Rest Day';
      day.focus = 'Active Recovery & Mobility';
    }
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
    triggerToast(day.isRestDay ? 'Marked as Rest Day' : 'Workout enabled');
  };

  // Update exercise
  const handleUpdateExercise = (exIdx: number, updatedEx: Exercise) => {
    const updatedWeeks = [...weeks];
    const day = updatedWeeks[currentWeek - 1]?.days[currentDayIndex];
    if (!day) return;

    day.exercises[exIdx] = updatedEx;
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
  };

  // Delete exercise
  const handleDeleteExercise = (exIdx: number) => {
    if (!confirm('Remove this exercise from the plan?')) return;
    const updatedWeeks = [...weeks];
    const day = updatedWeeks[currentWeek - 1]?.days[currentDayIndex];
    if (!day) return;

    day.exercises.splice(exIdx, 1);
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
    triggerToast('Exercise removed');
  };

  // Duplicate exercise
  const handleDuplicateExercise = (exIdx: number) => {
    const updatedWeeks = [...weeks];
    const day = updatedWeeks[currentWeek - 1]?.days[currentDayIndex];
    if (!day) return;

    const source = day.exercises[exIdx];
    const clone: Exercise = {
      ...source,
      id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${source.name} (Copy)`,
      sets: source.sets.map((s) => ({
        ...s,
        id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        completed: false,
      })),
      completed: false,
    };

    day.exercises.splice(exIdx + 1, 0, clone);
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
    triggerToast('Exercise duplicated');
  };

  // Reorder exercises
  const handleMoveExercise = (fromIdx: number, toIdx: number) => {
    const updatedWeeks = [...weeks];
    const day = updatedWeeks[currentWeek - 1]?.days[currentDayIndex];
    if (!day) return;

    const [moved] = day.exercises.splice(fromIdx, 1);
    day.exercises.splice(toIdx, 0, moved);
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
  };

  // Add exercise from library modal
  const handleAddExercise = (newEx: Exercise) => {
    const updatedWeeks = [...weeks];
    const day = updatedWeeks[currentWeek - 1]?.days[currentDayIndex];
    if (!day) return;

    day.exercises.push(newEx);
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
    triggerToast(`Added ${newEx.name}`);
  };

  // Save to library
  const handleSaveToLibrary = (item: ExerciseLibraryItem) => {
    const updatedLib = [item, ...library];
    setLibrary(updatedLib);
    saveLibrary(updatedLib);
  };

  // Copy Day operation
  const handleCopyDay = (targetWeekNum: number, targetDayIndex: number) => {
    const sourceDay = weeks[currentWeek - 1]?.days[currentDayIndex];
    if (!sourceDay) return;

    const updatedWeeks = [...weeks];
    const targetDay = updatedWeeks[targetWeekNum - 1]?.days[targetDayIndex];
    if (!targetDay) return;

    // Deep clone exercises with unique IDs
    const clonedExercises: Exercise[] = sourceDay.exercises.map((ex) => ({
      ...ex,
      id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sets: ex.sets.map((s) => ({
        ...s,
        id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        completed: false,
      })),
      completed: false,
    }));

    targetDay.title = sourceDay.title;
    targetDay.focus = sourceDay.focus;
    targetDay.isRestDay = sourceDay.isRestDay;
    targetDay.exercises = clonedExercises;
    targetDay.completed = false;

    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
    triggerToast(`Copied to Week ${targetWeekNum} · ${targetDay.dayOfWeek}!`);
  };

  // Copy Week operation
  const handleCopyWeek = (targetWeekNum: number) => {
    const sourceWeek = weeks[currentWeek - 1];
    if (!sourceWeek) return;

    const updatedWeeks = [...weeks];
    const targetWeek = updatedWeeks[targetWeekNum - 1];
    if (!targetWeek) return;

    targetWeek.days = sourceWeek.days.map((d, dIdx) => ({
      ...d,
      id: `w${targetWeekNum}_d${dIdx}`,
      exercises: d.exercises.map((ex) => ({
        ...ex,
        id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sets: ex.sets.map((s) => ({
          ...s,
          id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          completed: false,
        })),
        completed: false,
      })),
      completed: false,
    }));

    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
    triggerToast(`Copied entire Week ${currentWeek} to Week ${targetWeekNum}!`);
  };

  // 1-Click Auto-Scale Weeks 2, 3, and 4 from Week 1
  const handleAutoScaleWeeks = () => {
    const scaled = applyAutoScaleToAllWeeks();
    setWeeks(scaled);
    triggerToast('⚡ Weeks 2, 3 & 4 auto-scaled with progressive overload!');
  };

  if (!isLoaded || weeks.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>Loading Planner...</div>;
  }

  return (
    <div>
      {/* 4-Week Selector */}
      <WeekSelector selectedWeek={currentWeek} onSelectWeek={handleSelectWeek} />

      {/* Week 1 Auto-Progression Banner */}
      {currentWeek === 1 && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(20, 20, 29, 0.7) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap size={14} color="var(--accent-red)" />
              <span>Week 1 Baseline Routine</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Design Week 1, then 1-click auto-program Weeks 2, 3 &amp; 4 with progressive overload.
            </div>
          </div>
          <button
            type="button"
            className="btn-clean btn-primary btn-sm"
            onClick={handleAutoScaleWeeks}
            style={{ fontSize: '0.72rem', padding: '6px 10px', whiteSpace: 'nowrap' }}
          >
            <Sparkles size={12} />
            <span>Auto-Setup Weeks 2–4 ⚡</span>
          </button>
        </div>
      )}

      {/* 7-Day Grid */}
      <DayGrid
        days={currentWeekData.days}
        selectedDayIndex={currentDayIndex}
        onSelectDay={handleSelectDay}
      />

      {/* Day Summary & Inline Editor */}
      <section className="day-summary-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {isEditingHeader ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label className="clean-label">Workout Name</label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. Push #1, Legs, Upper..."
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="clean-label">Muscle Focus</label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. Chest · Shoulders · Triceps"
                  value={focusDraft}
                  onChange={(e) => setFocusDraft(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-clean btn-sm"
                onClick={() => setIsEditingHeader(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-clean btn-primary btn-sm"
                onClick={handleSaveHeader}
              >
                <Check size={12} />
                <span>Save</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-between">
            <div className="day-summary-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2>
                  {currentDayData.dayOfWeek} · {currentDayData.title}
                </h2>
                <button
                  type="button"
                  className="icon-action-btn"
                  style={{ width: '22px', height: '22px' }}
                  onClick={handleOpenEditHeader}
                  title="Rename workout or focus"
                >
                  <Edit2 size={11} />
                </button>
              </div>
              <p>{currentDayData.isRestDay ? 'Scheduled Rest Day' : currentDayData.focus}</p>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className={`btn-clean btn-sm ${currentDayData.isRestDay ? 'btn-danger' : ''}`}
                style={{ fontSize: '0.68rem', padding: '4px 8px', borderRadius: '7px' }}
                onClick={handleToggleRestDay}
                title="Toggle rest day"
              >
                <Moon size={12} />
                <span>{currentDayData.isRestDay ? 'Rest Day ✓' : 'Set Rest'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Copy Tools Row */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border)',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {currentDayData.exercises.length} Exercises Planned
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            {currentDayData.exercises.length > 0 && (
              <button
                type="button"
                className="btn-clean btn-sm"
                style={{ fontSize: '0.68rem', padding: '3px 8px', color: '#fca5a5' }}
                onClick={() => {
                  if (!confirm(`Remove all exercises from ${currentDayData.dayOfWeek}?`)) return;
                  const updatedWeeks = [...weeks];
                  updatedWeeks[currentWeek - 1].days[currentDayIndex].exercises = [];
                  setWeeks(updatedWeeks);
                  saveWeeks(updatedWeeks);
                  triggerToast('Day exercises cleared');
                }}
                title="Clear all exercises from this day"
              >
                <Trash2 size={11} />
                <span>Clear Day</span>
              </button>
            )}
            <button
              type="button"
              className="btn-clean btn-sm"
              style={{ fontSize: '0.68rem', padding: '3px 8px' }}
              onClick={() => setCopyModalState({ isOpen: true, mode: 'day' })}
              title="Copy this day to another day"
            >
              <Copy size={11} />
              <span>Copy Day</span>
            </button>
            <button
              type="button"
              className="btn-clean btn-sm"
              style={{ fontSize: '0.68rem', padding: '3px 8px' }}
              onClick={() => setCopyModalState({ isOpen: true, mode: 'week' })}
              title="Copy entire week to another week"
            >
              <Layers size={11} />
              <span>Copy Week {currentWeek}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Exercises Section */}
      {currentDayData.isRestDay ? (
        <div className="empty-state">
          <Sparkles size={32} color="var(--accent-amber)" style={{ margin: '0 auto 10px' }} />
          <div className="empty-state-title">Rest Day Scheduled</div>
          <p style={{ fontSize: '0.8rem', maxWidth: '300px', margin: '0 auto 14px' }}>
            No exercises planned for {currentDayData.dayOfWeek}. Click &ldquo;Set Rest&rdquo; above if you want to turn this into a workout day.
          </p>
        </div>
      ) : currentDayData.exercises.length === 0 ? (
        <div className="empty-state">
          <Dumbbell size={32} color="var(--text-dim)" style={{ margin: '0 auto 10px' }} />
          <div className="empty-state-title">No Exercises Added Yet</div>
          <p style={{ fontSize: '0.8rem', marginBottom: '14px' }}>
            Build your {currentDayData.title} routine. Select exercises from the library or create custom exercises.
          </p>
          <button
            type="button"
            className="btn-clean btn-primary"
            onClick={() => setIsLibraryOpen(true)}
          >
            <Plus size={14} />
            <span>Add Exercise</span>
          </button>
        </div>
      ) : (
        <div className="ex-card-list">
          {currentDayData.exercises.map((ex, exIdx) => {
            const lastPerf = getLastPerformance(ex.name, history, weeks, currentWeek);
            return (
              <ExerciseCard
                key={ex.id || exIdx}
                exercise={ex}
                index={exIdx}
                totalExercises={currentDayData.exercises.length}
                defaultUnit={unit}
                lastPerformance={lastPerf}
                mode="planner"
                weekNumber={currentWeek}
                onUpdate={(updated) => handleUpdateExercise(exIdx, updated)}
                onDelete={() => handleDeleteExercise(exIdx)}
                onDuplicate={() => handleDuplicateExercise(exIdx)}
                onMoveUp={() => handleMoveExercise(exIdx, exIdx - 1)}
                onMoveDown={() => handleMoveExercise(exIdx, exIdx + 1)}
                onStartRest={(restStr) => setActiveRestSeconds(90)}
              />
            );
          })}
        </div>
      )}

      {/* Add Exercise Floating / Bottom Button */}
      {!currentDayData.isRestDay && (
        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn-clean btn-primary w-full"
            style={{ padding: '12px', fontSize: '0.85rem' }}
            onClick={() => setIsLibraryOpen(true)}
          >
            <Plus size={16} />
            <span>Add Exercise to {currentDayData.title}</span>
          </button>
        </div>
      )}

      {/* Floating Rest Bar */}
      <RestTimerBar
        initialSeconds={activeRestSeconds}
        onDismiss={() => setActiveRestSeconds(null)}
      />

      {/* Exercise Library Modal */}
      <ExerciseLibraryModal
        isOpen={isLibraryOpen}
        library={library}
        defaultUnit={unit}
        onClose={() => setIsLibraryOpen(false)}
        onSelectExercise={handleAddExercise}
        onSaveToLibrary={handleSaveToLibrary}
      />

      {/* Copy Modal */}
      <CopyModal
        isOpen={copyModalState.isOpen}
        mode={copyModalState.mode}
        currentWeekNumber={currentWeek}
        currentDayName={currentDayData.dayOfWeek}
        currentDayIndex={currentDayIndex}
        weeks={weeks}
        onClose={() => setCopyModalState({ isOpen: false, mode: 'day' })}
        onCopyDay={handleCopyDay}
        onCopyWeek={handleCopyWeek}
      />

      {/* Toast Notification */}
      <div className={`clean-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}
