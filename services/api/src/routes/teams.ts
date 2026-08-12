import { Router } from 'express';
import {
  getMembershipForUser,
  membersCol,
  memberDocId,
  normalizeEmail,
  requireSystemAdmin,
  requireTeamRole,
  teamRef,
  type AuthedRequest,
  type TeamMembershipDoc,
  type TeamMembershipRole,
} from '../auth.js';
import { getAdmin } from '../firebaseAdmin.js';

export const teamsRouter = Router({ mergeParams: true });

function listCollection(teamId: string, name: string) {
  return teamRef(teamId)
    .collection(name)
    .get()
    .then((snap) => snap.docs.map((d) => d.data()));
}

async function replaceCollection(
  teamId: string,
  name: string,
  items: Array<{ id: string }>,
) {
  const col = teamRef(teamId).collection(name);
  const existing = await col.get();
  const batch = getAdmin().firestore().batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  items.forEach((item) => {
    batch.set(col.doc(item.id), item);
  });
  await batch.commit();
}

teamsRouter.get('/', async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (user.systemAdmin) {
    const snap = await getAdmin().firestore().collection('teams').get();
    res.json({ teams: snap.docs.map((d) => d.data()) });
    return;
  }

  const email = user.email ? normalizeEmail(user.email) : '';
  const allTeams = await getAdmin().firestore().collection('teams').get();
  const teams = [];
  for (const doc of allTeams.docs) {
    const membership = await getMembershipForUser(doc.id, user.uid, email);
    if (membership) teams.push(doc.data());
  }
  res.json({ teams });
});

