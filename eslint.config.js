// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores([
    'dist/*',
    'coverage/*',
    'build/*',
    'ios/*',
    'android/*',
    '.expo/*',
    'expo-env.d.ts',
    'docs/*',
    'scripts/*',
    '.maestro/*',
    '.claude/*',
  ]),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
