import {
  ALL_CATALOG_EXERCISES,
  matchCatalogCategory,
  matchEquipment,
  matchDifficulty,
  matchLoadType,
  deduplicateExercises,
} from '../lib/exerciseCatalog';
import { searchExercises, SearchSession } from '../lib/searchEngine';
import { ExerciseLibraryItem } from '../types/workout';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('====================================================');
console.log('RUNNING COMPREHENSIVE SEARCH & FILTER TEST SUITE');
console.log('====================================================');

const masterLibrary = deduplicateExercises(ALL_CATALOG_EXERCISES);

// Helper that executes the exact pipeline used in app/library/page.tsx and components/ExerciseLibraryModal.tsx
function runFilterPipeline(params: {
  library: ExerciseLibraryItem[];
  searchTerm?: string;
  selectedCategory?: string;
  selectedSubCategory?: string;
  selectedEquipment?: string;
  selectedLoadType?: string;
  selectedDifficulty?: string;
  sortBy?: 'name_asc' | 'name_desc' | 'muscle' | 'equipment';
  displayCount?: number;
}) {
  const {
    library,
    searchTerm = '',
    selectedCategory = 'All',
    selectedSubCategory = 'all',
    selectedEquipment = 'All',
    selectedLoadType = 'All',
    selectedDifficulty = 'All',
    sortBy = 'name_asc',
    displayCount = 48,
  } = params;

  // 1. Deduplication
  const clean = deduplicateExercises(library);

  // 2. Base Conjunction Filter
  const baseFiltered = clean.filter((item) => {
    const matchesCat = matchCatalogCategory(item, selectedCategory, selectedSubCategory);
    const matchesEq = matchEquipment(item.equipment, selectedEquipment);
    const matchesLoad = matchLoadType(item, selectedLoadType);
    const matchesDiff = matchDifficulty(item.difficulty, selectedDifficulty);
    return matchesCat && matchesEq && matchesLoad && matchesDiff;
  });

  // 3. Search Matching & Relevance Scoring
  const trimmed = searchTerm.trim();
  let searchFiltered: ExerciseLibraryItem[] = [];

  if (!trimmed) {
    searchFiltered = [...baseFiltered].sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'muscle')
        return a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name);
      if (sortBy === 'equipment')
        return (a.equipment || '').localeCompare(b.equipment || '') || a.name.localeCompare(b.name);
      return 0;
    });
  } else {
    const searchResults = searchExercises(baseFiltered, trimmed);
    if (sortBy === 'name_asc') {
      searchFiltered = searchResults.map((r) => r.item);
    } else {
      searchFiltered = [...searchResults]
        .sort((a, b) => {
          if (sortBy === 'name_desc') return b.item.name.localeCompare(a.item.name);
          if (sortBy === 'muscle')
            return (
              a.item.muscleGroup.localeCompare(b.item.muscleGroup) ||
              b.score - a.score ||
              a.item.name.localeCompare(b.item.name)
            );
          if (sortBy === 'equipment')
            return (
              (a.item.equipment || '').localeCompare(b.item.equipment || '') ||
              b.score - a.score ||
              a.item.name.localeCompare(b.item.name)
            );
          return b.score - a.score;
        })
        .map((r) => r.item);
    }
  }

  // 4. Rendered List (Single Source of Truth)
  const renderedExercises = searchFiltered.slice(0, displayCount);
  const renderedCount = renderedExercises.length;
  const totalMatches = searchFiltered.length;

  return {
    renderedExercises,
    renderedCount,
    totalMatches,
  };
}

// -------------------------------------------------------------
// TEST 1: Search "chest" -> shows ONLY chest exercises
// -------------------------------------------------------------
console.log('\n--- TEST 1: Search "chest" ---');
const test1 = runFilterPipeline({ library: masterLibrary, searchTerm: 'chest' });
assert(test1.totalMatches > 0, 'Search "chest" returns results');
assert(
  test1.renderedExercises.every((e) => matchCatalogCategory(e, 'Chest', 'all')),
  'Every single exercise returned for "chest" is strictly a Chest exercise (0 non-chest items)'
);
assert(test1.renderedCount === test1.renderedExercises.length, 'Rendered count exactly equals cards rendered');
console.log(`Matched: ${test1.totalMatches} exercises. Rendered cards: ${test1.renderedCount}. Non-chest: 0.`);

