import fs from 'fs';
import path from 'path';

interface RawGifItem {
  name: string;
  muscle: string;
  subMuscle?: string;
  equipment?: string;
  gifUrl?: string;
  [key: string]: unknown;
}

interface ProcessedExercise {
  id: string;
  name: string;
  muscleGroup: string;
  subMuscle: string;
  equipment: string;
  movementPattern: string;
  mediaUrl?: string;
}

const rawPath = path.join(__dirname, 'exercise-gifs.json');
let raw: RawGifItem[] = [];
if (fs.existsSync(rawPath)) {
  raw = JSON.parse(fs.readFileSync(rawPath, 'utf8')) as RawGifItem[];
}

const MUSCLE_GROUP_MAP: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Functional',
};

const SUB_MUSCLE_MAP: Record<string, string> = {
  pectorals: 'Pectorals',
  lats: 'Lats',
  'upper-back': 'Upper Back',
  traps: 'Traps',
  delts: 'Deltoids',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abductors: 'Abductors',
  adductors: 'Adductors',
  abs: 'Abdominals',
  spine: 'Erector Spinae',
  'serratus-anterior': 'Serratus Anterior',
  'levator-scapulae': 'Neck',
  cardio: 'Cardiovascular',
};

const EQUIPMENT_MAP: Record<string, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  cable: 'Cable',
  lever: 'Machine',
  smith: 'Smith Machine',
  bodyweight: 'Bodyweight',
  band: 'Resistance Band',
  kettlebell: 'Kettlebell',
  'ez-bar': 'EZ Bar',
  sled: 'Sled',
  machine: 'Machine',
  other: 'Other',
};

function getMovementPattern(name: string, _muscle: string, _equip: string): string {
  const n = name.toLowerCase();
  if (n.includes('overhead') || n.includes('military') || n.includes('shoulder press')) return 'Vertical Press';
  if (n.includes('bench') || n.includes('push-up') || n.includes('chest press') || n.includes('dip')) return 'Horizontal Press';
  if (n.includes('pull-up') || n.includes('chin-up') || n.includes('lat pulldown') || n.includes('pulldown')) return 'Vertical Pull';
  if (n.includes('row') || n.includes('pullover')) return 'Horizontal Pull';
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg press') || n.includes('step-up')) return 'Squat / Knee Flexion';
  if (n.includes('deadlift') || n.includes('rdl') || n.includes('hip thrust') || n.includes('good morning')) return 'Hinge / Hip Extension';
  if (n.includes('curl')) return 'Elbow Flexion';
  if (n.includes('extension') || n.includes('skull crusher') || n.includes('pushdown')) return 'Elbow Extension';
  if (n.includes('raise') || n.includes('fly')) return 'Isolation';
  if (n.includes('crunch') || n.includes('plank') || n.includes('rollout')) return 'Core Anti-Extension';
  return 'Functional / Movement';
}

function generate(): void {
  if (!raw.length) {
    console.log('No raw exercise-gifs.json found, skipping generation.');
    return;
  }
  const processed: ProcessedExercise[] = raw.map((item, idx) => {
    const muscle = (item.muscle || 'other').toLowerCase();
    const subMuscle = (item.subMuscle || 'other').toLowerCase();
    const equip = (item.equipment || 'other').toLowerCase();

    return {
      id: `ex_${idx + 1}`,
      name: item.name,
      muscleGroup: MUSCLE_GROUP_MAP[muscle] || 'Other',
      subMuscle: SUB_MUSCLE_MAP[subMuscle] || 'General',
      equipment: EQUIPMENT_MAP[equip] || 'Other',
      movementPattern: getMovementPattern(item.name, muscle, equip),
      mediaUrl: item.gifUrl,
    };
  });

  const outPath = path.join(__dirname, '../lib/exerciseCatalogData.generated.json');
  fs.writeFileSync(outPath, JSON.stringify(processed, null, 2), 'utf8');
  console.log(`Generated ${processed.length} exercises to ${outPath}`);
}

generate();
