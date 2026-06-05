// Provides global authentication state management using Firebase Authentication
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // If no Google account is logged in, immediately lock the state
      if (!currentUser || !currentUser.email) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Look up the document where the ID is the user's email
        const userDocRef = doc(db, 'authorized_users', currentUser.email.toLowerCase());
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          // The user exists in the Firestore whitelist
          setUser(currentUser);
        } else {
          // Rogue login: They have a valid Google account but aren't on the list
          console.warn(`Unauthorized tenant blocked: ${currentUser.email}`);
          await firebaseSignOut(auth);
          setUser(null);
          alert("Access Denied: You are not authorized to view this dashboard.");
        }
      } catch (error) {
        // Fail securely: If the database lookup fails, deny access
        console.error("Authorization check encountered an error:", error);
        await firebaseSignOut(auth);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);


  // signs the current user out of the app via Firebase
  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
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