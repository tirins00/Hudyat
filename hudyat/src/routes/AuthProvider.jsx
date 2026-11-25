import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext.js';
import {
  login as authLogin,
  logout as authLogout,
  resetPassword as authResetPassword,
  subscribeAuthState,
} from '../services/AuthService.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeAuthState((profile) => {
      setUser(profile);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const profile = await authLogin(email, password);
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    await authResetPassword(email);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      resetPassword,
    }),
    [user, loading, login, logout, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