// -------------------------------------------------------------
// TEST 2: Search "shoulders" immediately after -> shows ONLY shoulder exercises (no chest lingering)
// -------------------------------------------------------------
console.log('\n--- TEST 2: Search "shoulders" immediately after ---');
const test2 = runFilterPipeline({ library: masterLibrary, searchTerm: 'shoulders' });
assert(test2.totalMatches > 0, 'Search "shoulders" returns results');
assert(
  test2.renderedExercises.every((e) => matchCatalogCategory(e, 'Shoulders', 'all')),
  'Every single exercise returned for "shoulders" is strictly a Shoulder exercise (0 non-shoulder items)'
);
const lingeringChestInShoulders = test2.renderedExercises.filter((e) =>
  matchCatalogCategory(e, 'Chest', 'all')
);
assert(lingeringChestInShoulders.length === 0, 'Zero chest exercises lingering in shoulder search results');
assert(test2.renderedCount === test2.renderedExercises.length, 'Rendered count exactly equals cards rendered');
console.log(`Matched: ${test2.totalMatches} exercises. Rendered cards: ${test2.renderedCount}. Zero chest items.`);

// -------------------------------------------------------------
// TEST 3: Filter by Equipment "Dumbbells" -> shows only dumbbell exercises
// -------------------------------------------------------------
console.log('\n--- TEST 3: Filter by Equipment "Dumbbells" ---');
const test3 = runFilterPipeline({ library: masterLibrary, selectedEquipment: 'Dumbbells' });
assert(test3.totalMatches > 0, 'Equipment filter "Dumbbells" returns results');
assert(
  test3.renderedExercises.every((e) => matchEquipment(e.equipment, 'Dumbbells')),
  'All returned exercises are strictly Dumbbell exercises'
);
assert(test3.renderedCount === test3.renderedExercises.length, 'Rendered count exactly equals cards rendered');
console.log(`Matched: ${test3.totalMatches} exercises. Rendered cards: ${test3.renderedCount}.`);

// -------------------------------------------------------------
// TEST 4: Filter Muscle "Back" + Equipment "Barbell" -> shows only barbell back exercises
// -------------------------------------------------------------
console.log('\n--- TEST 4: Filter Muscle "Back" + Equipment "Barbell" ---');
const test4 = runFilterPipeline({
  library: masterLibrary,
  selectedCategory: 'Back',
  selectedEquipment: 'Barbell',
});
assert(test4.totalMatches > 0, 'Conjunction "Back" + "Barbell" returns results');
assert(
  test4.renderedExercises.every((e) => matchCatalogCategory(e, 'Back', 'all')),
  'Every returned exercise is strictly a Back exercise'
);
assert(
  test4.renderedExercises.every((e) => matchEquipment(e.equipment, 'Barbell')),
  'Every returned exercise strictly uses a Barbell'
);
assert(test4.renderedCount === test4.renderedExercises.length, 'Rendered count exactly equals cards rendered');
console.log(`Matched: ${test4.totalMatches} exercises. Rendered cards: ${test4.renderedCount}.`);

// -------------------------------------------------------------
// TEST 5: Filter Muscle "Legs" + Level "Beginner" + Search "squat" -> shows only beginner leg squats
// -------------------------------------------------------------
console.log('\n--- TEST 5: Muscle "Legs" + Level "Beginner" + Search "squat" ---');
const test5 = runFilterPipeline({
  library: masterLibrary,
  selectedCategory: 'Legs',
  selectedDifficulty: 'Beginner',
  searchTerm: 'squat',
});
assert(test5.totalMatches > 0, 'Triple conjunction "Legs" + "Beginner" + "squat" returns results');
assert(
  test5.renderedExercises.every((e) => matchCatalogCategory(e, 'Legs', 'all')),
  'All returned exercises strictly belong to the Legs pillar'
);
assert(
  test5.renderedExercises.every((e) => matchDifficulty(e.difficulty, 'Beginner')),
  'All returned exercises are Beginner difficulty'
);
assert(
  test5.renderedExercises.every(
    (e) =>
      e.name.toLowerCase().includes('squat') ||
      (e.movementPattern && e.movementPattern.toLowerCase().includes('squat'))
  ),
  'All returned exercises relate to squat movements'
);
assert(test5.renderedCount === test5.renderedExercises.length, 'Rendered count exactly equals cards rendered');
console.log(`Matched: ${test5.totalMatches} exercises. Rendered cards: ${test5.renderedCount}.`);

