/**
 * Supabase Authentication React Hooks
 *
 * This file provides React hooks for client-side authentication state management.
 * Use these hooks in Client Components to access authentication state and methods.
 *
 * These hooks now use the AuthContext for better performance and state management.
 */

"use client";

import type { Session, User } from "@supabase/supabase-js";
import type { SignUpEmailStatus, UserMetadata } from "./client";
import {
  useRequireAdmin as contextRequireAdmin,
  useRequireAuth as contextRequireAuth,
  useAuthContext,
} from "./context";

// Hook return types
export type UseAuthReturn = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    metadata?: Partial<UserMetadata>
  ) => Promise<SignUpEmailStatus>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export type UseRoleReturn = {
  role: "admin" | "user" | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
};

export type UseRequireAuthReturn = {
  user: User;
  session: Session;
  role: "admin" | "user";
  loading: boolean;
};

/**
 * Main authentication hook for managing auth state and operations
 *
 * Provides current user, session, loading state, and auth methods.
 * Now uses AuthContext for better performance and centralized state management.
 *
 * @returns Authentication state and methods
 *
 * @example
 * function LoginForm() {
 *   const { user, loading, signIn, error } = useAuth()
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
export function useAuth(): UseAuthReturn {
  return useAuthContext();
}

/**
 * Hook for role-based rendering and access control
 *
 * Provides current user role and admin status with loading state.
 * Now uses AuthContext for better performance and centralized state management.
 *
 * @returns Role information and loading state
 *
 * @example
 * function AdminPanel() {
 *   const { role, isAdmin, loading } = useRole()
 *
 *   if (loading) return <div>Loading...</div>
 *   if (!isAdmin) return <div>Access denied</div>
 *
 *   return <div>Admin Panel Content</div>
 * }
 */
export function useRole(): UseRoleReturn {
  const { role, isAdmin, loading, error } = useAuthContext();

  return {
    role,
    isAdmin,
    loading,
    error,
  };
}

/**
 * Hook for components that require authentication
 *
 * Automatically redirects to login if user is not authenticated.
 * Returns guaranteed non-null user, session, and role.
 * Now uses AuthContext for better performance.
 *
 * @param redirectTo - Optional redirect URL after login (default: current page)
 * @returns Guaranteed authentication state
 *
 * @example
 * function ProtectedComponent() {
 *   const { user, role, loading } = useRequireAuth()
 *
 *   if (loading) return <div>Loading...</div>
 *
 *   return (
 *     <div>
 *       <h1>Welcome {user.email}</h1>
 *       <p>Your role: {role}</p>
 *     </div>
 *   )
 * }
 */
export function useRequireAuth(redirectTo?: string): UseRequireAuthReturn {
  const result = contextRequireAuth(redirectTo);

  // Convert to the expected return type format
  if (result.loading || !result.user || !result.session || !result.role) {
    return {
      user: {} as User, // Placeholder to satisfy TypeScript
      session: {} as Session, // Placeholder to satisfy TypeScript
      role: "user" as const, // Placeholder to satisfy TypeScript
      loading: true,
    };
  }

  return {
    user: result.user,
    session: result.session,
    role: result.role,
    loading: false,
  };
}

/**
 * Hook for components that require admin privileges
 *
 * Automatically redirects to home page if user is not an admin.
 * Returns guaranteed admin user, session, and role.
 * Now uses AuthContext for better performance.
 *
 * @param redirectTo - Optional redirect URL for non-admin users (default: home page)
 * @returns Guaranteed admin authentication state
 *
 * @example
 * function AdminOnlyComponent() {
 *   const { user, loading } = useRequireAdmin()
 *
 *   if (loading) return <div>Loading...</div>
 *
 *   return <div>Admin Panel for {user.email}</div>
 * }
 */
export function useRequireAdmin(redirectTo = "/"): UseRequireAuthReturn {
  const result = contextRequireAdmin(redirectTo);

  // Convert to the expected return type format
  if (
    result.loading ||
    !result.user ||
    !result.session ||
    result.role !== "admin"
  ) {
    return {
      user: {} as User, // Placeholder to satisfy TypeScript
      session: {} as Session, // Placeholder to satisfy TypeScript
      role: "admin" as const, // Placeholder to satisfy TypeScript
      loading: true,
    };
  }

  return {
    user: result.user,
    session: result.session,
    role: "admin",
    loading: false,
  };
}

/**
 * Hook for conditional rendering based on authentication state
 *
 * Provides boolean flags for different authentication states.
 * Useful for conditional rendering without redirects.
 * Now uses AuthContext for better performance.
 *
 * @returns Authentication state flags
 *
 * @example
 * function ConditionalContent() {
 *   const { isAuthenticated, isAdmin, isLoading } = useAuthState()
 *
 *   if (isLoading) return <div>Loading...</div>
 *
 *   return (
 *     <div>
 *       {isAuthenticated && <div>Welcome back!</div>}
 *       {isAdmin && <div>Admin controls</div>}
 *       {!isAuthenticated && <div>Please log in</div>}
 *     </div>
 *   )
 * }
 */
export function useAuthState() {
  const { user, role, loading, isAuthenticated, isAdmin, isUser } =
    useAuthContext();

  return {
    isAuthenticated,
    isAdmin,
    isUser,
    isLoading: loading,
    user,
    role,
  };
}
