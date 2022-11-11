import fs from 'fs';

export default function saveArray(path, array) {
  const lines = array.map(item => `${JSON.stringify(item)}`);
  const stringified = `[\n${lines.join(',\n')}\n]`;
  fs.writeFileSync(path, stringified);
}
