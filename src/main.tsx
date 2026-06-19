import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Safe logging wrapper to prevent circular JSON stringification errors (e.g., Capacitor/Vite logging bridges)
const safeLoggingWrapper = (originalConsoleFn: (...args: any[]) => void) => {
  return (...args: any[]) => {
    // Suppress third-party extension or MetaMask sandbox console noise
    const isExtensionNoise = args.some(arg => {
      const msgStr = String(arg?.message || arg || '');
      return /metamask/i.test(msgStr) || /ethereum/i.test(msgStr) || /chrome-extension/i.test(msgStr) || /wallet/i.test(msgStr);
    });
    if (isExtensionNoise) {
      return;
    }

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
    originalConsoleFn.apply(console, safeArgs);
  };
};

console.error = safeLoggingWrapper(console.error);
console.warn = safeLoggingWrapper(console.warn);
console.log = safeLoggingWrapper(console.log);

// Unconditionally unregister active Service Workers and clear caches to prevent stale cache intercepting API routes (e.g. /api/*)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('[Service Worker] Successfully unregistered stale service worker.');
    }
  }).catch((err) => {
    console.warn('[Service Worker] Error listing registrations:', err);
  });
}

if ('caches' in window) {
  caches.keys().then((keys) => {
    for (const key of keys) {
      caches.delete(key);
      console.log(`[Cache Storage] Deleted cache database: ${key}`);
    }
  }).catch((err) => {
    console.warn('[Cache Storage] Error clearing caches:', err);
  });
}

// Auto-reload on Chunk Load Error to prevent White Screen issues during updates
window.addEventListener('error', (e) => {
  const errMsg = String(e.message || e.error?.message || '');
  if (/metamask/i.test(errMsg) || /ethereum/i.test(errMsg) || /chrome-extension/i.test(errMsg) || /wallet/i.test(errMsg)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  const isChunkError = /Loading chunk/i.test(e.message) || 
                       /Loading CSS chunk/i.test(e.message) ||
                       /SyntaxError: Unexpected token '</i.test(e.message);
  if (isChunkError) {
    console.warn('[Chunk Reloader] Chunk loading issue detected. Performing a force refresh...');
    window.location.reload();
  }
}, true);

// Handle failed dynamic imports (which throws unhandled rejections)
window.addEventListener('unhandledrejection', (e) => {
  const reasonStr = String(e.reason || e.reason?.message || '');
  if (/metamask/i.test(reasonStr) || /ethereum/i.test(reasonStr) || /chrome-extension/i.test(reasonStr) || /wallet/i.test(reasonStr)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  const isChunkError = /Failed to fetch dynamically imported module/i.test(reasonStr) ||
                       /Loading chunk/i.test(reasonStr) ||
                       /Loading CSS chunk/i.test(reasonStr);
  if (isChunkError) {
    console.warn('[Chunk Reloader] Unhandled chunk loading issue detected. Performing a force refresh...');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
