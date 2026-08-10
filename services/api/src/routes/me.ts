import { Router } from 'express';
import {
  getMembershipForUser,
  normalizeEmail,
  type AuthedRequest,
} from '../auth.js';
import { getAdmin } from '../firebaseAdmin.js';

export const meRouter = Router();

meRouter.get('/', async (req: AuthedRequest, res) => {
  const user = req.user!;
  const email = user.email ? normalizeEmail(user.email) : '';

  const allTeams = await getAdmin().firestore().collection('teams').get();
  const teams: Array<{ team: Record<string, unknown>; membership: unknown }> =
    [];

  for (const doc of allTeams.docs) {
    const membership = await getMembershipForUser(doc.id, user.uid, email);
    if (user.systemAdmin || membership) {
      teams.push({ team: doc.data() as Record<string, unknown>, membership });
    }
  }

  res.json({
    user: user.appUser,
    teams,
  });
});
