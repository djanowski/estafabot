import Bluebird from 'bluebird';
import { format, startOfHour, sub } from 'date-fns';
import { appClient, writeClient } from './clients.js';
import Scammer from './scammer.js';
import Alert from './alert.js';
import connect from './db.js';

const dryRun = !!process.env.DRY_RUN;

export default async function update() {
  await connect();

  const cutoff = sub(startOfHour(new Date()), { hours: 4 });
  console.log('Cutoff time is', format(cutoff, 'yyyy-MM-dd HH:mm:ss'));

  const scammers = process.env.SCAMMER
    ? await Scammer.find({ username: process.env.SCAMMER }).populate('brand')
    : await Scammer.find({ isActive: true }).populate('brand');

  console.log('Scammer count', scammers.length);

  const shuffledScammers = scammers.sort(() => Math.random() - 0.5);
  for (const scammer of shuffledScammers) {
    await processScammer(scammer, cutoff);
  }
}

async function processScammer(scammer, cutoff) {
  const alertedIDs = new Set(
    (await Alert.find({ scammer }).lean().select('tweet.id')).map(
      a => a.tweet.id
    )
  );

  const query = scammer.lastTweetID
    ? { since_id: scammer.lastTweetID }
    : { start_time: cutoff.toISOString() };

  const tweets = await toArray(
    await appClient.v2.userTimeline(scammer.id, {
      ...query,
      max_results: 100,
      exclude: 'retweets',
      'tweet.fields': [
        'conversation_id',
        'in_reply_to_user_id',
        'reply_settings',
        'created_at',
      ].join(','),
      expansions: ['entities.mentions.username'].join(','),
    })
  );

  const candidates = tweets
    .filter(tweet => tweet.in_reply_to_user_id)
    .filter(tweet => !alertedIDs.has(tweet.id))
    .filter(tweet => tweet.created_at >= cutoff.toISOString());

  for (const tweet of candidates) {
    const { data: victim } = await appClient.v2.user(
      tweet.in_reply_to_user_id,
      { 'user.fields': 'created_at' }
    );

    const tweetURL = `https://twitter.com/${scammer.username}/status/${tweet.id}`;

    if (await alreadyAlerted({ scammer, victim })) {
      console.log(
        `Already alerted ${victim.username} about ${scammer.username} ${tweetURL}`
      );
      continue;
    }

    console.log(
      `Alerting ${victim.username} about ${scammer.username} ${tweetURL}`
    );

    if (!dryRun) {
      const alertTweet = await postAlert({
        brand: scammer.brand,
        scammer,
        victim,
        tweet,
      });
      if (alertTweet.id !== 'duplicate') {
        await Alert.create({
          scammer,
          id: alertTweet.id,
          createdAt: new Date(alertTweet.created_at),
          victim: {
            user: {
              id: victim.id,
              username: victim.username,
              createdAt: new Date(victim.created_at),
            },
          },
          tweet: {
            id: tweet.id,
            text: tweet.text,
            createdAt: new Date(tweet.created_at),
          },
        });
      }
      await Bluebird.delay(10000);
    }
  }

  const lastTweetID = tweets[0]?.id;
  await Scammer.updateOne({ _id: scammer._id }, { $max: { lastTweetID } });
}

async function alreadyAlerted({ scammer, victim }) {
  return await Alert.exists({
    scammer,
    'victim.user.id': victim.id,
  });
}

async function postAlert({ brand, scammer, victim, tweet }) {
  return await ignoreDuplicates(async () => {
    try {
      return await postAlertViaReply({ brand, scammer, victim, tweet });
    } catch (error) {
      const isBlocked = error.code === 403;
      if (isBlocked) {
        return await postAlertViaQuote({ brand, scammer, victim, tweet });
      }
      throw error;
    }
  });
}

async function ignoreDuplicates(fn) {
  try {
    return await fn();
  } catch (error) {
    const isDuplicate =
      error.code === 403 && error.message.includes('Status is a duplicate');
    if (isDuplicate) {
      console.warn(error.message);
      return { id: 'duplicate' };
    }
    throw error;
  }
}

async function postAlertViaReply({ brand, tweet }) {
  const text = getBaseAlertText({ brand });
  const alertTweet = await writeClient.v1.reply(text, tweet.id);
  return alertTweet;
}

async function postAlertViaQuote({ brand, scammer, victim, tweet }) {
  const victims = [`@${victim.username}`];
  const tweetURL = `https://twitter.com/${scammer.username}/status/${tweet.id}`;
  const baseText = getBaseAlertText({ brand });
  const text = [...victims, baseText, tweetURL].join(' ');
  const alertTweet = await writeClient.v1.tweet(text);
  return alertTweet;
}

function getBaseAlertText({ brand }) {
  if (brand.hasAccount) {
    const brandMention = `@${brand.username}`;
    return `Cuidado, asegurate de estar hablando con la cuenta oficial (${brandMention})`;
  }

  return `Cuidado, ${brand.name} no provee soporte oficial por Twitter`;
}

async function toArray(iterator) {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
}
