'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ExerciseLibraryItem,
  Exercise,
  WorkoutSet,
  WeekPlan,
  WeightUnit,
  TrackingType,
} from '../../types/workout';
import {
  getSavedLibrary,
  saveLibrary,
  getSavedWeeks,
  saveWeeks,
  getActiveSelection,
} from '../../lib/storage';
import {
  CATALOG_CATEGORIES,
  CATALOG_EQUIPMENTS,
  matchCatalogCategory,
} from '../../lib/exerciseCatalog';
import {
  Search,
  Plus,
  Play,
  BookOpen,
  Check,
  X,
  Calendar,
  RotateCcw,
} from 'lucide-react';

const POPULAR_CATEGORIES = [
  { name: 'All', label: 'All (570)' },
  { name: 'Chest', label: 'Chest' },
  { name: 'Back (Lats)', label: 'Back (Lats)' },
  { name: 'Back (Upper / Mid)', label: 'Back (Upper / Mid)' },
  { name: 'Shoulders', label: 'Shoulders' },
  { name: 'Shoulders (Front)', label: 'Front Delts' },
  { name: 'Shoulders (Side)', label: 'Side Delts' },
  { name: 'Shoulders (Rear)', label: 'Rear Delts' },
  { name: 'Biceps', label: 'Biceps' },
  { name: 'Triceps', label: 'Triceps' },
  { name: 'Quads', label: 'Quads' },
  { name: 'Hamstrings', label: 'Hamstrings' },
  { name: 'Glutes', label: 'Glutes' },
  { name: 'Calves', label: 'Calves' },
  { name: 'Abs', label: 'Abs & Core' },
  { name: 'Forearms & Grip', label: 'Forearms' },
  { name: 'Cardio', label: 'Cardio' },
  { name: 'Calisthenics', label: 'Calisthenics' },
  { name: 'Kettlebell', label: 'Kettlebell' },
  { name: 'Mobility', label: 'Mobility' },
  { name: 'Stretching', label: 'Stretching' },
];

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export default function LibraryPage() {
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [weeks, setWeeks] = useState<WeekPlan[]>([]);
  const [defaultUnit, setDefaultUnit] = useState<WeightUnit>('kg');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [isCreating, setIsCreating] = useState(false);

  // Target picker for direct Add to Plan
  const [addingExerciseId, setAddingExerciseId] = useState<string | null>(null);
  const [targetWeek, setTargetWeek] = useState(1);
  const [targetDay, setTargetDay] = useState<string>('Monday');

  // Custom exercise form states
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('Chest');
  const [equipment, setEquipment] = useState('Barbell');
  const [videoUrl, setVideoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [warmupSets, setWarmupSets] = useState(1);
  const [workingSets, setWorkingSets] = useState(3);
  const [reps, setReps] = useState('10-12');
  const [rpe, setRpe] = useState('9');
  const [rest, setRest] = useState('90s');
  const [requiresLoad, setRequiresLoad] = useState(true);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setLibrary(getSavedLibrary());
    const savedWeeks = getSavedWeeks();
    setWeeks(savedWeeks);
    const active = getActiveSelection();
    setDefaultUnit(active.unit || 'kg');
    setTargetWeek(active.weekNumber || 1);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const resetForm = () => {
    setName('');
    setMuscleGroup('Chest');
    setEquipment('Barbell');
    setVideoUrl('');
    setNotes('');
    setWarmupSets(1);
    setWorkingSets(3);
    setReps('10-12');
    setRpe('9');
    setRest('90s');
    setRequiresLoad(true);
    setIsCreating(false);
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newItem: ExerciseLibraryItem = {
      id: `lib_${Date.now()}`,
      name: name.trim(),
      muscleGroup,
      category: muscleGroup,
      equipment: equipment.trim(),
      videoUrl:
        videoUrl.trim() ||
        `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(name.trim())}`,
      notes: notes.trim(),
      requiresLoad,
      trackingType: requiresLoad ? 'weight_reps' : 'bodyweight_reps',
      defaultWarmupSets: warmupSets,
      defaultWorkingSets: workingSets,
      defaultReps: reps.trim() || '10',
      defaultRpe: rpe.trim() || '9',
      defaultRest: rest.trim() || '90s',
    };

    const updated = [newItem, ...library];
    setLibrary(updated);
    saveLibrary(updated);
    triggerToast(`"${newItem.name}" added to library`);
    resetForm();
  };

  // Convert library item to concrete exercise
  const buildExercise = (item: ExerciseLibraryItem): Exercise => {
    const sets: WorkoutSet[] = [];
    const wu = item.defaultWarmupSets !== undefined ? item.defaultWarmupSets : 1;
    const wk = item.defaultWorkingSets !== undefined ? item.defaultWorkingSets : 3;
    const itemReps = item.defaultReps || (item.trackingType === 'time_only' ? '45s' : '10');
    const itemRpe = item.defaultRpe || '9';
    const itemRest = item.defaultRest || '90s';
    const hasLoad = item.requiresLoad !== undefined ? item.requiresLoad : true;
    const trackingType: TrackingType =
      item.trackingType || (hasLoad ? 'weight_reps' : 'bodyweight_reps');

    for (let w = 1; w <= wu; w++) {
      sets.push({
        id: `set_wu_${Date.now()}_${w}`,
        type: 'warmup',
        load: '',
        unit: defaultUnit,
        reps: itemReps,
        rpe: '6',
        rest: '60s',
        completed: false,
      });
    }
    for (let k = 1; k <= wk; k++) {
      sets.push({
        id: `set_wk_${Date.now()}_${k}`,
        type: 'working',
        load: '',
        unit: defaultUnit,
        reps: itemReps,
        rpe: itemRpe,
        rest: itemRest,
        completed: false,
      });
    }

    return {
      id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: item.name,
      muscleGroup: item.muscleGroup,
      category: item.category || item.muscleGroup,
      subMuscle: item.subMuscle,
      equipment: item.equipment,
      videoUrl: item.videoUrl,
      notes: item.notes,
      movementPattern: item.movementPattern,
      requiresLoad: hasLoad,
      trackingType,
      unilateral: item.unilateral,
      difficulty: item.difficulty,
      sets,
      completed: false,
    };
  };

  // Add exercise directly to selected week & day in planner
  const handleConfirmAddToPlan = (item: ExerciseLibraryItem) => {
    const freshWeeks = getSavedWeeks();
    const targetWeekObj = freshWeeks.find((w) => w.weekNumber === targetWeek);
    if (!targetWeekObj) {
      triggerToast('Error: Target week not found');
      return;
    }

    const targetDayObj = targetWeekObj.days.find((d) => d.dayOfWeek === targetDay);
    if (!targetDayObj) {
      triggerToast('Error: Target day not found');
      return;
    }

    const newEx = buildExercise(item);
    targetDayObj.exercises.push(newEx);
    if (targetDayObj.isRestDay) {
      targetDayObj.isRestDay = false;
      targetDayObj.title = targetDay;
      targetDayObj.focus = item.muscleGroup;
    }

    saveWeeks(freshWeeks);
    setWeeks(freshWeeks);
    setAddingExerciseId(null);
    triggerToast(`Added "${item.name}" to Week ${targetWeek} · ${targetDay}!`);
  };

  // Robust, smart filter that guarantees 100% accurate results for all buttons
  const filtered = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    return library.filter((item) => {
      const matchesSearch =
        query === '' ||
        item.name.toLowerCase().includes(query) ||
        item.muscleGroup.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.subMuscle && item.subMuscle.toLowerCase().includes(query)) ||
        (item.equipment && item.equipment.toLowerCase().includes(query)) ||
        (item.movementPattern && item.movementPattern.toLowerCase().includes(query)) ||
        (item.notes && item.notes.toLowerCase().includes(query));

      const matchesCat = matchCatalogCategory(item, selectedCategory);

      const matchesEq =
        selectedEquipment === 'All' ||
        (item.equipment && item.equipment.toLowerCase() === selectedEquipment.toLowerCase());

      return matchesSearch && matchesCat && matchesEq;
    });
  }, [library, searchTerm, selectedCategory, selectedEquipment]);

  return (
    <div>
      {/* Day Summary Card (Matches Tracker, Planner & Progress Layout) */}
      <section className="day-summary-card">
        <div className="day-summary-info">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--accent-red)" />
            <span>Master Exercise Library</span>
          </h2>
          <p>
            Browse 570 curated exercises with YouTube tutorials. Add directly to any week and day.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="progress-pill">
            <div className="progress-num">{filtered.length}</div>
            <div className="progress-label">
              {filtered.length === library.length ? 'Total Exercises' : 'Filtered'}
            </div>
          </div>

          <button
            type="button"
            className="btn-clean btn-primary btn-sm"
            onClick={() => {
              resetForm();
              setIsCreating(!isCreating);
            }}
          >
            {isCreating ? <X size={13} /> : <Plus size={13} />}
            <span>{isCreating ? 'Close' : 'New Exercise'}</span>
          </button>
        </div>
      </section>

      {/* Inline Create Form */}
      {isCreating && (
        <div
          className="clean-card"
          style={{ marginBottom: '14px', border: '1px solid var(--accent-red)' }}
        >
          <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginBottom: '10px' }}>
            Add Custom Exercise to Library
          </h3>

          <form onSubmit={handleCreateCustom}>
            <div style={{ marginBottom: '10px' }}>
              <label className="clean-label">Exercise Name *</label>
              <input
                type="text"
                required
                className="clean-input"
                placeholder="e.g. Incline Dumbbell Press"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <div>
                <label className="clean-label">Muscle Category</label>
                <select
                  className="clean-input"
                  value={muscleGroup}
                  onChange={(e) => setMuscleGroup(e.target.value)}
                >
                  {CATALOG_CATEGORIES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="clean-label">Equipment</label>
                <select
                  className="clean-input"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                >
                  {CATALOG_EQUIPMENTS.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Load requirement toggle */}
            <div
              style={{
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <input
                type="checkbox"
                id="pageRequiresLoad"
                checked={requiresLoad}
                onChange={(e) => setRequiresLoad(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label
                htmlFor="pageRequiresLoad"
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Requires External Load (Shows kg/lbs stepper). Uncheck for bodyweight, cardio, or
                mobility.
              </label>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label className="clean-label">YouTube Tutorial URL (Optional)</label>
              <input
                type="url"
                className="clean-input"
                placeholder="https://www.youtube.com/results?search_query=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label className="clean-label">Form Cues / Setup Notes</label>
              <textarea
                className="clean-input"
                rows={2}
                placeholder="Form execution cues and setup notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '6px',
                marginBottom: '14px',
              }}
            >
              <div>
                <label className="clean-label">Working Sets</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="clean-input"
                  value={workingSets}
                  onChange={(e) => setWorkingSets(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div>
                <label className="clean-label">Warmup Sets</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="clean-input"
                  value={warmupSets}
                  onChange={(e) => setWarmupSets(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div>
                <label className="clean-label">Target Reps</label>
                <input
                  type="text"
                  className="clean-input"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-clean" onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" className="btn-clean btn-primary">
                <Check size={14} />
                <span>Save to Library</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Bar: Search Input + Clean Equipment Dropdown (Matches New folder design) */}
      <div className="quick-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search exercises, cues, muscles, patterns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="unit-toggle-btn"
          value={selectedEquipment}
          onChange={(e) => setSelectedEquipment(e.target.value)}
          title="Filter by Equipment"
          style={{
            cursor: 'pointer',
            paddingRight: '6px',
            fontSize: '0.72rem',
          }}
        >
          <option value="All">All Equipment</option>
          {CATALOG_EQUIPMENTS.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
        {(searchTerm || selectedCategory !== 'All' || selectedEquipment !== 'All') && (
          <button
            type="button"
            className="unit-toggle-btn"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('All');
              setSelectedEquipment('All');
            }}
            title="Reset filters"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Sleek Category Filter Pills (Matches dayGrid aesthetic) */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '12px',
        }}
      >
        {POPULAR_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              style={{
                background: isActive ? 'rgba(239, 68, 68, 0.2)' : 'var(--card)',
                border: `1px solid ${isActive ? 'var(--accent-red)' : 'var(--border)'}`,
                color: isActive ? '#fff' : 'var(--text-dim)',
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '0.7rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Exercise Cards List (Identical to New folder and Tracker card styles) */}
      <div className="ex-card-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No exercises found</div>
            <p style={{ fontSize: '0.8rem' }}>
              No catalog exercises match &ldquo;{searchTerm || selectedCategory}&rdquo;.
            </p>
            <button
              type="button"
              className="btn-clean btn-sm"
              style={{ marginTop: '10px' }}
              onClick={() => {
                setSelectedCategory('All');
                setSelectedEquipment('All');
                setSearchTerm('');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filtered.map((item, idx) => {
            const isAddingThis = addingExerciseId === item.id;
            const noLoad = item.requiresLoad === false;

            return (
              <div key={item.id} className="clean-card">
                <div className="clean-card-header">
                  <div
                    className="clean-ex-title"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      #{idx + 1} {item.name}
                    </span>
                    {noLoad && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#6ee7b7',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        BW / No Load
                      </span>
                    )}
                  </div>

                  <div className="card-actions-group">
                    {/* YouTube Video Search Link */}
                    {item.videoUrl && (
                      <a
                        className="yt-link-btn"
                        href={item.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Watch tutorial: how to do ${item.name}`}
                      >
                        <Play size={10} fill="#ef4444" color="#ef4444" />
                        <span>YT ↗</span>
                      </a>
                    )}

                    {/* Direct Add to Plan Button */}
                    <button
                      type="button"
                      className={`btn-clean btn-sm ${isAddingThis ? 'btn-primary' : ''}`}
                      onClick={() => setAddingExerciseId(isAddingThis ? null : item.id)}
                      style={{
                        padding: '4px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                      }}
                    >
                      <Plus size={12} />
                      <span>{isAddingThis ? 'Cancel' : 'Add to Plan'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Week & Day Target Picker */}
                {isAddingThis && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid var(--accent-red)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginBottom: '10px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Calendar size={13} color="var(--accent-red)" />
                      <span>ADD TO:</span>
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Week:</span>
                      <select
                        className="clean-input"
                        style={{ fontSize: '0.72rem', padding: '3px 8px', width: 'auto' }}
                        value={targetWeek}
                        onChange={(e) => setTargetWeek(parseInt(e.target.value, 10))}
                      >
                        {[1, 2, 3, 4].map((wk) => (
                          <option key={wk} value={wk}>
                            Week {wk}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Day:</span>
                      <select
                        className="clean-input"
                        style={{ fontSize: '0.72rem', padding: '3px 8px', width: 'auto' }}
                        value={targetDay}
                        onChange={(e) => setTargetDay(e.target.value)}
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="btn-clean btn-primary btn-sm"
                      onClick={() => handleConfirmAddToPlan(item)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.72rem',
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check size={12} />
                      <span>Confirm Add</span>
                    </button>
                  </div>
                )}

                {/* Metadata Row */}
                <div className="clean-meta-row">
                  <span className="clean-badge red">{item.muscleGroup}</span>
                  {item.subMuscle && (
                    <span className="clean-badge" style={{ color: '#fed7aa' }}>
                      {item.subMuscle}
                    </span>
                  )}
                  {item.equipment && <span className="clean-badge">{item.equipment}</span>}
                  {item.difficulty && (
                    <span className="clean-badge amber">{item.difficulty}</span>
                  )}
                  <span className="clean-badge" style={{ fontFamily: 'var(--font-mono)' }}>
                    {item.defaultWorkingSets || 3} Work ·{' '}
                    {item.defaultWarmupSets !== undefined ? item.defaultWarmupSets : 1} Warmup
                  </span>
                  <span className="clean-badge" style={{ fontFamily: 'var(--font-mono)' }}>
                    {item.defaultReps || '10'} Reps
                  </span>
                  {item.defaultRpe && (
                    <span className="clean-badge amber" style={{ fontFamily: 'var(--font-mono)' }}>
                      RPE {item.defaultRpe}
                    </span>
                  )}
                  {item.defaultRest && (
                    <span className="clean-badge">⏱ {item.defaultRest}</span>
                  )}
                </div>

                {/* Notes / Form Cue */}
                {item.notes && (
                  <div className="clean-notes-box">
                    <span className="notes-tag">CUE</span>
                    <span>{item.notes}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Toast */}
      <div className={`clean-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}
