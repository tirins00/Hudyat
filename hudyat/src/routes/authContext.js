import { createContext, useContext } from 'react';

/**
 * @typedef {Object} AuthContextValue
 * @property {import('../types/models.js').User | null} user
 * @property {boolean} loading
 * @property {(email: string, password: string) => Promise<import('../types/models.js').User>} login
 * @property {() => Promise<void>} logout
 * @property {(email: string) => Promise<void>} resetPassword
 */

/** @type {import('react').Context<AuthContextValue | null>} */
export const AuthContext = createContext(null);

/**
 * Accesses the current authentication state and actions from `AuthProvider`.
 * @returns {AuthContextValue}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
