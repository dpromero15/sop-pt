import express from 'express';
import cors from 'cors';
import { initFirebaseAdmin } from './firebaseAdmin.js';
import { requireAdmin } from './auth.js';
import { statusRouter } from './routes/status.js';
import { teamsRouter } from './routes/teams.js';

const port = Number(process.env.PORT || 8080);
const corsOrigin = process.env.CORS_ORIGIN || '*';

initFirebaseAdmin();

const app = express();
app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',') }));
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sop-pt-api', version: '2.0.0' });
});

app.use('/v1/status', requireAdmin, statusRouter);
app.use('/v1/teams', requireAdmin, teamsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal error';
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`sop-pt-api listening on :${port}`);
});
