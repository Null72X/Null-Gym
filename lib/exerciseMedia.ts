import mediaMapRaw from './exerciseMediaMapping.json';

export interface ExerciseMediaData {
  gifUrl?: string;
  thumbUrl?: string;
  instructions?: string[];
  images?: string[];
}

const mediaMap: Record<string, ExerciseMediaData> = mediaMapRaw as any;

/**
 * Normalizes an exercise name into a slug for matching
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolves media demonstration (GIF, thumbnail, coaching instructions, images)
 * for any exercise by ID or name.
 */
export function getExerciseMedia(exercise: { id?: string; name: string } | null | undefined): ExerciseMediaData | null {
  if (!exercise) return null;

  // 1. Direct ID lookup
  if (exercise.id && mediaMap[exercise.id]) {
    return mediaMap[exercise.id];
  }

  // 2. Normalized slug match against known IDs
  const nameSlug = toSlug(exercise.name);
  if (!nameSlug) return null;

  // Try exact slug
  if (mediaMap[nameSlug]) {
    return mediaMap[nameSlug];
  }

  // Look for keys ending with the slug (e.g. "ex_chest_barbell_bench_press" ends with "barbell_bench_press")
  for (const [key, value] of Object.entries(mediaMap)) {
    if (key.endsWith(`_${nameSlug}`) || key === nameSlug || key.replace(/^ex_[a-z]+_/, '') === nameSlug) {
      return value;
    }
  }

  // Fuzzy match: check if key contains slug tokens
  const tokens = nameSlug.split('_').filter(t => t.length > 2);
  if (tokens.length >= 2) {
    for (const [key, value] of Object.entries(mediaMap)) {
      const matchAll = tokens.every(token => key.includes(token));
      if (matchAll) {
        return value;
      }
    }
  }

  return null;
}
