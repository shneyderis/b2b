import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clearAuth, getRole, getToken, setAuth } from './api';
import type { Role } from './types';

interface AuthContextValue {
  token: string | null;
  role: Role | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [role, setRole] = useState<Role | null>(() => getRole() as Role | null);

  useEffect(() => {
    function onStorage() {
      setToken(getToken());
      setRole(getRole() as Role | null);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    role,
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
  }), [token, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}
