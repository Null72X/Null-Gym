import catalogData from '../lib/exerciseCatalogData.json';

interface ExerciseItem {
  id?: string;
  name: string;
  muscleGroup: string;
  subMuscle?: string;
  category?: string;
  equipment: string;
  [key: string]: unknown;
}

const catalog = catalogData as ExerciseItem[];
const counts: Record<string, number> = {};

catalog.forEach((item) => {
  counts[item.muscleGroup] = (counts[item.muscleGroup] || 0) + 1;
});

console.log('Total exercises:', catalog.length);
console.log('Pillar distribution:', counts);

const equipCounts: Record<string, number> = {};
catalog.forEach((item) => {
  equipCounts[item.equipment] = (equipCounts[item.equipment] || 0) + 1;
});

console.log('Equipment distribution:', equipCounts);
