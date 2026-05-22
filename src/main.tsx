import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Safe logging wrapper to prevent circular JSON stringification errors (e.g., Capacitor/Vite logging bridges)
const safeLoggingWrapper = (originalConsoleFn: (...args: any[]) => void) => {
  return (...args: any[]) => {
    const safeArgs = args.map(arg => {
      if (arg instanceof Error) {
        return {
          name: arg.name || 'Error',
          message: arg.message || String(arg),
          stack: arg.stack
        };
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          JSON.stringify(arg);
          return arg;
        } catch (err) {
          const seen = new WeakSet();
          const cleanObj = (val: any): any => {
            if (val === null || typeof val !== 'object') return val;
            if (seen.has(val)) return '[Circular]';
            seen.add(val);
            
            // Handle common Firebase objects to prevent recursion issues
            if (val.uid && val.auth) return '[Firebase User]';
            if (val.currentUser && val.config) return '[Firebase Auth]';
            if (val.app && val.type === 'firestore') return '[Firestore Instance]';
            
            // Safely guard against minified or internal constructor chains (e.g. Y2, Ka, etc.)
            if (val.constructor && (val.constructor.name === 'Y2' || val.constructor.name === 'Ka' || val.path || val.firestore)) {
              return `[Firestore Object: ${val.constructor.name || 'Unknown'}]`;
            }

            if (Array.isArray(val)) {
              return val.map(cleanObj);
            }

            const copy: any = {};
            for (const key in val) {
              if (Object.prototype.hasOwnProperty.call(val, key)) {
                try {
                  copy[key] = cleanObj(val[key]);
                } catch {
                  copy[key] = '[Strict Access Property]';
                }
              }
            }
            return copy;
          };
          return cleanObj(arg);
        }
      }
      return arg;
    });
    originalConsoleFn(...safeArgs);
  };
};

console.error = safeLoggingWrapper(console.error);
console.warn = safeLoggingWrapper(console.warn);
console.log = safeLoggingWrapper(console.log);

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
