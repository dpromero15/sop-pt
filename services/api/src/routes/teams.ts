import { Router } from 'express';
import { getAdmin } from '../firebaseAdmin.js';

export const teamsRouter = Router();

function teamRef(teamId: string) {
  return getAdmin().firestore().collection('teams').doc(teamId);
}

teamsRouter.get('/:teamId', async (req, res) => {
  const snap = await teamRef(req.params.teamId).get();
  if (!snap.exists) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }
  res.json(snap.data());
});

teamsRouter.put('/:teamId', async (req, res) => {
  const teamId = req.params.teamId;
  const body = { ...req.body, id: teamId, updatedAt: new Date().toISOString() };
  await teamRef(teamId).set(body, { merge: true });
  res.json(body);
});

async function listCollection(teamId: string, name: string) {
  const snap = await teamRef(teamId).collection(name).get();
  return snap.docs.map((d) => d.data());
}

async function replaceCollection(teamId: string, name: string, items: Array<{ id: string }>) {
  const col = teamRef(teamId).collection(name);
  const existing = await col.get();
  const batch = getAdmin().firestore().batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  items.forEach((item) => {
    batch.set(col.doc(item.id), item);
  });
  await batch.commit();
}

for (const name of ['players', 'sessions', 'entries'] as const) {
  teamsRouter.get(`/:teamId/${name}`, async (req, res) => {
    res.json({ items: await listCollection(req.params.teamId, name) });
  });

  teamsRouter.put(`/:teamId/${name}`, async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    await replaceCollection(req.params.teamId, name, items);
    res.json({ ok: true, count: items.length });
  });
}

for (const name of ['metrics', 'labels', 'formula'] as const) {
  teamsRouter.get(`/:teamId/config/${name}`, async (req, res) => {
    const snap = await teamRef(req.params.teamId).collection('config').doc(name).get();
    res.json({ data: snap.exists ? snap.data()?.data ?? snap.data() : null });
  });

  teamsRouter.put(`/:teamId/config/${name}`, async (req, res) => {
    const data = req.body?.data ?? req.body;
    await teamRef(req.params.teamId).collection('config').doc(name).set({ data });
    res.json({ ok: true });
  });
}

teamsRouter.get('/:teamId/snapshot', async (req, res) => {
  const teamId = req.params.teamId;
  const teamSnap = await teamRef(teamId).get();
  if (!teamSnap.exists) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  const [players, sessions, entries] = await Promise.all([
    listCollection(teamId, 'players'),
    listCollection(teamId, 'sessions'),
    listCollection(teamId, 'entries'),
  ]);

  const metrics = (await teamRef(teamId).collection('config').doc('metrics').get()).data()?.data;
  const labels = (await teamRef(teamId).collection('config').doc('labels').get()).data()?.data;
  const formula = (await teamRef(teamId).collection('config').doc('formula').get()).data()?.data;

  res.json({
    team: teamSnap.data(),
    players,
    sessions,
    entries,
    metrics: metrics ?? [],
    labels: labels ?? [],
    formula: formula ?? null,
  });
});

teamsRouter.post('/:teamId/bootstrap', async (req, res) => {
  const teamId = req.params.teamId;
  const { team, players, sessions, entries, metrics, labels, formula } = req.body ?? {};

  if (!team || !Array.isArray(players) || !Array.isArray(sessions) || !Array.isArray(entries)) {
    res.status(400).json({ error: 'Invalid snapshot payload' });
    return;
  }

  await teamRef(teamId).set({ ...team, id: teamId, updatedAt: new Date().toISOString() }, { merge: true });
  await replaceCollection(teamId, 'players', players);
  await replaceCollection(teamId, 'sessions', sessions);
  await replaceCollection(teamId, 'entries', entries);
  await teamRef(teamId).collection('config').doc('metrics').set({ data: metrics ?? [] });
  await teamRef(teamId).collection('config').doc('labels').set({ data: labels ?? [] });
  await teamRef(teamId).collection('config').doc('formula').set({ data: formula ?? null });

  res.json({ ok: true, teamId });
});
