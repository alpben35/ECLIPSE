import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Unregister any active Service Workers to prevent stale cache intercepting API routes (e.g. /api/*)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('[Service Worker] Lingering service worker unregistered successfully.');
        }
      });
    }
  }).catch((err) => {
    console.warn('[Service Worker] Error unregistering service workers:', err);
  });
}

// Auto-reload on Chunk Load Error to prevent White Screen issues during updates
window.addEventListener('error', (e) => {
  const isChunkError = /Loading chunk/i.test(e.message) || 
                       /Loading CSS chunk/i.test(e.message) ||
                       /SyntaxError: Unexpected token '</i.test(e.message);
  if (isChunkError) {
    console.warn('[Chunk Reloader] Chunk loading issue detected. Performing a force refresh...');
    window.location.reload();
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
