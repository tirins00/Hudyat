import { app, auth, db } from './config.js';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

/**
 * Returns true when required Firebase environment variables are configured.
 */
export function isFirebaseConfigured() {
  const key = apiKey?.trim() ?? '';
  const proj = projectId?.trim() ?? '';
  return (
    key.length > 0 &&
    proj.length > 0 &&
    !key.startsWith('your-') &&
    !proj.startsWith('your-')
  );
}

/**
 * Returns the shared authenticated Cloud Firestore instance from `src/firebase/config.js`,
 * or null if Firebase environment variables are not configured yet.
 */
export function getHeadcountFirestore() {
  if (!isFirebaseConfigured()) {
    return null;
  }
  return db;
}

export { app, auth, db };
