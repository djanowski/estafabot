import { appClient } from './clients.js';
import Brand from './brand.js';
import Scammer from './scammer.js';
import connect from './db.js';

async function main() {
  await connect();

  const username = process.argv[2];
  const existing = await Scammer.exists({ username });

  if (existing) {
    console.log(`${username} already exists`);
    return;
  }

  const brand = await Brand.findByUsername(username);
  const { data: user } = await appClient.v2.userByUsername(username, {
    'user.fields': 'created_at',
  });
  await Scammer.create({
    id: user.id,
    username: user.username,
    createdAt: new Date(user.created_at),
    brand,
  });

  console.log(`Added ${user.username} for ${brand.name}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
