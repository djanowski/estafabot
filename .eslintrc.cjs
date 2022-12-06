module.exports = {
  root: true,
  extends: ['airbnb', 'prettier', 'plugin:node/recommended'],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    'no-underscore-dangle': 'off',
    'no-use-before-define': ['error', { functions: false }],
    'no-restricted-syntax': 0,
    'no-await-in-loop': 0,
    'no-console': 0,
    'no-return-await': 0,
    'no-process-exit': 0,
    'import/extensions': ['error', 'ignorePackages'],
  },
};
