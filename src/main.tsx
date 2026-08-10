import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initFirebase } from './services/firebase';
import { AccessProvider } from './access/AccessProvider';
import { runLocalMigrations } from './services/migrations';

// Adapt existing local data before any React state hydrates from StorageService.
try {
  const report = runLocalMigrations();
  if (report.error) {
    console.error('[sop-pt] data migration failed', report);
  } else if (report.applied.length > 0) {
    console.info('[sop-pt] data migrations applied', report);
  }
} catch (err) {
  console.error('[sop-pt] data migration crashed', err);
}

initFirebase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccessProvider>
      <App />
    </AccessProvider>
  </StrictMode>,
);
