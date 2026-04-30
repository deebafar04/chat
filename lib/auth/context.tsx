/**
 * Supabase Authentication Context Provider
 *
 * This file provides a React Context for managing authentication state across the application.
 * It centralizes auth state management and reduces the number of Supabase subscriptions.
 */

"use client";

import type { Session, User } from "@supabase/supabase-js";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  signIn as clientSignIn,
  signOut as clientSignOut,
  signUp as clientSignUp,
  getSession,
  getUser,
  getUserRole,
  onAuthStateChange,
  type SignUpEmailStatus,
  type UserMetadata,
} from "./client";

// Context types
type AuthContextType = {
  // Auth state
  user: User | null;
  session: Session | null;
  role: "admin" | "user" | null;
  loading: boolean;
  error: string | null;

  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    metadata?: Partial<UserMetadata>
  ) => Promise<SignUpEmailStatus>;
  signOut: () => Promise<void>;
  clearError: () => void;

  // Computed properties
  isAuthenticated: boolean;
  isAdmin: boolean;
  isUser: boolean;
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
type AuthProviderProps = {
  children: React.ReactNode;
};

/**
 * Supabase Auth Context Provider
 *
 * Provides authentication state and methods to all child components.
 * Manages a single subscription to Supabase auth state changes.
 *
 * @param children - Child components that will have access to auth context
 *
 * @example
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <YourAppComponents />
 *     </AuthProvider>
 *   )
 * }
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track initialization
  const initialized = useRef(false);
  const roleLoading = useRef(false);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const [currentSession, currentUser] = await Promise.all([
          getSession(),
          getUser(),
        ]);

        if (mounted) {
          setSession(currentSession);
          setUser(currentUser);
          initialized.current = true;

          // Get user role if user exists
          if (currentUser) {
            roleLoading.current = true;
            try {
              const userRole = await getUserRole(currentUser);
              if (mounted) {
                setRole(userRole);
              }
            } catch (err) {
              console.warn("Failed to get user role:", err);
              if (mounted) {
                setRole("user"); // Default to user role on error
              }
            } finally {
              roleLoading.current = false;
            }
          } else {
            setRole(null);
          }

          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to initialize auth"
          );
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Update role when user changes - use session.user directly
      if (session?.user) {
        roleLoading.current = true;
        try {
          // Use the fresh user object from session
          const userRole = await getUserRole(session.user);
          setRole(userRole);
        } catch (err) {
          console.warn("Failed to get user role:", err);
          setRole("user"); // Default to user role on error
        } finally {
          roleLoading.current = false;
        }
      } else {
        setRole(null);
      }

      // Only set loading to false after initial load
      if (initialized.current) {
        setLoading(false);
      }

      // Clear errors on successful auth state changes
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setError(null);
      }
    });

    return unsubscribe;
  }, []);

  // Sign in method
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await clientSignIn(email, password);

      if (error) {
        throw new Error(error.message);
      }

      // State will be updated by onAuthStateChange listener
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
      throw err;
    }
  }, []);

  // Sign up method
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Partial<UserMetadata>
    ): Promise<SignUpEmailStatus> => {
      try {
        setLoading(true);
        setError(null);

        const result = await clientSignUp(email, password, metadata);

        if (result.error) {
          throw new Error(result.error.message);
        }

        // State will be updated by onAuthStateChange listener.
        // Stop the global loading spinner here so the post-signup screen
        // (which depends on `loading` being false) can render.
        setLoading(false);
        return result.emailStatus;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign up failed");
        setLoading(false);
        throw err;
      }
    },
    []
  );

  // Sign out method
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await clientSignOut();

      if (error) {
        throw new Error(error.message);
      }

      // Dispatch auth event for storage cleanup
      if (typeof window !== "undefined") {
        const customEvent = new CustomEvent("auth-state-change", {
          detail: { type: "SIGNED_OUT" },
        });
        window.dispatchEvent(customEvent);
      }

      // State will be updated by onAuthStateChange listener
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
      setLoading(false);
      throw err;
    }
  }, []);

  // Clear error method
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed properties
  const isAuthenticated = !!user;
  const isAdmin = role === "admin";
  const isUser = role === "user";

  const value: AuthContextType = {
    // Auth state
    user,
    session,
    role,
    loading: loading || roleLoading.current,
    error,

    // Auth methods
    signIn,
    signUp,
    signOut,
    clearError,

    // Computed properties
    isAuthenticated,
    isAdmin,
    isUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access the auth context
 *
 * Must be used within an AuthProvider component.
 * Provides access to all authentication state and methods.
 *
 * @returns Authentication context value
 * @throws Error if used outside of AuthProvider
 *
 * @example
 * function LoginForm() {
 *   const { user, loading, signIn, error } = useAuthContext()
 *
 *   const handleSubmit = async (email: string, password: string) => {
 *     await signIn(email, password)
 *   }
 *
 *   if (loading) return <div>Loading...</div>
 *   if (user) return <div>Welcome {user.email}</div>
 *
 *   return <LoginForm onSubmit={handleSubmit} error={error} />
 * }
 */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}

/**
 * Hook for components that require authentication
 *
 * Automatically redirects to login if user is not authenticated.
 * Returns guaranteed non-null user, session, and role.
 *
 * @param redirectTo - Optional redirect URL after login (default: current page)
 * @returns Guaranteed authentication state
 */
export function useRequireAuth(redirectTo?: string) {
  const { user, session, role, loading } = useAuthContext();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user || !session || !role) {
      setShouldRedirect(true);
    } else {
      setShouldRedirect(false);
    }
  }, [user, session, role, loading]);

  useEffect(() => {
    if (shouldRedirect && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const returnTo = redirectTo || currentPath;
      const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
      window.location.href = loginUrl;
    }
  }, [shouldRedirect, redirectTo]);

  if (loading || !user || !session || !role) {
    return {
      user: null,
      session: null,
      role: null,
      loading: true,
    };
  }

  return {
    user,
    session,
    role,
    loading: false,
  };
}

/**
 * Hook for components that require admin privileges
 *
 * Automatically redirects to home page if user is not an admin.
 * Returns guaranteed admin user, session, and role.
 *
 * @param redirectTo - Optional redirect URL for non-admin users (default: home page)
 * @returns Guaranteed admin authentication state
 */
export function useRequireAdmin(redirectTo = "/") {
  const { user, session, role, loading } = useAuthContext();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user || !session || role !== "admin") {
      setShouldRedirect(true);
    } else {
      setShouldRedirect(false);
    }
  }, [user, session, role, loading]);

  useEffect(() => {
    if (shouldRedirect && typeof window !== "undefined") {
      window.location.href = redirectTo;
    }
  }, [shouldRedirect, redirectTo]);

  if (loading || !user || !session || role !== "admin") {
    return {
      user: null,
      session: null,
      role: null,
      loading: true,
    };
  }

  return {
    user,
    session,
    role: "admin" as const,
    loading: false,
  };
}
