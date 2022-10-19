require('dotenv').config();

const { TwitterApi } = require('twitter-api-v2');
const { compareTwoStrings } = require('string-similarity');
const { brands } = require('./brands.json');
const Bluebird = require('bluebird');
const differenceInDays = require('date-fns/differenceInDays');

require('util').inspect.defaultOptions.depth = 10;

const readClient = new TwitterApi({
  appKey: process.env.READ_APP_KEY || process.env.APP_KEY,
  appSecret: process.env.READ_APP_SECRET || process.env.APP_SECRET,
  accessToken: process.env.READ_ACCESS_TOKEN || process.env.READ_ACCESS_TOKEN,
  accessSecret: process.env.READ_ACCESS_SECRET | process.env.ACCESS_SECRET,
});

const writeClient = new TwitterApi({
  appKey: process.env.APP_KEY,
  appSecret: process.env.APP_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

async function analyzeAllBrands() {
  const results = await Bluebird.resolve(brands)
    .map(brand => analyzeBrand({ brand }))
    .reduce((accum, array) => accum.concat(array), [])
    .filter(Boolean);

  return results;
}

async function analyzeBrand({ brand }) {
  const users = await findUsers(brand.name);
  const verifiedUser = users.find(user => user.verified);

  brand.user = verifiedUser;

  return await Bluebird.resolve(users)
    .map(user => analyzeUserResult({ brand, user }))
    .reduce((accum, array) => accum.concat(array), [])
    .filter(Boolean);
}

async function findUsers(name) {
  let users = [];

  for (let i = 1; i <= 3; i++) {
    const page = await readClient.v1.get('users/search.json', {
      q: name,
      count: 20,
      page: i,
    });

    users = users.concat(page);

    if (page.length < 20) break;
  }

  return users;
}

async function analyzeUserResult({ brand, user }) {
  if (user.verified) return [];

  if (user.protected) return [];

  const names = [brand.name, user.name].map(s => s.toLowerCase());
  const nameSimilarity = compareTwoStrings(...names);

  if (nameSimilarity < 0.65) return;

  try {
    const timeline = await readClient.v1.get('statuses/user_timeline.json', {
      user_id: user.id_str,
      count: 5,
      tweet_mode: 'extended',
    });
    const replies = timeline.filter(tweet => tweet.in_reply_to_status_id_str);

    const results = await Bluebird.resolve(replies)
      .map(tweet => analyzeTweet({ brand, user, tweet }))
      .filter(({ isScam }) => isScam);
    return results;
  } catch (error) {
    const isBlockedError = error.data?.errors?.[0]?.code === 136;
    if (isBlockedError) {
      console.error(`${user.screen_name} blocked us`);
      return [];
    } else throw error;
  }
}

async function analyzeTweet({ brand, user, tweet }) {
  if (brand.noAccount) return { brand, user, tweet, isScam: true };

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

    const inReplyTo = await readClient.v1.get('statuses/show.json', {
      id: tweet.in_reply_to_status_id_str,
    });

    const originalTweetIsForVerifiedUser =
      inReplyTo.entities?.user_mentions?.some(
        mention => mention.screen_name === brand.user.screen_name
      );

    if (originalTweetIsForVerifiedUser) {
      return { brand, user, tweet, isScam: true };
    } else return { isScam: false };
  } catch (error) {
    const isNotFound = error.code === 404;
    const isSuspendedAccount = error.data?.errors?.some(e => e.code === 63);
    const isProtectedTweet = error.data?.errors?.some(e => e.code === 179);
    if (!(isNotFound || isSuspendedAccount || isProtectedTweet))
      console.error(
        `Error retrieving tweet https://twitter.com/i/web/status/${tweet.id_str}`,
        error
      );

    return { isScam: false };
  }
}

async function postAlerts(results) {
  const candidates = await getCandidatesForAlerts(results);

  for (const candidate of candidates) {
    await postAlert(candidate);
    await Bluebird.delay(2000);
  }
}

async function getCandidatesForAlerts(results) {
  const alertedTweetIDs = await getAlreadyAlertedTweetIDs();
  const candidates = results
    .filter(({ tweet }) => {
      const isAlreadyRepliedTo = alertedTweetIDs.has(tweet.id_str);
      return !isAlreadyRepliedTo;
    })
    .filter(({ tweet }) => {
      const tweetDate = new Date(tweet.created_at);
      const today = new Date();
      const isRecent = differenceInDays(today, tweetDate) <= 3;
      return isRecent;
    });
  return candidates;
}

async function postAlert({ brand, user, tweet }) {
  try {
    await postAlertViaReply({ brand, user, tweet });
  } catch (error) {
    const isBlocked = error.code === 403;
    if (isBlocked) {
      await postAlertViaQuote({ brand, user, tweet });
    } else throw error;
  }
}

async function postAlertViaReply({ brand, user, tweet }) {
  const text = getBaseAlertText({ brand });
  await writeClient.v1.post('statuses/update.json', {
    status: text,
    in_reply_to_status_id: tweet.id_str,
    auto_populate_reply_metadata: true,
  });
}

async function postAlertViaQuote({ brand, user, tweet }) {
  const victims = tweet.entities.user_mentions?.map(m => `@${m.screen_name}`);
  const tweetURL = `https://twitter.com/${user.screen_name}/status/${tweet.id_str}`;
  const baseText = getBaseAlertText({ brand });
  const result = await writeClient.v1.post('statuses/update.json', {
    status: [...victims, baseText, tweetURL].join(' '),
  });
}

function getBaseAlertText({ brand }) {
  if (brand.user) {
    const brandMention = `@${brand.user.screen_name}`;
    return `Cuidado, asegurate de estar hablando con la cuenta oficial (${brandMention})`;
  } else {
    return `Cuidado, ${brand.name} no provee soporte oficial por Twitter`;
  }
}

async function getAlreadyAlertedTweetIDs() {
  const timeline = await readClient.v1.get('statuses/user_timeline.json', {
    screen_name: 'EstafabotOK',
    count: 200,
    tweet_mode: 'extended',
  });
  const ids = timeline
    .flatMap(tweet => [
      tweet.in_reply_to_status_id_str,
      tweet.quoted_status_id_str,
    ])
    .filter(Boolean);
  return new Set(ids);
}

module.exports = {
  analyzeAllBrands,
  analyzeBrand,
  getCandidatesForAlerts,
  postAlerts,
  postAlert,
};
