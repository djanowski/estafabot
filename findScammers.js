import { compareTwoStrings } from 'string-similarity';
import Bluebird from 'bluebird';
import fs from 'node:fs';
import { appClient } from './clients.js';
import { getScammers, saveScammer } from './scammers.js';
import uniqueBy from './uniqueBy.js';

const { brands } = JSON.parse(fs.readFileSync('./brands.json'));

async function main() {
  await Bluebird.resolve(brands).map(brand => processBrand({ brand }), {
    concurrency: 5,
  });
}

async function processBrand({ brand }) {
  const results = await analyzeBrand({ brand });
  // eslint-disable-next-line no-shadow
  for (const { scammer, brand } of results) {
    console.log(`Found scammer ${scammer.user.screen_name} (${brand.name})`);
    saveScammer({ scammer: scammer.user, brand });
  }
}

async function analyzeBrand({ brand }) {
  console.log('Analyzing brand', brand.name);
  const knownScammerIDs = new Set(
    (await getScammers()).map(scammer => scammer.id)
  );
  const users = await findUsers(brand.name);
  const verifiedUser = users.find(user => user.verified);

  const brandWithUser = { ...brand, user: verifiedUser };

  return await Bluebird.resolve(users)
    .filter(user => !knownScammerIDs.has(user.id_str))
    .map(user => analyzeUserResult({ brand: brandWithUser, user }), {
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

  if (!brand.user) {
    console.error(`Cannot find verified profile for ${brand.name}, skipping`);
    return { isScam: false };
  }

  try {
    // Scammers don't usually mention the brand's official account in their tweets.
    const tweetMentionsBrand = tweet.entities?.user_mentions?.some(
      mention => mention.screen_name === brand.user.screen_name
    );
    if (tweetMentionsBrand) return { isScam: false };

    const inReplyTo = await appClient.v1.get('statuses/show.json', {
      id: tweet.in_reply_to_status_id_str,
      tweet_mode: 'extended',
    });

    const originalTweetIsForVerifiedUser =
      inReplyTo.entities?.user_mentions?.some(
        mention => mention.screen_name === brand.user.screen_name
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
