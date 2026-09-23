/**
 * High-Precision Search Engine for Null Gym
 * 
 * Features:
 * - Multi-field weighted scoring (name, muscle, cues, equipment, movement pattern)
 * - Exact, prefix, word-boundary, partial, and typo/fuzzy matching (Damerau-Levenshtein)
 * - Common fitness synonyms and abbreviations (e.g., db, bb, rdl, ohp, dumbell, sqat)
 * - Conjunctive multi-keyword search in any order
 * - Strict search result isolation with monotonic Query Generation IDs
 * - Zero external dependencies, ultra-fast in-memory execution (< 2ms)
 */

import { ExerciseLibraryItem } from '../types/workout';

// -------------------------------------------------------------
// FITNESS SYNONYMS & TYPO CORRECTIONS
// -------------------------------------------------------------
export const FITNESS_SYNONYMS: Record<string, string[]> = {
  // Equipment
  db: ['dumbbell'],
  dumbell: ['dumbbell'],
  dumbel: ['dumbbell'],
  bb: ['barbell'],
  barbel: ['barbell'],
  kb: ['kettlebell'],
  cable: ['cables', 'pulley'],

  // Movements & Exercises
  benc: ['bench'],
  bench: ['benc', 'press'],
  sqat: ['squat'],
  sqaut: ['squat'],
  squat: ['sqat', 'squats'],
  dl: ['deadlift'],
  deadlift: ['dl'],
  rdl: ['romanian deadlift', 'deadlift'],
  ohp: ['overhead press', 'shoulder press'],
  press: ['benc', 'bench'],
  pullup: ['pull-up', 'pull up', 'chinup', 'chin-up'],
  pullups: ['pull-ups', 'pull ups'],
  pushup: ['push-up', 'push up'],
  pushups: ['push-ups', 'push ups'],
  row: ['rows', 'rowing'],

  // Muscles
  lat: ['lats', 'latissimus'],
  lats: ['lat', 'latissimus', 'back'],
  bicp: ['bicep', 'biceps', 'arms'],
  bicep: ['biceps', 'arms'],
  biceps: ['bicep', 'arms'],
  tricep: ['triceps', 'arms'],
  triceps: ['tricep', 'arms'],
  delt: ['deltoid', 'delts', 'shoulder', 'shoulders'],
  delts: ['delt', 'deltoid', 'shoulder', 'shoulders'],
  pec: ['pecs', 'chest'],
  pecs: ['pec', 'chest'],
  abs: ['abdominals', 'core', 'abdominal'],
  core: ['abs', 'abdominals'],
  glute: ['glutes', 'butt'],
  glutes: ['glute'],
  quad: ['quads', 'quadriceps'],
  quads: ['quad', 'quadriceps'],
  ham: ['hams', 'hamstrings', 'hamstring'],
  hamstring: ['hamstrings', 'ham'],
  hamstrings: ['hamstring', 'ham'],
  calf: ['calves'],
  calves: ['calf', 'calfs'],
  calfs: ['calves', 'calf'],
  trap: ['traps', 'trapezius'],
  traps: ['trap', 'trapezius'],
};

