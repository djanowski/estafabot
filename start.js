import { setIntervalAsync } from 'set-interval-async';
import ms from 'ms';
import update from './update.js';

const updateInterval = '1m';

console.log('Checking every', updateInterval);

update()
  .catch(console.error)
  .then(() => {
    setIntervalAsync(async () => {
      await update().catch(console.error);
      fetch(
        'https://cronitor.link/p/d0f88a8c67c94502beefda7035fc8c48/rWwpwY'
      ).catch(console.error);
    }, ms(updateInterval));
  });
