const fs = require('fs');
const path = require('path');

async function run() {
  const ourCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/exerciseCatalogData.json'), 'utf8'));
  console.log('Loading ExerciseDB API dataset...');
  const res = await fetch('https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json');
  const apiExercises = await res.json();
  console.log(`Fetched ${apiExercises.length} API exercises.`);

  function normalize(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function polishExerciseName(rawName) {
    let name = rawName.trim();

    // Minor words that stay lowercase unless at the start or immediately after an opening parenthesis
    const minorWords = new Set([
      'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from',
      'by', 'over', 'in', 'of', 'with', 'as', 'into'
    ]);

    const acronyms = {
      ez: 'EZ',
      bosu: 'BOSU',
      trx: 'TRX',
      smrv: 'SMRV',
    };

    // Capitalize words respecting spaces, hyphens, slashes, and parentheses
    name = name.replace(/([^\s\-/(]+)/g, (word, match, offset, fullStr) => {
      const lower = word.toLowerCase();
      if (acronyms[lower]) return acronyms[lower];
      if (lower === 'v' && (fullStr[offset + 1] === '-' || fullStr[offset - 1] === '-')) return 'V';
      if (lower === 't' && (fullStr[offset + 1] === '-' || fullStr[offset - 1] === '-')) return 'T';
      
      const prevChar = offset > 0 ? fullStr[offset - 1] : '';
      const isStart = offset === 0 || prevChar === '(' || prevChar === '[' || prevChar === '"' || prevChar === '-' || prevChar === '/';
      if (!isStart && minorWords.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

    // Fix ExerciseDB API typos and awkward formatting
    name = name
      .replace(/\bSitted\b/g, 'Seated')
      .replace(/\bRevers\b/g, 'Reverse')
      .replace(/\bRollerout\b/g, 'Rollout')
      .replace(/\brollerout\b/g, 'rollout')
      .replace(/\bV\.\s*2\b/g, 'v2')
      .replace(/\bV\.\s*3\b/g, 'v3')
      .replace(/\bv\.\s*2\b/g, 'v2')
      .replace(/\bv\.\s*3\b/g, 'v3')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return name;
  }

  // Lookup maps from API
  const mapByNorm = new Map();
  const mapByNoGender = new Map();
  const mapBySlug = new Map();

  apiExercises.forEach((item) => {
    const norm = normalize(item.name);
    mapByNorm.set(norm, item);

    const noGender = normalize(item.name.replace(/\s*\((male|female)\)/gi, ''));
    mapByNoGender.set(noGender, item);

    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    mapBySlug.set(slug, item);
  });

  let upgradedCount = 0;
  const sampleChanges = [];

  const updatedCatalog = ourCatalog.map((item) => {
    const slug = item.id.replace('exdb_', '').replace(/_/g, '-');
    const ourNorm = normalize(item.name);
    const ourNoGender = normalize(item.name.replace(/\s*(male|female|v\s*\d+|\d+)$/gi, ''));

    const found =
      mapByNorm.get(ourNorm) ||
      mapByNoGender.get(ourNoGender) ||
      mapBySlug.get(slug) ||
      mapByNorm.get(ourNoGender);

    if (found) {
      const betterName = polishExerciseName(found.name);
      if (betterName !== item.name && sampleChanges.length < 50) {
        sampleChanges.push({ old: item.name, new: betterName });
      }

      // If API has real instruction steps, use them!
      let instructions = item.instructions;
      let notes = item.notes;
      if (found.instruction_steps && found.instruction_steps.en && found.instruction_steps.en.length > 0) {
        instructions = found.instruction_steps.en;
        notes = found.instruction_steps.en.join(' ');
      }

      upgradedCount++;
      return {
        ...item,
        name: betterName,
        instructions,
        notes,
        videoUrl: `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(betterName)}`,
      };
    } else {
      console.warn('Could not match:', item.name, item.id);
      return item;
    }
  });

  console.log(`Matched and upgraded: ${upgradedCount} of ${ourCatalog.length}`);
  console.log('Sample polished names:');
  sampleChanges.slice(0, 25).forEach((c, i) => console.log(`${i + 1}. "${c.old}" -> "${c.new}"`));

  // Write updated catalog to lib/exerciseCatalogData.json
  fs.writeFileSync(
    path.join(__dirname, '../lib/exerciseCatalogData.json'),
    JSON.stringify(updatedCatalog, null, 2),
    'utf8'
  );
  console.log('Saved updated lib/exerciseCatalogData.json');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
