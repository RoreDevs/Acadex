import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile, Role } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  recovering: boolean;
  clearRecovery: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: {
    email: string;
    password: string;
    full_name: string;
    index_number?: string;
    program?: string;
    level?: string;
  }) => Promise<{ error: string | null; data?: UserProfile }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const loading = authLoading || (user !== null && profileLoading);

  const clearRecovery = () => setRecovering(false);

  const fetchProfile = async (userId: string): Promise<boolean> => {
    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('fetchProfile error:', error.message);
      setProfile(null);
      setProfileLoading(false);
      return false;
    }
    if (data) {
      setProfile(data as UserProfile);
      setProfileLoading(false);
      return true;
    }
    setProfile(null);
    setProfileLoading(false);
    return false;
  };

  const recoverSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const ok = await fetchProfile(session.user.id);
      if (!ok) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
      }
    } else {
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const isRecovery = window.location.hash.includes('type=recovery');

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        if (isRecovery) setRecovering(true);
        setUser(session.user);
        const ok = await fetchProfile(session.user.id);
        if (!ok) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
        }
      } else {
        setProfileLoading(false);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const ok = await fetchProfile(session.user.id);
        if (!ok && event !== 'SIGNED_IN') {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
      } else {
        await recoverSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && authData.user) {
      setUser(authData.user);
      await fetchProfile(authData.user.id);
    }
    return { error: error?.message || null };
  };

  const signUp = async (data: {
    email: string;
    password: string;
    full_name: string;
    index_number?: string;
    program?: string;
    level?: string;
  }) => {
    if (data.index_number) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('index_number', data.index_number)
        .maybeSingle();

      if (existing) {
        return { error: 'Index number exist' };
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
        },
      },
    });

    if (authError) return { error: authError.message };

    if (authData.user) {
      // Role is always 'student' and is set server-side by the SECURITY DEFINER RPC.
      const { error: profileError } = await supabase.rpc('create_signup_profile', {
        p_user_id: authData.user.id,
        p_email: data.email,
        p_full_name: data.full_name,
        p_index_number: data.index_number ?? null,
        p_program: data.program ?? null,
        p_level: data.level ?? null,
      });

      if (profileError) return { error: profileError.message };

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      setUser(authData.user);
      setProfile((profileData as UserProfile) ?? null);
      return { error: null, data: (profileData as UserProfile) ?? undefined };
    }

    return { error: 'Registration failed' };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);
    if (!error) {
      await refreshProfile();
    }
    return { error: error?.message || null };
  };

  const deleteAccount = async () => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.rpc('delete_user_account');
    if (!error) {
      await signOut();
    }
    return { error: error?.message || null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        recovering,
        clearRecovery,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
