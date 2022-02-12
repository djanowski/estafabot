#!/usr/bin/env node

const { analyzeAllBrands } = require('./index');
const { postAlerts } = require('./index');
const fs = require('fs');

async function main() {
  const results = await analyzeAllBrands();
  fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
  await postAlerts(results);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
