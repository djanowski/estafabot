import { compareTwoStrings } from 'string-similarity';
import { pipeline } from 'node:stream/promises';
import Bluebird from 'bluebird';
import strom from 'stromjs';
import { subHours } from 'date-fns';
import { appClient } from './clients.js';
import Brand from './brand.js';
import Scammer from './scammer.js';
import connect from './db.js';
import { notifyScammer } from './notify.js';

export default async function main({ progress }) {
  await connect();

  const brands = await Brand.find({
    name: { $not: /ypf|fr.vega/i },
    $or: [
      { lastUserSearchAt: { $exists: false } },
      { lastUserSearchAt: { $lt: subHours(new Date(), 1) } },
    ],
  });

  progress.start(brands.length, 0);

  await Bluebird.resolve(brands).map(
    async brand => {
      await processBrand({ brand });
      progress.increment();
    },
    {
      concurrency: 2,
    }
  );
}

async function processBrand({ brand }) {
  const knownScammerIDs = new Set(
    (await Scammer.find().select('id').lean()).map(s => s.id)
  );

  await pipeline(
    findUsers(brand.name),
    uniqueBy(user => user.id_str),
    strom.filter(user => !knownScammerIDs.has(user.id_str)),
    strom.map(user => analyzeUserResult({ brand, user })),
    strom.filter(Boolean),
    strom.map(async ({ scammer }) => {
      notifyScammer({ scammer: scammer.user, brand });
      await Scammer.create({
        id: scammer.user.id_str,
        username: scammer.user.screen_name,
        createdAt: scammer.user.created_at,
        brand,
      });
    })
  );

  await Brand.updateOne(
    {
      _id: brand._id,
    },
    {
      $max: {
        lastUserSearchAt: new Date(),
      },
    }
  );
}

// Need to wrap this function because of
//
// errors: [
//    {
//      code: 44,
//      message: 'Invalid value 52 for parameter page parameter is invalid.'
//    }
//  ]
async function* findUsers(name) {
  try {
    const iterator = await appClient.v1.searchUsers(`"${name}"`);
    for await (const user of iterator) {
      yield user;
    }
  } catch (error) {
    const isPaginationError = error.errors?.[0]?.code === 44;
    if (!isPaginationError) throw error;
  }
}

// stream unique by:
function uniqueBy(mapper) {
  const seen = new Set();
  return strom.filter(item => {
    const value = mapper(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

async function analyzeUserResult({ brand, user }) {
  if (user.verified) return null;

  if (user.protected) return null;
  if (user.id_str === brand.id) return null;

  const isSameName = brand.name.length > 3 && user.name === brand.name;
  if (isSameName) return { brand, scammer: { user }, isScam: true };

  const names = [brand.name, user.name].map(s => s.toLowerCase());
  const nameSimilarity = compareTwoStrings(...names);

  if (nameSimilarity < 0.65) return null;

  const cutoff = new Date('2020-01-01T00:00:00.000Z');

  try {
    const timeline = await appClient.v1.get('statuses/user_timeline.json', {
      user_id: user.id_str,
      count: 200,
      tweet_mode: 'extended',
    });
    const candidates = timeline
      .filter(tweet => tweet.in_reply_to_status_id_str)
      .filter(tweet => {
        const tweetDate = new Date(tweet.created_at);
        const isAfterCutoff = tweetDate > cutoff;
        return isAfterCutoff;
      });

    for (const tweet of candidates) {
      const result = await analyzeTweet({ brand, user, tweet });
      if (result?.isScam) {
        return result;
      }
    }
    return null;
  } catch (error) {
    const isBlockedError = error.data?.errors?.[0]?.code === 136;
    const isSuspendedError = error.data?.errors?.[0]?.code === 131;
    if (isBlockedError) {
      console.error(`${user.screen_name} blocked us`);
      return null;
    }
    if (isSuspendedError) {
      console.error(`${user.screen_name} is already suspended`);
      return null;
    }
    throw error;
  }
}

async function analyzeTweet({ brand, user, tweet }) {
  if (brand.hasAccount === false) {
    const inReplyTo = await appClient.v1.get('statuses/show.json', {
      id: tweet.in_reply_to_status_id_str,
      tweet_mode: 'extended',
    });
    return {
      brand,
      scammer: { user, tweet },
      victim: { user: inReplyTo.user, tweet: inReplyTo },
      isScam: true,
    };
  }

  if (!brand.username) {
    console.error(
      `Cannot find verified profile for ${brand.name}, skipping: ${tweet.full_text}`
    );
    return { isScam: false };
  }

  try {
    // Scammers don't usually mention the brand's official account in their tweets.
    const tweetMentionsBrand = tweet.entities?.user_mentions?.some(
      mention =>
        mention.screen_name.toLowerCase() === brand.username.toLowerCase()
    );
    if (tweetMentionsBrand) return { isScam: false };

    const inReplyTo = await appClient.v1.get('statuses/show.json', {
      id: tweet.in_reply_to_status_id_str,
      tweet_mode: 'extended',
    });

    const originalTweetIsForVerifiedUser =
      inReplyTo.entities?.user_mentions?.some(
        mention =>
          mention.screen_name.toLowerCase() === brand.username.toLowerCase()
      );

    if (originalTweetIsForVerifiedUser) {
      return {
        brand,
        scammer: { user, tweet },
        victim: { user: inReplyTo.user, tweet: inReplyTo },
        isScam: true,
      };
    }
    return { isScam: false };
  } catch (error) {
    const isNotFound = error.code === 404;
    const isSuspendedAccount = error.data?.errors?.some(e => e.code === 63);
    const isProtectedTweet = error.data?.errors?.some(e => e.code === 179);
    if (!(isNotFound || isSuspendedAccount || isProtectedTweet)) {
      console.error(
        `Error retrieving tweet https://twitter.com/i/web/status/${tweet.id_str}`,
        error
      );
    }

    return { isScam: false };
  }
}

export const heartbeatURL =
  'https://cronitor.link/p/d0f88a8c67c94502beefda7035fc8c48/wU7C3M';

export const interval = '30m';
