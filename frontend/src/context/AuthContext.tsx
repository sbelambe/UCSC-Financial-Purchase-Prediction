import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Defines the shape of the Authentication Context.
 * @property user - The active Firebase User object (email, uid, metadata).
 * @property loading - True while Firebase checks the user's auth state.
 * @property signOut - Function to log the user out.
 */
interface AuthContextType {
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase listener handles both 'initial load' and 'updates'
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
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