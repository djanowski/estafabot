import { setIntervalAsync } from 'set-interval-async';
import ms from 'ms';
import cliProgress from 'cli-progress';
import { notifyError } from './notify.js';

const jobName = process.argv[2];
const jobPromise = import(`./${jobName}.js`);

async function run() {
  const { default: fn, heartbeatURL } = await jobPromise;

  const progress = new cliProgress.SingleBar({
    format: `${jobName} |{bar}| {percentage}% || {value}/{total}`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });

  try {
    await fn({ progress });
    fetch(heartbeatURL).catch(console.error);
  } catch (error) {
    const firstError = error.errors?.[0];
    const isOverQuota = firstError?.code === 185;
    const isRateLimited = firstError?.code === 88;
    if (isOverQuota) {
      notifyError(`Error: ${firstError.message} (${firstError.code})`);
      await new Promise(resolve => {
        setTimeout(resolve, ms('10m'));
      });
    } else if (isRateLimited) {
      const { reset } = firstError;
      const delay = reset * 1000 - Date.now();
      notifyError(`Rate limited for ${ms(delay, { long: true })}}`);
      await new Promise(resolve => {
        setTimeout(resolve, delay);
      });
    } else {
      notifyError(error);
    }
  } finally {
    progress.stop();
  }
}

jobPromise.then(({ interval }) => {
  console.log('Running every', interval);

  run().then(() => {
    setIntervalAsync(run, ms(interval));
  });
});
