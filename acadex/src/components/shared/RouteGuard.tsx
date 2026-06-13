import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from './LoadingScreen';
import type { Role } from '@/types';

interface RouteGuardProps {
  children: React.ReactNode;
  roles?: Role[];
}

export function RouteGuard({ children, roles }: RouteGuardProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !profile) {
    return <LoadingScreen />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    if (profile.role === 'super_admin') {
      return <Navigate to="/super-admin" replace />;
    }
    if (profile.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  if (profile?.role === 'super_admin' && !window.location.pathname.startsWith('/super-admin')) {
    return <Navigate to="/super-admin" replace />;
  }

  return <>{children}</>;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user && !profile) {
    return <LoadingScreen />;
  }

  if (user) {
    if (profile?.role === 'super_admin') {
      return <Navigate to="/super-admin" replace />;
    }
    if (profile?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
