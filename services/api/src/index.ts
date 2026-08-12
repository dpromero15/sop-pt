import express from 'express';
import cors from 'cors';
import { initFirebaseAdmin } from './firebaseAdmin.js';
import { requireAuth, requireSystemAdmin } from './auth.js';
import { statusRouter } from './routes/status.js';
import { teamsRouter } from './routes/teams.js';
import { meRouter } from './routes/me.js';

const port = Number(process.env.PORT || 8080);
const corsOrigin = process.env.CORS_ORIGIN || '*';

initFirebaseAdmin();

const app = express();
// SPA is on Firebase Hosting; API is on API Gateway (cross-origin).
app.use(
  cors({
    origin:
      corsOrigin === '*'
        ? true
        : corsOrigin.split(',').map((s) => s.trim()).filter(Boolean),
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sop-pt-api', version: '2.9.0' });
});

app.use('/v1/me', requireAuth, meRouter);
app.use('/v1/status', requireSystemAdmin, statusRouter);
app.use('/v1/teams', requireAuth, teamsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal error';
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`sop-pt-api listening on :${port}`);
});
