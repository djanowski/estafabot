import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';
import { createClient } from 'redis';
import { TwitterApiCachePluginRedis } from '@twitter-api-v2/plugin-cache-redis';
import util from 'util';
import ms from 'ms';

util.inspect.defaultOptions.depth = 3;

const redisInstance = createClient();
const cachePlugin = new TwitterApiCachePluginRedis(redisInstance, {
  ttl: ms('8h'),
});

export const appClient = new TwitterApi(process.env.APP_BEARER_TOKEN, {
  plugins: [cachePlugin],
});

export const writeClient = new TwitterApi({
  appKey: process.env.APP_KEY,
  appSecret: process.env.APP_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});
