import Bluebird from 'bluebird';
import { format, startOfHour, sub } from 'date-fns';
import fs from 'fs';
import { appClient, writeClient } from './clients.js';
import { getScammers, updateLastID } from './scammers.js';
import saveArray from './saveArray.js';

const cutoff = sub(startOfHour(new Date()), { hours: 4 });
const dryRun = !!process.env.DRY_RUN;

export default async function update() {
  console.log('Cutoff time is', format(cutoff, 'yyyy-MM-dd HH:mm:ss'));

  const scammers = process.env.SCAMMER
    ? getScammers().filter(
        s => s.username.toLowerCase() === process.env.SCAMMER.toLowerCase()
      )
    : getScammers();

  console.log('Scammer count', scammers.length);

  const shuffledScammers = scammers.sort(() => Math.random() - 0.5);
  for (const scammer of shuffledScammers) {
    await processScammer(scammer);
  }
}

async function processScammer(scammer) {
  const alertedIDs = getAlertedIDs();

  const tweets = await toArray(
    await appClient.v2.userTimeline(scammer.id, {
      max_results: 100,
      exclude: 'retweets',
      since_id: scammer?.last_id,
      start_time: cutoff.toISOString(),
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
    .filter(tweet => !alertedIDs.has(tweet.id));

  for (const tweet of candidates) {
    const { data: victim } = await appClient.v2.user(
      tweet.in_reply_to_user_id,
      { 'user.fields': 'created_at' }
    );
    const alert = {
      brand: { user: { username: scammer.brand } },
      scammer: { user: scammer, tweet },
      victim: { user: victim },
    };

    const tweetURL = `https://twitter.com/${alert.scammer.user.username}/status/${alert.scammer.tweet.id}`;

    if (alreadyAlerted({ alert })) {
      console.log(
        `Already alerted ${alert.victim.user.username} about ${alert.scammer.user.username} ${tweetURL}`
      );
      continue;
    }

    console.log(
      `Alerting ${alert.victim.user.username} about ${alert.scammer.user.username} ${tweetURL}`
    );

    if (!dryRun) {
      const alertTweet = await postAlert(alert);
      if (alertTweet.id !== 'duplicate') {
        await saveAlert({ ...alert, alert: alertTweet });
      }
      await Bluebird.delay(10000);
    }
  }

  const lastID = tweets[0]?.id;
  updateLastID({ scammer, lastID });
}

function alreadyAlerted({ alert }) {
  const alerts = JSON.parse(fs.readFileSync('data/alerts.json'));
  return alerts.some(
    a =>
      a.scammer.user.id === alert.scammer.user.id &&
      a.victim.user.id === alert.victim.user.id
  );
}

async function saveAlert({ brand, scammer, victim, alert }) {
  const alertToSave = {
    brand: {
      name: brand.name,
      user: {
        id: brand.user.id,
        username: brand.user.username,
      },
    },
    scammer: {
      user: {
        id: scammer.user.id,
        username: scammer.user.username,
        created_at: new Date(scammer.user.created_at).valueOf(),
      },
      tweet: {
        id: scammer.tweet.id,
        full_text: scammer.tweet.text,
        created_at: new Date(scammer.tweet.created_at).valueOf(),
      },
    },
    victim: {
      user: {
        id: victim.user.id,
        username: victim.user.username,
        created_at: new Date(victim.user.created_at).valueOf(),
      },
      tweet: victim.tweet && {
        id: victim.tweet.id,
        full_text: victim.tweet.full_text,
        created_at: new Date(victim.tweet.created_at).valueOf(),
      },
    },
    alert: {
      id: alert.id,
      created_at: new Date(alert.created_at).valueOf(),
    },
  };

  const alerts = JSON.parse(fs.readFileSync('data/alerts.json'));
  alerts.push(alertToSave);
  saveArray('data/alerts.json', alerts);
}

function getAlertedIDs() {
  const alerts = JSON.parse(fs.readFileSync('data/alerts.json'));
  const alertedIDs = new Set();

  for (const alert of alerts) {
    alertedIDs.add(alert.scammer.tweet.id);
  }

  return alertedIDs;
}

async function postAlert({ brand, scammer, victim }) {
  return await ignoreDuplicates(async () => {
    try {
      return await postAlertViaReply({ brand, scammer, victim });
    } catch (error) {
      const isBlocked = error.code === 403;
      if (isBlocked) {
        return await postAlertViaQuote({ brand, scammer, victim });
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

async function postAlertViaReply({ brand, scammer }) {
  const text = getBaseAlertText({ brand });
  return await writeClient.v1.reply(text, scammer.tweet.id);
}

async function postAlertViaQuote({ brand, scammer, victim }) {
  const victims = [`@${victim.user.username}`];
  const tweetURL = `https://twitter.com/${scammer.user.username}/status/${scammer.tweet.id}`;
  const baseText = getBaseAlertText({ brand });
  const text = [...victims, baseText, tweetURL].join(' ');
  const tweet = await writeClient.v1.tweet(text);
  return tweet;
}

function getBaseAlertText({ brand }) {
  if (brand.user?.username) {
    const brandMention = `@${brand.user.username}`;
    return `Cuidado, asegurate de estar hablando con la cuenta oficial (${brandMention})`;
  }
  // return `Cuidado, ${brand.name} no provee soporte oficial por Twitter`;
  return null;
}
async function toArray(iterator) {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
}
