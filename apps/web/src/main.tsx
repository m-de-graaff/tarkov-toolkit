import '@fontsource-variable/inter';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startCrossTabSync } from './lib/crossTab';
import { restoreProgressFromMirror, startProgressMirror } from './lib/storage';

// Restore the durable IndexedDB copy into localStorage (if needed) BEFORE the
// store module loads and hydrates from localStorage.
void restoreProgressFromMirror().then(async () => {
  const [{ App }, { usePlanner }] = await Promise.all([import('./App'), import('./store')]);
  startProgressMirror((listener) => usePlanner.subscribe(listener));
  startCrossTabSync(() => void usePlanner.persist.rehydrate());
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
