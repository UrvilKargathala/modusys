// Holds who is signed in. On start it restores the token from the Keychain and
// asks the server who it belongs to (a deactivated user or a password change
// elsewhere makes it invalid, which signs the phone out).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import type { User } from '../api/auth';
import { ApiError, setApiToken, setUnauthorizedHandler } from '../api/client';
import { clearToken, loadToken, saveToken } from './session';
import { stopPush } from '../lib/push';
import { saveLastEmail } from './lastEmail';
import { clearBiometricLogin } from './biometric';

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; notice?: string }
  | { status: 'signed-in'; user: User };

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOut: (notice?: string) => Promise<void>;
  /** After you edit your own profile: show the new name / email at once (the token stays valid). */
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const queryClient = useQueryClient();

  const signOut = useCallback(
    async (notice?: string) => {
      // Stop push to this phone. A plain sign-out (no notice) still has a valid session, so the server is told too;
      // when the session already ended (notice), only the phone's token is dropped.
      await stopPush(!notice);
      setApiToken(null);
      await clearToken().catch(() => undefined);
      queryClient.clear();
      setState({ status: 'signed-out', notice });
    },
    [queryClient],
  );

  // Any 401 from a normal call = the session ended on the server.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut('Your session ended. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Restore on app start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await loadToken().catch(() => null);
      if (!token) {
        if (!cancelled) setState({ status: 'signed-out' });
        return;
      }
      setApiToken(token);
      try {
        const { user } = await authApi.getSession();
        if (cancelled) return;
        if (user) setState({ status: 'signed-in', user });
        else await signOut('Your session ended. Please sign in again.');
      } catch (e) {
        if (cancelled) return;
        // Server rejected the token: clear it. No network: show Sign In with the
        // message but keep the token, so the next launch can try again.
        // 0 = no network, 408 = too slow: keep the token for the next try.
        if (e instanceof ApiError && e.status !== 0 && e.status !== 408) await signOut();
        else setState({ status: 'signed-out', notice: e instanceof Error ? e.message : undefined });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user, token } = await authApi.signIn(email.trim(), password);
    await saveToken(token);
    await saveLastEmail(email.trim());
    setApiToken(token);
    setState({ status: 'signed-in', user });
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const { user, token } = await authApi.changePassword(currentPassword, newPassword);
    await saveToken(token);
    // The saved Face ID / fingerprint sign-in holds the old password: drop it (the user can turn it on again).
    await clearBiometricLogin();
    setApiToken(token);
    setState({ status: 'signed-in', user });
  }, []);

  const setUser = useCallback((user: User) => setState((s) => (s.status === 'signed-in' ? { status: 'signed-in', user } : s)), []);

  const value = useMemo(() => ({ state, signIn, changePassword, signOut, setUser }), [state, signIn, changePassword, signOut, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in user; only call inside the signed-in part of the app. */
export function useUser(): User {
  const { state } = useAuth();
  if (state.status !== 'signed-in') throw new Error('useUser called while signed out');
  return state.user;
}
