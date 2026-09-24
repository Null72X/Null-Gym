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
  ALL_CATALOG_EXERCISES,
  CATALOG_CATEGORIES,
  CATALOG_EQUIPMENTS,
  matchCatalogCategory,
  SEVEN_MASTER_PILLARS,
  MusclePillar,
  deduplicateExercises,
  matchEquipment,
  matchDifficulty,
  matchLoadType,
} from '../../lib/exerciseCatalog';
import { getExerciseMuscleInfo, DEFAULT_DAY_SCHEDULE } from '../../lib/muscleMetadata';
import {
  Search,
  Plus,
  Play,
  BookOpen,
  Check,
  X,
  Calendar,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { searchExercises } from '../../lib/searchEngine';
import { HighlightedText } from '../../components/HighlightedText';
import ExerciseVideoModal from '../../components/ExerciseVideoModal';

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
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>(() => {
    if (typeof window !== 'undefined') return getSavedLibrary();
    return ALL_CATALOG_EXERCISES;
  });
  const [weeks, setWeeks] = useState<WeekPlan[]>(() => {
    if (typeof window !== 'undefined') return getSavedWeeks();
    return [];
  });
  const [defaultUnit, setDefaultUnit] = useState<WeightUnit>(() => {
    if (typeof window !== 'undefined') return getActiveSelection().unit;
    return 'kg';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [selectedLoadType, setSelectedLoadType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'muscle' | 'equipment'>('name_asc');
  const [displayCount, setDisplayCount] = useState<number>(48);
  const [isCreating, setIsCreating] = useState(false);
  const [videoModalExercise, setVideoModalExercise] = useState<ExerciseLibraryItem | null>(null);

  // Smooth responsive debounce for search execution without blocking input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  };

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

  const resetAllFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedCategory('All');
    setSelectedSubCategory('all');
    setSelectedEquipment('All');
    setSelectedLoadType('All');
    setSelectedDifficulty('All');
    setSortBy('name_asc');
    setDisplayCount(48);
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedCategory !== 'All' ||
    selectedSubCategory !== 'all' ||
    selectedEquipment !== 'All' ||
    selectedLoadType !== 'All' ||
    selectedDifficulty !== 'All' ||
    sortBy !== 'name_asc';

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

  // 1. Master Deduplicated Library (Unique by exercise ID)
  const cleanLibrary = useMemo(() => {
    return deduplicateExercises(library);
  }, [library]);

  // 2. Conjunction Filter (Muscle + Equipment + Load + Difficulty)
  const baseFiltered = useMemo(() => {
    return cleanLibrary.filter((item) => {
      const matchesCat = matchCatalogCategory(item, selectedCategory, selectedSubCategory);
      const matchesEq = matchEquipment(item.equipment, selectedEquipment);
      const matchesLoad = matchLoadType(item, selectedLoadType);
      const matchesDiff = matchDifficulty(item.difficulty, selectedDifficulty);
      return matchesCat && matchesEq && matchesLoad && matchesDiff;
    });
  }, [cleanLibrary, selectedCategory, selectedSubCategory, selectedEquipment, selectedLoadType, selectedDifficulty]);

  // 3. Search Matching & Relevance Scoring
  const searchFiltered = useMemo(() => {
    const trimmed = debouncedSearchTerm.trim();
    if (!trimmed) {
      return [...baseFiltered].sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'muscle')
          return a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name);
        if (sortBy === 'equipment')
          return (a.equipment || '').localeCompare(b.equipment || '') || a.name.localeCompare(b.name);
        return 0;
      });
    }

    const searchResults = searchExercises(baseFiltered, trimmed);

    if (sortBy === 'name_asc') {
      return searchResults.map((r) => r.item);
    }

    return [...searchResults]
      .sort((a, b) => {
        if (sortBy === 'name_desc') return b.item.name.localeCompare(a.item.name);
        if (sortBy === 'muscle')
          return (
            a.item.muscleGroup.localeCompare(b.item.muscleGroup) ||
            b.score - a.score ||
            a.item.name.localeCompare(b.item.name)
          );
        if (sortBy === 'equipment')
          return (
            (a.item.equipment || '').localeCompare(b.item.equipment || '') ||
            b.score - a.score ||
            a.item.name.localeCompare(b.item.name)
          );
        return b.score - a.score;
      })
      .map((r) => r.item);
  }, [baseFiltered, debouncedSearchTerm, sortBy]);

  // 4. Reset pagination / displayCount on any criteria transition
  useEffect(() => {
    setDisplayCount(48);
  }, [debouncedSearchTerm, selectedCategory, selectedSubCategory, selectedEquipment, selectedLoadType, selectedDifficulty, sortBy]);

  // 5. Final Rendered List (Single Source of Truth)
  const renderedExercises = useMemo(() => {
    return searchFiltered.slice(0, displayCount);
  }, [searchFiltered, displayCount]);

  const renderedCount = renderedExercises.length;
  const totalMatches = searchFiltered.length;

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
            Browse {cleanLibrary.length ? cleanLibrary.length.toLocaleString() : '1,323'} ExerciseDB movements across 7 Master Muscle Pillars with form animations &amp; YouTube tutorials. Add directly to any week and day.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="progress-pill">
            <div className="progress-num">
              {hasActiveFilters ? totalMatches.toLocaleString() : (cleanLibrary.length ? cleanLibrary.length.toLocaleString() : '1,323')}
            </div>
            <div className="progress-label">
              {hasActiveFilters ? 'Matching' : 'Total Exercises'}
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

      {/* Advanced Search & Filtering Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '4px 10px',
            gap: '8px',
          }}
        >
          <Search size={15} color="var(--accent-red)" />
          <input
            type="text"
            placeholder={`Search ${cleanLibrary.length ? cleanLibrary.length.toLocaleString() : '1,323'} exercises by name, muscle, cues, equipment...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '0.8rem',
              padding: '6px 0',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
            gap: '6px',
          }}
        >
          {/* Equipment Dropdown */}
          <select
            className="clean-input"
            value={selectedEquipment}
            onChange={(e) => setSelectedEquipment(e.target.value)}
            style={{ fontSize: '0.72rem', padding: '6px 8px', height: '34px' }}
            title="Filter by Equipment"
          >
            <option value="All">All Equipment</option>
            {CATALOG_EQUIPMENTS.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>

          {/* Tracking / Load Type Dropdown */}
          <select
            className="clean-input"
            value={selectedLoadType}
            onChange={(e) => setSelectedLoadType(e.target.value)}
            style={{ fontSize: '0.72rem', padding: '6px 8px', height: '34px' }}
            title="Filter by Tracking Type"
          >
            <option value="All">All Load Types</option>
            <option value="weighted">Weighted (Barbell/DB/Cable)</option>
            <option value="bodyweight">Bodyweight (Reps)</option>
            <option value="timed">Timed Holds (Sec)</option>
            <option value="cardio">Cardio &amp; Distance</option>
          </select>

          {/* Difficulty Dropdown */}
          <select
            className="clean-input"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            style={{ fontSize: '0.72rem', padding: '6px 8px', height: '34px' }}
            title="Filter by Difficulty"
          >
            <option value="All">All Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>

          {/* Sort By Dropdown */}
          <select
            className="clean-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ fontSize: '0.72rem', padding: '6px 8px', height: '34px' }}
            title="Sort Exercises"
          >
            <option value="name_asc">Sort: A to Z</option>
            <option value="name_desc">Sort: Z to A</option>
            <option value="muscle">Sort: Muscle Group</option>
            <option value="equipment">Sort: Equipment</option>
          </select>
        </div>

        {/* Active Filter Chips Bar */}
        {hasActiveFilters && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexWrap: 'wrap',
              paddingTop: '2px',
            }}
          >
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Active:
            </span>

            {searchTerm.trim() && (
              <span
                className="clean-badge"
                style={{
                  fontSize: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  padding: '2px 7px',
                }}
              >
                &ldquo;{searchTerm}&rdquo;
                <X size={10} style={{ cursor: 'pointer' }} onClick={handleClearSearch} />
              </span>
            )}

            {selectedCategory !== 'All' && (
              <span
                className="clean-badge"
                style={{
                  fontSize: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  padding: '2px 7px',
                }}
              >
                {selectedCategory}
                <X size={10} style={{ cursor: 'pointer' }} onClick={() => { setSelectedCategory('All'); setSelectedSubCategory('all'); }} />
              </span>
            )}

            {selectedSubCategory !== 'all' && (
              <span
                className="clean-badge"
                style={{
                  fontSize: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(239, 68, 68, 0.25)',
                  color: '#fca5a5',
                  borderColor: 'rgba(239, 68, 68, 0.5)',
                  padding: '2px 7px',
                }}
              >
                Focus: {selectedSubCategory}
                <X size={10} style={{ cursor: 'pointer' }} onClick={() => setSelectedSubCategory('all')} />
              </span>
            )}

            {selectedEquipment !== 'All' && (
              <span
                className="clean-badge"
                style={{
                  fontSize: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                }}
              >
                {selectedEquipment}
                <X size={10} style={{ cursor: 'pointer' }} onClick={() => setSelectedEquipment('All')} />
              </span>
            )}

            {selectedLoadType !== 'All' && (
              <span
                className="clean-badge"
                style={{
                  fontSize: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                }}
              >
                {selectedLoadType}
                <X size={10} style={{ cursor: 'pointer' }} onClick={() => setSelectedLoadType('All')} />
              </span>
            )}

            {selectedDifficulty !== 'All' && (
              <span
                className="clean-badge"
                style={{
                  fontSize: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                }}
              >
                {selectedDifficulty}
                <X size={10} style={{ cursor: 'pointer' }} onClick={() => setSelectedDifficulty('All')} />
              </span>
            )}

            <button
              type="button"
              className="btn-clean btn-sm"
              onClick={resetAllFilters}
              style={{
                fontSize: '0.62rem',
                padding: '1px 6px',
                color: 'var(--accent-red)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <RotateCcw size={10} />
              <span>Reset All</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. Primary 7 Master Muscle Pillars Navigation */}
      <div className="horizontal-pill-scroll">
        <button
          type="button"
          onClick={() => {
            setSelectedCategory('All');
            setSelectedSubCategory('all');
          }}
          style={{
            background: selectedCategory === 'All' ? 'rgba(239, 68, 68, 0.2)' : 'var(--card)',
            border: `1px solid ${selectedCategory === 'All' ? 'var(--accent-red)' : 'var(--border)'}`,
            color: selectedCategory === 'All' ? '#fff' : 'var(--text-dim)',
            borderRadius: '8px',
            padding: '5px 12px',
            fontSize: '0.7rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>All</span>
          <span style={{ opacity: 0.65, fontSize: '0.66rem' }}>({library.length})</span>
        </button>

        {SEVEN_MASTER_PILLARS.map((pillar) => {
          const isActive = selectedCategory === pillar.name;
          return (
            <button
              key={pillar.id}
              type="button"
              onClick={() => {
                setSelectedCategory(pillar.name);
                setSelectedSubCategory('all');
              }}
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
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{pillar.icon}</span>
              <span>{pillar.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Contextual Sub-Muscle Chips (Appears dynamically when a pillar is selected) */}
      {selectedCategory !== 'All' && (() => {
        const activePillar = SEVEN_MASTER_PILLARS.find((p) => p.name === selectedCategory);
        if (!activePillar || !activePillar.subCategories?.length) return null;
        return (
          <div
            className="horizontal-pill-scroll"
            style={{
              alignItems: 'center',
              gap: '5px',
              paddingBottom: '8px',
              marginBottom: '10px',
              background: 'rgba(255, 255, 255, 0.015)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '6px 8px',
            }}
          >
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                marginRight: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              Target:
            </span>
            {activePillar.subCategories.map((sub) => {
              const isSubActive = selectedSubCategory === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubCategory(sub.id)}
                  style={{
                    background: isSubActive ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isSubActive ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: isSubActive ? '#fff' : 'var(--text-muted)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '0.67rem',
                    fontWeight: isSubActive ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Search & Filter Result Status Bar (100% synchronized with rendered cards) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 2px',
          marginBottom: '10px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span>
          Showing <strong style={{ color: '#fff' }}>{renderedCount}</strong> exercise{renderedCount === 1 ? '' : 's'}
          {totalMatches > renderedCount && (
            <span style={{ color: 'var(--text-dim)', marginLeft: '4px' }}>
              (of {totalMatches} total)
            </span>
          )}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="btn-clean btn-sm"
            style={{ fontSize: '0.68rem', padding: '2px 8px', color: 'var(--accent-red)' }}
          >
            Reset All Filters
          </button>
        )}
      </div>

      {/* Exercise Cards List (Responsive 1-col on mobile, 2-col on desktop) */}
      <div className="responsive-grid-2">
        {renderedExercises.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '40px 16px' }}>
            <div className="empty-state-title" style={{ fontSize: '1.05rem', color: '#fff' }}>
              No exercises match {searchTerm ? `"${searchTerm}"` : 'selected filters'}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: '360px', margin: '6px auto 14px' }}>
              {searchTerm
                ? 'Try checking for typos, searching by target muscle (e.g. chest, lats, quads), or clearing equipment filters.'
                : 'No exercises match the selected category or equipment filters.'}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {searchTerm && (
                <button
                  type="button"
                  className="clean-btn primary"
                  style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                  onClick={handleClearSearch}
                >
                  Clear Search
                </button>
              )}
              <button
                type="button"
                className="btn-clean btn-sm"
                onClick={resetAllFilters}
              >
                Reset All Filters
              </button>
            </div>
          </div>
        ) : (
          renderedExercises.map((item, idx) => {
            const isAddingThis = addingExerciseId === item.id;
            const noLoad = item.requiresLoad === false;
            const muscleInfo = getExerciseMuscleInfo(item);

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
                      #{idx + 1} <HighlightedText text={item.name} query={searchTerm} />
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
                    {/* In-App Video & Animated Form Demo Button */}
                    <button
                      type="button"
                      className="yt-link-btn"
                      onClick={() => setVideoModalExercise(item)}
                      title={`Watch tutorial & form demonstration for ${item.name}`}
                    >
                      <Play size={10} fill="#ef4444" color="#ef4444" />
                      <span>Demo &amp; Video</span>
                    </button>

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
                        {[1, 2, 3, 4, 5, 6].map((wk) => (
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
                        {DEFAULT_DAY_SCHEDULE.map((s) => (
                          <option key={s.dayOfWeek} value={s.dayOfWeek}>
                            {s.dayOfWeek} · {s.title}
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
                  <span
                    className="clean-badge"
                    style={{
                      background: muscleInfo.pillarMeta.bg,
                      color: muscleInfo.pillarMeta.color,
                      borderColor: muscleInfo.pillarMeta.border,
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{muscleInfo.pillarMeta.icon}</span>
                    <span>{muscleInfo.displayPillar}</span>
                  </span>
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
                  {item.movementPattern && (
                    <span
                      className="clean-badge"
                      style={{
                        color: '#cbd5e1',
                        borderColor: 'rgba(203, 213, 225, 0.2)',
                        fontSize: '0.64rem',
                      }}
                    >
                      {item.movementPattern}
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
                    <span>
                      <HighlightedText text={item.notes} query={searchTerm} />
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Show More / Pagination */}
      {displayCount < totalMatches && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', marginBottom: '28px' }}>
          <button
            type="button"
            className="clean-btn primary"
            style={{ padding: '10px 24px', fontSize: '0.85rem', fontWeight: 600 }}
            onClick={() => setDisplayCount((prev) => prev + 48)}
          >
            Show More Exercises ({totalMatches - displayCount} remaining)
          </button>
        </div>
      )}

      {/* In-App Exercise Form & Video Modal */}
      {videoModalExercise && (
        <ExerciseVideoModal
          isOpen={!!videoModalExercise}
          onClose={() => setVideoModalExercise(null)}
          exercise={videoModalExercise}
        />
      )}

      {/* Toast */}
      <div className={`clean-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
}
