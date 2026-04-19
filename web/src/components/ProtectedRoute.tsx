import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import type { Role } from '../types';

export function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode;
  role?: Role;
}) {
  const { token, role: currentRole, isTelegram, tgAuthStatus } = useAuth();
  const location = useLocation();

  if (!token) {
    if (isTelegram && tgAuthStatus === 'pending') {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 text-sm text-neutral-600">
          Вхід через Telegram…
        </div>
      );
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (role && currentRole !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}
