'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  WorkoutHistoryEntry,
  PersonalRecord,
  WeekPlan,
} from '../../types/workout';
import { getSavedHistory, getSavedWeeks, onCloudHistoryUpdated, onCloudPlanUpdated } from '../../lib/storage';
import {
  getPersonalRecords,
  getExerciseProgression,
} from '../../lib/history';
import { ProgressionChart, WeeklyBarChart } from '../../components/Charts';
import {
  TrendingUp,
  Trophy,
  Calendar,
  Flame,
  Dumbbell,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Activity,
  Layers,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { searchItems } from '../../lib/searchEngine';
import { HighlightedText } from '../../components/HighlightedText';

export default function ProgressPage() {
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>(() => {
    if (typeof window !== 'undefined') return getSavedHistory();
    return [];
  });
  const [weeks, setWeeks] = useState<WeekPlan[]>(() => {
    if (typeof window !== 'undefined') return getSavedWeeks();
    return [];
  });
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>(() => {
    if (typeof window !== 'undefined') return getPersonalRecords(getSavedHistory());
    return [];
  });
  const [selectedExercise, setSelectedExercise] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const prs = getPersonalRecords(getSavedHistory());
      if (prs.length > 0) return prs[0].exerciseName;
      const loadedWeeks = getSavedWeeks();
      if (loadedWeeks[0]?.days[0]?.exercises[0]) return loadedWeeks[0].days[0].exercises[0].name;
    }
    return '';
  });
  const [expandedHistId, setExpandedHistId] = useState<string | null>(null);

  // Filters
  const [prSearch, setPrSearch] = useState<string>('');
  const [historyFilterWeek, setHistoryFilterWeek] = useState<number | 'all'>('all');
  const [historySearch, setHistorySearch] = useState<string>('');

  useEffect(() => {
    // Cloud listeners for background sync
    const unsubHistory = onCloudHistoryUpdated((newHistory) => {
      setHistory(newHistory);
      const updatedPrs = getPersonalRecords(newHistory);
      setPersonalRecords(updatedPrs);
    });

    const unsubPlan = onCloudPlanUpdated((newWeeks) => {
      setWeeks(newWeeks);
    });

    return () => {
      unsubHistory();
      unsubPlan();
    };
  }, []);

  // Compute 6-Week Completion Rates
  const weeklyRates = useMemo(() => {
    return [1, 2, 3, 4, 5, 6].map((wNum) => {
      const week = weeks[wNum - 1];
      if (!week) return { week: wNum, percent: 0, completedSets: 0, totalSets: 0 };

      let totalSets = 0;
      let completedSets = 0;

      week.days.forEach((d) => {
        d.exercises.forEach((ex) => {
          totalSets += ex.sets.length;
          completedSets += ex.sets.filter((s) => s.completed).length;
        });
      });

      const percent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
      return { week: wNum, percent, completedSets, totalSets };
    });
  }, [weeks]);

  // Overall Statistics
  const totalWorkoutsLogged = history.length;
  const totalSetsLogged = history.reduce((acc, h) => acc + h.completedSets, 0);
  const totalVolumeLifted = Math.round(
    history.reduce((acc, h) => acc + (h.totalVolumeKg || 0), 0)
  );

  // List of all unique exercise names ever recorded in history or plan
  const allExerciseNames = useMemo(() => {
    return Array.from(
      new Set([
        ...personalRecords.map((p) => p.exerciseName),
        ...weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.name))),
      ])
    ).sort();
  }, [personalRecords, weeks]);

  // Progression data for selected exercise
  const progressionData = useMemo(() => {
    return selectedExercise ? getExerciseProgression(selectedExercise, history) : [];
  }, [selectedExercise, history]);

  // Selected exercise PR summary & stats
  const selectedExPR = useMemo(() => {
    return personalRecords.find(
      (p) => p.exerciseName.toLowerCase() === selectedExercise.toLowerCase()
    );
  }, [personalRecords, selectedExercise]);

  const estimated1RM = useMemo(() => {
    if (!selectedExPR || !selectedExPR.maxWeight) return null;
    const repsNum =
      typeof selectedExPR.maxWeightReps === 'number'
        ? selectedExPR.maxWeightReps
        : parseInt(String(selectedExPR.maxWeightReps || 1), 10);
    if (isNaN(repsNum) || repsNum < 1) return selectedExPR.maxWeight;
    if (repsNum === 1) return selectedExPR.maxWeight;
    // Brzycki Formula: Weight * (36 / (37 - Reps))
    if (repsNum <= 10) {
      return Math.round(selectedExPR.maxWeight * (36 / (37 - repsNum)));
    }
    // Epley Formula for higher reps: Weight * (1 + 0.0333 * reps)
    return Math.round(selectedExPR.maxWeight * (1 + 0.0333 * repsNum));
  }, [selectedExPR]);

  // Filtered PR list with intelligent search & typo tolerance
  const filteredPRs = useMemo(() => {
    if (!prSearch.trim()) return personalRecords;
    const fields = [
      { name: 'exerciseName', weight: 10, isPrimary: true, getter: (pr: PersonalRecord) => pr.exerciseName },
    ];
    return searchItems(personalRecords, prSearch, fields).map((r) => r.item);
  }, [personalRecords, prSearch]);

  // Filtered History list with multi-field search (title, day, exercises)
  const filteredHistory = useMemo(() => {
    const weekFiltered =
      historyFilterWeek === 'all'
        ? history
        : history.filter((entry) => entry.weekNumber === historyFilterWeek);

    if (!historySearch.trim()) return weekFiltered;

    const fields = [
      { name: 'workoutTitle', weight: 9, isPrimary: true, getter: (entry: WorkoutHistoryEntry) => entry.workoutTitle },
      { name: 'dayOfWeek', weight: 5, getter: (entry: WorkoutHistoryEntry) => entry.dayOfWeek },
      {
        name: 'exercises',
        weight: 10,
        getter: (entry: WorkoutHistoryEntry) =>
          entry.exercises.map((e) => e.exerciseName).join(' '),
      },
    ];

    return searchItems(weekFiltered, historySearch, fields).map((r) => r.item);
  }, [history, historyFilterWeek, historySearch]);

  return (
    <div>
      {/* Header */}
      <section className="day-summary-card">
        <div className="day-summary-info">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="var(--accent-red)" />
            <span>Progress &amp; Performance Analytics</span>
          </h2>
          <p>
            6-week progression metrics, personal records, load volume, and completed workout logs.
          </p>
        </div>

        <div className="progress-pill">
          <div className="progress-num">{totalWorkoutsLogged}</div>
          <div className="progress-label">Workouts Logged</div>
        </div>
      </section>

      {/* Summary Stat Cards */}
      <div className="responsive-grid-4" style={{ marginBottom: '16px' }}>
        <div className="stat-summary-card">
          <div style={{ color: 'var(--accent-red)', marginBottom: '4px' }}>
            <Flame size={16} style={{ margin: '0 auto' }} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#fff',
            }}
          >
            {totalWorkoutsLogged}
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Sessions Done
          </div>
        </div>

        <div className="stat-summary-card">
          <div style={{ color: 'var(--accent-amber)', marginBottom: '4px' }}>
            <Dumbbell size={16} style={{ margin: '0 auto' }} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#fff',
            }}
          >
            {totalSetsLogged}
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Sets Completed
          </div>
        </div>

        <div className="stat-summary-card">
          <div style={{ color: '#38bdf8', marginBottom: '4px' }}>
            <Activity size={16} style={{ margin: '0 auto' }} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#fff',
            }}
          >
            {totalVolumeLifted > 0 ? `${totalVolumeLifted.toLocaleString()} kg` : '--'}
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Tonnage Lifted
          </div>
        </div>

        <div className="stat-summary-card">
          <div style={{ color: 'var(--accent-green)', marginBottom: '4px' }}>
            <Trophy size={16} style={{ margin: '0 auto' }} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#fff',
            }}
          >
            {personalRecords.length}
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            PRs Established
          </div>
        </div>
      </div>

      {/* 6-Week Completion Rates Bar Chart */}
      <WeeklyBarChart weeklyRates={weeklyRates} />

      {/* Exercise Progression Analytics & Chart */}
      <div className="clean-card" style={{ marginBottom: '16px' }}>
        <h3
          style={{
            fontSize: '0.9rem',
            fontWeight: 800,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '10px',
          }}
        >
          <TrendingUp size={15} color="var(--accent-red)" />
          <span>Exercise Progression &amp; 1RM Strength Curve</span>
        </h3>

        <div style={{ marginBottom: '10px' }}>
          <label className="clean-label">Select Exercise to Inspect Progression</label>
          <select
            className="clean-input"
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
          >
            {allExerciseNames.length === 0 && <option value="">No exercises tracked yet</option>}
            {allExerciseNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Highlights for Selected Exercise */}
        {selectedExercise && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '6px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                All-Time PR
              </div>
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: 'var(--accent-red)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: '2px',
                }}
              >
                {selectedExPR ? `${selectedExPR.maxWeight} ${selectedExPR.maxWeightUnit}` : '--'}
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                {selectedExPR?.maxWeightReps ? `× ${selectedExPR.maxWeightReps} reps` : 'No PR logged'}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Estimated 1RM
              </div>
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#6ee7b7',
                  fontFamily: 'var(--font-mono)',
                  marginTop: '2px',
                }}
              >
                {estimated1RM ? `${estimated1RM} ${selectedExPR?.maxWeightUnit || 'kg'}` : '--'}
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                Brzycki / Epley calculation
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Sessions Tracked
              </div>
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  marginTop: '2px',
                }}
              >
                {progressionData.length}
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                Total recorded history
              </div>
            </div>
          </div>
        )}

        <ProgressionChart
          data={progressionData}
          exerciseName={selectedExercise || 'Exercise'}
          unit={selectedExPR?.maxWeightUnit || 'kg'}
        />
      </div>

      {/* Personal Records Leaderboard */}
      <div className="clean-card" style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trophy size={15} color="var(--accent-amber)" />
            <span>Personal Records Leaderboard ({personalRecords.length})</span>
          </h3>

          {personalRecords.length > 5 && (
            <div style={{ position: 'relative', width: '200px' }}>
              <input
                type="text"
                className="clean-input"
                placeholder="Search PRs..."
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                style={{ fontSize: '0.72rem', padding: '4px 24px 4px 26px' }}
              />
              <Search
                size={12}
                color="var(--text-dim)"
                style={{ position: 'absolute', left: '8px', top: '8px' }}
              />
              {prSearch && (
                <button
                  type="button"
                  onClick={() => setPrSearch('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '5px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {personalRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <Trophy size={28} color="var(--text-dim)" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div>No Personal Records established yet.</div>
            <p style={{ fontSize: '0.74rem', marginTop: '4px' }}>
              Log workout sets with loads in the tracker to automatically establish PRs.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
            {filteredPRs.map((pr, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
                onClick={() => setSelectedExercise(pr.exerciseName)}
                title="Click to view progression curve"
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#fff' }}>
                    <HighlightedText text={pr.exerciseName} query={prSearch} />
                  </div>
                  <div
                    style={{
                      fontSize: '0.66rem',
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--font-mono)',
                      marginTop: '1px',
                    }}
                  >
                    Week {pr.weekNumber || 1} · {pr.date ? new Date(pr.date).toLocaleDateString() : 'Recorded'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      color: '#f87171',
                    }}
                  >
                    {pr.maxWeight} {pr.maxWeightUnit}
                  </div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    × {pr.maxWeightReps} reps
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workout History Log */}
      <div className="clean-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={15} color="var(--accent-red)" />
            <span>Workout History Log ({history.length})</span>
          </h3>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {history.length > 2 && (
              <div style={{ position: 'relative', width: '180px' }}>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="Search logs & exercises..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{ fontSize: '0.72rem', padding: '4px 24px 4px 26px' }}
                />
                <Search
                  size={12}
                  color="var(--text-dim)"
                  style={{ position: 'absolute', left: '8px', top: '8px' }}
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '5px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Week Filter Tabs */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {(['all', 1, 2, 3, 4, 5, 6] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`btn-clean btn-sm ${historyFilterWeek === w ? 'btn-primary' : ''}`}
                  style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                  onClick={() => setHistoryFilterWeek(w)}
                >
                  {w === 'all' ? 'All Weeks' : `Wk ${w}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <Calendar size={28} color="var(--text-dim)" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div>No completed workouts logged yet.</div>
            <p style={{ fontSize: '0.74rem', marginTop: '4px', maxWidth: '320px', margin: '4px auto 14px' }}>
              When you finish your session in the tracker and click &ldquo;Save Workout to History&rdquo;, it will appear here.
            </p>
            <Link href="/" className="btn-clean btn-primary btn-sm">
              <span>Go to Workout</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
              No workout logs match {historySearch ? `"${historySearch}"` : 'selected week'}
            </div>
            <p style={{ fontSize: '0.74rem' }}>Try clearing your search or selecting &ldquo;All Weeks&rdquo;.</p>
            {historySearch && (
              <button
                type="button"
                className="clean-btn primary"
                style={{ marginTop: '10px', padding: '4px 12px', fontSize: '0.72rem' }}
                onClick={() => setHistorySearch('')}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredHistory.map((entry) => {
              const isExpanded = expandedHistId === entry.id;

              return (
                <div
                  key={entry.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedHistId(isExpanded ? null : entry.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <CheckCircle size={13} color="var(--accent-green)" />
                        <span>
                          Week {entry.weekNumber} · {entry.dayOfWeek} (
                          <HighlightedText text={entry.workoutTitle} query={historySearch} />
                          )
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-dim)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: '2px',
                        }}
                      >
                        {new Date(entry.date).toLocaleDateString()} · {entry.completedExercises} Exercises ·{' '}
                        {entry.completedSets} Sets
                        {entry.totalVolumeKg ? ` · ${Math.round(entry.totalVolumeKg)} kg volume` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="icon-action-btn"
                      style={{ border: 'none', background: 'none' }}
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>

                  {/* Expanded exercise details */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {entry.exercises.map((ex, exIdx) => (
                        <div key={exIdx} style={{ marginBottom: '8px' }}>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: '#cbd5e1',
                              marginBottom: '3px',
                            }}
                          >
                            <HighlightedText text={ex.exerciseName} query={historySearch} />
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {ex.sets.map((s, sIdx) => {
                              const isWu = s.type === 'warmup';
                              const label = isWu ? `W${sIdx + 1}` : `S${sIdx + 1}`;

                              let metricStr = '';
                              if (s.duration && s.distance) {
                                metricStr = `${s.duration} · ${s.distance}`;
                              } else if (s.duration) {
                                metricStr = `${s.duration}`;
                              } else if (s.load && s.load > 0) {
                                metricStr = `${s.load} ${s.unit} × ${s.reps}`;
                              } else {
                                metricStr = `BW × ${s.reps}`;
                              }

                              return (
                                <span
                                  key={sIdx}
                                  className="clean-badge"
                                  style={{
                                    fontSize: '0.64rem',
                                    background: isWu
                                      ? 'rgba(245,158,11,0.1)'
                                      : 'rgba(239,68,68,0.1)',
                                    color: isWu ? '#fde68a' : '#fca5a5',
                                    fontFamily: 'var(--font-mono)',
                                    padding: '2px 6px',
                                  }}
                                >
                                  <strong>{label}:</strong> {metricStr}
                                  {s.rpe ? ` @ RPE ${s.rpe}` : ''}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
