import { useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { AuthContext } from './authContext.js';
import {
  getHeadcountFirestore,
  isFirebaseConfigured,
} from '../firebase/headcountClient';
import type { User } from '../types/models';

export interface HudyatSessionState {
  authUser: User | null;
  authLoading: boolean;
  logout: (() => Promise<void>) | null;
  activeDrillId: string | null;
  firebaseReady: boolean;
}

/**
 * Safely reads Dev 1's `AuthContext` (without throwing if rendered standalone) and
 * subscribes to `campuses/{campusId}.activeDrillId` when authenticated.
 */
export function useHudyatSession(enabled = true): HudyatSessionState {
  const authCtx = useContext(AuthContext);
  const authUser = (authCtx?.user as User | null | undefined) ?? null;
  const authLoading = Boolean(authCtx?.loading);
  const logout = authCtx?.logout ?? null;
  const firebaseReady = isFirebaseConfigured();

  const [activeDrillId, setActiveDrillId] = useState<string | null>(null);

  const campusId = authUser?.campusId?.trim() ?? '';

  useEffect(() => {
    if (!enabled || !firebaseReady || !campusId) {
      return;
    }

    const db = getHeadcountFirestore();
    if (!db) return;

    const unsub = onSnapshot(
      doc(db, 'campuses', campusId),
      (snap) => {
        if (!snap.exists()) {
          setActiveDrillId(null);
          return;
        }
        const data = snap.data() as { activeDrillId?: unknown } | undefined;
        const id =
          typeof data?.activeDrillId === 'string' &&
          data.activeDrillId.trim().length > 0
            ? data.activeDrillId.trim()
            : null;
        setActiveDrillId(id);
      },
      () => {
        // Ignore transient permission/offline read errors and retain fallback behavior
      },
    );

    return () => unsub();
  }, [enabled, firebaseReady, campusId]);

  return {
    authUser,
    authLoading,
    logout,
    activeDrillId: campusId ? activeDrillId : null,
    firebaseReady,
  };
}
