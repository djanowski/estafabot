import { appClient } from './clients.js';
import uniqueBy from './uniqueBy.js';
import connect from './db.js';
import Brand from './brand.js';

async function main() {
  await connect();

  const name = process.argv[2];
  const accountName = process.argv[3];
  const hasAccount = accountName !== 'no';

  const account = hasAccount
    ? await findAccount({ name, accountName: hasAccount && accountName })
    : null;

  await Brand.create({
    name,
    hasAccount,
    id: account?.id_str,
    username: account?.screen_name,
  });

  console.log(`Added ${name} (${account?.screen_name})`);
}

async function findAccount({ name, accountName }) {
  if (accountName) return await appClient.v1.user({ screen_name: accountName });

  const users = await findUsers(name);
  const verifiedUser = users.find(user => user.verified);
  return verifiedUser;
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

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
