import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';


/**
 * Defines the shape of the Authentication Context.
 * @property session - The active Supabase session (tokens, expiry, etc.).
 * @property user - The specific user object (email, id, metadata).
 * @property loading - True while fetching initial session state.
 * @property signOut - Function to log the user out.
 */
interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Component
 * Wraps the application to provide global access to the user's authentication state.
 * It handles checking for an existing session on load and listening for changes (login/logout).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes (sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // Cleanup: Unsubscribe from the listener when the component unmounts
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Logs the user out of Supabase and clears the local session.
   */
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {/* Wait for loading to finish before rendering children.
        This prevents ProtectedRoute from kicking the user out prematurely. 
      */}
      {!loading && children}
    </AuthContext.Provider>
  );
}

/**
 * Custom Hook: useAuth
 * Provides easy access to the AuthContext values.
 * @throws Error if used outside of an AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};