const catalog = require('../lib/exerciseCatalogData.json');
const counts = {};
catalog.forEach(item => {
  counts[item.muscleGroup] = (counts[item.muscleGroup] || 0) + 1;
});
console.log('Total exercises:', catalog.length);
console.log('Pillar distribution:', counts);

const equipCounts = {};
catalog.forEach(item => {
  equipCounts[item.equipment] = (equipCounts[item.equipment] || 0) + 1;
});
console.log('Equipment distribution:', equipCounts);
