import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { pb, hasStoredIdentity, backendConfigured } from '@/lib/pb';
import { resetSyncCursors } from '@/lib/sync';
import { clearAllData } from '@/features/training/db/seedDemoWorkouts';

/**
 * Three modes:
 * - `authed`      : signed in — sync is active.
 * - `local`       : using the app without an account (no backend, or the user
 *                   chose "continue without account"). Everything works on
 *                   IndexedDB; nothing syncs.
 * - `needs-login` : a backend exists and the user hasn't signed in or opted out,
 *                   so the login screen is shown.
 */
export type AuthMode = 'authed' | 'local' | 'needs-login';

const LOCAL_ONLY_KEY = 'tracker.localOnly';

function computeMode(): AuthMode {
  if (hasStoredIdentity()) return 'authed';
  if (!backendConfigured()) return 'local';
  if (localStorage.getItem(LOCAL_ONLY_KEY) === 'true') return 'local';
  return 'needs-login';
}

interface AuthContextValue {
  mode: AuthMode;
  /** True when signed in (sync active). */
  isAuthed: boolean;
  /** Whether a backend is configured at all (drives whether login is offered). */
  hasBackend: boolean;
  /** Display name / username of the signed-in user, if any. */
  username: string | null;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  /** Continue using the app locally, without an account. */
  continueWithoutAccount: () => void;
  /** Leave local mode and show the login screen (to create/sign in to an account). */
  goToLogin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUsername(): string | null {
  const rec = pb.authStore.record;
  return (rec?.username as string) ?? (rec?.email as string) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>(computeMode());
  const [username, setUsername] = useState<string | null>(readUsername());

  useEffect(() => {
    // Keep React state in step with the SDK's auth store (login/logout/refresh).
    return pb.authStore.onChange(() => {
      setMode(computeMode());
      setUsername(readUsername());
    });
  }, []);

  async function loginWithPassword(user: string, password: string): Promise<void> {
    await pb.collection('users').authWithPassword(user, password);
    localStorage.removeItem(LOCAL_ONLY_KEY);
  }

  async function register(user: string, password: string): Promise<void> {
    await pb.collection('users').create({ username: user, password, passwordConfirm: password });
    await pb.collection('users').authWithPassword(user, password);
    localStorage.removeItem(LOCAL_ONLY_KEY);
  }

  async function loginWithGoogle(): Promise<void> {
    await pb.collection('users').authWithOAuth2({ provider: 'google' });
    localStorage.removeItem(LOCAL_ONLY_KEY);
  }

  function continueWithoutAccount(): void {
    localStorage.setItem(LOCAL_ONLY_KEY, 'true');
    setMode('local');
  }

  function goToLogin(): void {
    localStorage.removeItem(LOCAL_ONLY_KEY);
    setMode(computeMode());
  }

  async function logout(): Promise<void> {
    pb.authStore.clear();
    resetSyncCursors();
    localStorage.removeItem(LOCAL_ONLY_KEY);
    // Keep the local cache private after signing out (requirement G-04).
    await clearAllData();
    setMode(computeMode());
  }

  return (
    <AuthContext.Provider
      value={{
        mode,
        isAuthed: mode === 'authed',
        hasBackend: backendConfigured(),
        username,
        loginWithPassword,
        register,
        loginWithGoogle,
        continueWithoutAccount,
        goToLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
