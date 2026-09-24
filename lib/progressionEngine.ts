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
  weekOffset: number, // 1 for W2, 2 for W3, 3 for W4, 4 for W5, 5 for W6
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

    // Bi-weekly overload: increases on Week 3 (step 1) and Week 5 (step 2)
    // W1 & W2: Base load (0 increments)
    // W3 & W4: +1 increment (Increases at W3)
    // W5 & W6: +2 increments (Increases at W5)
    const biweeklyOffset = Math.floor(weekOffset / 2);

    const increment = unit === 'kg' ? config.weeklyIncrementKg : config.weeklyIncrementLbs;
    let newLoad = set.load;
    let newReps = set.reps;
    let newDuration = set.duration;

    if (exercise.requiresLoad && typeof set.load === 'number' && set.load > 0) {
      newLoad = Math.round((set.load + increment * biweeklyOffset) * 10) / 10;
    } else if (exercise.trackingType === 'bodyweight_reps') {
      const parsedReps = parseInt(String(set.reps || '10'), 10);
      if (!isNaN(parsedReps)) {
        newReps = String(parsedReps + config.bodyweightRepIncrement * biweeklyOffset);
      }
    } else if (exercise.trackingType === 'time_only') {
      const parsedSecs = parseInt(String(set.duration || '30'), 10);
      if (!isNaN(parsedSecs)) {
        newDuration = parsedSecs + config.timedHoldIncrementSecs * biweeklyOffset;
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
 * Propagates Week 1 to Weeks 2, 3, 4, 5, and 6 with progressive overload
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

    const weekOffset = wIdx; // 1 for W2, 2 for W3, 3 for W4, 4 for W5, 5 for W6
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
  const biweeklyOffset = Math.floor((weekNumber - 1) / 2);
  const increment = unit === 'kg' ? config.weeklyIncrementKg : config.weeklyIncrementLbs;
  const totalOffset = biweeklyOffset * increment;

  if (biweeklyOffset === 0) {
    return 'Consolidation (Same as W1)';
  }

  if (exercise.requiresLoad) {
    return `+${totalOffset} ${unit} Overload vs W1`;
  }
  if (exercise.trackingType === 'bodyweight_reps') {
    return `+${biweeklyOffset * config.bodyweightRepIncrement} Reps vs W1`;
  }
  if (exercise.trackingType === 'time_only') {
    return `+${biweeklyOffset * config.timedHoldIncrementSecs}s Hold vs W1`;
  }
  return null;
}

/**
 * Promotes the final week (Week 6) peak performance weights to become the new Week 1 baseline,
 * resets all completion checkmarks to false for a fresh cycle,
 * and auto-programs Weeks 2 through 6 using bi-weekly progressive overload.
 */
export function startNextSixWeekCycle(
  currentWeeks: WeekPlan[],
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG,
  unit: WeightUnit = 'kg'
): WeekPlan[] {
  if (!currentWeeks || currentWeeks.length === 0) return currentWeeks;

  // Source week: prioritize Week 6 (index 5) or highest week with exercises
  let sourceWeek = currentWeeks[5];
  const hasExercises = (w?: WeekPlan) => w && w.days.some((d) => d.exercises.length > 0);

  if (!hasExercises(sourceWeek)) {
    for (let i = currentWeeks.length - 1; i >= 0; i--) {
      if (hasExercises(currentWeeks[i])) {
        sourceWeek = currentWeeks[i];
        break;
      }
    }
  }

  if (!sourceWeek) {
    sourceWeek = currentWeeks[0];
  }

  // Create new Week 1 from the source week's exercises, unchecking all sets
  const newWeek1Days = sourceWeek.days.map((d, dIdx) => ({
    ...d,
    id: `w1_d${dIdx}`,
    completed: false,
    exercises: d.exercises.map((ex) => ({
      ...ex,
      id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      completed: false,
      sets: ex.sets.map((s, sIdx) => ({
        ...s,
        id: `set_${Date.now()}_${sIdx}`,
        completed: false,
      })),
    })),
  }));

  const initialCyclePlan: WeekPlan[] = currentWeeks.map((w, wIdx) => {
    if (wIdx === 0) {
      return {
        ...w,
        weekNumber: 1,
        days: newWeek1Days,
      };
    }
    return {
      ...w,
      weekNumber: wIdx + 1,
      days: w.days.map((d, dIdx) => ({
        ...d,
        completed: false,
        exercises: [],
      })),
    };
  });

  // Automatically scale Weeks 2 through 6 from the new Week 1 baseline
  return autoScaleWeek1ToAllWeeks(initialCyclePlan, config, unit);
}

