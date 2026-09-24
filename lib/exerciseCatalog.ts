// Master Exercise Library (1,323 ExerciseDB Exercises) with animated demonstrations,
// YouTube search links, equipment types, and intelligent tracking types.
import { ExerciseLibraryItem } from '../types/workout';
import exercisesData from './exerciseCatalogData.json';

export const ALL_CATALOG_EXERCISES: ExerciseLibraryItem[] = exercisesData as unknown as ExerciseLibraryItem[];

export const CATALOG_CATEGORIES: string[] = Array.from(
  new Set(ALL_CATALOG_EXERCISES.map((e) => e.muscleGroup))
).sort();

export const CATALOG_EQUIPMENTS: string[] = Array.from(
  new Set(ALL_CATALOG_EXERCISES.map((e) => e.equipment))
).sort();

export interface MusclePillar {
  id: string;
  name: string;
  label: string;
  icon: string;
  subCategories: { id: string; label: string }[];
}

export const SEVEN_MASTER_PILLARS: MusclePillar[] = [
  {
    id: 'chest',
    name: 'Chest',
    label: 'Chest',
    icon: '🛡️',
    subCategories: [
      { id: 'all', label: 'All Chest' },
      { id: 'upper', label: 'Upper Chest' },
      { id: 'mid', label: 'Mid Chest' },
      { id: 'lower', label: 'Lower Chest' },
      { id: 'flyes', label: 'Flyes & Cables' },
    ],
  },
  {
    id: 'back',
    name: 'Back',
    label: 'Back',
    icon: '🦅',
    subCategories: [
      { id: 'all', label: 'All Back' },
      { id: 'lats', label: 'Lats (Width)' },
      { id: 'upper_back', label: 'Upper Back & Rhomboids' },
      { id: 'traps', label: 'Trapezius (Traps)' },
      { id: 'lower_back', label: 'Lower Back & Erectors' },
    ],
  },
  {
    id: 'shoulders',
    name: 'Shoulders',
    label: 'Shoulders',
    icon: '🏹',
    subCategories: [
      { id: 'all', label: 'All Shoulders' },
      { id: 'front', label: 'Front Delts' },
      { id: 'side', label: 'Side Delts' },
      { id: 'rear', label: 'Rear Delts' },
      { id: 'rotator', label: 'Rotator Cuff' },
    ],
  },
  {
    id: 'arms',
    name: 'Arms',
    label: 'Arms',
    icon: '💪',
    subCategories: [
      { id: 'all', label: 'All Arms' },
      { id: 'biceps', label: 'Biceps & Long Head' },
      { id: 'brachialis', label: 'Brachialis & Hammers' },
      { id: 'triceps', label: 'Triceps' },
      { id: 'forearms', label: 'Forearms & Grip' },
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    label: 'Legs',
    icon: '🦵',
    subCategories: [
      { id: 'all', label: 'All Legs' },
      { id: 'quads', label: 'Quadriceps' },
      { id: 'hamstrings', label: 'Hamstrings' },
      { id: 'glutes', label: 'Glutes' },
      { id: 'calves', label: 'Calves' },
      { id: 'adductors', label: 'Adductors & Hips' },
      { id: 'tibialis', label: 'Tibialis' },
    ],
  },
  {
    id: 'core',
    name: 'Core',
    label: 'Core & Abs',
    icon: '🧱',
    subCategories: [
      { id: 'all', label: 'All Core' },
      { id: 'abs_upper_lower', label: 'Upper & Lower Abs' },
      { id: 'obliques', label: 'Obliques & Rotation' },
      { id: 'deep_core', label: 'Deep Stabilizers & Vacuum' },
      { id: 'serratus', label: 'Serratus Anterior' },
    ],
  },
  {
    id: 'neck',
    name: 'Neck',
    label: 'Neck',
    icon: '🥋',
    subCategories: [
      { id: 'all', label: 'All Neck' },
      { id: 'flexion', label: 'Neck Flexion (Front)' },
      { id: 'extension', label: 'Neck Extension (Rear/Harness)' },
      { id: 'lateral', label: 'Lateral Neck (Sides)' },
      { id: 'isometric', label: 'Isometrics & 4-Way Machine' },
    ],
  },
  {
    id: 'functional',
    name: 'Functional',
    label: 'Functional',
    icon: '⚡',
    subCategories: [
      { id: 'all', label: 'All Functional' },
      { id: 'cardio', label: 'Cardio & HIIT' },
      { id: 'calisthenics', label: 'Calisthenics' },
      { id: 'kettlebell', label: 'Kettlebells' },
      { id: 'mobility', label: 'Mobility & Stretching' },
    ],
  },
];

export function matchCatalogCategory(
  item: ExerciseLibraryItem,
  selectedPillar: string,
  selectedSub: string = 'all'
): boolean {
  if (!selectedPillar || selectedPillar === 'All') return true;
  const pillar = selectedPillar.toLowerCase().trim();
  const subFilter = (selectedSub || 'all').toLowerCase().trim();
  const mg = (item.muscleGroup || '').toLowerCase().trim();
  const sub = (item.subMuscle || '').toLowerCase().trim();
  const cat = (item.category || '').toLowerCase().trim();
  const name = (item.name || '').toLowerCase().trim();
  const pattern = (item.movementPattern || '').toLowerCase().trim();

  // 1. CHEST PILLAR
  if (pillar === 'chest' || pillar === 'chest (pectorals)') {
    const isChest = mg === 'chest' || cat === 'chest' || sub.includes('pectoral');
    if (!isChest) return false;
    if (subFilter === 'all') return true;
    if (subFilter === 'upper') return sub.includes('upper') || name.includes('incline') || name.includes('low-to-high');
    if (subFilter === 'mid') return sub.includes('mid') || name.includes('flat') || name.includes('bench press') || name.includes('push-up');
    if (subFilter === 'lower') return sub.includes('lower') || name.includes('decline') || name.includes('dip') || name.includes('high-to-low');
    if (subFilter === 'flyes') return pattern.includes('adduction') || name.includes('fly') || name.includes('crossover') || name.includes('pec deck');
    return true;
  }

  // 2. BACK PILLAR
  if (pillar === 'back' || pillar === 'back (posterior chain)') {
    const isBack = mg === 'back' || cat === 'back' || sub.includes('lat') || sub.includes('trap');
    if (!isBack) return false;
    if (subFilter === 'all') return true;
    if (subFilter === 'lats') return sub.includes('lat') || name.includes('lat') || name.includes('pulldown') || name.includes('pull-up') || name.includes('chin-up') || name.includes('pullover');
    if (subFilter === 'upper_back') return sub.includes('upper back') || sub.includes('rhomboid') || name.includes('row') || name.includes('face pull') || name.includes('t-bar');
    if (subFilter === 'traps') return sub.includes('trapezius') || sub.includes('trap') || name.includes('shrug') || name.includes('y-raise');
    if (subFilter === 'lower_back') return sub.includes('lower back') || sub.includes('erector') || sub.includes('spine') || name.includes('deadlift') || name.includes('good morning') || name.includes('hyperextension') || name.includes('back extension');
    return true;
  }

  // 3. SHOULDERS PILLAR
  if (pillar === 'shoulders' || pillar === 'shoulders (deltoids)') {
    const isShoulder = mg === 'shoulders' || cat === 'shoulders' || sub.includes('delt');
    if (!isShoulder) return false;
    if (subFilter === 'all') return true;
    if (subFilter === 'front') return sub.includes('front') || name.includes('overhead') || name.includes('military') || name.includes('front raise') || name.includes('shoulder press') || name.includes('arnold');
    if (subFilter === 'side') return sub.includes('lateral') || name.includes('lateral') || name.includes('side raise');
    if (subFilter === 'rear') return sub.includes('rear') || name.includes('rear') || name.includes('reverse fly');
    if (subFilter === 'rotator') return sub.includes('rotator') || name.includes('external rotation') || name.includes('face pull');
    return true;
  }

  // 4. ARMS PILLAR
  if (pillar === 'arms' || pillar === 'arms (biceps & triceps)') {
    const isArm = mg === 'arms' || mg === 'biceps' || mg === 'triceps' || cat === 'arms' || sub.includes('bicep') || sub.includes('tricep') || sub.includes('forearm');
    if (!isArm) return false;
    if (subFilter === 'all') return true;
    if (subFilter === 'biceps') return (sub.includes('bicep') || name.includes('curl')) && !name.includes('hammer') && !name.includes('reverse');
    if (subFilter === 'brachialis') return name.includes('hammer') || name.includes('reverse curl') || sub.includes('brachialis');
    if (subFilter === 'triceps') return sub.includes('tricep') || name.includes('extension') || name.includes('pushdown') || name.includes('kickback') || name.includes('dip');
    if (subFilter === 'forearms') return sub.includes('forearm') || name.includes('wrist') || name.includes('grip') || name.includes('hang');
    return true;
  }

  // 5. LEGS PILLAR
  if (pillar === 'legs' || pillar === 'legs (lower body)') {
    const isLeg = mg === 'legs' || cat === 'legs' || sub.includes('quad') || sub.includes('hamstring') || sub.includes('glute') || sub.includes('calv') || sub.includes('adductor') || sub.includes('abductor');
    if (!isLeg) return false;
    if (subFilter === 'all') return true;
    if (subFilter === 'quads') return sub.includes('quad') || name.includes('squat') || name.includes('leg extension') || name.includes('lunge') || name.includes('leg press') || name.includes('step-up');
    if (subFilter === 'hamstrings') return sub.includes('hamstring') || name.includes('leg curl') || name.includes('rdl') || name.includes('romanian') || name.includes('deadlift');
    if (subFilter === 'glutes') return sub.includes('glute') || name.includes('hip thrust') || name.includes('glute') || name.includes('kickback') || name.includes('bridge');
    if (subFilter === 'calves') return sub.includes('calv') || name.includes('calf') || name.includes('heel raise');
    if (subFilter === 'adductors') return sub.includes('adductor') || sub.includes('abductor') || name.includes('abduct') || name.includes('adduct');
    if (subFilter === 'tibialis') return sub.includes('tibialis') || name.includes('tibialis');
    return true;
  }

  // 6. CORE PILLAR
  if (pillar === 'core' || pillar === 'core & abs' || pillar === 'core & abdominals' || pillar === 'abs') {
    const isCore = mg === 'core' || cat === 'core' || sub.includes('ab') || sub.includes('spine');
    if (!isCore) return false;
    if (subFilter === 'all') return true;
    if (subFilter === 'abs_upper_lower') return sub.includes('ab') || name.includes('crunch') || name.includes('sit-up') || name.includes('leg raise') || name.includes('toe to bar');
    if (subFilter === 'obliques') return sub.includes('oblique') || name.includes('twist') || name.includes('side') || name.includes('pallof') || name.includes('windshield') || name.includes('woodchopper');
    if (subFilter === 'deep_core') return sub.includes('deep core') || name.includes('plank') || name.includes('rollout') || name.includes('hold') || name.includes('vacuum') || name.includes('dead bug');
    if (subFilter === 'serratus') return sub.includes('serratus') || name.includes('serratus') || name.includes('push-up plus');
    return true;
  }

  // 7. NECK PILLAR
  if (pillar === 'neck' || pillar === 'neck & cervical spine') {
    const isNeck = mg === 'neck' || cat === 'neck' || sub.includes('neck') || sub.includes('levator') || name.includes('neck');
    if (!isNeck) return false;
    if (subFilter === 'all') return true;
    if (subFilter === 'flexion') return name.includes('flexion') || name.includes('curl');
    if (subFilter === 'extension') return name.includes('extension') || name.includes('harness');
    if (subFilter === 'lateral') return name.includes('lateral') || name.includes('side');
    if (subFilter === 'isometric') return name.includes('isometric') || name.includes('hold') || name.includes('stretch');
    return true;
  }

  // 8. FUNCTIONAL PILLAR
  if (pillar === 'functional' || pillar === 'functional & conditioning') {
    const isFunc =
      mg === 'functional' ||
      cat === 'functional' ||
      sub.includes('cardio') ||
      name.includes('cardio') ||
      name.includes('running') ||
      name.includes('cycling') ||
      name.includes('jump') ||
      name.includes('burpee') ||
      item.equipment === 'Kettlebell' ||
      item.equipment === 'Sled';
    if (!isFunc) return false;
    if (subFilter === 'all') return true;
    if (subFilter === 'cardio') return sub.includes('cardio') || name.includes('cardio') || name.includes('running') || name.includes('cycling') || name.includes('jump');
    if (subFilter === 'calisthenics') return item.equipment === 'Bodyweight';
    if (subFilter === 'kettlebell') return item.equipment === 'Kettlebell';
    if (subFilter === 'mobility') return name.includes('stretch') || name.includes('mobility');
    return true;
  }

  // Backward compatibility fallback
  if (pillar === 'biceps') return sub.includes('bicep');
  if (pillar === 'triceps') return sub.includes('tricep');
  if (pillar === 'quads') return sub.includes('quad');
  if (pillar === 'hamstrings') return sub.includes('hamstring');
  if (pillar === 'glutes') return sub.includes('glute');
  if (pillar === 'calves') return sub.includes('calv');

  return mg.includes(pillar) || sub.includes(pillar) || cat.includes(pillar);
}

/**
 * Deduplicates exercises strictly by unique ID to preserve single source of truth
 */
export function deduplicateExercises(exercises: ExerciseLibraryItem[]): ExerciseLibraryItem[] {
  if (!exercises || exercises.length === 0) return [];
  const seen = new Set<string>();
  const result: ExerciseLibraryItem[] = [];
  for (const ex of exercises) {
    if (!ex || !ex.id) continue;
    if (!seen.has(ex.id)) {
      seen.add(ex.id);
      result.push(ex);
    }
  }
  return result;
}

/**
 * Robust equipment matching with plural/singular and alias tolerance
 */
export function matchEquipment(exerciseEquipment: string | undefined | null, selected: string): boolean {
  if (!selected || selected === 'All') return true;
  if (!exerciseEquipment) return false;

  const eqNorm = exerciseEquipment.toLowerCase().trim();
  const selNorm = selected.toLowerCase().trim();

  if (eqNorm === selNorm) return true;

  // Plural/singular normalization
  const singular = (s: string) => (s.endsWith('s') ? s.slice(0, -1) : s);
  if (singular(eqNorm) === singular(selNorm)) return true;

  // Machine normalization (Machine / Lever / Leverage)
  if ((selNorm.includes('machine') || selNorm === 'lever') && (eqNorm.includes('machine') || eqNorm === 'lever')) return true;

  // Dumbbell normalization (db / dumbbell / dumbbells)
  if ((selNorm === 'db' || selNorm.startsWith('dumbbell')) && eqNorm.startsWith('dumbbell')) return true;

  // Barbell normalization (bb / barbell / barbells)
  if ((selNorm === 'bb' || selNorm.startsWith('barbell')) && eqNorm.startsWith('barbell')) return true;

  // Cable normalization
  if (selNorm.startsWith('cable') && eqNorm.startsWith('cable')) return true;

  // Resistance band normalization
  if (selNorm.includes('band') && eqNorm.includes('band')) return true;

  // Kettlebell normalization
  if ((selNorm === 'kb' || selNorm.startsWith('kettlebell')) && eqNorm.startsWith('kettlebell')) return true;

  return false;
}

/**
 * Normalized difficulty matching
 */
export function matchDifficulty(exerciseDiff: string | undefined | null, selected: string): boolean {
  if (!selected || selected === 'All') return true;
  if (!exerciseDiff) return false;
  return exerciseDiff.toLowerCase().trim() === selected.toLowerCase().trim();
}

/**
 * Normalized load/tracking type matching
 */
export function matchLoadType(item: ExerciseLibraryItem, selectedLoadType: string): boolean {
  if (!selectedLoadType || selectedLoadType === 'All') return true;

  if (selectedLoadType === 'weighted') {
    return item.requiresLoad !== false && item.trackingType !== 'bodyweight_reps';
  }
  if (selectedLoadType === 'bodyweight') {
    return item.requiresLoad === false || item.trackingType === 'bodyweight_reps';
  }
  if (selectedLoadType === 'timed') {
    return item.trackingType === 'time_only';
  }
  if (selectedLoadType === 'cardio') {
    return item.trackingType === 'cardio_metrics' || (item.muscleGroup || '').toLowerCase().includes('cardio');
  }
  return true;
}
