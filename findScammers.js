import { compareTwoStrings } from 'string-similarity';
import Bluebird from 'bluebird';
import { appClient } from './clients.js';
import uniqueBy from './uniqueBy.js';
import Brand from './brand.js';
import Scammer from './scammer.js';
import connect from './db.js';

async function main() {
  await connect();
  const brands = await Brand.find();

  await Bluebird.resolve(brands).map(brand => processBrand({ brand }), {
    concurrency: 5,
  });

  const scammers = await Scammer.find({ isActive: true });
  const batches = batch(scammers, 100);
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
  }
}

function batch(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function processBrand({ brand }) {
  const results = await analyzeBrand({ brand });
  // eslint-disable-next-line no-shadow
  for (const { scammer, brand } of results) {
    console.log(`Found scammer ${scammer.user.screen_name} (${brand.name})`);
    await Scammer.create({
      id: scammer.user.id_str,
      username: scammer.user.screen_name,
      createdAt: scammer.user.created_at,
      brand,
    });
  }
}

async function analyzeBrand({ brand }) {
  console.log('Analyzing brand', brand.name);
  const knownScammerIDs = new Set(
    (await Scammer.find().select('id').lean()).map(s => s.id)
  );
  const users = await findUsers(brand.name);

  return await Bluebird.resolve(users)
    .filter(user => !knownScammerIDs.has(user.id_str))
    .map(user => analyzeUserResult({ brand, user }), {
      concurrency: 1,
    })
    .filter(Boolean);
}

async function findUsers(name) {
  const users = [];

  const iterator = await appClient.v1.searchUsers(`"${name}"`);
  for await (const user of iterator) {
    users.push(user);
    if (users.length >= 50) break;
  }

  return uniqueBy(users, user => user.id_str);
}

async function analyzeUserResult({ brand, user }) {
  if (user.verified) return null;

  if (user.protected) return null;

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
    if (isBlockedError) {
      console.error(`${user.screen_name} blocked us`);
      return [];
    }
    throw error;
  }
}

async function analyzeTweet({ brand, user, tweet }) {
  if (brand.noAccount) {
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
    console.error(`Cannot find verified profile for ${brand.name}, skipping`);
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

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
