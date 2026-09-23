import { Exercise, ExerciseLibraryItem, DayWorkout } from '../types/workout';

export interface MusclePillarMeta {
  key: string;
  name: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

export const MASTER_PILLAR_METADATA: Record<string, MusclePillarMeta> = {
  Chest: {
    key: 'Chest',
    name: 'Chest',
    icon: '🛡️',
    color: '#f87171',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  Back: {
    key: 'Back',
    name: 'Back',
    icon: '🦅',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  Shoulders: {
    key: 'Shoulders',
    name: 'Shoulders',
    icon: '🏹',
    color: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  Arms: {
    key: 'Arms',
    name: 'Arms',
    icon: '💪',
    color: '#c084fc',
    bg: 'rgba(168, 85, 247, 0.14)',
    border: 'rgba(168, 85, 247, 0.3)',
  },
  Legs: {
    key: 'Legs',
    name: 'Legs',
    icon: '🦵',
    color: '#34d399',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  Core: {
    key: 'Core',
    name: 'Core',
    icon: '🧱',
    color: '#fb923c',
    bg: 'rgba(249, 115, 22, 0.14)',
    border: 'rgba(249, 115, 22, 0.3)',
  },
  Neck: {
    key: 'Neck',
    name: 'Neck',
    icon: '🥋',
    color: '#f472b6',
    bg: 'rgba(236, 72, 153, 0.14)',
    border: 'rgba(236, 72, 153, 0.3)',
  },
  Functional: {
    key: 'Functional',
    name: 'Functional',
    icon: '⚡',
    color: '#818cf8',
    bg: 'rgba(99, 102, 241, 0.14)',
    border: 'rgba(99, 102, 241, 0.3)',
  },
};

const DEFAULT_META: MusclePillarMeta = {
  key: 'General',
  name: 'General',
  icon: '🏋️',
  color: '#e2e8f0',
  bg: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.16)',
};

/**
 * Standard 7-Day Push/Pull/Legs Schedule
 * Mon: Push 1, Tue: Pull 1, Wed: Leg 1, Thu: Push 2, Fri: Pull 2, Sat: Leg 2, Sun: Rest Day
 */
export interface DayScheduleTemplate {
  dayOfWeek: DayWorkout['dayOfWeek'];
  title: string;
  focus: string;
  isRestDay: boolean;
  targetPillars: string[];
}

export const DEFAULT_DAY_SCHEDULE: DayScheduleTemplate[] = [
  {
    dayOfWeek: 'Monday',
    title: 'Push 1',
    focus: 'Chest · Shoulders · Triceps',
    isRestDay: false,
    targetPillars: ['Chest', 'Shoulders', 'Arms'],
  },
  {
    dayOfWeek: 'Tuesday',
    title: 'Pull 1',
    focus: 'Back · Biceps · Rear Delts',
    isRestDay: false,
    targetPillars: ['Back', 'Arms', 'Shoulders'],
  },
  {
    dayOfWeek: 'Wednesday',
    title: 'Leg 1',
    focus: 'Quads · Hamstrings · Calves',
    isRestDay: false,
    targetPillars: ['Legs'],
  },
  {
    dayOfWeek: 'Thursday',
    title: 'Push 2',
    focus: 'Chest · Shoulders · Triceps',
    isRestDay: false,
    targetPillars: ['Chest', 'Shoulders', 'Arms'],
  },
  {
    dayOfWeek: 'Friday',
    title: 'Pull 2',
    focus: 'Back · Biceps · Rear Delts',
    isRestDay: false,
    targetPillars: ['Back', 'Arms', 'Shoulders'],
  },
  {
    dayOfWeek: 'Saturday',
    title: 'Leg 2',
    focus: 'Quads · Hamstrings · Calves',
    isRestDay: false,
    targetPillars: ['Legs'],
  },
  {
    dayOfWeek: 'Sunday',
    title: 'Rest Day',
    focus: 'Rest & Recovery',
    isRestDay: true,
    targetPillars: [],
  },
];

/**
 * Accurately resolves an exercise or catalog item into its Master Pillar & Sub-Muscle
 */
export function getExerciseMuscleInfo(item: Partial<Exercise> | Partial<ExerciseLibraryItem>): {
  pillar: string;
  pillarMeta: MusclePillarMeta;
  subMuscle: string;
  displayPillar: string;
} {
  const mg = (item.muscleGroup || '').trim().toLowerCase();
  const sub = (item.subMuscle || '').trim();
  const cat = (item.category || '').trim().toLowerCase();
  const name = (item.name || '').trim().toLowerCase();

  // 1. CHEST
  if (mg === 'chest' || cat === 'chest' || mg.includes('pectoral')) {
    return {
      pillar: 'Chest',
      pillarMeta: MASTER_PILLAR_METADATA.Chest,
      subMuscle: sub || (name.includes('incline') ? 'Upper Chest' : name.includes('decline') ? 'Lower Chest' : 'Chest'),
      displayPillar: 'Chest',
    };
  }

  // 2. BACK
  if (mg === 'back' || cat === 'back' || mg.includes('lat') || mg.includes('trapezius')) {
    return {
      pillar: 'Back',
      pillarMeta: MASTER_PILLAR_METADATA.Back,
      subMuscle: sub || (name.includes('lat') || name.includes('pulldown') || name.includes('pull-up') ? 'Lats' : name.includes('shrug') ? 'Traps' : 'Back'),
      displayPillar: 'Back',
    };
  }

  // 3. SHOULDERS
  if (mg === 'shoulders' || cat === 'shoulders' || mg.includes('deltoid')) {
    return {
      pillar: 'Shoulders',
      pillarMeta: MASTER_PILLAR_METADATA.Shoulders,
      subMuscle: sub || (name.includes('lateral') ? 'Side Delts' : name.includes('rear') ? 'Rear Delts' : 'Shoulders'),
      displayPillar: 'Shoulders',
    };
  }

  // 4. ARMS (Biceps, Triceps, Forearms)
  if (
    mg === 'biceps' ||
    mg === 'triceps' ||
    mg === 'forearms & grip' ||
    mg === 'forearms' ||
    cat === 'biceps' ||
    cat === 'triceps' ||
    cat === 'arms' ||
    mg === 'arms'
  ) {
    const defaultSub = mg === 'biceps' || cat === 'biceps' ? 'Biceps' : mg === 'triceps' || cat === 'triceps' ? 'Triceps' : 'Forearms & Grip';
    return {
      pillar: 'Arms',
      pillarMeta: MASTER_PILLAR_METADATA.Arms,
      subMuscle: sub || defaultSub,
      displayPillar: 'Arms',
    };
  }

  // 5. LEGS (Quads, Hamstrings, Glutes, Calves, Adductors)
  if (
    mg === 'quads' ||
    mg === 'hamstrings' ||
    mg === 'glutes' ||
    mg === 'calves' ||
    mg === 'hips & adductors' ||
    mg === 'legs' ||
    cat === 'quads' ||
    cat === 'hamstrings' ||
    cat === 'glutes' ||
    cat === 'calves' ||
    cat === 'legs'
  ) {
    let defaultSub = 'Legs';
    if (mg === 'quads' || cat === 'quads') defaultSub = 'Quads';
    else if (mg === 'hamstrings' || cat === 'hamstrings') defaultSub = 'Hamstrings';
    else if (mg === 'glutes' || cat === 'glutes') defaultSub = 'Glutes';
    else if (mg === 'calves' || cat === 'calves') defaultSub = 'Calves';
    else if (mg === 'hips & adductors') defaultSub = 'Adductors & Hips';

    return {
      pillar: 'Legs',
      pillarMeta: MASTER_PILLAR_METADATA.Legs,
      subMuscle: sub || defaultSub,
      displayPillar: 'Legs',
    };
  }

  // 6. CORE / ABS
  if (mg === 'abs' || mg === 'core' || cat === 'abs' || cat === 'core' || mg.includes('oblique')) {
    return {
      pillar: 'Core',
      pillarMeta: MASTER_PILLAR_METADATA.Core,
      subMuscle: sub || (name.includes('oblique') ? 'Obliques' : 'Abs & Core'),
      displayPillar: 'Core',
    };
  }

  // 7. NECK
  if (mg === 'neck' || cat === 'neck' || name.includes('neck')) {
    return {
      pillar: 'Neck',
      pillarMeta: MASTER_PILLAR_METADATA.Neck,
      subMuscle: sub || 'Neck & Cervical',
      displayPillar: 'Neck',
    };
  }

  // 8. FUNCTIONAL / CARDIO
  if (
    mg.startsWith('cardio') ||
    mg === 'hiit' ||
    mg === 'liss' ||
    mg === 'calisthenics' ||
    mg === 'kettlebell' ||
    mg === 'olympic lifts' ||
    mg === 'plyometrics' ||
    mg === 'mobility' ||
    mg === 'functional' ||
    cat === 'functional'
  ) {
    return {
      pillar: 'Functional',
      pillarMeta: MASTER_PILLAR_METADATA.Functional,
      subMuscle: sub || (item.equipment === 'Bodyweight' ? 'Calisthenics' : 'Cardio & Conditioning'),
      displayPillar: 'Functional',
    };
  }

  return {
    pillar: item.muscleGroup || 'General',
    pillarMeta: DEFAULT_META,
    subMuscle: sub || item.muscleGroup || 'General',
    displayPillar: item.muscleGroup || 'General',
  };
}

/**
 * Calculates a clean breakdown of all muscle pillars present in a workout day
 */
export function getDayMuscleBreakdown(exercises: Exercise[]): Array<{
  pillar: string;
  meta: MusclePillarMeta;
  exerciseCount: number;
  setCount: number;
  subMuscles: string[];
}> {
  if (!exercises || exercises.length === 0) return [];

  const map = new Map<
    string,
    { meta: MusclePillarMeta; exerciseCount: number; setCount: number; subMuscles: Set<string> }
  >();

  exercises.forEach((ex) => {
    const { pillar, pillarMeta, subMuscle } = getExerciseMuscleInfo(ex);
    const existing = map.get(pillar) || {
      meta: pillarMeta,
      exerciseCount: 0,
      setCount: 0,
      subMuscles: new Set<string>(),
    };

    existing.exerciseCount += 1;
    existing.setCount += (ex.sets || []).length;
    if (subMuscle) existing.subMuscles.add(subMuscle);
    map.set(pillar, existing);
  });

  return Array.from(map.entries()).map(([pillar, data]) => ({
    pillar,
    meta: data.meta,
    exerciseCount: data.exerciseCount,
    setCount: data.setCount,
    subMuscles: Array.from(data.subMuscles),
  }));
}
