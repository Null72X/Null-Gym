import { WeekPlan, DayWorkout } from '../types/workout';

export const DAY_NAMES: DayWorkout['dayOfWeek'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Creates a clean 6-week empty plan template
 */
export function createBlankWeeks(): WeekPlan[] {
  return Array.from({ length: 6 }, (_, wIdx) => ({
    weekNumber: wIdx + 1,
    days: DAY_NAMES.map((d, dIdx) => ({
      id: `w${wIdx + 1}_d${dIdx}`,
      dayOfWeek: d,
      title: d === 'Sunday' ? 'Rest Day' : d,
      focus: d === 'Sunday' ? 'Rest & Recovery' : '',
      isRestDay: d === 'Sunday',
      exercises: [],
    })),
  }));
}

/**
 * Enforces strict 6-week architecture on any plan payload
 */
export function ensureSixWeeks(plan: WeekPlan[] | null | undefined): WeekPlan[] {
  if (!plan || !Array.isArray(plan) || plan.length === 0) {
    return createBlankWeeks();
  }
  if (plan.length >= 6) {
    return plan;
  }
  const blank = createBlankWeeks();
  return [...plan, ...blank.slice(plan.length)];
}
