import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { SUPER_ADMIN_EMAIL } from '@/lib/config';
import type { UserProfile, Role } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: {
    email: string;
    password: string;
    full_name: string;
    index_number: string;
    program: string;
    level: string;
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
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setProfile(data as UserProfile);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && authData.user) {
      if (email === SUPER_ADMIN_EMAIL) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();
        if (existingProfile && existingProfile.role !== 'super_admin') {
          await supabase
            .from('profiles')
            .update({ role: 'super_admin' })
            .eq('id', authData.user.id);
        }
      }
      await fetchProfile(authData.user.id);
    }
    return { error: error?.message || null };
  };

  const signUp = async (data: {
    email: string;
    password: string;
    full_name: string;
    index_number: string;
    program: string;
    level: string;
  }) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (authError) return { error: authError.message };

    if (authData.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: data.email,
            full_name: data.full_name,
            index_number: data.index_number,
            program: data.program,
            level: data.level,
            role: data.email === SUPER_ADMIN_EMAIL ? 'super_admin' : 'student',
          },
        ])
        .select()
        .single();

      if (profileError) return { error: profileError.message };
      return { error: null, data: profileData as UserProfile };
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
