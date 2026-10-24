import fs from 'fs';
import path from 'path';

interface CatalogExercise {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ApiExercise {
  id?: string;
  name: string;
  [key: string]: unknown;
}

async function run(): Promise<void> {
  const filePath = path.join(__dirname, '../lib/exerciseCatalogData.json');
  const ourCatalog = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CatalogExercise[];
  console.log('Loading ExerciseDB API dataset...');
  const res = await fetch('https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json');
  const apiExercises = (await res.json()) as ApiExercise[];
  console.log(`Fetched ${apiExercises.length} API exercises.`);

  function normalize(s?: string): string {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function polishExerciseName(rawName: string): string {
    let name = rawName.trim();

    const minorWords = new Set([
      'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from',
      'by', 'over', 'in', 'of', 'with', 'as', 'into'
    ]);

    const acronyms: Record<string, string> = {
      ez: 'EZ',
      bosu: 'BOSU',
      trx: 'TRX',
      smrv: 'SMRV',
    };

    name = name.replace(/([^\s\-/(]+)/g, (word: string, _match: unknown, offset: number, fullStr: string) => {
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

    name = name
      .replace(/\bSitted\b/g, 'Seated')
      .replace(/\bRevers\b/g, 'Reverse')
      .replace(/\bRollerout\b/g, 'Rollout');

    return name;
  }

  const nameMap = new Map<string, string>();
  for (const apiEx of apiExercises) {
    if (apiEx && apiEx.name) {
      nameMap.set(normalize(apiEx.name), apiEx.name);
    }
  }

  let updatedCount = 0;
  for (const ex of ourCatalog) {
    const norm = normalize(ex.name);
    if (nameMap.has(norm)) {
      const canonical = nameMap.get(norm)!;
      const polished = polishExerciseName(canonical);
      if (polished !== ex.name) {
        ex.name = polished;
        updatedCount++;
      }
    } else {
      const polished = polishExerciseName(ex.name);
      if (polished !== ex.name) {
        ex.name = polished;
        updatedCount++;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(ourCatalog, null, 2), 'utf8');
  console.log(`Upgraded catalog names successfully. Updated: ${updatedCount}`);
}

run().catch(console.error);
