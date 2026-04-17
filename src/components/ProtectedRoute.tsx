import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../lib/contexts';
import { OWNER_EMAIL } from '../constants';

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile } = useContext(AuthContext);
  const location = useLocation();
  
  if (!user) {
    if (location.pathname.startsWith('/teacher')) {
      return <Navigate to="/teacher/auth" />;
    }
    return <Navigate to="/auth" />;
  }
  
  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
  const isTempOwner = profile?.rank === 'Temporary Owner';
  
  if (adminOnly && !isOwner && !isTempOwner) return <Navigate to="/tutor" />;
  return <>{children}</>;
}
