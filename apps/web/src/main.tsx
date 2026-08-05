import '@fontsource-variable/inter';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startCrossTabSync } from './lib/crossTab';
import { initMonitoring } from './lib/monitoring';
import { restoreProgressFromMirror, startProgressMirror } from './lib/storage';

// fire-and-forget: monitoring must never delay or block boot
void initMonitoring();

// Restore the durable IndexedDB copy into localStorage (if needed) BEFORE the
// store module loads and hydrates from localStorage.
void restoreProgressFromMirror()
  .then(async () => {
    const [{ App }, { usePlanner }] = await Promise.all([import('./App'), import('./store')]);
    startProgressMirror((listener) => usePlanner.subscribe(listener));
    startCrossTabSync(() => void usePlanner.persist.rehydrate());
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    // a failed chunk load (stale index.html after a deploy, or connection
    // loss) would otherwise leave a permanently blank page; plain DOM because
    // React itself may be what failed to load
    console.error('boot failed:', error);
    const root = document.getElementById('root');
    if (!root) return;
    root.innerHTML = `
      <div role="alert" style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;text-align:center">
        <div>
          <h1 style="font-size:18px;margin:0 0 8px">The app failed to load</h1>
          <p style="margin:0 0 16px;opacity:.75">Your connection dropped, or a new version was just deployed. Your progress on this device is safe.</p>
          <button id="boot-retry" style="padding:8px 16px;cursor:pointer">Reload</button>
        </div>
      </div>`;
    document.getElementById('boot-retry')?.addEventListener('click', () => {
      window.location.reload();
    });
  });