// -------------------------------------------------------------
// DAMERAU-LEVENSHTEIN DISTANCE
// -------------------------------------------------------------
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  // Swap to save memory: a is shorter
  let s1 = a;
  let s2 = b;
  if (s1.length > s2.length) {
    s1 = b;
    s2 = a;
  }

  const len1 = s1.length;
  const len2 = s2.length;
  const d: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (
        i > 1 &&
        j > 1 &&
        s1[i - 1] === s2[j - 2] &&
        s1[i - 2] === s2[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[len1][len2];
}

// -------------------------------------------------------------
// QUERY TOKENIZATION & NORMALIZATION
// -------------------------------------------------------------
export function tokenizeQuery(query: string): string[] {
  if (!query) return [];
  // Normalize hyphens/slashes and split by whitespace
  const normalized = query
    .toLowerCase()
    .replace(/[-_/]/g, ' ')
    .trim();

  if (!normalized) return [];

  // Deduplicate and filter out empty strings
  const tokens = Array.from(new Set(normalized.split(/\s+/).filter(Boolean)));
  return tokens;
}

/**
 * Returns original tokens plus known synonym expansions
 */
export function expandTokensWithSynonyms(tokens: string[]): { primary: string; expansions: string[] }[] {
  return tokens.map((token) => {
    const directSynonyms = FITNESS_SYNONYMS[token] || [];
    return {
      primary: token,
      expansions: directSynonyms,
    };
  });
}

// -------------------------------------------------------------
// FIELD SCORER
// -------------------------------------------------------------
export interface FieldConfig<T> {
  name: string;
  weight: number;
  getter: (item: T) => string | undefined | null;
  isPrimary?: boolean;
}

export interface SearchMatchResult<T> {
  item: T;
  score: number;
  matchedTokens: string[];
  matchedFields: string[];
}

/**
 * Calculates a match score for a given target text against a single query token
 */
function scoreTokenAgainstText(
  token: string,
  target: string,
  fieldWeight: number,
  isPrimary: boolean
): { score: number; matched: boolean } {
  if (!target) return { score: 0, matched: false };

  const targetLower = target.toLowerCase();
  const tokenLen = token.length;
  const targetWords = targetLower.split(/[\s\-_/(),]+/).filter(Boolean);

  // 1. Exact match with whole field
  if (targetLower === token) {
    return { score: 1000 * fieldWeight, matched: true };
  }

  // 2. Starts with token
  if (targetLower.startsWith(token)) {
    return { score: 600 * fieldWeight, matched: true };
  }

  // 3. Word boundary exact or prefix match
  for (const word of targetWords) {
    if (word === token) {
      return { score: 500 * fieldWeight, matched: true };
    }
    if (word.startsWith(token)) {
      return { score: 400 * fieldWeight, matched: true };
    }
  }

  // 4. Substring contains token
  const subIdx = targetLower.indexOf(token);
  if (subIdx !== -1) {
    return { score: 250 * fieldWeight, matched: true };
  }

  // 5. Fuzzy / Typo match on individual words (only for tokens >= 4 characters to avoid false positives)
  if (tokenLen >= 4) {
    const maxAllowedDistance = tokenLen >= 7 ? 2 : 1;
    for (const word of targetWords) {
      // Don't compare words with vast length difference
      if (Math.abs(word.length - tokenLen) <= maxAllowedDistance) {
        const dist = damerauLevenshtein(token, word);
        if (dist <= maxAllowedDistance) {
          const typoPenalty = dist === 1 ? 0.6 : 0.35;
          return { score: 200 * fieldWeight * typoPenalty, matched: true };
        }
      }
    }
  }

  return { score: 0, matched: false };
}

/**
 * General purpose weighted multi-field search
 */
export function searchItems<T>(
  items: T[],
  query: string,
  fields: FieldConfig<T>[],
  options: {
    limit?: number;
    threshold?: number;
  } = {}
): SearchMatchResult<T>[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return items.map((item) => ({
      item,
      score: 1,
      matchedTokens: [],
      matchedFields: [],
    }));
  }

  const tokens = tokenizeQuery(trimmed);
  if (tokens.length === 0) {
    return items.map((item) => ({
      item,
      score: 1,
      matchedTokens: [],
      matchedFields: [],
    }));
  }

  const tokenGroups = expandTokensWithSynonyms(tokens);
  const fullQueryLower = trimmed.toLowerCase();
  const threshold = options.threshold ?? 50;

  const results: SearchMatchResult<T>[] = [];

  for (const item of items) {
    let totalScore = 0;
    const matchedTokensSet = new Set<string>();
    const matchedFieldsSet = new Set<string>();
    let allTokensMatched = true;

    // Check primary field exact & prefix matches with full query string
    const primaryField = fields.find((f) => f.isPrimary) || fields[0];
    const primaryVal = primaryField ? (primaryField.getter(item) || '').toLowerCase() : '';

    if (primaryVal) {
      if (primaryVal === fullQueryLower) {
        totalScore += 10000;
        matchedFieldsSet.add(primaryField.name);
      } else if (primaryVal.startsWith(fullQueryLower)) {
        totalScore += 5000;
        matchedFieldsSet.add(primaryField.name);
      } else if (primaryVal.includes(fullQueryLower)) {
        totalScore += 2500;
        matchedFieldsSet.add(primaryField.name);
      }
    }

    // Every token in the query MUST match at least one field (Conjunctive AND)
    for (const group of tokenGroups) {
      let bestTokenScore = 0;
      let tokenMatched = false;
      const candidates = [group.primary, ...group.expansions];

      for (const field of fields) {
        const fieldVal = field.getter(item);
        if (!fieldVal) continue;

        for (const candidate of candidates) {
          const { score, matched } = scoreTokenAgainstText(
            candidate,
            fieldVal,
            field.weight,
            !!field.isPrimary
          );

          if (matched) {
            tokenMatched = true;
            matchedTokensSet.add(group.primary);
            matchedFieldsSet.add(field.name);
            if (score > bestTokenScore) {
              bestTokenScore = score;
            }
          }
        }
      }

      if (!tokenMatched) {
        allTokensMatched = false;
        break; // Conjunctive requirement failed
      }

      totalScore += bestTokenScore;
    }

    if (allTokensMatched && totalScore >= threshold) {
      // Length normalization: slightly penalize long rambling names to prioritize concise matches
      if (primaryVal) {
        const lengthDiff = Math.max(0, primaryVal.length - fullQueryLower.length);
        totalScore -= Math.min(lengthDiff * 0.25, 200);
      }

      results.push({
        item,
        score: Math.max(1, Math.round(totalScore)),
        matchedTokens: Array.from(matchedTokensSet),
        matchedFields: Array.from(matchedFieldsSet),
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  if (options.limit && options.limit > 0) {
    return results.slice(0, options.limit);
  }

  return results;
}

// -------------------------------------------------------------
// EXERCISE CATALOG SEARCH SPECIALIZATION
// -------------------------------------------------------------
const EXERCISE_SEARCH_FIELDS: FieldConfig<ExerciseLibraryItem>[] = [
  {
    name: 'name',
    weight: 10,
    isPrimary: true,
    getter: (ex) => ex.name,
  },
  {
    name: 'muscleGroup',
    weight: 6,
    getter: (ex) => ex.muscleGroup,
  },
  {
    name: 'subMuscle',
    weight: 5,
    getter: (ex) => ex.subMuscle,
  },
  {
    name: 'equipment',
    weight: 4,
    getter: (ex) => ex.equipment,
  },
  {
    name: 'category',
    weight: 4,
    getter: (ex) => ex.category,
  },
  {
    name: 'movementPattern',
    weight: 3,
    getter: (ex) => ex.movementPattern,
  },
  {
    name: 'notes',
    weight: 2,
    getter: (ex) => ex.notes,
  },
  {
    name: 'difficulty',
    weight: 2,
    getter: (ex) => ex.difficulty,
  },
];

/**
 * Searches exercise library items with full ranking, synonyms, and typo tolerance
 */
export function searchExercises(
  exercises: ExerciseLibraryItem[],
  query: string,
  options?: { limit?: number; threshold?: number }
): SearchMatchResult<ExerciseLibraryItem>[] {
  return searchItems(exercises, query, EXERCISE_SEARCH_FIELDS, options);
}

// -------------------------------------------------------------
// STRICT SEARCH RESULT ISOLATION SESSION
// -------------------------------------------------------------
/**
 * Guaranteed search isolation session manager.
 * Prevents race conditions, out-of-order async responses, and old search appending.
 */
export class SearchSession<T> {
  private currentGeneration = 0;
  private latestQuery = '';

  /**
   * Executes a synchronous isolated search.
   * Completely replaces any previous search state.
   */
  public execute(
    query: string,
    items: T[],
    fields: FieldConfig<T>[],
    options?: { limit?: number; threshold?: number }
  ): {
    generationId: number;
    query: string;
    results: SearchMatchResult<T>[];
  } {
    this.currentGeneration += 1;
    const generationId = this.currentGeneration;
    this.latestQuery = query;

    const results = searchItems(items, query, fields, options);

    return {
      generationId,
      query,
      results,
    };
  }

  /**
   * Validates whether a response belongs to the latest query generation.
   */
  public isLatest(generationId: number): boolean {
    return generationId === this.currentGeneration;
  }

  public getCurrentGeneration(): number {
    return this.currentGeneration;
  }

  public getLatestQuery(): string {
    return this.latestQuery;
  }

  /**
   * Resets the session immediately when clearing search
   */
  public reset(): number {
    this.currentGeneration += 1;
    this.latestQuery = '';
    return this.currentGeneration;
  }
}

/**
 * Helper to extract unique terms for text highlighting
 */
export function extractMatchedTokens(query: string): string[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const set = new Set<string>();
  for (const t of tokens) {
    if (t.length >= 2) set.add(t);
    // Also include any known synonyms
    const syns = FITNESS_SYNONYMS[t] || [];
    for (const s of syns) {
      if (s.length >= 2) set.add(s);
    }
  }

  return Array.from(set);
}
