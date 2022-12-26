import { formatDistanceToNow } from 'date-fns';

async function notify(message) {
  process.stdout.write(`\n${message}\n`);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      chat_id: '-1001873454236',
      text: message,
      disable_notification: true,
      disable_web_page_preview: true,
      parse_mode: 'Markdown',
    }),
  });
}

export async function notifyAlert({ victim, scammer, tweetURL }) {
  const followers = victim.public_metrics.followers_count;
  const following = victim.public_metrics.following_count;

  const isRelevant = followers > 7000 && following < 2000;

  if (!isRelevant) return;

  await notify(
    `Alerted [${victim.username}](https://twitter.com/${victim.username}) (${following}/${followers}) about [${scammer.username}](${tweetURL})`
  );
}

export async function notifyScammer({ scammer, brand }) {
  const created = formatDistanceToNow(new Date(scammer.created_at), {
    addSuffix: true,
  });
  const username = scammer.screen_name;
  await notify(
    `Found new scammer [${username}](https://twitter.com/${username}) (${created}) for ${brand.name}`
  );
}

export async function notifyError(error) {
  console.error(error);
  const codeBlock = '```';
  await notify(
    `${codeBlock}\nError: ${error.stack || error.message}\n${codeBlock}`
  );
}
