import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, clearAuth, getRole, getToken, setAuth } from './api';
import type { Role } from './types';

export type TgAuthStatus = 'idle' | 'pending' | 'not_linked' | 'not_approved' | 'error';

interface AuthContextValue {
  token: string | null;
  role: Role | null;
  tgAuthStatus: TgAuthStatus;
  isTelegram: boolean;
  login: (email: string, password: string) => Promise<void>;
  onboardTelegram: (companyName: string, phone: string) => Promise<void>;
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
  const [tgAuthStatus, setTgAuthStatus] = useState<TgAuthStatus>('idle');
  const tgAttemptedRef = useRef(false);
  const isTelegram = !!window.Telegram?.WebApp?.initData;

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
      // older SDK versions don't expose all methods
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
        if (err instanceof ApiError) {
          if (err.status === 404 && err.data?.error === 'not_linked') {
            setTgAuthStatus('not_linked');
            return;
          }
          if (err.status === 403 && err.data?.error === 'partner_not_approved') {
            setTgAuthStatus('not_approved');
            return;
          }
        }
        setTgAuthStatus('error');
      }
    })();
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    role,
    tgAuthStatus,
    isTelegram,
    async login(email, password) {
      const res = await api<{ token: string; role: Role }>('/auth/login', {
        body: { email, password },
      });
      setAuth(res.token, res.role);
      setToken(res.token);
      setRole(res.role);
    },
    async onboardTelegram(companyName, phone) {
      const initData = getTelegramInitData();
      if (!initData) throw new ApiError(400, 'not_in_telegram');
      setTgAuthStatus('pending');
      try {
        const res = await api<{ token: string; role: Role }>('/auth/telegram/onboard', {
          body: { initData, company_name: companyName, phone },
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
        throw err;
      }
    },
    logout() {
      clearAuth();
      setToken(null);
      setRole(null);
    },
  }), [token, role, tgAuthStatus, isTelegram]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}
