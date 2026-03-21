// knip.config.js — Dead code detection
// Docs: https://knip.dev/overview/configuration
module.exports = {
  entry: ['src/index.{ts,tsx,js,jsx}'],
  project: ['src/**/*.{ts,tsx,js,jsx}'],
  ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**'],
  ignoreDependencies: [],
  ignoreBinaries: [],
}
