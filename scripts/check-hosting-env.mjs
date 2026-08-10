#!/usr/bin/env node
/**
 * Fail Firebase Hosting builds when required Vite public env is missing.
 * Prevents shipping a blank/"Auth not configured" production site.
 */
const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

const missing = required.filter((k) => !String(process.env[k] || '').trim());
if (missing.length) {
  console.error(
    `[sop-pt] Missing required env for Hosting build:\n  - ${missing.join('\n  - ')}\n` +
      'Set GitHub Actions secrets (or .env.firebase for local deploy:hosting).',
  );
  process.exit(1);
}

console.info('[sop-pt] Hosting env OK (Firebase web config present).');
