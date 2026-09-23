'use client';

import React, { useState, useMemo } from 'react';
import {
  ExerciseLibraryItem,
  Exercise,
  WorkoutSet,
  WeightUnit,
  TrackingType,
  ExerciseDifficulty,
} from '../types/workout';
import {
  CATALOG_CATEGORIES,
  CATALOG_EQUIPMENTS,
  matchCatalogCategory,
  SEVEN_MASTER_PILLARS,
  MusclePillar,
} from '../lib/exerciseCatalog';
import { getExerciseMuscleInfo } from '../lib/muscleMetadata';
import { X, Search, Plus, Play, ExternalLink } from 'lucide-react';

interface ExerciseLibraryModalProps {
  isOpen: boolean;
  library: ExerciseLibraryItem[];
  defaultUnit: WeightUnit;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  onSaveToLibrary: (item: ExerciseLibraryItem) => void;
}

export default function ExerciseLibraryModal({
  isOpen,
  library,
  defaultUnit,
  onClose,
  onSelectExercise,
  onSaveToLibrary,
}: ExerciseLibraryModalProps) {
  const [tab, setTab] = useState<'browse' | 'create'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [selectedLoadType, setSelectedLoadType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'muscle' | 'equipment'>('name_asc');

  // Custom exercise form state
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

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedSubCategory('all');
    setSelectedEquipment('All');
    setSelectedLoadType('All');
    setSelectedDifficulty('All');
    setSortBy('name_asc');
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedCategory !== 'All' ||
    selectedSubCategory !== 'all' ||
    selectedEquipment !== 'All' ||
    selectedLoadType !== 'All' ||
    selectedDifficulty !== 'All' ||
    sortBy !== 'name_asc';

  // Advanced multi-token search, multi-faceted filtering & smart sorting
  const filtered = useMemo(() => {
    const rawTokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const matches = library.filter((item) => {
      const matchesSearch =
        rawTokens.length === 0 ||
        rawTokens.every(
          (t) =>
            item.name.toLowerCase().includes(t) ||
            item.muscleGroup.toLowerCase().includes(t) ||
            (item.category && item.category.toLowerCase().includes(t)) ||
            (item.subMuscle && item.subMuscle.toLowerCase().includes(t)) ||
            (item.equipment && item.equipment.toLowerCase().includes(t)) ||
            (item.movementPattern && item.movementPattern.toLowerCase().includes(t)) ||
            (item.notes && item.notes.toLowerCase().includes(t)) ||
            (item.difficulty && item.difficulty.toLowerCase().includes(t))
        );

      const matchesCat = matchCatalogCategory(item, selectedCategory, selectedSubCategory);

      const matchesEq =
        selectedEquipment === 'All' ||
        (item.equipment && item.equipment.toLowerCase() === selectedEquipment.toLowerCase());

      const matchesLoad =
        selectedLoadType === 'All' ||
        (selectedLoadType === 'weighted' &&
          item.requiresLoad !== false &&
          item.trackingType !== 'bodyweight_reps') ||
        (selectedLoadType === 'bodyweight' &&
          (item.requiresLoad === false || item.trackingType === 'bodyweight_reps')) ||
        (selectedLoadType === 'timed' && item.trackingType === 'time_only') ||
        (selectedLoadType === 'cardio' &&
          (item.trackingType === 'cardio_metrics' ||
            item.muscleGroup.toLowerCase().includes('cardio')));

      const matchesDiff =
        selectedDifficulty === 'All' ||
        (item.difficulty &&
          item.difficulty.toLowerCase() === selectedDifficulty.toLowerCase());

      return matchesSearch && matchesCat && matchesEq && matchesLoad && matchesDiff;
    });

    return matches.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'muscle')
        return a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name);
      if (sortBy === 'equipment')
        return (a.equipment || '').localeCompare(b.equipment || '') || a.name.localeCompare(b.name);
      return 0;
    });
  }, [
    library,
    searchTerm,
    selectedCategory,
    selectedSubCategory,
    selectedEquipment,
    selectedLoadType,
    selectedDifficulty,
    sortBy,
  ]);

  if (!isOpen) return null;

  // Convert a library item to a concrete Exercise with its default sets
  const convertToExercise = (item: ExerciseLibraryItem): Exercise => {
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

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newLibItem: ExerciseLibraryItem = {
      id: `lib_${Date.now()}`,
      name: name.trim(),
      muscleGroup,
      category: muscleGroup,
      equipment,
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

    onSaveToLibrary(newLibItem);
    const exercise = convertToExercise(newLibItem);
    onSelectExercise(exercise);
    onClose();
  };

  return (
    <div className="clean-modal-backdrop" onClick={onClose}>
      <div
        className="clean-modal-content"
        style={{ maxWidth: '580px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn-clean ${tab === 'browse' ? 'btn-primary' : ''}`}
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
              onClick={() => setTab('browse')}
            >
              Browse Library ({library.length})
            </button>
            <button
              type="button"
              className={`btn-clean ${tab === 'create' ? 'btn-primary' : ''}`}
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
              onClick={() => setTab('create')}
            >
              + Create Custom
            </button>
          </div>
          <button type="button" className="icon-action-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {tab === 'browse' ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '8px', flexShrink: 0 }}>
              <input
                type="text"
                className="clean-input"
                placeholder="Search 570 exercises by name, muscle, equipment, pattern..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
                autoFocus
              />
              <Search
                size={14}
                color="var(--text-dim)"
                style={{ position: 'absolute', left: '10px', top: '9px' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Dropdown Filters Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '5px',
                marginBottom: '8px',
                flexShrink: 0,
              }}
            >
              <select
                className="clean-input"
                style={{ fontSize: '0.7rem', padding: '4px 6px', height: '30px' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Muscles ({CATALOG_CATEGORIES.length})</option>
                {CATALOG_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                className="clean-input"
                style={{ fontSize: '0.7rem', padding: '4px 6px', height: '30px' }}
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value)}
              >
                <option value="All">All Equipment ({CATALOG_EQUIPMENTS.length})</option>
                {CATALOG_EQUIPMENTS.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>

              <select
                className="clean-input"
                style={{ fontSize: '0.7rem', padding: '4px 6px', height: '30px' }}
                value={selectedLoadType}
                onChange={(e) => setSelectedLoadType(e.target.value)}
              >
                <option value="All">All Load Types</option>
                <option value="weighted">Weighted (Barbell/DB/Cable)</option>
                <option value="bodyweight">Bodyweight (Reps)</option>
                <option value="timed">Timed Holds (Sec)</option>
                <option value="cardio">Cardio &amp; Distance</option>
              </select>

              <select
                className="clean-input"
                style={{ fontSize: '0.7rem', padding: '4px 6px', height: '30px' }}
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
              >
                <option value="All">All Levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>

              <select
                className="clean-input"
                style={{ fontSize: '0.7rem', padding: '4px 6px', height: '30px' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="name_asc">Sort: A-Z</option>
                <option value="name_desc">Sort: Z-A</option>
                <option value="muscle">Sort: Muscle</option>
                <option value="equipment">Sort: Equipment</option>
              </select>
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexWrap: 'wrap',
                  marginBottom: '8px',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Active:
                </span>
                {searchTerm.trim() && (
                  <span
                    className="clean-badge"
                    style={{ fontSize: '0.62rem', padding: '1px 6px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
                  >
                    &ldquo;{searchTerm}&rdquo;
                    <X size={9} style={{ cursor: 'pointer', marginLeft: '3px' }} onClick={() => setSearchTerm('')} />
                  </span>
                )}
                {selectedCategory !== 'All' && (
                  <span
                    className="clean-badge"
                    style={{ fontSize: '0.62rem', padding: '1px 6px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
                  >
                    {selectedCategory}
                    <X size={9} style={{ cursor: 'pointer', marginLeft: '3px' }} onClick={() => { setSelectedCategory('All'); setSelectedSubCategory('all'); }} />
                  </span>
                )}
                {selectedSubCategory !== 'all' && (
                  <span
                    className="clean-badge"
                    style={{ fontSize: '0.62rem', padding: '1px 6px', background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.5)' }}
                  >
                    Focus: {selectedSubCategory}
                    <X size={9} style={{ cursor: 'pointer', marginLeft: '3px' }} onClick={() => setSelectedSubCategory('all')} />
                  </span>
                )}
                {selectedEquipment !== 'All' && (
                  <span className="clean-badge" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                    {selectedEquipment}
                    <X size={9} style={{ cursor: 'pointer', marginLeft: '3px' }} onClick={() => setSelectedEquipment('All')} />
                  </span>
                )}
                {selectedLoadType !== 'All' && (
                  <span className="clean-badge" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                    {selectedLoadType}
                    <X size={9} style={{ cursor: 'pointer', marginLeft: '3px' }} onClick={() => setSelectedLoadType('All')} />
                  </span>
                )}
                {selectedDifficulty !== 'All' && (
                  <span className="clean-badge" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                    {selectedDifficulty}
                    <X size={9} style={{ cursor: 'pointer', marginLeft: '3px' }} onClick={() => setSelectedDifficulty('All')} />
                  </span>
                )}
                <button
                  type="button"
                  className="btn-clean btn-sm"
                  onClick={resetAllFilters}
                  style={{ fontSize: '0.6rem', padding: '1px 5px', color: 'var(--accent-red)' }}
                >
                  Reset All
                </button>
              </div>
            )}

            {/* 1. Primary 7 Master Muscle Pillars */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                overflowX: 'auto',
                paddingBottom: '4px',
                marginBottom: '6px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedSubCategory('all');
                }}
                style={{
                  background:
                    selectedCategory === 'All'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${
                    selectedCategory === 'All' ? 'var(--accent-red)' : 'var(--border)'
                  }`,
                  color: selectedCategory === 'All' ? '#fff' : 'var(--text-dim)',
                  borderRadius: '7px',
                  padding: '3px 8px',
                  fontSize: '0.66rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                All ({library.length})
              </button>

              {SEVEN_MASTER_PILLARS.map((pillar) => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(pillar.name);
                    setSelectedSubCategory('all');
                  }}
                  style={{
                    background:
                      selectedCategory === pillar.name
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${
                      selectedCategory === pillar.name ? 'var(--accent-red)' : 'var(--border)'
                    }`,
                    color: selectedCategory === pillar.name ? '#fff' : 'var(--text-dim)',
                    borderRadius: '7px',
                    padding: '3px 8px',
                    fontSize: '0.66rem',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{pillar.icon}</span>
                  <span>{pillar.label}</span>
                </button>
              ))}
            </div>

            {/* 2. Contextual Sub-Category Chips */}
            {selectedCategory !== 'All' && (() => {
              const activePillar = SEVEN_MASTER_PILLARS.find((p) => p.name === selectedCategory);
              if (!activePillar || !activePillar.subCategories?.length) return null;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    overflowX: 'auto',
                    paddingBottom: '6px',
                    marginBottom: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '7px',
                    padding: '4px 6px',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono)',
                      marginRight: '2px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Focus:
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
                          borderRadius: '5px',
                          padding: '2px 6px',
                          fontSize: '0.64rem',
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

            {/* Result Count */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.68rem',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                marginBottom: '6px',
                flexShrink: 0,
              }}
            >
              <span>
                Showing {filtered.length} exercise{filtered.length === 1 ? '' : 's'}
              </span>
              {filtered.length === 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-red)',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear Filters ✕
                </button>
              )}
            </div>

            {/* Scrollable Exercise List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                overflowY: 'auto',
                flex: 1,
                paddingRight: '4px',
              }}
            >
              {filtered.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '36px 0',
                    color: 'var(--text-dim)',
                    fontSize: '0.8rem',
                  }}
                >
                  No exercises match your search filters.
                </div>
              ) : (
                filtered.map((item) => {
                  const noLoad = item.requiresLoad === false;
                  const muscleInfo = getExerciseMuscleInfo(item);
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.025)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease',
                      }}
                      onClick={() => {
                        onSelectExercise(convertToExercise(item));
                        onClose();
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            color: '#fff',
                            marginBottom: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>{item.name}</span>
                          {noLoad && (
                            <span
                              style={{
                                fontSize: '0.6rem',
                                padding: '1px 5px',
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
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            className="clean-badge"
                            style={{
                              fontSize: '0.6rem',
                              padding: '1px 5px',
                              background: muscleInfo.pillarMeta.bg,
                              color: muscleInfo.pillarMeta.color,
                              borderColor: muscleInfo.pillarMeta.border,
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <span>{muscleInfo.pillarMeta.icon}</span>
                            <span>{muscleInfo.displayPillar}</span>
                          </span>
                          {muscleInfo.subMuscle && (
                            <span
                              className="clean-badge"
                              style={{
                                fontSize: '0.6rem',
                                padding: '1px 5px',
                                color: '#fed7aa',
                                borderColor: 'rgba(254, 215, 170, 0.2)',
                                fontWeight: 700,
                              }}
                            >
                              {muscleInfo.subMuscle}
                            </span>
                          )}
                          {item.movementPattern && (
                            <span
                              className="clean-badge"
                              style={{
                                fontSize: '0.6rem',
                                padding: '1px 5px',
                                color: '#cbd5e1',
                                borderColor: 'rgba(203, 213, 225, 0.2)',
                              }}
                            >
                              {item.movementPattern}
                            </span>
                          )}
                          {item.equipment && (
                            <span
                              className="clean-badge"
                              style={{ fontSize: '0.6rem', padding: '1px 5px' }}
                            >
                              {item.equipment}
                            </span>
                          )}
                          {item.difficulty && (
                            <span
                              className="clean-badge amber"
                              style={{ fontSize: '0.6rem', padding: '1px 5px' }}
                            >
                              {item.difficulty}
                            </span>
                          )}
                          {item.videoUrl && (
                            <a
                              href={item.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={`Watch tutorial: ${item.name}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                color: '#fca5a5',
                                fontSize: '0.6rem',
                                textDecoration: 'none',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              <Play size={8} fill="#ef4444" color="#ef4444" />
                              <span>YT ↗</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-clean btn-sm"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          flexShrink: 0,
                        }}
                      >
                        <Plus size={12} />
                        <span>Add</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Create Custom Form */
          <form
            onSubmit={handleCreateCustom}
            style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}
          >
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
                id="modalRequiresLoad"
                checked={requiresLoad}
                onChange={(e) => setRequiresLoad(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label
                htmlFor="modalRequiresLoad"
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Requires External Load (Shows kg/lbs weight stepper). Uncheck for bodyweight,
                cardio, or mobility.
              </label>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label className="clean-label">YouTube Search URL</label>
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
                placeholder="Pause at chest, retract scapula, flare at 45°..."
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
              <button type="button" className="btn-clean" onClick={() => setTab('browse')}>
                Cancel
              </button>
              <button type="submit" className="btn-clean btn-primary">
                Save & Add Exercise
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
