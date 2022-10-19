const assert = require('assert');
const { analyzeBrand } = require('../index');
const nock = require('nock');

describe('Analyze a brand', function () {
  describe('simple case', () => {
    before(function () {
      nock('https://api.twitter.com')
        .get('/1.1/users/search.json')
        .query({
          q: 'Banco Supervielle',
          count: 20,
          page: 1,
        })
        .reply(200, [
          {
            id: 194225986,
            id_str: '194225986',
            name: 'Banco Supervielle',
            screen_name: 'Supervielle_ARG',
            verified: true,
          },
          {
            id: 1471593766498627586,
            id_str: '1471593766498627586',
            name: 'Banco Supervielle',
            screen_name: 'BancoSupervie32',
            verified: false,
          },
        ]);

      nock('https://api.twitter.com')
        .get('/1.1/statuses/user_timeline.json')
        .query({
          user_id: '1471593766498627586',
          count: 5,
          tweet_mode: 'extended',
        })
        .reply(200, [
          {
            created_at: 'Thu Dec 16 22:20:41 +0000 2021',
            id: 1471606231911522300,
            id_str: '1471606231911522308',
            full_text:
              '@nachidami Hola👋, ¿En qué te puedo ayudar?\n' +
              'Podés escribirme tu consulta, o te dejo estas opciones que pueden ser de tu interés🤔\n' +
              '\n' +
              '     ◾Claves\n' +
              '     ◾Tarjetas\n' +
              '     ◾Homebanking\n' +
              '     ◾Cuentas\n' +
              '\n' +
              'Para mayor información a su consulta brindanos tu número muchas gracias.',
            truncated: false,
            display_text_range: [11, 262],
            entities: {
              hashtags: [],
              symbols: [],
              user_mentions: [
                {
                  screen_name: 'nachidami',
                  name: 'Natalia Daminato',
                  id: 181734603,
                  id_str: '181734603',
                  indices: [0, 10],
                },
              ],
              urls: [],
            },
            source:
              '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
            in_reply_to_status_id: 1471507665243181000,
            in_reply_to_status_id_str: '1471507665243181056',
            in_reply_to_user_id: 181734603,
            in_reply_to_user_id_str: '181734603',
            in_reply_to_screen_name: 'nachidami',
            user: {
              id: 1471593766498627600,
              id_str: '1471593766498627586',
              name: 'Banco Supervielle',
              screen_name: 'BancoSupervie32',
              location: 'Ciudad Autónoma de Buenos Aire',
              description:
                'Bienvenidos a nuestra página oficial banco supervielle atención al Cliente por cualquier consulta contactarnos al privado Muchas gracias.',
              url: 'https://t.co/eEYYnHVkSv',
              entities: {
                url: {
                  urls: [
                    {
                      url: 'https://t.co/eEYYnHVkSv',
                      expanded_url: 'http://www.supervielle.com/arg',
                      display_url: 'supervielle.com/arg',
                      indices: [0, 23],
                    },
                  ],
                },
                description: { urls: [] },
              },
              protected: false,
              followers_count: 0,
              friends_count: 3,
              listed_count: 0,
              created_at: 'Thu Dec 16 21:31:17 +0000 2021',
              favourites_count: 0,
              utc_offset: null,
              time_zone: null,
              geo_enabled: false,
              verified: false,
              statuses_count: 2,
              lang: null,
              contributors_enabled: false,
              is_translator: false,
              is_translation_enabled: false,
              profile_background_color: 'F5F8FA',
              profile_background_image_url: null,
              profile_background_image_url_https: null,
              profile_background_tile: false,
              profile_image_url:
                'http://pbs.twimg.com/profile_images/1471593979615473665/YdWlKz3V_normal.jpg',
              profile_image_url_https:
                'https://pbs.twimg.com/profile_images/1471593979615473665/YdWlKz3V_normal.jpg',
              profile_banner_url:
                'https://pbs.twimg.com/profile_banners/1471593766498627586/1639693086',
              profile_link_color: '1DA1F2',
              profile_sidebar_border_color: 'C0DEED',
              profile_sidebar_fill_color: 'DDEEF6',
              profile_text_color: '333333',
              profile_use_background_image: true,
              has_extended_profile: true,
              default_profile: true,
              default_profile_image: false,
              following: false,
              follow_request_sent: false,
              notifications: false,
              translator_type: 'none',
              withheld_in_countries: [],
            },
            geo: null,
            coordinates: null,
            place: null,
            contributors: null,
            is_quote_status: false,
            retweet_count: 0,
            favorite_count: 0,
            favorited: false,
            retweeted: false,
            lang: 'es',
          },
        ]);

      nock('https://api.twitter.com')
        .get('/1.1/statuses/show.json')
        .query({ id: '1471507665243181056' })
        .reply(200, {
          created_at: 'Thu Dec 16 15:49:01 +0000 2021',
          id: 1471507665243181000,
          id_str: '1471507665243181056',
          text: '@Supervielle_ARG otra vez con problemas en el HB.... por que... que mal servicio hacia sus clientes, tanto en la sucursal como en HB....',
          truncated: false,
          entities: {
            hashtags: [],
            symbols: [],
            user_mentions: [
              {
                screen_name: 'Supervielle_ARG',
                name: 'Supervielle',
                id: 194225986,
                id_str: '194225986',
                indices: [0, 16],
              },
            ],
            urls: [],
          },
          source:
            '<a href="https://mobile.twitter.com" rel="nofollow">Twitter Web App</a>',
          in_reply_to_status_id: null,
          in_reply_to_status_id_str: null,
          in_reply_to_user_id: 194225986,
          in_reply_to_user_id_str: '194225986',
          in_reply_to_screen_name: 'Supervielle_ARG',
          user: {
            id: 181734603,
            id_str: '181734603',
            name: 'Natalia Daminato',
            screen_name: 'nachidami',
            location: '',
            description: '',
            url: null,
            entities: { description: { urls: [] } },
            protected: false,
            followers_count: 164,
            friends_count: 164,
            listed_count: 3,
            created_at: 'Sun Aug 22 23:04:12 +0000 2010',
            favourites_count: 1275,
            utc_offset: null,
            time_zone: null,
            geo_enabled: false,
            verified: false,
            statuses_count: 1103,
            lang: null,
            contributors_enabled: false,
            is_translator: false,
            is_translation_enabled: false,
            profile_background_color: 'C0DEED',
            profile_background_image_url:
              'http://abs.twimg.com/images/themes/theme1/bg.png',
            profile_background_image_url_https:
              'https://abs.twimg.com/images/themes/theme1/bg.png',
            profile_background_tile: true,
            profile_image_url:
              'http://pbs.twimg.com/profile_images/1108791288/natu_normal.jpg',
            profile_image_url_https:
              'https://pbs.twimg.com/profile_images/1108791288/natu_normal.jpg',
            profile_link_color: '0084B4',
            profile_sidebar_border_color: 'C0DEED',
            profile_sidebar_fill_color: 'DDEEF6',
            profile_text_color: '333333',
            profile_use_background_image: true,
            has_extended_profile: false,
            default_profile: false,
            default_profile_image: false,
            following: false,
            follow_request_sent: false,
            notifications: false,
            translator_type: 'none',
            withheld_in_countries: [],
          },
          geo: null,
          coordinates: null,
          place: null,
          contributors: null,
          is_quote_status: false,
          retweet_count: 0,
          favorite_count: 0,
          favorited: false,
          retweeted: false,
          lang: 'es',
        });
    });

    let results;

    before('analyze brand', async function () {
      results = await analyzeBrand({
        brand: {
          name: 'Banco Supervielle',
        },
      });
    });

    it('should return one result', function () {
      const actual = results.length;
      const expected = 1;

      assert.strictEqual(actual, expected);
    });

    describe('result', function () {
      let result;

      before(function () {
        result = results[0];
      });

      it('should be marked as scam', function () {
        const actual = result.isScam;
        const expected = true;

        assert.strictEqual(actual, expected);
      });

      it('should include brand', function () {
        const actual = result.brand.name;
        const expected = 'Banco Supervielle';

        assert.strictEqual(actual, expected);
      });

      it('should include scammer details', function () {
        const actual = result.user.screen_name;
        const expected = 'BancoSupervie32';

        assert.strictEqual(actual, expected);
      });

      it('should include tweet details', function () {
        const actual = result.tweet.id_str;
        const expected = '1471606231911522308';

        assert.strictEqual(actual, expected);
      });
    });
  });

  describe('original tweet is protected', () => {
    before(function () {
      nock('https://api.twitter.com')
        .get('/1.1/users/search.json')
        .query({
          q: 'Banco Supervielle',
          count: 20,
          page: 1,
        })
        .reply(200, [
          {
            id: 194225986,
            id_str: '194225986',
            name: 'Banco Supervielle',
            screen_name: 'Supervielle_ARG',
            verified: true,
          },
          {
            id: 1471593766498627586,
            id_str: '1471593766498627586',
            name: 'Banco Supervielle',
            screen_name: 'BancoSupervie32',
            verified: false,
          },
        ]);

      nock('https://api.twitter.com')
        .get('/1.1/statuses/user_timeline.json')
        .query({
          user_id: '1471593766498627586',
          count: 5,
          tweet_mode: 'extended',
        })
        .reply(200, [
          {
            created_at: 'Thu Dec 16 22:20:41 +0000 2021',
            id: 1471606231911522300,
            id_str: '1471606231911522308',
            full_text:
              '@nachidami Hola👋, ¿En qué te puedo ayudar?\n' +
              'Podés escribirme tu consulta, o te dejo estas opciones que pueden ser de tu interés🤔\n' +
              '\n' +
              '     ◾Claves\n' +
              '     ◾Tarjetas\n' +
              '     ◾Homebanking\n' +
              '     ◾Cuentas\n' +
              '\n' +
              'Para mayor información a su consulta brindanos tu número muchas gracias.',
            truncated: false,
            display_text_range: [11, 262],
            entities: {
              hashtags: [],
              symbols: [],
              user_mentions: [
                {
                  screen_name: 'nachidami',
                  name: 'Natalia Daminato',
                  id: 181734603,
                  id_str: '181734603',
                  indices: [0, 10],
                },
              ],
              urls: [],
            },
            source:
              '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
            in_reply_to_status_id: 1471507665243181000,
            in_reply_to_status_id_str: '1471507665243181056',
            in_reply_to_user_id: 181734603,
            in_reply_to_user_id_str: '181734603',
            in_reply_to_screen_name: 'nachidami',
            user: {
              id: 1471593766498627600,
              id_str: '1471593766498627586',
              name: 'Banco Supervielle',
              screen_name: 'BancoSupervie32',
              location: 'Ciudad Autónoma de Buenos Aire',
              description:
                'Bienvenidos a nuestra página oficial banco supervielle atención al Cliente por cualquier consulta contactarnos al privado Muchas gracias.',
              url: 'https://t.co/eEYYnHVkSv',
              entities: {
                url: {
                  urls: [
                    {
                      url: 'https://t.co/eEYYnHVkSv',
                      expanded_url: 'http://www.supervielle.com/arg',
                      display_url: 'supervielle.com/arg',
                      indices: [0, 23],
                    },
                  ],
                },
                description: { urls: [] },
              },
              protected: false,
              followers_count: 0,
              friends_count: 3,
              listed_count: 0,
              created_at: 'Thu Dec 16 21:31:17 +0000 2021',
              favourites_count: 0,
              utc_offset: null,
              time_zone: null,
              geo_enabled: false,
              verified: false,
              statuses_count: 2,
              lang: null,
              contributors_enabled: false,
              is_translator: false,
              is_translation_enabled: false,
              profile_background_color: 'F5F8FA',
              profile_background_image_url: null,
              profile_background_image_url_https: null,
              profile_background_tile: false,
              profile_image_url:
                'http://pbs.twimg.com/profile_images/1471593979615473665/YdWlKz3V_normal.jpg',
              profile_image_url_https:
                'https://pbs.twimg.com/profile_images/1471593979615473665/YdWlKz3V_normal.jpg',
              profile_banner_url:
                'https://pbs.twimg.com/profile_banners/1471593766498627586/1639693086',
              profile_link_color: '1DA1F2',
              profile_sidebar_border_color: 'C0DEED',
              profile_sidebar_fill_color: 'DDEEF6',
              profile_text_color: '333333',
              profile_use_background_image: true,
              has_extended_profile: true,
              default_profile: true,
              default_profile_image: false,
              following: false,
              follow_request_sent: false,
              notifications: false,
              translator_type: 'none',
              withheld_in_countries: [],
            },
            geo: null,
            coordinates: null,
            place: null,
            contributors: null,
            is_quote_status: false,
            retweet_count: 0,
            favorite_count: 0,
            favorited: false,
            retweeted: false,
            lang: 'es',
          },
        ]);

      nock('https://api.twitter.com')
        .get('/1.1/statuses/show.json')
        .query({ id: '1471507665243181056' })
        .reply(403, {
          errors: [
            {
              code: 179,
              message: 'Sorry, you are not authorized to see this status.',
            },
          ],
        });
    });

    let results;

    before('analyze brand', async function () {
      results = await analyzeBrand({
        brand: {
          name: 'Banco Supervielle',
        },
      });
    });

    it('should return no results', function () {
      const actual = results.length;
      const expected = 0;

      assert.strictEqual(actual, expected);
    });
  });
});
