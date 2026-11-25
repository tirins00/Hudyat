import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

let cachedDb: Firestore | null = null;

/**
 * Returns true when required Firebase environment variables are configured.
 */
export function isFirebaseConfigured(): boolean {
  const apiKey = firebaseConfig.apiKey?.trim() ?? '';
  const projectId = firebaseConfig.projectId?.trim() ?? '';
  return (
    apiKey.length > 0 &&
    projectId.length > 0 &&
    !apiKey.startsWith('your-') &&
    !projectId.startsWith('your-')
  );
}

/**
 * Lazily returns a Cloud Firestore instance with offline persistence enabled,
 * or null if Firebase environment variables are not configured yet.
 */
export function getHeadcountFirestore(): Firestore | null {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (cachedDb) {
    return cachedDb;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    cachedDb = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Firestore was already initialized on this FirebaseApp instance.
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}
