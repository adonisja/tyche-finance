/**
 * useAuth Hook
 * 
 * Manages authentication state with AWS Cognito.
 * Handles login, signup, logout, and session management.
 * 
 * Usage:
 *   const { user, loading, login, signUp, logout, isAuthenticated } = useAuth();
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  signIn, 
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';

export interface User {
  userId: string;  // Cognito 'sub' claim - permanent UUID identifier (e.g., '8448b4d8-20b1-7062-caba-1ab4ab081277')
  email: string;   // User's email address (can change)
  emailVerified: boolean;
}

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      
      if (currentUser && session.tokens) {
        // Use 'sub' from JWT token as the permanent userId
        // This is the immutable user identifier that should be used in your database
        const sub = session.tokens.idToken?.payload.sub as string;
        const email = session.tokens.idToken?.payload.email as string;
        
        setUser({
          userId: sub,  // Using sub (UUID) as the permanent userId
          email: email || currentUser.signInDetails?.loginId || '',
          emailVerified: true,
        });
      } else {
        setUser(null);
      }
    } catch (err) {
      // User not authenticated
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      await signIn({
        username: email,
        password,
      });

      await fetchUser();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to login';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      await amplifySignUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to sign up';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const confirmSignUp = async (email: string, code: string): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      await amplifyConfirmSignUp({
        username: email,
        confirmationCode: code,
      });

      // Auto-login after confirmation
      // Note: User still needs to login manually or we can auto-sign them in here
      setUser({
        userId: email,
        email,
        emailVerified: true,
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to confirm account';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setError(null);
      await signOut();
      setUser(null);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to logout';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    signUp,
    confirmSignUp,
    logout,
    refreshUser: fetchUser,
  };
}
