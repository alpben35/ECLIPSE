import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Unregister and destroy any active Service Workers to prevent stale cache intercepting API routes (e.g. /api/*)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    let hasCleared = false;
    if (registrations.length > 0) {
      for (const registration of registrations) {
        registration.unregister();
        hasCleared = true;
      }
    }
    // Also clear caches for absolute assurance
    if (hasCleared && 'caches' in window) {
      caches.keys().then((keys) => {
        Promise.all(keys.map(key => caches.delete(key))).then(() => {
          console.log('[Service Worker] Cleared registrations and caches. Performing force reload...');
          window.location.reload();
        });
      });
    }
  }).catch((err) => {
    console.warn('[Service Worker] Error clearing service workers:', err);
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
