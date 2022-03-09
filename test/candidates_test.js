const assert = require('assert');
const { getCandidatesForAlerts } = require('../index');
const nock = require('nock');
const querystring = require('querystring');

describe('Getting candidates for alert', function () {
  describe('with reply', function () {
    let payload;

    before(function () {
      nock('https://api.twitter.com')
        .get('/1.1/statuses/user_timeline.json')
        .query({
          screen_name: 'EstafabotOK',
          count: 200,
          tweet_mode: 'extended',
        })
        .reply(200, [
          {
            in_reply_to_status_id_str: '56789',
          },
        ]);
    });

    let results;

    before(async function () {
      candidates = await getCandidatesForAlerts([
        {
          brand: {
            user: {
              screen_name: 'Supervielle_ARG',
            },
          },
          user: {
            id_str: 'scammer12345',
          },
          tweet: {
            id_str: '56789',
            created_at: new Date().toISOString(),
            entities: {
              user_mentions: [
                {
                  screen_name: 'Victim1',
                  id: 303779387,
                  id_str: '303779387',
                  indices: [0, 13],
                },
              ],
            },
          },
        },
        {
          brand: {
            user: {
              screen_name: 'Supervielle_ARG',
            },
          },
          user: {
            id_str: 'scammer12345',
          },
          tweet: {
            id_str: '67890',
            created_at: new Date().toISOString(),
            entities: {
              user_mentions: [
                {
                  screen_name: 'Victim1',
                  id: 303779387,
                  id_str: '303779387',
                  indices: [0, 13],
                },
              ],
            },
          },
        },
      ]);
    });

    it('should include tweet that was not replied to', function () {
      const actual = candidates[0].tweet.id_str;
      const expected = '67890';
      assert.strictEqual(actual, expected);
    });

    it('should not include a tweet that was replied to', function () {
      const actual = candidates.some(({ tweet }) => tweet.id_str === '56789');
      const expected = false;

      assert.strictEqual(actual, expected);
    });
  });

  describe('with quote', function () {
    let payload;

    before(function () {
      nock('https://api.twitter.com')
        .get('/1.1/statuses/user_timeline.json')
        .query({
          screen_name: 'EstafabotOK',
          count: 200,
          tweet_mode: 'extended',
        })
        .reply(200, [
          {
            in_reply_to_status_id_str: '56789',
          },
          {
            quoted_status_id_str: '78901',
          },
        ]);
    });

    let results;

    before(async function () {
      candidates = await getCandidatesForAlerts([
        {
          brand: {
            user: {
              screen_name: 'Supervielle_ARG',
            },
          },
          user: {
            id_str: 'scammer12345',
          },
          tweet: {
            id_str: '56789',
            created_at: new Date().toISOString(),
            entities: {
              user_mentions: [
                {
                  screen_name: 'Victim1',
                  id: 303779387,
                  id_str: '303779387',
                  indices: [0, 13],
                },
              ],
            },
          },
        },
        {
          brand: {
            user: {
              screen_name: 'Supervielle_ARG',
            },
          },
          user: {
            id_str: 'scammer12345',
          },
          tweet: {
            id_str: '67890',
            created_at: new Date().toISOString(),
            entities: {
              user_mentions: [
                {
                  screen_name: 'Victim1',
                  id: 303779387,
                  id_str: '303779387',
                  indices: [0, 13],
                },
              ],
            },
          },
        },
        {
          brand: {
            user: {
              screen_name: 'Supervielle_ARG',
            },
          },
          user: {
            id_str: 'scammer12345',
          },
          tweet: {
            id_str: '78901',
            created_at: new Date().toISOString(),
            entities: {
              user_mentions: [
                {
                  screen_name: 'Victim1',
                  id: 303779387,
                  id_str: '303779387',
                  indices: [0, 13],
                },
              ],
            },
          },
        },
      ]);
    });

    it('should include tweet that was not replied to', function () {
      const actual = candidates[0].tweet.id_str;
      const expected = '67890';
      assert.strictEqual(actual, expected);
    });

    it('should not include a tweet that was quoted', function () {
      const actual = candidates.some(({ tweet }) => tweet.id_str === '78901');
      const expected = false;

      assert.strictEqual(actual, expected);
    });
  });
});
