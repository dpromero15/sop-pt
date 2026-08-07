import admin from 'firebase-admin';

let ready = false;

export function initFirebaseAdmin(): void {
  if (ready) return;

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT) {
    try {
      admin.initializeApp({
        projectId:
          process.env.GOOGLE_CLOUD_PROJECT ||
          process.env.GCLOUD_PROJECT ||
          process.env.FIREBASE_PROJECT_ID,
      });
      ready = true;
      return;
    } catch (err) {
      console.warn('Firebase Admin init with ADC failed, trying credentials JSON', err);
    }
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const creds = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(creds),
      projectId: creds.project_id,
    });
    ready = true;
    return;
  }

  try {
    admin.initializeApp();
    ready = true;
  } catch {
    console.warn(
      'Firebase Admin not fully configured. /health works; authenticated routes need credentials.',
    );
  }
}

export function getAdmin() {
  return admin;
}

export function isAdminReady() {
  return ready;
}
