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
import { matchCatalogCategory } from './exerciseCatalog';

// -------------------------------------------------------------
// FITNESS SYNONYMS & TYPO CORRECTIONS
// -------------------------------------------------------------
export const FITNESS_SYNONYMS: Record<string, string[]> = {
  // Equipment
  db: ['dumbbell', 'dumbbells'],
  dumbbell: ['db', 'dumbbells'],
  dumbbells: ['dumbbell', 'db'],
  dumbell: ['dumbbell', 'dumbbells'],
  dumbel: ['dumbbell', 'dumbbells'],
  bb: ['barbell', 'barbells'],
  barbell: ['bb', 'barbells'],
  barbel: ['barbell'],
  kb: ['kettlebell', 'kettlebells'],
  kettlebell: ['kb', 'kettlebells'],
  cable: ['cables', 'pulley'],
  cables: ['cable', 'pulley'],

  // Movements & Exercises
  benc: ['bench'],
  bench: ['benc'],
  sqat: ['squat'],
  sqaut: ['squat'],
  squat: ['sqat', 'squats'],
  squats: ['squat'],
  dl: ['deadlift'],
  deadlift: ['dl'],
  rdl: ['romanian deadlift'],
  ohp: ['overhead press', 'shoulder press'],
  pullup: ['pull-up', 'pull up', 'chinup', 'chin-up'],
  pullups: ['pull-ups', 'pull ups'],
  pushup: ['push-up', 'push up'],
  pushups: ['push-ups', 'push ups'],
  situp: ['sit-up', 'sit up'],
  situps: ['sit-ups', 'sit ups'],
  vup: ['v-up', 'v up'],
  row: ['rows', 'rowing'],
  rows: ['row'],

  // Muscles
  lat: ['lats', 'latissimus'],
  lats: ['lat', 'latissimus'],
  bicp: ['bicep', 'biceps'],
  bicep: ['biceps'],
  biceps: ['bicep'],
  tricep: ['triceps'],
  triceps: ['tricep'],
  delt: ['deltoid', 'delts', 'shoulder', 'shoulders'],
  delts: ['delt', 'deltoid', 'shoulder', 'shoulders'],
  deltoid: ['delts', 'shoulder', 'shoulders'],
  shoulder: ['shoulders', 'delts', 'deltoid'],
  shoulders: ['shoulder', 'delts', 'deltoid'],
  pec: ['pecs', 'chest'],
  pecs: ['pec', 'chest'],
  chest: ['pec', 'pecs'],
  abs: ['abdominals', 'core', 'abdominal'],
  core: ['abs', 'abdominals'],
  glute: ['glutes'],
  glutes: ['glute'],
  quad: ['quads', 'quadriceps'],
  quads: ['quad', 'quadriceps'],
  quadriceps: ['quad', 'quads'],
  ham: ['hamstrings', 'hamstring'],
  hamstring: ['hamstrings', 'ham'],
  hamstrings: ['hamstring', 'ham'],
  calf: ['calves'],
  calves: ['calf', 'calfs'],
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

export interface PrecomputedField {
  lower: string;
  words: string[];
}

const itemFieldCache = new WeakMap<object, Map<string, PrecomputedField>>();

function getPrecomputedField(item: object, fieldName: string, rawVal: string): PrecomputedField {
  let itemCache = itemFieldCache.get(item);
  if (!itemCache) {
    itemCache = new Map<string, PrecomputedField>();
    itemFieldCache.set(item, itemCache);
  }
  let cached = itemCache.get(fieldName);
  if (!cached) {
    const lower = rawVal.toLowerCase();
    const words = lower.split(/[\s\-_/(),]+/).filter(Boolean);
    cached = { lower, words };
    itemCache.set(fieldName, cached);
  }
  return cached;
}

/**
 * Calculates a match score for pre-computed target text & words against a single query token
 */
function scoreTokenAgainstPrecomputed(
  token: string,
  targetLower: string,
  targetWords: string[],
  fieldWeight: number,
  isPrimary: boolean
): { score: number; matched: boolean } {
  if (!targetLower) return { score: 0, matched: false };

  const tokenLen = token.length;

  // 1. Exact match with whole field
  if (targetLower === token) {
    return { score: 1000 * fieldWeight, matched: true };
  }

  // 2. Starts with token
  if (targetLower.startsWith(token)) {
    return { score: 600 * fieldWeight, matched: true };
  }

  // 3. Word boundary exact or prefix match
  for (let i = 0; i < targetWords.length; i++) {
    const word = targetWords[i];
    if (word === token) {
      return { score: 500 * fieldWeight, matched: true };
    }
    if (word.startsWith(token)) {
      return { score: 400 * fieldWeight, matched: true };
    }
  }

  // 4. Substring contains token (only for tokens >= 3 characters to prevent 2-letter acronyms like 'bb' or 'db' matching inside words like 'dumbbell')
  if (tokenLen >= 3) {
    const subIdx = targetLower.indexOf(token);
    if (subIdx !== -1) {
      return { score: 250 * fieldWeight, matched: true };
    }
  }

  // 5. Fuzzy / Typo match on individual words (only for tokens >= 5 characters to avoid false positives on 4-letter words like hack/rack vs back)
  if (tokenLen >= 5) {
    const maxAllowedDistance = tokenLen >= 8 ? 2 : 1;
    for (let i = 0; i < targetWords.length; i++) {
      const word = targetWords[i];
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
 * Calculates a match score for a given target text against a single query token (backward compatible wrapper)
 */
export function scoreTokenAgainstText(
  token: string,
  target: string,
  fieldWeight: number,
  isPrimary: boolean = false
): { score: number; matched: boolean } {
  if (!target) return { score: 0, matched: false };
  const targetLower = target.toLowerCase();
  const targetWords = targetLower.split(/[\s\-_/(),]+/).filter(Boolean);
  return scoreTokenAgainstPrecomputed(token, targetLower, targetWords, fieldWeight, isPrimary);
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

    // Resolve precomputed fields for this item
    const resolvedFields: {
      name: string;
      weight: number;
      isPrimary: boolean;
      lower: string;
      words: string[];
    }[] = [];

    for (let f = 0; f < fields.length; f++) {
      const field = fields[f];
      const fieldVal = field.getter(item);
      if (!fieldVal) continue;

      if (typeof item === 'object' && item !== null) {
        const cached = getPrecomputedField(item, field.name, fieldVal);
        resolvedFields.push({
          name: field.name,
          weight: field.weight,
          isPrimary: !!field.isPrimary,
          lower: cached.lower,
          words: cached.words,
        });
      } else {
        const lower = fieldVal.toLowerCase();
        resolvedFields.push({
          name: field.name,
          weight: field.weight,
          isPrimary: !!field.isPrimary,
          lower,
          words: lower.split(/[\s\-_/(),]+/).filter(Boolean),
        });
      }
    }

    // Check primary field exact & prefix matches with full query string
    const primaryResolved = resolvedFields.find((f) => f.isPrimary) || resolvedFields[0];
    const primaryVal = primaryResolved ? primaryResolved.lower : '';

    if (primaryVal) {
      if (primaryVal === fullQueryLower) {
        totalScore += 10000;
        matchedFieldsSet.add(primaryResolved.name);
      } else if (primaryVal.startsWith(fullQueryLower)) {
        totalScore += 5000;
        matchedFieldsSet.add(primaryResolved.name);
      } else if (primaryVal.includes(fullQueryLower)) {
        totalScore += 2500;
        matchedFieldsSet.add(primaryResolved.name);
      }
    }

    // Every token in the query MUST match at least one field (Conjunctive AND)
    for (const group of tokenGroups) {
      let bestTokenScore = 0;
      let tokenMatched = false;
      const candidates = [group.primary, ...group.expansions];

      for (let rf = 0; rf < resolvedFields.length; rf++) {
        const field = resolvedFields[rf];

        for (let c = 0; c < candidates.length; c++) {
          const candidate = candidates[c];
          const { score, matched } = scoreTokenAgainstPrecomputed(
            candidate,
            field.lower,
            field.words,
            field.weight,
            field.isPrimary
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
export const CANONICAL_MUSCLE_MAPPINGS: Record<string, { pillar: string; sub?: string }> = {
  chest: { pillar: 'Chest' },
  pecs: { pillar: 'Chest' },
  pec: { pillar: 'Chest' },
  pectorals: { pillar: 'Chest' },
  shoulders: { pillar: 'Shoulders' },
  shoulder: { pillar: 'Shoulders' },
  delts: { pillar: 'Shoulders' },
  delt: { pillar: 'Shoulders' },
  deltoid: { pillar: 'Shoulders' },
  deltoids: { pillar: 'Shoulders' },
  back: { pillar: 'Back' },
  lats: { pillar: 'Back', sub: 'lats' },
  lat: { pillar: 'Back', sub: 'lats' },
  traps: { pillar: 'Back', sub: 'traps' },
  trap: { pillar: 'Back', sub: 'traps' },
  biceps: { pillar: 'Arms', sub: 'biceps' },
  bicep: { pillar: 'Arms', sub: 'biceps' },
  triceps: { pillar: 'Arms', sub: 'triceps' },
  tricep: { pillar: 'Arms', sub: 'triceps' },
  arms: { pillar: 'Arms' },
  arm: { pillar: 'Arms' },
  legs: { pillar: 'Legs' },
  leg: { pillar: 'Legs' },
  quads: { pillar: 'Legs', sub: 'quads' },
  quad: { pillar: 'Legs', sub: 'quads' },
  quadriceps: { pillar: 'Legs', sub: 'quads' },
  hamstrings: { pillar: 'Legs', sub: 'hamstrings' },
  hamstring: { pillar: 'Legs', sub: 'hamstrings' },
  glutes: { pillar: 'Legs', sub: 'glutes' },
  glute: { pillar: 'Legs', sub: 'glutes' },
  calves: { pillar: 'Legs', sub: 'calves' },
  calf: { pillar: 'Legs', sub: 'calves' },
  abs: { pillar: 'Core', sub: 'abs_upper_lower' },
  ab: { pillar: 'Core', sub: 'abs_upper_lower' },
  core: { pillar: 'Core' },
  neck: { pillar: 'Neck' },
};

const EXERCISE_SEARCH_FIELDS: FieldConfig<ExerciseLibraryItem>[] = [
  {
    name: 'name',
    weight: 10,
    isPrimary: true,
    getter: (ex) => ex.name,
  },
  {
    name: 'muscleGroup',
    weight: 8,
    getter: (ex) => ex.muscleGroup,
  },
  {
    name: 'subMuscle',
    weight: 7,
    getter: (ex) => ex.subMuscle,
  },
  {
    name: 'category',
    weight: 6,
    getter: (ex) => ex.category,
  },
  {
    name: 'equipment',
    weight: 5,
    getter: (ex) => ex.equipment,
  },
  {
    name: 'movementPattern',
    weight: 3,
    getter: (ex) => ex.movementPattern,
  },
  {
    name: 'difficulty',
    weight: 1,
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
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return exercises.map((item) => ({
      item,
      score: 1,
      matchedTokens: [],
      matchedFields: [],
    }));
  }

  // 1. Direct muscle query intent routing (guarantees 100% isolation for muscle searches)
  const muscleMapping = CANONICAL_MUSCLE_MAPPINGS[trimmed];
  if (muscleMapping) {
    const matches = exercises.filter((ex) =>
      matchCatalogCategory(ex, muscleMapping.pillar, muscleMapping.sub || 'all')
    );
    // Deduplicate matches by item ID
    const seen = new Set<string>();
    const deduplicatedMatches: ExerciseLibraryItem[] = [];
    for (const m of matches) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        deduplicatedMatches.push(m);
      }
    }
    return deduplicatedMatches.map((item) => ({
      item,
      score: 10000,
      matchedTokens: [trimmed],
      matchedFields: ['muscleGroup', 'category'],
    }));
  }

  // 2. High-precision weighted multi-field search
  const rawResults = searchItems(exercises, query, EXERCISE_SEARCH_FIELDS, options);

  // Deduplicate results by ID
  const seen = new Set<string>();
  const deduplicated: SearchMatchResult<ExerciseLibraryItem>[] = [];
  for (const r of rawResults) {
    if (!seen.has(r.item.id)) {
      seen.add(r.item.id);
      deduplicated.push(r);
    }
  }

  return deduplicated;
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
