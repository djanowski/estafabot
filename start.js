import { setIntervalAsync } from 'set-interval-async';
import ms from 'ms';
import update from './update.js';
import { notifyError } from './notify.js';

const updateInterval = '1m';

console.log('Checking every', updateInterval);

async function run() {
  try {
    await update();
  } catch (error) {
    const firstError = error.errors?.[0];
    const isOverQuota = firstError?.code === 185;
    if (isOverQuota) {
      notifyError(`Error: ${firstError.message} (${firstError.code})`);
      await new Promise(resolve => {
        setTimeout(resolve, ms('10m'));
      });
    } else {
      notifyError(error);
    }
  }
}

run().then(() => {
  setIntervalAsync(async () => {
    await run();
    fetch(
      'https://cronitor.link/p/d0f88a8c67c94502beefda7035fc8c48/rWwpwY'
    ).catch(console.error);
  }, ms(updateInterval));
});
