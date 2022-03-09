const assert = require('assert');
const { postAlert } = require('../index');
const nock = require('nock');
const querystring = require('querystring');

describe('Post an alert', function () {
  describe('with reply', function () {
    let payload;

    before(function () {
      nock('https://api.twitter.com')
        .post('/1.1/statuses/update.json')
        .reply(200, function (uri, body) {
          payload = querystring.parse(body);
        });
    });

    let results;

    before(async function () {
      results = await postAlert({
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
      });
    });

    it('should have text', function () {
      const actual = payload.status;
      const expected =
        'Cuidado, asegurate de estar hablando con la cuenta oficial (@Supervielle_ARG)';

      assert.strictEqual(actual, expected);
    });

    it('should be in reply to scammer tweet', function () {
      const actual = payload.in_reply_to_status_id;
      const expected = '56789';

      assert.strictEqual(actual, expected);
    });

    it('should ask Twitter to handle reply mentions', function () {
      const actual = payload.auto_populate_reply_metadata;
      const expected = 'true';

      assert.strictEqual(actual, expected);
    });
  });

  describe('when scammer blocked us', function () {
    let payload;

    before(function () {
      nock('https://api.twitter.com')
        .persist()
        .post('/1.1/statuses/update.json')
        .reply(function (uri, body) {
          payload = querystring.parse(body);
          if (payload.in_reply_to_status_id === '56789') {
            return [
              403,
              {
                error: true,
                type: 'response',
                code: 403,
                data: {
                  errors: [
                    {
                      code: 385,
                      message:
                        'You attempted to reply to a Tweet that is deleted or not visible to you.',
                    },
                  ],
                },
              },
            ];
          } else return [200];
        });
    });

    let results;

    before(async function () {
      results = await postAlert({
        brand: {
          user: {
            screen_name: 'Supervielle_ARG',
          },
        },
        user: {
          screen_name: 'BadGuy',
          id_str: 'scammer12345',
        },
        tweet: {
          id_str: '56789',
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
      });
    });

    it('should have text', function () {
      const actual = payload.status;
      const expected =
        '@Victim1 Cuidado, asegurate de estar hablando con la cuenta oficial (@Supervielle_ARG) https://twitter.com/BadGuy/status/56789';

      assert.strictEqual(actual, expected);
    });

    it('should not be in reply to any tweet', function () {
      const actual = payload.in_reply_to_status_id;
      const expected = undefined;

      assert.strictEqual(actual, expected);
    });

    it('should not ask Twitter to handle reply mentions', function () {
      const actual = payload.auto_populate_reply_metadata;
      const expected = undefined;

      assert.strictEqual(actual, expected);
    });
  });
});
