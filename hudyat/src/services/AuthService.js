import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config.js';
import { ROLES } from '../types/models.js';

/**
 * Default landing routes for each user role.
 * @readonly
 */
export const ROLE_HOME_PATHS = Object.freeze({
  [ROLES.STUDENT]: '/student',
  [ROLES.TEACHER]: '/teacher',
  [ROLES.COORDINATOR]: '/coordinator',
  [ROLES.ADMIN]: '/admin',
});

/**
 * Returns the configured allowed campus email domain (defaults to `cit.edu`).
 * @returns {string}
 */
export function getAllowedEmailDomain() {
  return (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'cit.edu')
    .trim()
    .toLowerCase();
}

/**
 * Returns the home route path for a given user role, or `/login` if unknown.
 * @param {import('../types/models.js').Role | string | undefined} role
 * @returns {string}
 */
export function getRoleHomePath(role) {
  return (role && ROLE_HOME_PATHS[role]) || '/login';
}

/**
 * Normalizes and validates that an email belongs to the allowed campus domain.
 * @param {string} email
 * @returns {string}
 */
function validateCampusEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const domain = getAllowedEmailDomain();
  const suffix = `@${domain}`;

  if (
    !normalized ||
    /\s/.test(normalized) ||
    !normalized.endsWith(suffix) ||
    normalized.indexOf('@') <= 0 ||
    normalized.indexOf('@') !== normalized.lastIndexOf('@')
  ) {
    throw new Error(`Please use your campus email ending in @${domain}.`);
  }

  return normalized;
}

/**
 * Translates Firebase Auth errors into clear user-facing messages.
 * @param {unknown} error
 * @param {string} fallbackMessage
 * @returns {Error}
 */
function mapAuthError(error, fallbackMessage) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('Invalid email or password. Please try again.');
    case 'auth/invalid-email':
      return new Error('Please enter a valid campus email address.');
    case 'auth/user-disabled':
      return new Error('Account inactive. Contact your administrator.');
    case 'auth/too-many-requests':
      return new Error(
        'Too many attempts. Please wait a moment and try again.',
      );
    case 'auth/network-request-failed':
      return new Error(
        'Network error. Check your connection and try again.',
      );
    default:
      if (error instanceof Error && error.message) {
        return error;
      }
      return new Error(fallbackMessage);
  }
}

/**
 * Fetches `users/{uid}` from Firestore and verifies the account is active.
 * @param {string} uid
 * @returns {Promise<import('../types/models.js').User | null>}
 */
async function fetchActiveUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  if (data.active !== true) {
    return null;
  }

  return /** @type {import('../types/models.js').User} */ ({
    uid,
    ...data,
  });
}

/**
 * Validates the campus email domain, signs in with Firebase Auth, and loads
 * the active `users/{uid}` Firestore profile.
 *
 * If the Firestore profile is missing or `active !== true`, signs out
 * immediately and throws `"Account inactive. Contact your administrator."`.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('../types/models.js').User>}
 */
export async function login(email, password) {
  const normalizedEmail = validateCampusEmail(email);

  if (!password) {
    throw new Error('Please enter your password.');
  }

  let credential;
  try {
    credential = await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );
  } catch (error) {
    throw mapAuthError(error, 'Unable to sign in. Please try again.');
  }

  let userProfile;
  try {
    userProfile = await fetchActiveUserProfile(credential.user.uid);
  } catch {
    await signOut(auth).catch(() => {});
    throw new Error('Account inactive. Contact your administrator.');
  }

  if (!userProfile) {
    await signOut(auth).catch(() => {});
    throw new Error('Account inactive. Contact your administrator.');
  }

  return userProfile;
}

/**
 * Signs out the current Firebase Auth session.
 * @returns {Promise<void>}
 */
export async function logout() {
  await signOut(auth);
}

/**
 * Sends a Firebase password reset email to a validated campus address.
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function resetPassword(email) {
  const normalizedEmail = validateCampusEmail(email);

  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error) {
    throw mapAuthError(
      error,
      'Unable to send password reset email. Please try again.',
    );
  }
}

/**
 * Subscribes to Firebase Auth state changes and resolves each signed-in user's
 * active `users/{uid}` Firestore profile (or `null` when signed out/inactive).
 *
 * @param {(user: import('../types/models.js').User | null) => void} callback
 * @returns {import('firebase/auth').Unsubscribe}
 */
export function subscribeAuthState(callback) {
  let activeRequestId = 0;

  return onAuthStateChanged(auth, async (firebaseUser) => {
    const requestId = ++activeRequestId;

    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      const userProfile = await fetchActiveUserProfile(firebaseUser.uid);

      if (requestId !== activeRequestId) {
        return;
      }

      if (!userProfile) {
        await signOut(auth).catch(() => {});
        callback(null);
        return;
      }

      callback(userProfile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      if (requestId === activeRequestId) {
        callback(null);
      }
    }
  });
}
