export type SetType = 'warmup' | 'working' | 'dropset' | 'failure';

export type WeightUnit = 'kg' | 'lbs' | 'bw' | 'assisted' | 'custom';

export type TrackingType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'time_only'
  | 'distance_time'
  | 'cardio_metrics';

export type ExerciseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface WorkoutSet {
  id: string;
  type: SetType;
  load: number | '';
  unit: WeightUnit;
  reps: string | number;
  rpe: string | number;
  rest: string;
  completed: boolean;
  // Advanced tracking fields
  duration?: string | number;
  distance?: string | number;
  speed?: string | number;
  incline?: string | number;
  level?: string | number;
  tempo?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  category?: string;
  subMuscle?: string;
  equipment?: string;
  videoUrl?: string;
  notes?: string;
  movementPattern?: string;
  requiresLoad?: boolean;
  trackingType?: TrackingType;
  unilateral?: boolean;
  difficulty?: ExerciseDifficulty;
  tempo?: string;
  sets: WorkoutSet[];
  completed?: boolean;
}

export interface DayWorkout {
  id: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  title: string;
  focus: string;
  isRestDay: boolean;
  exercises: Exercise[];
  completed?: boolean;
}

export interface WeekPlan {
  weekNumber: number; // 1 - 4
  days: DayWorkout[];
}

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  muscleGroup: string;
  category?: string;
  subMuscle?: string;
  equipment: string;
  videoUrl?: string;
  notes?: string;
  movementPattern?: string;
  requiresLoad?: boolean;
  trackingType?: TrackingType;
  unilateral?: boolean;
  difficulty?: ExerciseDifficulty;
  tempo?: string;
  defaultWarmupSets?: number;
  defaultWorkingSets?: number;
  defaultReps?: string;
  defaultRpe?: string;
  defaultRest?: string;
}

export interface SavedPerformanceSet {
  type: SetType;
  load: number | '';
  unit: WeightUnit;
  reps: string | number;
  rpe: string | number;
  completed: boolean;
  duration?: string | number;
  distance?: string | number;
}

export interface SavedExercisePerformance {
  date: string;
  weekNumber: number;
  dayOfWeek: string;
  workoutTitle: string;
  sets: SavedPerformanceSet[];
}

export interface WorkoutHistoryEntry {
  id: string;
  date: string;
  weekNumber: number;
  dayOfWeek: string;
  workoutTitle: string;
  completedExercises: number;
  totalExercises: number;
  completedSets: number;
  totalSets: number;
  totalVolumeKg?: number;
  exercises: {
    exerciseName: string;
    sets: SavedPerformanceSet[];
  }[];
}

export interface PersonalRecord {
  exerciseName: string;
  maxWeight: number;
  maxWeightUnit: WeightUnit;
  maxWeightReps?: string | number;
  date?: string;
  weekNumber?: number;
  achievedDate?: string;
}

export interface ProgressionConfig {
  autoProgressionEnabled: boolean;
  weeklyIncrementKg: number;
  weeklyIncrementLbs: number;
  bodyweightRepIncrement: number;
  timedHoldIncrementSecs: number;
  deloadWeek4: boolean;
}
