const { TwitterApi } = require('twitter-api-v2');
const { compareTwoStrings } = require('string-similarity');
const { brands } = require('./brands.json');
const Bluebird = require('bluebird');
const differenceInDays = require('date-fns/differenceInDays');

require('util').inspect.defaultOptions.depth = 10;

const client = new TwitterApi({
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
  const query = brand.name;
  const users = await client.v1.get('users/search.json', {
    q: query,
    count: 30,
  });
  const verifiedUser = users.find(user => user.verified);

  if (!verifiedUser) {
    console.error(`Cannot find verified profile for ${brand.name}, skipping`);
    return;
  }

  brand.user = verifiedUser;

  return await Bluebird.resolve(users)
    .map(user => analyzeUserResult({ brand, user }))
    .reduce((accum, array) => accum.concat(array), [])
    .filter(Boolean);
}

async function analyzeUserResult({ brand, user }) {
  if (user.verified) return [];

  if (user.protected) return [];

  const names = [brand.name, user.name].map(s => s.toLowerCase());
  const nameSimilarity = compareTwoStrings(...names);

  if (nameSimilarity < 0.65) return;

  const timeline = await client.v1.get('statuses/user_timeline.json', {
    user_id: user.id_str,
    count: 5,
    tweet_mode: 'extended',
  });
  const replies = timeline.filter(tweet => tweet.in_reply_to_status_id_str);

  return await Bluebird.resolve(replies)
    .map(tweet => analyzeTweet({ brand, user, tweet }))
    .filter(({ isScam }) => isScam);
}

async function analyzeTweet({ brand, user, tweet }) {
  try {
    // Scammers don't usually mention the brand's official account in their tweets.
    const tweetMentionsBrand = tweet.entities?.user_mentions?.some(
      mention => mention.screen_name === brand.user.screen_name
    );
    if (tweetMentionsBrand) return { isScam: false };

    const inReplyTo = await client.v1.get('statuses/show.json', {
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
    if (error.code !== 404)
      console.error(
        `Error retrieving tweet https://twitter.com/i/web/status/${tweet.id_str}`
      );

    return { isScam: false };
  }
}

async function postAlerts(results) {
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

  for (const candidate of candidates) {
    await postAlert(candidate);
    await Bluebird.delay(2000);
  }
}

async function postAlert({ brand, user, tweet }) {
  const brandMention = `@${brand.user.screen_name}`;
  const text = `Cuidado, asegurate de estar hablando con la cuenta oficial (${brandMention})`;
  await client.v1.post('statuses/update.json', {
    status: text,
    in_reply_to_status_id: tweet.id_str,
    auto_populate_reply_metadata: true,
    exclude_reply_user_ids: user.id_str,
  });
}

async function getAlreadyAlertedTweetIDs() {
  const timeline = await client.v1.get('statuses/user_timeline.json', {
    screen_name: 'EstafabotOK',
    count: 200,
    tweet_mode: 'extended',
  });
  const ids = timeline
    .filter(tweet => tweet.in_reply_to_status_id_str)
    .reduce((accum, tweet) => {
      return accum.add(tweet.in_reply_to_status_id_str);
    }, new Set());
  return ids;
}

module.exports = {
  analyzeAllBrands,
  postAlerts,
};
