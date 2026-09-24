const catalog = require('../lib/exerciseCatalogData.json');

const PILLARS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Functional', 'Neck'];

function testMatch(item, pillar, subFilter = 'all') {
  const p = pillar.toLowerCase().trim();
  const sub = (subFilter || 'all').toLowerCase().trim();
  const mg = (item.muscleGroup || '').toLowerCase().trim();
  const sm = (item.subMuscle || '').toLowerCase().trim();
  const cat = (item.category || '').toLowerCase().trim();
  const name = (item.name || '').toLowerCase().trim();

  if (p === 'chest') {
    return mg === 'chest' || cat === 'chest' || sm.includes('pectoral');
  }
  if (p === 'back') {
    return mg === 'back' || cat === 'back' || sm.includes('lat') || sm.includes('trap');
  }
  if (p === 'shoulders') {
    return mg === 'shoulders' || cat === 'shoulders' || sm.includes('delt');
  }
  if (p === 'arms') {
    return mg === 'arms' || cat === 'arms' || sm.includes('bicep') || sm.includes('tricep') || sm.includes('forearm');
  }
  if (p === 'legs') {
    return mg === 'legs' || cat === 'legs' || sm.includes('quad') || sm.includes('hamstring') || sm.includes('glute') || sm.includes('calv') || sm.includes('adductor') || sm.includes('abductor');
  }
  if (p === 'core') {
    return mg === 'core' || cat === 'core' || sm.includes('ab') || sm.includes('spine');
  }
  if (p === 'neck') {
    return mg === 'neck' || sm.includes('neck') || sm.includes('levator') || name.includes('neck');
  }
  if (p === 'functional') {
    return mg === 'functional' || cat === 'functional' || sm.includes('cardio') || name.includes('cardio');
  }
  return false;
}

PILLARS.forEach(pillar => {
  const matched = catalog.filter(item => testMatch(item, pillar));
  console.log(`Pillar ${pillar}: ${matched.length} exercises match`);
});
