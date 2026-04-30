/**
 * Supabase Authentication Client Utilities
 *
 * This file provides client-side authentication utilities for Supabase Auth.
 * Use these functions in Client Components for authentication operations.
 */

"use client";

import type {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/db/supabase-client";

// Types for user metadata
export type UserMetadata = {
  role: "admin" | "user";
  isActive: boolean;
  settings?: {
    theme?: string;
    defaultModel?: string;
    notifications?: boolean;
  };
};

// Enhanced auth response type
export type AuthResult = {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
};

// Status of the verification email after signUp.
// - sent: a verification email was (or should have been) dispatched
// - already_registered: Supabase returned success but identities is empty,
//     which is its security-by-obscurity signal that the email is in use
// - rate_limited: Supabase or its SMTP provider rejected for rate limit
// - smtp_failed: SMTP send error (custom SMTP misconfigured, etc.)
// - unknown: signUp returned an error we couldn't categorize
export type SignUpEmailStatus =
  | "sent"
  | "already_registered"
  | "rate_limited"
  | "smtp_failed"
  | "unknown";

export type SignUpResult = AuthResult & {
  emailStatus: SignUpEmailStatus;
};

function classifySignUpError(error: AuthError): SignUpEmailStatus {
  const message = error.message?.toLowerCase() ?? "";
  const code = (error as AuthError & { code?: string }).code?.toLowerCase() ?? "";
  const status = error.status ?? 0;

  if (
    status === 429 ||
    message.includes("rate limit") ||
    message.includes("too many") ||
    code.includes("over_email_send_rate_limit") ||
    code.includes("rate_limit")
  ) {
    return "rate_limited";
  }

  if (
    message.includes("smtp") ||
    message.includes("send email") ||
    message.includes("email send") ||
    code.includes("email_send_failed") ||
    code.includes("smtp")
  ) {
    return "smtp_failed";
  }

  if (
    message.includes("already registered") ||
    message.includes("already exists") ||
    code.includes("user_already_exists")
  ) {
    return "already_registered";
  }

  return "unknown";
}

function classifySignUpSuccess(user: User | null, session: Session | null): SignUpEmailStatus {
  // If a session is returned, email confirmation is disabled in this project,
  // so no verification email is expected — treat as "sent" so the UI doesn't
  // confusingly show a remediation banner.
  if (session) return "sent";

  // Supabase's security-by-obscurity: when the email is already taken, it
  // returns a User shell with an empty identities array and no session.
  // No verification email is dispatched in this case.
  if (user && Array.isArray(user.identities) && user.identities.length === 0) {
    return "already_registered";
  }

  return "sent";
}

/**
 * Sign up a new user with email and password
 * Assigns default 'user' role in metadata
 *
 * @param email - User's email address
 * @param password - User's password
 * @param metadata - Optional additional user metadata
 * @returns Promise with auth result
 *
 * @example
 * const { user, error } = await signUp('user@example.com', 'password123')
 * if (error) {
 *   console.error('Sign up failed:', error.message)
 * } else {
 *   console.log('User created:', user?.email)
 * }
 */
export async function signUp(
  email: string,
  password: string,
  metadata: Partial<UserMetadata> = {}
): Promise<SignUpResult> {
  if (!isSupabaseConfigured) {
    return {
      user: null,
      session: null,
      error: new Error("Supabase is not configured") as AuthError,
      emailStatus: "unknown",
    };
  }
  try {
    const supabase = createClient();

    // Default metadata with user role
    const defaultMetadata: UserMetadata = {
      role: "user",
      isActive: true,
      settings: {
        theme: "system",
        notifications: true,
      },
      ...metadata,
    };

    // emailRedirectTo makes the verification link in the email return to
    // the origin the user signed up from. Without this, Supabase falls back
    // to its "Site URL" project setting, which on localhost typically points
    // at production and breaks the dev round-trip.
    const emailRedirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: defaultMetadata,
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    // Log successful registration
    if (!error && data.user) {
      try {
        const { logUserActivity, UserActivityType, ActivityCategory } =
          await import("@/lib/logging");

        // Fire and forget - don't block auth flow
        void logUserActivity({
          user_id: data.user.id,
          activity_type: UserActivityType.AUTH_REGISTER,
          activity_category: ActivityCategory.AUTHENTICATION,
          activity_metadata: {
            method: "password",
            role: defaultMetadata.role,
            email_confirmed: data.user.email_confirmed_at !== null,
          },
          success: true,
        });
      } catch (logError) {
        // Don't fail registration if logging fails
        console.error("Failed to log registration:", logError);
      }
    }

    const emailStatus: SignUpEmailStatus = error
      ? classifySignUpError(error)
      : classifySignUpSuccess(data.user, data.session);

    return {
      user: data.user,
      session: data.session,
      error,
      emailStatus,
    };
  } catch (err) {
    return {
      user: null,
      session: null,
      error: err as AuthError,
      emailStatus: "unknown",
    };
  }
}

/**
 * Resend the signup verification email for an unconfirmed user.
 *
 * Used by the post-signup screen so the user can retry without re-entering
 * their password. Returns the same emailStatus shape as signUp so the UI
 * can render the same remediation paths.
 */
export async function resendSignupEmail(
  email: string
): Promise<{ error: AuthError | null; emailStatus: SignUpEmailStatus }> {
  if (!isSupabaseConfigured) {
    return {
      error: new Error("Supabase is not configured") as AuthError,
      emailStatus: "unknown",
    };
  }
  try {
    const supabase = createClient();
    const emailRedirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    });
    return {
      error,
      emailStatus: error ? classifySignUpError(error) : "sent",
    };
  } catch (err) {
    return { error: err as AuthError, emailStatus: "unknown" };
  }
}

