import { searchExercises, SearchSession, damerauLevenshtein, tokenizeQuery } from '../lib/searchEngine';
import { ALL_CATALOG_EXERCISES } from '../lib/exerciseCatalog';
import { ExerciseLibraryItem } from '../types/workout';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- RUNNING SEARCH ENGINE TEST SUITE ---');

// 1. Exact Match
const exactResults = searchExercises(ALL_CATALOG_EXERCISES, 'Barbell Bench Press');
assert(exactResults.length > 0, 'Exact match returns results');
assert(exactResults[0].item.name.toLowerCase() === 'barbell bench press', 'Exact match ranks #1');

// 2. Starts-With Match
const startsWithResults = searchExercises(ALL_CATALOG_EXERCISES, 'Barbell');
assert(startsWithResults.length > 0, 'Starts-with returns results');
assert(startsWithResults.every((r) => r.item.name.toLowerCase().includes('barbell') || r.item.equipment.toLowerCase().includes('barbell')), 'All results relate to barbell');

// 3. Typo Tolerance: 'benc' -> 'Bench'
const typoBenc = searchExercises(ALL_CATALOG_EXERCISES, 'benc press');
assert(typoBenc.length > 0, 'Typo "benc press" matches exercises');
assert(typoBenc[0].item.name.toLowerCase().includes('bench'), 'Typo "benc press" ranks bench press first');

// 4. Typo Tolerance: 'dumbell' -> 'Dumbbell'
const typoDumbell = searchExercises(ALL_CATALOG_EXERCISES, 'dumbell curl');
assert(typoDumbell.length > 0, 'Typo "dumbell curl" matches exercises');
assert(typoDumbell.some((r) => r.item.name.toLowerCase().includes('dumbbell')), 'Correctly maps dumbell to dumbbell');

// 5. Typo Tolerance: 'sqaut' / 'sqat' -> 'Squat'
const typoSqaut = searchExercises(ALL_CATALOG_EXERCISES, 'sqaut');
assert(typoSqaut.length > 0, 'Typo "sqaut" returns results');
assert(typoSqaut[0].item.name.toLowerCase().includes('squat'), '"sqaut" ranks squat exercises at the top');

// 6. Abbreviation / Synonym: 'ohp' -> 'Overhead Press' / 'Shoulder Press'
const ohpResults = searchExercises(ALL_CATALOG_EXERCISES, 'ohp');
assert(ohpResults.length > 0, 'Abbreviation "ohp" returns results');
assert(ohpResults.some((r) => r.item.name.toLowerCase().includes('overhead') || r.item.name.toLowerCase().includes('shoulder')), '"ohp" matches overhead/shoulder presses');

// 7. Abbreviation / Synonym: 'rdl' -> 'Romanian Deadlift'
const rdlResults = searchExercises(ALL_CATALOG_EXERCISES, 'rdl');
assert(rdlResults.length > 0, 'Abbreviation "rdl" returns results');
assert(rdlResults.some((r) => r.item.name.toLowerCase().includes('romanian deadlift') || r.item.name.toLowerCase().includes('deadlift')), '"rdl" matches romanian deadlifts');

// 8. Multiple Keywords in Any Order:
const orderA = searchExercises(ALL_CATALOG_EXERCISES, 'incline dumbbell bench');
const orderB = searchExercises(ALL_CATALOG_EXERCISES, 'bench dumbbell incline');
assert(orderA.length > 0 && orderB.length > 0, 'Multi-keyword searches return results');
assert(orderA[0].item.name === orderB[0].item.name, 'Keyword order independence preserved for top result');

// 9. Secondary Field Match (Muscle Group)
const quadResults = searchExercises(ALL_CATALOG_EXERCISES, 'quadriceps');
assert(quadResults.length > 0, 'Searching by muscle group "quadriceps" returns exercises');
assert(quadResults.some((r) => r.item.muscleGroup.toLowerCase().includes('quad') || r.item.subMuscle?.toLowerCase().includes('quad')), 'Returns quad exercises');

// 10. Empty Query, Spaces, Special Characters
const emptyResults = searchExercises(ALL_CATALOG_EXERCISES, '   ');
assert(emptyResults.length === ALL_CATALOG_EXERCISES.length, 'Empty whitespace query returns all items');

const specialResults = searchExercises(ALL_CATALOG_EXERCISES, '@@@###$$$');
assert(specialResults.length === 0, 'Nonsense special character query safely returns 0 results without errors');

// 11. STRICT RESULT ISOLATION & RACE-CONDITION TEST:
// ABC -> XYZ -> NULL -> TEST
console.log('--- TESTING STRICT RESULT ISOLATION ---');
const session = new SearchSession<ExerciseLibraryItem>();

// Simulate query 1: ABC
const res1 = session.execute('ABC', ALL_CATALOG_EXERCISES, [
  { name: 'name', weight: 10, isPrimary: true, getter: (ex) => ex.name },
]);

// Simulate query 2: XYZ
const res2 = session.execute('XYZ', ALL_CATALOG_EXERCISES, [
  { name: 'name', weight: 10, isPrimary: true, getter: (ex) => ex.name },
]);

// Simulate query 3: NULL (empty)
const res3 = session.execute('', ALL_CATALOG_EXERCISES, [
  { name: 'name', weight: 10, isPrimary: true, getter: (ex) => ex.name },
]);

// Simulate query 4: TEST (e.g. 'squat')
const res4 = session.execute('squat', ALL_CATALOG_EXERCISES, [
  { name: 'name', weight: 10, isPrimary: true, getter: (ex) => ex.name },
]);

// Assertions on generations
assert(!session.isLatest(res1.generationId), 'Query 1 (ABC) is recognized as stale');
assert(!session.isLatest(res2.generationId), 'Query 2 (XYZ) is recognized as stale');
assert(!session.isLatest(res3.generationId), 'Query 3 (NULL) is recognized as stale');
assert(session.isLatest(res4.generationId), 'Query 4 (TEST) is the active latest generation');
assert(session.getLatestQuery() === 'squat', 'Latest query matches "squat" exactly');
assert(res4.results.every((r) => r.item.name.toLowerCase().includes('squat')), 'Results contain ONLY squat results, zero ABC or XYZ contamination');

console.log('🎉 ALL 11 SEARCH ENGINE AND ISOLATION TESTS PASSED PERFECTLY!');
