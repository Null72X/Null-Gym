import { WeekPlan, DayWorkout } from '../types/workout';
import { DEFAULT_DAY_SCHEDULE } from './muscleMetadata';

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
 * Creates a clean 6-week template with the standard Push/Pull/Legs split:
 * Mon: Push 1, Tue: Pull 1, Wed: Leg 1, Thu: Push 2, Fri: Pull 2, Sat: Leg 2, Sun: Rest Day
 */
export function createBlankWeeks(): WeekPlan[] {
  return Array.from({ length: 6 }, (_, wIdx) => ({
    weekNumber: wIdx + 1,
    days: DEFAULT_DAY_SCHEDULE.map((sched, dIdx) => ({
      id: `w${wIdx + 1}_d${dIdx}`,
      dayOfWeek: sched.dayOfWeek,
      title: sched.title,
      focus: sched.focus,
      isRestDay: sched.isRestDay,
      exercises: [],
    })),
  }));
}

/**
 * Normalizes day titles: upgrades generic day names (e.g. "Monday", "Tuesday") to "Push 1", "Pull 1", etc.
 */
export function normalizeDayWorkout(day: DayWorkout, dayIndex: number): DayWorkout {
  const sched = DEFAULT_DAY_SCHEDULE[dayIndex] || DEFAULT_DAY_SCHEDULE.find((s) => s.dayOfWeek === day.dayOfWeek);
  if (!sched) return day;

  const currentTitle = (day.title || '').trim();
  const isGenericTitle =
    !currentTitle ||
    currentTitle.toLowerCase() === day.dayOfWeek.toLowerCase() ||
    currentTitle.toLowerCase() === 'workout' ||
    currentTitle.toLowerCase() === 'day' ||
    (day.isRestDay && currentTitle.toLowerCase() === 'sunday');

  const newTitle = isGenericTitle ? sched.title : day.title;
  const newFocus = !day.focus || day.focus.trim() === '' ? sched.focus : day.focus;

  return {
    ...day,
    title: newTitle,
    focus: newFocus,
    isRestDay: day.isRestDay ?? sched.isRestDay,
  };
}

/**
 * Enforces strict 6-week architecture and standardizes day titles on any plan payload
 */
export function ensureSixWeeks(plan: WeekPlan[] | null | undefined): WeekPlan[] {
  if (!plan || !Array.isArray(plan) || plan.length === 0) {
    return createBlankWeeks();
  }

  // Upgrade and normalize day titles for existing weeks
  const normalizedExisting = plan.map((week, wIdx) => ({
    ...week,
    weekNumber: week.weekNumber || wIdx + 1,
    days: (week.days || []).map((day, dIdx) => normalizeDayWorkout(day, dIdx)),
  }));

  if (normalizedExisting.length >= 6) {
    return normalizedExisting;
  }

  const blank = createBlankWeeks();
  return [...normalizedExisting, ...blank.slice(normalizedExisting.length)];
}
