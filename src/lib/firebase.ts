import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Encryption Utility
const ENCRYPTION_KEY = 'eclipse-secure-v1-' + firebaseConfig.projectId;

export const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

export const decryptData = (ciphertext: string): string => {
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    // Only return decrypted if successfully parsed as UTF-8
    if (decrypted && decrypted.length > 0) return decrypted;
    
    // If decryption succeeds but result is empty, it might be due to a wrong key or partial data
    if (ciphertext && ciphertext.length > 5) {
      console.warn("Decryption yielded empty string - possible key mismatch or corrupted data.");
    }
  } catch (e) {
    // Fail silently and return original ciphertext
    console.error("Decryption Error:", e);
  }
  
  return ciphertext;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

/**
 * Safely stringify objects that might contain circular references.
 * Specialized for Firebase objects which often have internal circularity.
 */
function safeStringify(obj: any): string {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular]';
      }
      cache.add(value);
      
      // Specifically handle common Firebase objects to prevent recursion issues
      // as some internal properties might still be problematic for the cache set
      if (value.constructor?.name === 'FirebaseAppImpl' || 
          value.constructor?.name === 'UserImpl' || 
          value.constructor?.name === 'AuthImpl') {
        return `[Firebase ${value.constructor.name}]`;
      }
    }
    return value;
  });
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Suppress verbose logging for common transient errors especially when app is backgrounded
  const isTransient = errorMessage.includes('offline') || 
                      errorMessage.includes('network-request-failed') || 
                      errorMessage.includes('stream-error');

  if (isTransient) {
    console.warn(`Firestore Transient Error (${operationType}):`, errorMessage);
    throw new Error(JSON.stringify({ error: errorMessage, transient: true }));
  }

  // Custom check for domain authorization error which is common for new domains
  if (errorMessage.includes('auth/unauthorized-domain')) {
    console.warn("Domain Authorization Warning: This domain needs to be added to your Firebase 'Authorized Domains' settings.");
  }

  // Construct a safe, flat object for logging. Use getters defensively.
  const authInfoSafe = {
    uid: auth.currentUser ? String(auth.currentUser.uid) : null,
    email: auth.currentUser ? String(auth.currentUser.email || '') : null,
    emailVerified: auth.currentUser ? !!auth.currentUser.emailVerified : false,
    providerData: auth.currentUser?.providerData?.map(p => ({
      providerId: p.providerId,
      email: p.email
    })) || []
  };

  const errInfo = {
    error: errorMessage,
    operationType,
    path,
    authInfo: authInfoSafe,
    timestamp: new Date().toISOString()
  };

  let serializedErrorInfo = '';
  try {
    // Use the safe stringifier instead of standard JSON.stringify
    serializedErrorInfo = safeStringify(errInfo);
  } catch (e) {
    // Ultimate fallback for any stringification failure
    serializedErrorInfo = JSON.stringify({ 
      error: errorMessage, 
      path, 
      operation: operationType,
      serializationFailed: true 
    });
  }

  console.error('Firestore Error:', serializedErrorInfo);
  throw new Error(serializedErrorInfo);
}

/**
 * Validates connection to Firestore. 
 * Required by Firebase integration security guidelines.
 */
async function testConnection() {
  try {
    // Attempt a lightweight server-side read to verify connectivity and project ID
    await getDocFromServer(doc(db, 'system', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase Connectivity Error: The client is offline or the configuration is invalid.");
    }
  }
}

// Perform connection test on boot
testConnection();

export interface ConnectivityState {
  isChecking: boolean;
  isAuthorized: boolean;
  error: string | null;
}

/**
 * Hook to monitor Firebase connectivity and domain authorization status.
 */
export function useConnectivity() {
  const [state, setState] = useState<ConnectivityState>({
    isChecking: true,
    isAuthorized: true,
    error: null
  });

  useEffect(() => {
    async function check() {
      try {
        await getDocFromServer(doc(db, 'system', 'connection_test'));
        setState({ isChecking: false, isAuthorized: true, error: null });
      } catch (error: any) {
        if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
          // Permission denied is fine (doc might not exist for read), means domain is authorized
          setState({ isChecking: false, isAuthorized: true, error: null });
        } else if (error.message?.includes('unauthorized-domain') || error.code === 'auth/unauthorized-domain') {
          setState({ isChecking: false, isAuthorized: false, error: "Domain not authorized in Firebase Console." });
        } else {
          setState(prev => ({ ...prev, isChecking: false }));
        }
      }
    }
    check();
  }, []);

  return state;
}
