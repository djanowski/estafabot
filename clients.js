import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';
import { createClient } from 'redis';
import { TwitterApiCachePluginRedis } from '@twitter-api-v2/plugin-cache-redis';
import util from 'util';
import ms from 'ms';

util.inspect.defaultOptions.depth = 4;

const plugins =
  process.env.NODE_ENV === 'development' ? [getRedisPlugin()] : [];

export const appClient = new TwitterApi(process.env.APP_BEARER_TOKEN, {
  plugins,
});

export const writeClient = new TwitterApi({
  appKey: process.env.APP_KEY,
  appSecret: process.env.APP_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

function getRedisPlugin() {
  console.warn('WARNING: Using Redis as a cache for Twitter requests');
  return new TwitterApiCachePluginRedis(createClient(), { ttl: ms('1d') });
}
