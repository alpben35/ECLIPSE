import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../lib/contexts';
import { OWNER_EMAIL } from '../constants';

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useContext(AuthContext);
  const location = useLocation();
  
  if (!user) {
    if (location.pathname.startsWith('/teacher')) {
      return <Navigate to="/teacher/auth" />;
    }
    return <Navigate to="/auth" />;
  }
  
  if (loading) return <p role="status" className="p-8 text-center">Checking account access…</p>;
  if (adminOnly && !isAdmin) return <Navigate to={location.pathname.startsWith('/teacher') ? '/teacher/tutor' : '/tutor'} />;
  return <>{children}</>;
}
