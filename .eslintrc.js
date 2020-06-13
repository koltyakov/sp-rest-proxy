/**
 * @type {import('eslint').Linter.Config}
 */
const config = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  rules: {
    quotes: [2, 'single', 'avoid-escape'],
    indent: ['error', 2],
    'arrow-parens': ['error', 'always']
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};

module.exports = config;