teamsRouter.post('/', requireSystemAdmin, async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const id =
    typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : `team_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const team = {
    ...body,
    id,
    updatedAt: now,
    name: body.name || 'New Team',
    shortName: body.shortName || 'TEAM',
    season: body.season || String(new Date().getFullYear()),
    ageGroup: body.ageGroup || '',
    clubName: body.clubName || '',
    homeVenue: body.homeVenue || '',
    primaryColor: body.primaryColor || '#10b981',
    secondaryColor: body.secondaryColor || '#0f172a',
    timezone: body.timezone || 'America/Denver',
  };
  await teamRef(id).set(team, { merge: true });

  if (req.user?.email) {
    const email = normalizeEmail(req.user.email);
    const member: TeamMembershipDoc = {
      uid: req.user.uid,
      email,
      role: 'teamAdmin',
      createdAt: now,
      createdByUid: req.user.uid,
      coachDisplayName: req.user.displayName,
    };
    await membersCol(id).doc(memberDocId(email)).set(member);
  }

  res.status(201).json(team);
});

teamsRouter.get(
  '/:teamId/members',
  requireTeamRole('teamAdmin'),
  async (req, res) => {
    const snap = await membersCol(req.params.teamId).get();
    res.json({ members: snap.docs.map((d) => d.data()) });
  },
);

teamsRouter.put(
  '/:teamId/members/:email',
  requireTeamRole('teamAdmin'),
  async (req: AuthedRequest, res) => {
    const teamId = req.params.teamId;
    const email = normalizeEmail(req.params.email);
    const role = req.body?.role as TeamMembershipRole | undefined;
    if (!role || !['viewer', 'dataEntry', 'teamAdmin'].includes(role)) {
      res.status(400).json({ error: 'role must be viewer | dataEntry | teamAdmin' });
      return;
    }

    const existing = await membersCol(teamId).doc(memberDocId(email)).get();
    const now = new Date().toISOString();
    const member: TeamMembershipDoc = {
      email,
      role,
      coachDisplayName:
        typeof req.body?.coachDisplayName === 'string'
          ? req.body.coachDisplayName
          : existing.exists
            ? (existing.data() as TeamMembershipDoc).coachDisplayName
            : undefined,
      uid: existing.exists
        ? (existing.data() as TeamMembershipDoc).uid
        : undefined,
      createdAt: existing.exists
        ? ((existing.data() as TeamMembershipDoc).createdAt ?? now)
        : now,
      createdByUid: req.user!.uid,
    };
    await membersCol(teamId).doc(memberDocId(email)).set(member, { merge: true });
    res.json(member);
  },
);

teamsRouter.delete(
  '/:teamId/members/:email',
  requireTeamRole('teamAdmin'),
  async (req, res) => {
    const email = normalizeEmail(req.params.email);
    await membersCol(req.params.teamId).doc(memberDocId(email)).delete();
    res.json({ ok: true });
  },
);

teamsRouter.get('/:teamId', requireTeamRole('viewer'), async (req, res) => {
  const snap = await teamRef(req.params.teamId).get();
  if (!snap.exists) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }
  res.json(snap.data());
});

teamsRouter.put('/:teamId', requireTeamRole('teamAdmin'), async (req, res) => {
  const teamId = req.params.teamId;
  const body = { ...req.body, id: teamId, updatedAt: new Date().toISOString() };
  await teamRef(teamId).set(body, { merge: true });
  res.json(body);
});

for (const name of ['players', 'sessions', 'entries'] as const) {
  teamsRouter.get(
    `/:teamId/${name}`,
    requireTeamRole('viewer'),
    async (req, res) => {
      res.json({ items: await listCollection(req.params.teamId, name) });
    },
  );

  teamsRouter.put(
    `/:teamId/${name}`,
    requireTeamRole('dataEntry'),
    async (req, res) => {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      await replaceCollection(req.params.teamId, name, items);
      res.json({ ok: true, count: items.length });
    },
  );
}

const EXTRA_CONFIG = [
  'calculatedFields',
  'coaches',
  'coachBallots',
  'bumpTransactions',
  'bumpBudget',
  'complianceRequirements',
  'playerCompliance',
  'equipmentGroups',
  'equipmentItems',
  'rankingBoundaries',
] as const;

function registerConfigRoutes(
  name: string,
  writeRole: 'dataEntry' | 'teamAdmin',
) {
  teamsRouter.get(
    `/:teamId/config/${name}`,
    requireTeamRole('viewer'),
    async (req, res) => {
      const snap = await teamRef(req.params.teamId)
        .collection('config')
        .doc(name)
        .get();
      res.json({ data: snap.exists ? snap.data()?.data ?? snap.data() : null });
    },
  );

  teamsRouter.put(
    `/:teamId/config/${name}`,
    requireTeamRole(writeRole),
    async (req, res) => {
      const data = req.body?.data ?? req.body;
      await teamRef(req.params.teamId)
        .collection('config')
        .doc(name)
        .set({ data });
      res.json({ ok: true });
    },
  );
}

for (const name of ['metrics', 'labels', 'formula'] as const) {
  registerConfigRoutes(name, 'teamAdmin');
}
for (const name of EXTRA_CONFIG) {
  registerConfigRoutes(name, 'dataEntry');
}

teamsRouter.get(
  '/:teamId/snapshot',
  requireTeamRole('viewer'),
  async (req, res) => {
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

    const configDocs = await Promise.all(
      (
        [
          'metrics',
          'labels',
          'formula',
          ...EXTRA_CONFIG,
        ] as const
      ).map(async (name) => {
        const snap = await teamRef(teamId).collection('config').doc(name).get();
        return [name, snap.exists ? snap.data()?.data ?? snap.data() : null] as const;
      }),
    );
    const config = Object.fromEntries(configDocs);

    res.json({
      team: teamSnap.data(),
      players,
      sessions,
      entries,
      metrics: config.metrics ?? [],
      labels: config.labels ?? [],
      formula: config.formula ?? null,
      calculatedFields: config.calculatedFields ?? [],
      coaches: config.coaches ?? [],
      coachBallots: config.coachBallots ?? [],
      bumpTransactions: config.bumpTransactions ?? [],
      bumpBudget: config.bumpBudget ?? null,
      complianceRequirements: config.complianceRequirements ?? [],
      playerCompliance: config.playerCompliance ?? {},
      equipmentGroups: config.equipmentGroups ?? [],
      equipmentItems: config.equipmentItems ?? [],
      rankingBoundaries: config.rankingBoundaries ?? null,
    });
  },
);

teamsRouter.post(
  '/:teamId/bootstrap',
  requireTeamRole('teamAdmin'),
  async (req, res) => {
    const teamId = req.params.teamId;
    const body = req.body ?? {};
    const { team, players, sessions, entries, metrics, labels, formula } = body;

    if (
      !team ||
      !Array.isArray(players) ||
      !Array.isArray(sessions) ||
      !Array.isArray(entries)
    ) {
      res.status(400).json({ error: 'Invalid snapshot payload' });
      return;
    }

    await teamRef(teamId).set(
      { ...team, id: teamId, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    await replaceCollection(teamId, 'players', players);
    await replaceCollection(teamId, 'sessions', sessions);
    await replaceCollection(teamId, 'entries', entries);

    const configWrites: Array<[string, unknown]> = [
      ['metrics', metrics ?? []],
      ['labels', labels ?? []],
      ['formula', formula ?? null],
      ['calculatedFields', body.calculatedFields ?? []],
      ['coaches', body.coaches ?? []],
      ['coachBallots', body.coachBallots ?? []],
      ['bumpTransactions', body.bumpTransactions ?? body.adjustedBumps ?? []],
      ['bumpBudget', body.bumpBudget ?? null],
      ['complianceRequirements', body.complianceRequirements ?? []],
      ['playerCompliance', body.playerCompliance ?? {}],
      ['equipmentGroups', body.equipmentGroups ?? []],
      ['equipmentItems', body.equipmentItems ?? []],
      ['rankingBoundaries', body.rankingBoundaries ?? null],
    ];
    for (const [name, data] of configWrites) {
      await teamRef(teamId).collection('config').doc(name).set({ data });
    }

    res.json({ ok: true, teamId });
  },
);
