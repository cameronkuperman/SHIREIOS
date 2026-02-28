const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = defineConfig([
  ...expoConfig,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'metro.config.js', 'tailwind.config.js'],
  },
]);