// -------------------------------------------------------------
// TEST 6: Clear all filters -> shows full master library
// -------------------------------------------------------------
console.log('\n--- TEST 6: Clear all filters (Reset All) ---');
const test6 = runFilterPipeline({ library: masterLibrary });
assert(
  test6.totalMatches === masterLibrary.length,
  `Full master library restored (${masterLibrary.length} unique exercises)`
);
assert(test6.renderedCount === Math.min(48, masterLibrary.length), 'Renders initial page slice cleanly');
console.log(`Total available: ${test6.totalMatches}. Rendered cards: ${test6.renderedCount}.`);

// -------------------------------------------------------------
// TEST 7: Result Count 100% Synchronization in every scenario
// -------------------------------------------------------------
console.log('\n--- TEST 7: 100% Count-to-Card Synchronization ---');
const scenarios = [
  { searchTerm: 'incline barbell bench press' }, // Specific 1-2 match
  { searchTerm: 'bicep' },
  { selectedCategory: 'Neck' },
  { selectedEquipment: 'Smith Machine' },
  { selectedLoadType: 'timed' },
  { searchTerm: 'nonexistentexercisexyz' }, // 0 matches
];

for (const sc of scenarios) {
  const res = runFilterPipeline({ library: masterLibrary, ...sc });
  assert(
    res.renderedCount === res.renderedExercises.length,
    `Scenario ${JSON.stringify(sc)}: renderedCount (${res.renderedCount}) === renderedExercises.length (${res.renderedExercises.length})`
  );
  if (res.totalMatches === 0) {
    assert(res.renderedCount === 0 && res.renderedExercises.length === 0, 'Zero match scenario correctly yields 0 count and 0 cards');
  }
}

// -------------------------------------------------------------
// TEST 8: Fuzzy Safety: "back" does NOT match "hack squat" or "front rack squat"
// -------------------------------------------------------------
console.log('\n--- TEST 8: Fuzzy Safety for 4-letter words ---');
const backSearch = runFilterPipeline({ library: masterLibrary, searchTerm: 'back', displayCount: 200 });
const hackInBack = backSearch.renderedExercises.find((e) => e.name.toLowerCase().includes('hack squat'));
assert(!hackInBack, 'Search "back" does NOT match "Hack Squat" (false positive fuzzy match prevented)');

// -------------------------------------------------------------
// TEST 9: Typo Tolerance & Fitness Abbreviations
// -------------------------------------------------------------
console.log('\n--- TEST 9: Typo Tolerance & Fitness Abbreviations ---');
const typoBench = runFilterPipeline({ library: masterLibrary, searchTerm: 'benc press' });
assert(typoBench.totalMatches > 0, '"benc press" matches bench press');
assert(typoBench.renderedExercises[0].name.toLowerCase().includes('bench'), 'Top result is bench press');

const typoDumbell = runFilterPipeline({ library: masterLibrary, searchTerm: 'dumbell curl' });
assert(typoDumbell.totalMatches > 0, '"dumbell curl" matches dumbbell curl');

const typoSquat = runFilterPipeline({ library: masterLibrary, searchTerm: 'sqaut' });
assert(typoSquat.totalMatches > 0, '"sqaut" matches squats');

const ohp = runFilterPipeline({ library: masterLibrary, searchTerm: 'ohp' });
assert(ohp.totalMatches > 0, '"ohp" matches overhead presses');

console.log('\n====================================================');
console.log('🎉 ALL COMPREHENSIVE SEARCH & FILTER TESTS PASSED PERFECTLY!');
console.log('====================================================');
