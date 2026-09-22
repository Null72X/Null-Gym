import {
  WorkoutHistoryEntry,
  SavedExercisePerformance,
  PersonalRecord,
  WeekPlan,
} from '../types/workout';

/**
 * Finds the most recent completed performance for a given exercise.
 * Looks first into formal history entries, and also scans earlier completed days in the plan.
 */
export function getLastPerformance(
  exerciseName: string,
  history: WorkoutHistoryEntry[],
  weeksPlan?: WeekPlan[],
  currentWeekNumber?: number
): SavedExercisePerformance | null {
  const normName = exerciseName.trim().toLowerCase();

  // 1. Search in history (most recent first)
  if (history && history.length > 0) {
    const sorted = [...history].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const entry of sorted) {
      const exFound = entry.exercises.find(
        e => e.exerciseName.trim().toLowerCase() === normName
      );
      if (exFound && exFound.sets.some(s => s.completed || (s.load !== '' && s.load > 0))) {
        return {
          date: entry.date,
          weekNumber: entry.weekNumber,
          dayOfWeek: entry.dayOfWeek,
          workoutTitle: entry.workoutTitle,
          sets: exFound.sets.filter(s => s.completed || (s.load !== '' && s.load > 0))
        };
      }
    }
  }

  // 2. Fallback: Search in earlier weeks / days of the plan itself
  if (weeksPlan) {
    for (let w = (currentWeekNumber || 4) - 1; w >= 0; w--) {
      const week = weeksPlan[w];
      if (!week) continue;

      for (let d = week.days.length - 1; d >= 0; d--) {
        const day = week.days[d];
        const exFound = day.exercises.find(
          e => e.name.trim().toLowerCase() === normName
        );
        if (exFound && exFound.sets.some(s => s.completed || (s.load !== '' && s.load > 0))) {
          // If it has at least one completed set or entered load
          const validSets = exFound.sets
            .filter(s => s.completed || (s.load !== '' && s.load > 0))
            .map(s => ({
              type: s.type,
              load: s.load,
              unit: s.unit,
              reps: s.reps,
              rpe: s.rpe,
              completed: s.completed
            }));

          if (validSets.length > 0) {
            return {
              date: new Date().toISOString(),
              weekNumber: week.weekNumber,
              dayOfWeek: day.dayOfWeek,
              workoutTitle: day.title,
              sets: validSets
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Computes Personal Records across all historical workouts.
 */
export function getPersonalRecords(history: WorkoutHistoryEntry[]): PersonalRecord[] {
  const prMap = new Map<string, PersonalRecord>();

  history.forEach(entry => {
    entry.exercises.forEach(ex => {
      const name = ex.exerciseName.trim();
      ex.sets.forEach(set => {
        const load = typeof set.load === 'number' ? set.load : 0;
        if (load > 0 && set.completed) {
          const existing = prMap.get(name);
          if (!existing || load > existing.maxWeight) {
            prMap.set(name, {
              exerciseName: name,
              maxWeight: load,
              maxWeightUnit: set.unit,
              maxWeightReps: set.reps,
              date: entry.date,
              weekNumber: entry.weekNumber
            });
          }
        }
      });
    });
  });

  return Array.from(prMap.values()).sort((a, b) => b.maxWeight - a.maxWeight);
}

export interface ProgressionPoint {
  date: string;
  weekNumber: number;
  dayOfWeek: string;
  maxWeight: number;
  totalVolume: number;
  bestReps: number | string;
  rpe: number | string;
}

/**
 * Returns progression data points for an exercise over time for charting.
 */
export function getExerciseProgression(
  exerciseName: string,
  history: WorkoutHistoryEntry[]
): ProgressionPoint[] {
  const normName = exerciseName.trim().toLowerCase();
  const points: ProgressionPoint[] = [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  sorted.forEach(entry => {
    const found = entry.exercises.find(
      e => e.exerciseName.trim().toLowerCase() === normName
    );
    if (!found) return;

    let maxWeight = 0;
    let totalVolume = 0;
    let bestReps: number | string = '-';
    let maxRpe: number | string = '-';

    found.sets.forEach(s => {
      const load = typeof s.load === 'number' ? s.load : 0;
      const repsNum = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps), 10) || 0;
      if (s.completed && load > 0) {
        if (load > maxWeight) {
          maxWeight = load;
          bestReps = s.reps;
          maxRpe = s.rpe;
        }
        totalVolume += load * repsNum;
      }
    });

    if (maxWeight > 0) {
      points.push({
        date: entry.date,
        weekNumber: entry.weekNumber,
        dayOfWeek: entry.dayOfWeek,
        maxWeight,
        totalVolume,
        bestReps,
        rpe: maxRpe
      });
    }
  });

  return points;
}