/**
 * Sign in an existing user with email and password
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise with auth result
 *
 * @example
 * const { user, session, error } = await signIn('user@example.com', 'password123')
 * if (error) {
 *   console.error('Sign in failed:', error.message)
 * } else {
 *   console.log('User signed in:', user?.email)
 * }
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { user: null, session: null, error: new Error("Supabase is not configured") as AuthError };
  }
  try {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Log successful login
    if (!error && data.user) {
      try {
        const { logUserActivity, UserActivityType, ActivityCategory } =
          await import("@/lib/logging");

        // Fire and forget - don't block auth flow
        void logUserActivity({
          user_id: data.user.id,
          activity_type: UserActivityType.AUTH_LOGIN,
          activity_category: ActivityCategory.AUTHENTICATION,
          activity_metadata: {
            method: "password",
            last_sign_in: data.user.last_sign_in_at,
          },
          success: true,
        });
      } catch (logError) {
        // Don't fail login if logging fails
        console.error("Failed to log login:", logError);
      }
    }

    return {
      user: data.user,
      session: data.session,
      error,
    };
  } catch (err) {
    return {
      user: null,
      session: null,
      error: err as AuthError,
    };
  }
}

/**
 * Sign out the current user
 * Clears session and redirects to login
 *
 * @returns Promise that resolves when sign out is complete
 *
 * @example
 * await signOut()
 * // User is now signed out and session is cleared
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  if (!isSupabaseConfigured) return { error: null };
  try {
    const supabase = createClient();

    // Get current user before signing out for logging
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    // Log successful logout
    if (!error && user) {
      try {
        const { logUserActivity, UserActivityType, ActivityCategory } =
          await import("@/lib/logging");

        // Fire and forget - don't block auth flow
        void logUserActivity({
          user_id: user.id,
          activity_type: UserActivityType.AUTH_LOGOUT,
          activity_category: ActivityCategory.AUTHENTICATION,
          activity_metadata: {
            method: "manual",
          },
          success: true,
        });
      } catch (logError) {
        // Don't fail logout if logging fails
        console.error("Failed to log logout:", logError);
      }
    }

    return { error };
  } catch (err) {
    return { error: err as AuthError };
  }
}

/**
 * Get the current user session
 *
 * @returns Promise with current session or null
 *
 * @example
 * const session = await getSession()
 * if (session) {
 *   console.log('User is authenticated:', session.user.email)
 * } else {
 *   console.log('User is not authenticated')
 * }
 */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch (err) {
    console.error("Error getting session:", err);
    return null;
  }
}

/**
 * Get the current authenticated user
 *
 * @returns Promise with current user or null
 *
 * @example
 * const user = await getUser()
 * if (user) {
 *   console.log('Current user:', user.email)
 * } else {
 *   console.log('No authenticated user')
 * }
 */
export async function getUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.error("Error getting user:", err);
    return null;
  }
}

/**
 * Get the current user's role from metadata
 *
 * @param user - Optional user object, if not provided will fetch current user
 * @returns Promise with user role ('admin' or 'user')
 *
 * @example
 * const role = await getUserRole()
 * if (role === 'admin') {
 *   console.log('User has admin privileges')
 * }
 */
export async function getUserRole(
  user?: User | null
): Promise<"admin" | "user"> {
  try {
    const currentUser = user || (await getUser());

    if (!currentUser) {
      return "user"; // Default to user role if no user found
    }

    const role = currentUser.user_metadata?.role;
    return role === "admin" ? "admin" : "user";
  } catch (err) {
    console.error("Error getting user role:", err);
    return "user"; // Default to user role on error
  }
}

/**
 * Check if the current user has admin privileges
 *
 * @param user - Optional user object, if not provided will fetch current user
 * @returns Promise with boolean indicating admin status
 *
 * @example
 * const isUserAdmin = await isAdmin()
 * if (isUserAdmin) {
 *   // Show admin UI
 * } else {
 *   // Show regular user UI
 * }
 */
export async function isAdmin(user?: User | null): Promise<boolean> {
  try {
    const role = await getUserRole(user);
    return role === "admin";
  } catch (err) {
    console.error("Error checking admin status:", err);
    return false; // Default to false on error
  }
}

/**
 * Listen to authentication state changes
 *
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function
 *
 * @example
 * const unsubscribe = onAuthStateChange((event, session) => {
 *   if (event === 'SIGNED_IN') {
 *     console.log('User signed in:', session?.user.email)
 *   } else if (event === 'SIGNED_OUT') {
 *     console.log('User signed out')
 *   }
 * })
 *
 * // Later, unsubscribe
 * unsubscribe()
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  if (!isSupabaseConfigured) return () => {};

  const supabase = createClient();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Refresh the current session
 * Useful for ensuring the session is up to date
 *
 * @returns Promise with refreshed session result
 *
 * @example
 * const { session, error } = await refreshSession()
 * if (error) {
 *   console.error('Failed to refresh session:', error.message)
 * }
 */
export async function refreshSession(): Promise<{
  session: Session | null;
  error: AuthError | null;
}> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.refreshSession();

    return {
      session: data.session,
      error,
    };
  } catch (err) {
    return {
      session: null,
      error: err as AuthError,
    };
  }
}

/**
 * Update user metadata
 * Useful for updating user role or other metadata
 *
 * @param updates - Metadata updates to apply
 * @returns Promise with updated user result
 *
 * @example
 * const { user, error } = await updateUserMetadata({
 *   settings: { theme: 'dark' }
 * })
 */
export async function updateUserMetadata(
  updates: Partial<UserMetadata>
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    });

    return {
      user: data.user,
      error,
    };
  } catch (err) {
    return {
      user: null,
      error: err as AuthError,
    };
  }
}
