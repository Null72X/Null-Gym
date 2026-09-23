import { WeekPlan, Exercise, WorkoutSet, WeightUnit, ProgressionConfig } from '../types/workout';

export const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = {
  autoProgressionEnabled: true,
  weeklyIncrementKg: 2.5,
  weeklyIncrementLbs: 5.0,
  bodyweightRepIncrement: 1,
  timedHoldIncrementSecs: 5,
  deloadWeek4: false,
};

/**
 * Scale an exercise for a target week offset with progressive overload
 */
export function scaleExerciseForWeek(
  exercise: Exercise,
  weekOffset: number, // 1 for W2, 2 for W3, 3 for W4
  config: ProgressionConfig,
  unit: WeightUnit,
  isDeload = false
): Exercise {
  const scaledSets: WorkoutSet[] = exercise.sets.map((set) => {
    // Only scale working sets & dropsets (leave warmups as designed)
    if (set.type !== 'working' && set.type !== 'dropset') {
      return { ...set, completed: false };
    }

    if (isDeload) {
      let deloadLoad = set.load;
      if (typeof deloadLoad === 'number' && deloadLoad > 0) {
        const step = unit === 'kg' ? 2.5 : 5;
        deloadLoad = Math.max(step, Math.round((deloadLoad * 0.8) / step) * step);
      }
      return {
        ...set,
        load: deloadLoad,
        completed: false,
      };
    }

    const increment = unit === 'kg' ? config.weeklyIncrementKg : config.weeklyIncrementLbs;
    let newLoad = set.load;
    let newReps = set.reps;
    let newDuration = set.duration;

    if (exercise.requiresLoad && typeof set.load === 'number' && set.load > 0) {
      newLoad = Math.round((set.load + increment * weekOffset) * 10) / 10;
    } else if (exercise.trackingType === 'bodyweight_reps') {
      const parsedReps = parseInt(String(set.reps || '10'), 10);
      if (!isNaN(parsedReps)) {
        newReps = String(parsedReps + config.bodyweightRepIncrement * weekOffset);
      }
    } else if (exercise.trackingType === 'time_only') {
      const parsedSecs = parseInt(String(set.duration || '30'), 10);
      if (!isNaN(parsedSecs)) {
        newDuration = parsedSecs + config.timedHoldIncrementSecs * weekOffset;
      }
    }

    return {
      ...set,
      load: newLoad,
      reps: newReps,
      duration: newDuration,
      completed: false,
    };
  });

  return {
    ...exercise,
    id: `${exercise.id}_w${weekOffset + 1}_${Math.random().toString(36).slice(2, 6)}`,
    sets: scaledSets,
  };
}

/**
 * Propagates Week 1 to Weeks 2, 3, and 4 with progressive overload
 */
export function autoScaleWeek1ToAllWeeks(
  weeks: WeekPlan[],
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG,
  unit: WeightUnit = 'kg'
): WeekPlan[] {
  if (!weeks || weeks.length === 0) return weeks;
  const week1 = weeks[0];

  return weeks.map((w, wIdx) => {
    if (wIdx === 0) return w; // Week 1 remains unchanged

    const weekOffset = wIdx; // 1 for W2, 2 for W3, 3 for W4
    const isDeload = wIdx === 3 && config.deloadWeek4;

    const scaledDays = week1.days.map((d1, dIdx) => {
      const targetDay = w.days[dIdx] || { ...d1, id: `w${wIdx + 1}_d${dIdx}` };

      return {
        ...targetDay,
        title: d1.title,
        focus: d1.focus,
        isRestDay: d1.isRestDay,
        completed: false,
        exercises: d1.exercises.map((ex) =>
          scaleExerciseForWeek(ex, weekOffset, config, unit, isDeload)
        ),
      };
    });

    return {
      ...w,
      days: scaledDays,
    };
  });
}

/**
 * Returns a motivating progression label for the workout tracker
 */
export function getProgressionBadge(
  exercise: Exercise,
  weekNumber: number,
  unit: WeightUnit,
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG
): string | null {
  if (weekNumber <= 1) return null;
  const increment = unit === 'kg' ? config.weeklyIncrementKg : config.weeklyIncrementLbs;
  const totalOffset = (weekNumber - 1) * increment;

  if (exercise.requiresLoad) {
    return `+${totalOffset} ${unit} Overload vs W1`;
  }
  if (exercise.trackingType === 'bodyweight_reps') {
    return `+${(weekNumber - 1) * config.bodyweightRepIncrement} Reps vs W1`;
  }
  if (exercise.trackingType === 'time_only') {
    return `+${(weekNumber - 1) * config.timedHoldIncrementSecs}s Hold vs W1`;
  }
  return null;
}
