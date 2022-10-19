#!/usr/bin/env node

const { analyzeAllBrands } = require('./index');
const { postAlert } = require('./index');
const Bluebird = require('bluebird');
const fs = require('fs');

async function main() {
  const alertedIDs = getAlertedIDs();
  console.log(`Already alerted about ${alertedIDs.size} tweets`);

  const scammers = JSON.parse(fs.readFileSync('data/scammers.json'));
  const results = await analyzeAllBrands({ scammers, alertedIDs });

  // Group alerts by scammer so we can advance our cursor.
  const alertsByScammer = groupBy(
    results,
    ({ scammer }) => scammer.user.id_str
  );

  for (const [scammerID, alerts] of alertsByScammer.entries()) {
    const [
      {
        scammer: { user: scammer },
      },
    ] = alerts;

    for (const alert of alerts) {
      const alertTweet = await postAlert(alert);
      await saveAlert({ ...alert, alert: alertTweet });
      await Bluebird.delay(2000);
    }

    await saveScammer(scammer);
  }
}

function groupBy(array, identity) {
  return array.reduce((result, item) => {
    const value = identity(item);
    if (!result.has(value)) {
      result.set(value, []);
    }
    result.get(value).push(item);
    return result;
  }, new Map());
}

async function saveScammer(scammer) {
  const scammers = JSON.parse(fs.readFileSync('data/scammers.json'));
  if (!scammers[scammer.id_str]) {
    scammers[scammer.id_str] = {};
  }
  const lastID = scammer.status.id_str;
  scammers[scammer.id_str] = {
    last_id: lastID,
    id_str: scammer.id_str,
    screen_name: scammer.screen_name,
    created_at: scammer.created_at,
  };
  fs.writeFileSync('data/scammers.json', JSON.stringify(scammers));
}

async function saveAlert({ brand, scammer, victim, alert }) {
  const alertToSave = {
    brand: {
      name: brand.name,
      user: {
        id_str: brand.user.id_str,
        screen_name: brand.user.screen_name,
      },
    },
    scammer: {
      user: {
        id_str: scammer.user.id_str,
        screen_name: scammer.user.screen_name,
        created_at: new Date(scammer.user.created_at).valueOf(),
      },
      tweet: {
        id_str: scammer.tweet.id_str,
        full_text: scammer.tweet.full_text,
        created_at: new Date(scammer.tweet.created_at).valueOf(),
      },
    },
    victim: {
      user: {
        id_str: victim.user.id_str,
        screen_name: victim.user.screen_name,
        created_at: new Date(victim.user.created_at).valueOf(),
      },
      tweet: {
        id_str: victim.tweet.id_str,
        full_text: victim.tweet.full_text,
        created_at: new Date(victim.tweet.created_at).valueOf(),
      },
    },
    alert: {
      id_str: alert.id_str,
      created_at: alert.created_at,
    },
  };

  const alerts = JSON.parse(fs.readFileSync('data/alerts.json'));
  alerts.push(alertToSave);
  fs.writeFileSync('data/alerts.json', JSON.stringify(alerts));
}

function getAlertedIDs() {
  const alerts = JSON.parse(fs.readFileSync('data/alerts.json'));
  const alertedIDs = new Set();

  for (const alert of alerts) {
    alertedIDs.add(alert.scammer.tweet.id_str);
  }

  return alertedIDs;
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
