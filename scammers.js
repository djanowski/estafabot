import { readFileSync } from 'fs';
import saveArray from './saveArray.js';

const path = new URL('./data/scammers.json', import.meta.url);

export function getScammers() {
  return JSON.parse(readFileSync(path));
}

export function saveScammer({ scammer, brand }) {
  const scammerID = scammer.id_str || scammer.id;
  const scammers = getScammers();

  const record = {
    id: scammerID,
    username: scammer.username || scammer.screen_name,
    created_at: new Date(scammer.created_at).valueOf(),
    brand: brand.user?.username || brand.user?.screen_name,
  };
  const existing = scammers.find(s => s.id === record.id);
  if (existing) Object.assign(existing, record);
  else scammers.push(record);
  saveArray(path, scammers);
}

export function updateLastID({ scammer, lastID }) {
  const scammerID = scammer.id_str || scammer.id;
  const scammers = getScammers();
  const existing = scammers.find(s => s.id === scammerID);
  existing.last_id = lastID;
  saveArray(path, scammers);
}
