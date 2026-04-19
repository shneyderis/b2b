import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, clearAuth, getRole, getToken, setAuth } from './api';
import type { Role } from './types';

interface AuthContextValue {
  token: string | null;
  role: Role | null;
  tgAuthStatus: 'idle' | 'pending' | 'error' | 'not_approved';
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getTelegramInitData(): string | null {
  const raw = window.Telegram?.WebApp?.initData;
  return raw && raw.length > 0 ? raw : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [role, setRole] = useState<Role | null>(() => getRole() as Role | null);
  const [tgAuthStatus, setTgAuthStatus] =
    useState<AuthContextValue['tgAuthStatus']>('idle');
  const tgAttemptedRef = useRef(false);

  useEffect(() => {
    function onStorage() {
      setToken(getToken());
      setRole(getRole() as Role | null);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    try {
      webApp.ready();
      webApp.expand?.();
    } catch {
      // ignore — older SDKs may not have these
    }

    const initData = getTelegramInitData();
    if (!initData || token || tgAttemptedRef.current) return;
    tgAttemptedRef.current = true;
    setTgAuthStatus('pending');
    (async () => {
      try {
        const res = await api<{ token: string; role: Role }>('/auth/telegram', {
          body: { initData },
        });
        setAuth(res.token, res.role);
        setToken(res.token);
        setRole(res.role);
        setTgAuthStatus('idle');
      } catch (err) {
        if (err instanceof ApiError && err.status === 403 && err.data?.error === 'partner_not_approved') {
          setTgAuthStatus('not_approved');
        } else {
          setTgAuthStatus('error');
        }
      }
    })();
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    role,
    tgAuthStatus,
    async login(email, password) {
      const res = await api<{ token: string; role: Role }>('/auth/login', {
        body: { email, password },
      });
      setAuth(res.token, res.role);
      setToken(res.token);
      setRole(res.role);
    },
    logout() {
      clearAuth();
      setToken(null);
      setRole(null);
    },
  }), [token, role, tgAuthStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}
