export default function uniqueBy(array, predicate) {
  const seen = new Set();
  const result = [];
  for (const item of array) {
    const id = predicate(item);
    if (!seen.has(id)) result.push(item);
    seen.add(id);
  }
  return result;
}
