import { appClient } from './clients.js';
import Scammer from './scammer.js';
import connect from './db.js';

export default async function main({ progress }) {
  await connect();

  const scammers = await Scammer.find({ isActive: true });
  const batches = batch(scammers, 100);

  progress.start(scammers.length, 0);

  for (const users of batches) {
    const { errors } = await appClient.v2.users(users.map(s => s.id));

    const deactivated = (errors || [])
      .filter(error => error.detail.includes('suspended'))
      .map(error => error.resource_id);

    if (deactivated.length) {
      await Scammer.updateMany(
        { id: { $in: deactivated } },
        { $set: { isActive: false } }
      );

      console.log('Deactivated', deactivated.length);
    }

    progress.increment(users.length);
  }
}

function batch(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export const heartbeatURL =
  'https://cronitor.link/p/d0f88a8c67c94502beefda7035fc8c48/yFaIvB';

export const interval = '30m';
