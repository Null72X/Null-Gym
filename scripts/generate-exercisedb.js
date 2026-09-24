const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'exercise-gifs.json'), 'utf8'));

const MUSCLE_GROUP_MAP = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Functional',
};

const SUB_MUSCLE_MAP = {
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

const EQUIPMENT_MAP = {
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

function getMovementPattern(name, muscle, equip) {
  const n = name.toLowerCase();
  if (n.includes('overhead') || n.includes('military') || n.includes('shoulder press')) return 'Vertical Press';
  if (n.includes('bench') || n.includes('push-up') || n.includes('chest press') || n.includes('dip')) return 'Horizontal Press';
  if (n.includes('pull-up') || n.includes('chin-up') || n.includes('lat pulldown') || n.includes('pulldown')) return 'Vertical Pull';
  if (n.includes('row') || n.includes('pullover')) return 'Horizontal Pull';
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg press') || n.includes('step-up')) return 'Squat / Knee Flexion';
  if (n.includes('deadlift') || n.includes('rdl') || n.includes('hip thrust') || n.includes('good morning')) return 'Hinge / Hip Extension';
  if (n.includes('curl')) return 'Elbow Flexion';
  if (n.includes('extension') || n.includes('pushdown') || n.includes('kickback')) return 'Elbow Extension';
  if (n.includes('lateral raise') || n.includes('front raise') || n.includes('rear delt')) return 'Shoulder Isolation';
  if (n.includes('fly') || n.includes('pec deck') || n.includes('crossover')) return 'Horizontal Adduction';
  if (n.includes('plank') || n.includes('crunch') || n.includes('sit-up') || n.includes('leg raise')) return 'Core Anti-Extension / Flexion';
  if (muscle === 'calves') return 'Plantarflexion';
  return 'Isolation / Accessory';
}

function getTrackingType(name, muscle, equip) {
  const n = name.toLowerCase();
  if (muscle === 'cardio' || n.includes('cardio') || n.includes('running') || n.includes('cycling')) return 'cardio_metrics';
  if (n.includes('plank') || n.includes('hold') || n.includes('hang') || n.includes('isometric')) return 'time_only';
  if (equip === 'bodyweight') return 'bodyweight_reps';
  return 'weight_reps';
}

function getDifficulty(name, muscle, equip) {
  const n = name.toLowerCase();
  if (n.includes('muscle-up') || n.includes('dragon flag') || n.includes('clean') || n.includes('snatch') || n.includes('pistol')) {
    return 'Advanced';
  }
  if (equip === 'lever' || equip === 'machine' || (equip === 'bodyweight' && (n.includes('crunch') || n.includes('push-up')))) {
    return 'Beginner';
  }
  return 'Intermediate';
}

const exercises = [];
const mediaMap = {};

raw.exercises.forEach((item, index) => {
  const id = `exdb_${item.slug.replace(/[^a-z0-9]+/g, '_')}`;
  const muscleGroup = MUSCLE_GROUP_MAP[item.bodyPart] || 'Functional';
  const subMuscle = SUB_MUSCLE_MAP[item.muscle] || item.muscle;
  const equipment = EQUIPMENT_MAP[item.equipment] || 'Other';
  const trackingType = getTrackingType(item.name, item.muscle, item.equipment);
  const requiresLoad = trackingType === 'weight_reps';
  const movementPattern = getMovementPattern(item.name, item.muscle, item.equipment);
  const difficulty = getDifficulty(item.name, item.muscle, item.equipment);

  const notes = item.instructions && item.instructions.length > 0
    ? item.instructions.join(' ')
    : `Target muscle: ${subMuscle}. Focus on controlled eccentric phase and full active range of motion.`;

  const exerciseItem = {
    id,
    name: item.name,
    muscleGroup,
    category: muscleGroup,
    subMuscle,
    equipment,
    videoUrl: `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(item.name)}`,
    notes,
    movementPattern,
    requiresLoad,
    trackingType,
    unilateral: item.name.toLowerCase().includes('single') || item.name.toLowerCase().includes('one-arm'),
    difficulty,
    defaultWarmupSets: 1,
    defaultWorkingSets: 3,
    defaultReps: trackingType === 'time_only' ? '45s' : '10-12',
    defaultRpe: '8-9',
    defaultRest: '90s',
    gifUrl: item.gifUrl,
    thumbUrl: item.thumbUrl,
    instructions: item.instructions || [],
  };

  exercises.push(exerciseItem);

  mediaMap[id] = {
    gifUrl: item.gifUrl,
    thumbUrl: item.thumbUrl,
    instructions: item.instructions || [],
  };

  // Also map by slug for seamless lookup
  mediaMap[item.slug] = {
    gifUrl: item.gifUrl,
    thumbUrl: item.thumbUrl,
    instructions: item.instructions || [],
  };
});

console.log(`Generated ${exercises.length} ExerciseDB exercises.`);

// Write media mapping
fs.writeFileSync(
  path.join(__dirname, '../lib/exerciseMediaMapping.json'),
  JSON.stringify(mediaMap, null, 2),
  'utf8'
);
console.log('Saved lib/exerciseMediaMapping.json');

// Write catalog
const catalogPath = path.join(__dirname, '../lib/exerciseCatalogData.json');
fs.writeFileSync(catalogPath, JSON.stringify(exercises, null, 2), 'utf8');
console.log('Saved lib/exerciseCatalogData.json');
