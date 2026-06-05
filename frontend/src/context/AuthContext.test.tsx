// __tests__/AuthContext.test.tsx
// using this command on the Fronend folder: npx jest src/context/AuthContext.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import '@testing-library/jest-dom';

// Mock Firebase module dependencies
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
}));

/**
 * TestComponent
 * A minimal consumer of the AuthContext used solely to verify
 * that the provider correctly cascades loading and user states.
 */
const TestComponent = () => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (user) return <div>Welcome {user.email}</div>;
  return <div>Please log in</div>;
};

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
  });

  test('maintains loading state while Firebase initializes', () => {
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('resolves to unauthenticated state when no user is present', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      callback(null);
      return jest.fn();
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Please log in')).toBeInTheDocument();
    });
  });

  test('authenticates successfully when user exists in the Firestore whitelist', async () => {
    const mockUser = { email: 'admin@ucsc.edu' };
    
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome admin@ucsc.edu')).toBeInTheDocument();
    });
  });

  test('forces sign out and alerts when user is missing from the Firestore whitelist', async () => {
    const mockUser = { email: 'unauthorized@gmail.com' };
    
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(firebaseSignOut).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('Access Denied: You are not authorized to view this dashboard.');
      expect(screen.getByText('Please log in')).toBeInTheDocument();
    });
  });

  test('fails securely and forces sign out if the Firestore lookup throws an exception', async () => {
    const mockUser = { email: 'error-trigger@ucsc.edu' };
    
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    // Simulate network error or permissions failure
    (getDoc as jest.Mock).mockRejectedValue(new Error('Firestore connection failed'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(firebaseSignOut).toHaveBeenCalled();
      expect(screen.getByText('Please log in')).toBeInTheDocument();
    });
  });
});