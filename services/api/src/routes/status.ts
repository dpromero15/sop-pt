import { Router } from 'express';
import { getAdmin, isAdminReady } from '../firebaseAdmin.js';

export const statusRouter = Router();

statusRouter.get('/', async (_req, res) => {
  let firestoreReachable = false;
  try {
    if (isAdminReady()) {
      await getAdmin().firestore().collection('_health').limit(1).get();
      firestoreReachable = true;
    }
  } catch {
    firestoreReachable = false;
  }

  res.json({
    ok: true,
    firestoreReachable,
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      null,
  });
});
