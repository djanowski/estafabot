#!/usr/bin/env node

const { analyzeAllBrands } = require('../index');
const fs = require('fs');

analyzeAllBrands()
  .then(results => {
    fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
