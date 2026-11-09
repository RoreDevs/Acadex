import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from './LoadingScreen';
import { Button } from '@/components/ui/button';
import type { Role } from '@/types';

interface RouteGuardProps {
  children: React.ReactNode;
  roles?: Role[];
}

// Shown when a signed-in user's profile could not be loaded. Without it the
// guards below bounce between /login and a permanent loading screen.
function ProfileRecovery() {
  const { profileError, retryProfile, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await retryProfile();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md text-center rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-card p-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">We could not load your account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {profileError || 'Your profile is temporarily unavailable.'} You can retry, or sign out and sign in again.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button className="flex-1" onClick={retry} disabled={retrying}>
            {retrying ? 'Retrying...' : 'Try again'}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => { void signOut(); }}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RouteGuard({ children, roles }: RouteGuardProps) {
  const { user, profile, loading, profileError } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profileError) {
    return <ProfileRecovery />;
  }

  if (roles && !profile) {
    return <Navigate to="/login" replace />;
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
  const { user, profile, loading, profileError } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user && !profile && profileError) {
    return <ProfileRecovery />;
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
