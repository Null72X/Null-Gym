'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import WeekSelector from '../components/WeekSelector';
import DayGrid from '../components/DayGrid';
import ExerciseCard from '../components/ExerciseCard';
import RestTimerBar from '../components/RestTimerBar';
import {
  WeekPlan,
  Exercise,
  WeightUnit,
  WorkoutHistoryEntry,
} from '../types/workout';
import {
  getSavedWeeks,
  saveWeeks,
  getSavedHistory,
  saveHistory,
  getActiveSelection,
  saveActiveSelection,
  onCloudPlanUpdated,
  onCloudHistoryUpdated,
  onCloudSettingsUpdated,
} from '../lib/storage';
import { getLastPerformance } from '../lib/history';
import { getDayMuscleBreakdown } from '../lib/muscleMetadata';
import {
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Edit2,
  Dumbbell,
  Clock,
} from 'lucide-react';

export default function DashboardPage() {
  const [weeks, setWeeks] = useState<WeekPlan[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(0);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTimer, setActiveTimer] = useState<{
    seconds: number;
    mode: 'rest' | 'exercise';
    exerciseName?: string;
    exerciseIndex?: number;
    setIndex?: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load from storage on mount & listen to real-time multi-device cloud updates
  useEffect(() => {
    const loadedWeeks = getSavedWeeks();
    const loadedHistory = getSavedHistory();
    const active = getActiveSelection();

    setWeeks(loadedWeeks);
    setHistory(loadedHistory);
    setCurrentWeek(active.weekNumber || 1);
    setCurrentDayIndex(active.dayIndex || 0);
    setUnit(active.unit || 'kg');
    setIsLoaded(true);

    const unsubPlan = onCloudPlanUpdated((newWeeks) => {
      setWeeks(newWeeks);
    });

    const unsubHistory = onCloudHistoryUpdated((newHistory) => {
      setHistory(newHistory);
    });

    const unsubSettings = onCloudSettingsUpdated((newSettings) => {
      if (newSettings.weekNumber) setCurrentWeek(newSettings.weekNumber);
      if (newSettings.dayIndex !== undefined) setCurrentDayIndex(newSettings.dayIndex);
      if (newSettings.unit) setUnit(newSettings.unit);
    });

    return () => {
      unsubPlan();
      unsubHistory();
      unsubSettings();
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  const handleSelectWeek = (w: number) => {
    setCurrentWeek(w);
    saveActiveSelection({ weekNumber: w, dayIndex: currentDayIndex, unit });
  };

  const handleSelectDay = (d: number) => {
    setCurrentDayIndex(d);
    saveActiveSelection({ weekNumber: currentWeek, dayIndex: d, unit });
  };

  const toggleUnit = () => {
    const nextUnit: WeightUnit = unit === 'kg' ? 'lbs' : 'kg';
    setUnit(nextUnit);
    saveActiveSelection({ weekNumber: currentWeek, dayIndex: currentDayIndex, unit: nextUnit });
    triggerToast(`Unit set to ${nextUnit.toUpperCase()}`);
  };

  // Start rest timer from string e.g. "90s", "~2-3 min", "60s"
  const handleStartRest = (restStr: string) => {
    let sec = 90;
    const str = restStr.toLowerCase();
    if (str.includes('3-4')) sec = 210;
    else if (str.includes('2-3')) sec = 150;
    else if (str.includes('1-2')) sec = 90;
    else if (str.includes('15 sec') || str.includes('15s')) sec = 15;
    else if (str.includes('30s') || str.includes('30 sec')) sec = 30;
    else if (str.includes('60s') || str.includes('1 min')) sec = 60;
    else if (str.includes('120s') || str.includes('2 min')) sec = 120;
    else if (str.includes('180s') || str.includes('3 min')) sec = 180;
    else {
      const match = str.match(/\d+/);
      if (match) sec = parseInt(match[0], 10);
    }
    setActiveTimer({ seconds: sec, mode: 'rest' });
  };

  // Start active work timer for exercise
  const handleStartExerciseTimer = (
    exerciseName: string,
    durationSecs: number,
    exerciseIndex: number,
    setIndex: number
  ) => {
    setActiveTimer({
      seconds: durationSecs,
      mode: 'exercise',
      exerciseName,
      exerciseIndex,
      setIndex,
    });
    triggerToast(`⏱ Started timer: ${exerciseName} (${durationSecs}s)`);
  };

  // Automatically check off set when exercise timer completes or user clicks finish set
  const handleCompleteActiveSet = () => {
    if (!activeTimer || activeTimer.exerciseIndex === undefined || activeTimer.setIndex === undefined) return;
    const { exerciseIndex, setIndex } = activeTimer;

    const updatedWeeks = [...weeks];
    const targetDay = updatedWeeks[currentWeek - 1]?.days[currentDayIndex];
    if (!targetDay) return;
    const targetEx = targetDay.exercises[exerciseIndex];
    if (!targetEx || !targetEx.sets[setIndex]) return;

    targetEx.sets[setIndex].completed = true;
    targetEx.completed = targetEx.sets.every((s) => s.completed);
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);

    // Switch directly to Rest timer with the set's rest configuration
    const restStr = targetEx.sets[setIndex].rest || '90s';
    let restSec = 90;
    const match = restStr.match(/\d+/);
    if (match) restSec = parseInt(match[0], 10);

    setActiveTimer({
      seconds: restSec,
      mode: 'rest',
      exerciseName: targetEx.name,
    });
    triggerToast(`Set ${setIndex + 1} complete! Rest timer started.`);
  };

  // Update current day's exercise (weights / reps / completion tracking in tracker mode)
  const handleUpdateExercise = (exIdx: number, updatedEx: Exercise) => {
    const updatedWeeks = [...weeks];
    const targetDay = updatedWeeks[currentWeek - 1]?.days[currentDayIndex];
    if (!targetDay) return;

    targetDay.exercises[exIdx] = updatedEx;
    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
  };

  // Reset checkmarks for current day
  const handleResetDayCheckmarks = () => {
    if (!confirm('Reset all checkmarks for this day? Entered weights will be preserved.')) return;
    const updatedWeeks = [...weeks];
    const targetDay = updatedWeeks[currentWeek - 1]?.days[currentDayIndex];
    if (!targetDay) return;

    targetDay.completed = false;
    targetDay.exercises.forEach((ex) => {
      ex.completed = false;
      ex.sets.forEach((s) => {
        s.completed = false;
      });
    });

    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);
    triggerToast('Checkmarks reset');
  };

  // Mark entire workout completed & log to history
  const handleFinishWorkout = () => {
    const targetDay = weeks[currentWeek - 1]?.days[currentDayIndex];
    if (!targetDay) return;

    const updatedWeeks = [...weeks];
    const day = updatedWeeks[currentWeek - 1].days[currentDayIndex];
    day.completed = true;
    day.exercises.forEach((ex) => {
      ex.completed = true;
      ex.sets.forEach((s) => {
        s.completed = true;
      });
    });

    setWeeks(updatedWeeks);
    saveWeeks(updatedWeeks);

    // Compute volume and log to history
    let completedSets = 0;
    let totalVolume = 0;

    const exercisesLog = day.exercises.map((ex) => ({
      exerciseName: ex.name,
      sets: ex.sets.map((s) => {
        const load = typeof s.load === 'number' ? s.load : 0;
        const reps = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps), 10) || 0;
        if (load > 0) totalVolume += load * reps;
        completedSets++;
        return {
          type: s.type,
          load: s.load,
          unit: s.unit || unit,
          reps: s.reps,
          rpe: s.rpe,
          completed: true,
        };
      }),
    }));

    const newHistoryEntry: WorkoutHistoryEntry = {
      id: `hist_${Date.now()}`,
      date: new Date().toISOString(),
      weekNumber: currentWeek,
      dayOfWeek: day.dayOfWeek,
      workoutTitle: day.title,
      completedExercises: day.exercises.length,
      totalExercises: day.exercises.length,
      completedSets,
      totalSets: completedSets,
      totalVolumeKg: totalVolume,
      exercises: exercisesLog,
    };

    const updatedHistory = [newHistoryEntry, ...history];
    setHistory(updatedHistory);
    saveHistory(updatedHistory);

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
    triggerToast('Workout logged to history! 🎉');
  };

  if (!isLoaded || weeks.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>Loading Null Gym...</div>;
  }

  const currentWeekData = weeks[currentWeek - 1] || weeks[0];
  const currentDayData = currentWeekData?.days[currentDayIndex] || currentWeekData?.days[0];

  // Stats calculation
  const totalSets = currentDayData?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) || 0;
  const doneSets =
    currentDayData?.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    ) || 0;
  const totalExercises = currentDayData?.exercises.length || 0;
  const doneExercises =
    currentDayData?.exercises.filter((ex) => ex.sets.length > 0 && ex.sets.every((s) => s.completed))
      .length || 0;
  const workoutPercent = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;
  const muscleBreakdown = getDayMuscleBreakdown(currentDayData?.exercises || []);

  // Filter exercises by search
  const filteredExercises = (currentDayData?.exercises || []).filter((ex) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ex.name.toLowerCase().includes(q) ||
      (ex.muscleGroup && ex.muscleGroup.toLowerCase().includes(q)) ||
      (ex.notes && ex.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* 6-Week Segmented Control */}
      <WeekSelector selectedWeek={currentWeek} onSelectWeek={handleSelectWeek} />

      {/* 7-Day Switching Grid */}
      <DayGrid
        days={currentWeekData.days}
        selectedDayIndex={currentDayIndex}
        onSelectDay={handleSelectDay}
      />

      {/* Day Summary Card */}
      <section className="day-summary-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div className="day-summary-info">
            <h2>
              {currentDayData.dayOfWeek} · {currentDayData.title}
            </h2>
            <p>{currentDayData.isRestDay ? 'Scheduled Rest Day' : currentDayData.focus || 'Training Session'}</p>
          </div>

          <div className="progress-pill">
            <div className="progress-num">
              {doneSets}/{totalSets}
            </div>
            <div className="progress-label">
              {totalSets > 0 ? `${workoutPercent}% Sets` : 'No Sets'}
            </div>
          </div>
        </div>

        {/* Dynamic Muscle Pillar Tags */}
        {!currentDayData.isRestDay && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '8px' }}>
            {muscleBreakdown.length > 0 ? (
              muscleBreakdown.map((item) => (
                <span
                  key={item.pillar}
                  className="clean-badge"
                  style={{
                    background: item.meta.bg,
                    color: item.meta.color,
                    borderColor: item.meta.border,
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{item.meta.icon}</span>
                  <span>{item.pillar}</span>
                  <span style={{ opacity: 0.8, fontSize: '0.6rem' }}>
                    ({item.exerciseCount})
                  </span>
                </span>
              ))
            ) : (
              <span
                className="clean-badge"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#fca5a5',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                }}
              >
                Target: {currentDayData.focus || 'Push / Pull / Legs'}
              </span>
            )}
          </div>
        )}

        {/* Dynamic Visual Progress Bar */}
        {!currentDayData.isRestDay && totalSets > 0 && (
          <div className="workout-progress-track">
            <div
              className={`workout-progress-fill ${workoutPercent === 100 ? 'complete' : ''}`}
              style={{ width: `${workoutPercent}%` }}
            />
          </div>
        )}
      </section>

      {/* Quick Search & Unit Bar */}
      <div className="quick-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search exercises, muscles, form cues..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            className="unit-toggle-btn"
            onClick={toggleUnit}
            title="Toggle default unit (KG / LBS)"
          >
            {unit.toUpperCase()}
          </button>
          <button
            type="button"
            className="unit-toggle-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => handleStartRest('90s')}
            title="Start 90s Rest Timer"
          >
            <Clock size={13} color="var(--accent-red)" />
            <span>Rest</span>
          </button>
          <button
            type="button"
            className="unit-toggle-btn"
            onClick={handleResetDayCheckmarks}
            title="Reset checkmarks for today"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Rest Day Message or Exercise List */}
      {currentDayData.isRestDay ? (
        <div className="empty-state">
          <Sparkles size={32} color="var(--accent-amber)" style={{ margin: '0 auto 10px' }} />
          <div className="empty-state-title">Rest &amp; Recovery Day</div>
          <p style={{ fontSize: '0.8rem', maxWidth: '300px', margin: '0 auto' }}>
            Allow your muscles to recover, hydrate, and prepare for upcoming workouts.
          </p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? (
            <>
              <div className="empty-state-title">No exercises match &ldquo;{searchQuery}&rdquo;</div>
              <p style={{ fontSize: '0.8rem' }}>Try searching by muscle group or clear search query.</p>
            </>
          ) : (
            <>
              <Dumbbell size={32} color="var(--text-dim)" style={{ margin: '0 auto 10px' }} />
              <div className="empty-state-title">No Exercises Scheduled</div>
              <p style={{ fontSize: '0.8rem', maxWidth: '320px', margin: '0 auto' }}>
                Select a workout day from the grid above to start tracking your sets.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="ex-card-list">
          {filteredExercises.map((ex, exIdx) => {
            const lastPerf = getLastPerformance(ex.name, history, weeks, currentWeek);
            return (
              <ExerciseCard
                key={ex.id || exIdx}
                exercise={ex}
                index={exIdx}
                totalExercises={filteredExercises.length}
                defaultUnit={unit}
                lastPerformance={lastPerf}
                mode="tracker"
                weekNumber={currentWeek}
                onUpdate={(updated) => handleUpdateExercise(exIdx, updated)}
                onStartRest={handleStartRest}
                onStartExerciseTimer={(name, duration, setIdx) =>
                  handleStartExerciseTimer(name, duration, exIdx, setIdx)
                }
              />
            );
          })}
        </div>
      )}

      {/* Workout Bottom Action Bar */}
      {!currentDayData.isRestDay && totalExercises > 0 && (
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            gap: '8px',
          }}
        >
          <button
            type="button"
            className="btn-clean btn-primary"
            style={{ width: '100%', padding: '12px 14px' }}
            onClick={handleFinishWorkout}
          >
            <CheckCircle2 size={16} />
            <span>
              {workoutPercent === 100
                ? 'Save Workout to History ✓'
                : `Finish Workout (${doneExercises}/${totalExercises} Exercises)`}
            </span>
          </button>
        </div>
      )}

      {/* Floating Rest / Work Timer Bar */}
      <RestTimerBar
        initialSeconds={activeTimer ? activeTimer.seconds : null}
        mode={activeTimer?.mode || 'rest'}
        exerciseName={activeTimer?.exerciseName || ''}
        onDismiss={() => setActiveTimer(null)}
        onCompleteExerciseSet={handleCompleteActiveSet}
        onSwitchToRest={(restSecs) =>
          setActiveTimer({
            seconds: restSecs || 90,
            mode: 'rest',
            exerciseName: activeTimer?.exerciseName,
          })
        }
      />

      {/* Toast Notification */}
      <div className={`clean-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}
