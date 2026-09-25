/**
 * Unified Timer Utilities & Single Source of Truth for Rest & Work Durations
 */

/**
 * Resolves rest duration in seconds from any input:
 * - A string like '90s', '2-3 min', '1.5 min', '60s', '120s'
 * - A WorkoutSet object containing a `rest` field
 * - A raw number in seconds
 * Fallback is 90 seconds if unspecified or 0.
 */
export function getRestDuration(
  input?: string | { rest?: string } | number | null,
  fallbackSec = 90
): number {
  if (input === null || input === undefined) return fallbackSec;
  if (typeof input === 'number') {
    return input > 0 ? Math.round(input) : fallbackSec;
  }

  const restStr = typeof input === 'string' ? input : input.rest || '';
  if (!restStr || typeof restStr !== 'string') return fallbackSec;

  const str = restStr.toLowerCase().trim();
  if (!str) return fallbackSec;

  // Specific common gym rest range phrases
  if (str.includes('3-4')) return 210;
  if (str.includes('2-3')) return 150;
  if (str.includes('1-2')) return 90;
  if (str.includes('15 sec') || str.includes('15s')) return 15;
  if (str.includes('30s') || str.includes('30 sec')) return 30;
  if (str.includes('45s') || str.includes('45 sec')) return 45;
  if (str.includes('60s') || str.includes('1 min') || str.includes('60 sec')) return 60;
  if (str.includes('90s') || str.includes('1.5 min') || str.includes('1:30') || str.includes('90 sec')) return 90;
  if (str.includes('120s') || str.includes('2 min') || str.includes('120 sec')) return 120;
  if (str.includes('180s') || str.includes('3 min') || str.includes('180 sec')) return 180;
  if (str.includes('240s') || str.includes('4 min')) return 240;
  if (str.includes('300s') || str.includes('5 min')) return 300;

  // Handle minutes with decimals e.g. "2.5 min", "2m"
  const minMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)$/);
  if (minMatch) {
    const mins = parseFloat(minMatch[1]);
    if (!isNaN(mins) && mins > 0) return Math.round(mins * 60);
  }

  // Handle pure seconds or general numbers
  const numMatch = str.match(/(\d+)/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    // If the string says "min" and not "sec", treat single digits (e.g. "2") as minutes
    if ((str.includes('min') || str.includes('m')) && !str.includes('s') && val <= 10) {
      return val * 60;
    }
    if (val > 0) return val;
  }

  return fallbackSec;
}

/**
 * Resolves work / set duration in seconds (defaults to 90 seconds).
 */
export function getSetWorkDuration(
  input?: string | number | { duration?: string | number } | null,
  fallbackSec = 90
): number {
  if (input === null || input === undefined) return fallbackSec;
  if (typeof input === 'number') {
    return input > 0 ? Math.round(input) : fallbackSec;
  }
  const durVal = typeof input === 'string' ? input : input.duration;
  if (typeof durVal === 'number') return durVal > 0 ? durVal : fallbackSec;
  if (typeof durVal === 'string') {
    const m = durVal.match(/\d+/);
    if (m) {
      const val = parseInt(m[0], 10);
      if (val > 0) return val;
    }
  }
  return fallbackSec;
}
