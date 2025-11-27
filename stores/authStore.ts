import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      set({
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
      });

      // Set up auth state listener
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    set({
      loading: false,
      session: data.session,
      user: data.user,
    });

    return { error: error as Error | null };
  },

  signUp: async (email, password) => {
    set({ loading: true });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    set({
      loading: false,
      session: data.session,
      user: data.user,
    });

    return { error: error as Error | null };
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      loading: false,
    });
  },

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },
}));
