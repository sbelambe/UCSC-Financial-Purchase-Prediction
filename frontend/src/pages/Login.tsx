import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';


/**
 * Login Page
 * Handles Google OAuth authentication using Supabase.
 * Checks for existing sessions and displays error messages from URL fragments.
 */
export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // 2. Parse URL Hash for Error Messages
  // Supabase redirects back with errors in the URL hash (e.g., #error_description=User+blocked)
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorDescription = hashParams.get('error_description');
    
    if (errorDescription) {
      // Decode URL encoding (e.g., 'User+blocked' -> 'User blocked')
      const cleanMsg = decodeURIComponent(errorDescription).replace(/\+/g, ' ');
      setErrorMsg(cleanMsg);
    }
  }, []);


/**
   * Initiates the OAuth flow with Google.
   */
const handleLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
  setLoading(true);
  
try {
    await signInWithPopup(auth, googleProvider);
    // Firebase automatically handles the redirect/popup logic
  } catch (error) {
    console.error(error);
  }
};

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        
        {/* Header Section */}
        <div className="p-8 text-center bg-gray-50 border-b border-gray-100">
          <div 
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-4 shadow-sm"
            style={{ borderColor: '#003c6c' }}
          >
            <span className="text-2xl font-bold" style={{ color: '#003c6c' }}>
              UCSC
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Finance Dashboard</h2>
          <p className="text-sm text-gray-500 mt-2">
            Secure access for Staff & Faculty
          </p>
        </div>

        {/* Card Body */}
        <div className="p-8">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <div className="text-red-500 mt-0.5">⚠️</div>
              <div>
                <h3 className="text-sm font-semibold text-red-800">Access Denied</h3>
                <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Sign In Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-fit mx-auto flex items-center justify-center gap-3 px-8 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            style={{ backgroundColor: '#003c6c' }}
          >
            {loading ? (
              <span>Connecting...</span>
            ) : (
              <>
                <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with UCSC ID
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}