/**
 * Supabase Server-Side Authentication Utilities
 *
 * This file provides server-side authentication utilities for Supabase Auth.
 * Use these functions in Server Components, API Routes, and Server Actions.
 */

import type { Session, User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/db/supabase-client";
import {
  ActivityCategory,
  createCorrelationId,
  logUserActivity,
  UserActivityType,
} from "@/lib/logging/activity-logger";

// Types for server auth results
export type ServerAuthResult = {
  user: User;
  session: Session;
};

export interface ServerAuthError extends Error {
  code: "UNAUTHORIZED" | "FORBIDDEN" | "SESSION_EXPIRED" | "UNKNOWN_ERROR";
  statusCode: number;
}

/**
 * Decide whether the current request must be authenticated.
 *
 * Resolution:
 *   1. `REQUIRE_AUTH=true`  → always require login.
 *   2. `REQUIRE_AUTH=false` → never require login.
 *   3. Unset → fall back to host-based default: non-localhost requires login,
 *      localhost (and 127.0.0.1 / ::1) does not.
 *
 * Pass a `Headers` object when calling from an API route. From a Server
 * Component, omit it and the helper reads `next/headers` itself.
 */
export async function isAuthRequired(reqHeaders?: Headers): Promise<boolean> {
  const flag = process.env.REQUIRE_AUTH?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;

  const headerStore = reqHeaders ?? (await headers());
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";
  return !isLocalhost;
}

/**
 * Get the current authenticated user from server context
 * Returns null if no user is authenticated
 *
 * @returns Promise with current user or null
 *
 * @example
 * // In Server Component
 * export default async function MyPage() {
 *   const user = await getCurrentUser()
 *   if (!user) {
 *     return <div>Please log in</div>
 *   }
 *   return <div>Welcome {user.email}</div>
 * }
 */
export async function getCurrentUser(): Promise<User | null> {
  const correlationId = createCorrelationId();

  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // "Auth session missing" is the normal anonymous case; only treat
      // unexpected errors as failures worth logging.
      const isSessionMissing =
        error.name === "AuthSessionMissingError" ||
        error.message?.includes("Auth session missing");

      if (!isSessionMissing) {
        console.error("Error getting current user:", error);

        await logUserActivity({
          user_id: "unknown",
          activity_type: UserActivityType.AUTH_LOGIN,
          activity_category: ActivityCategory.AUTHENTICATION,
          activity_metadata: {
            description: "Failed to get current user",
            error_message: error.message,
            error_code: error.status,
          },
          correlation_id: correlationId,
          success: false,
        });
      }

      return null;
    }

    return user;
  } catch (err) {
    console.error("Error in getCurrentUser:", err);

    // Log unexpected error
    await logUserActivity({
      user_id: "unknown",
      activity_type: UserActivityType.AUTH_LOGIN,
      activity_category: ActivityCategory.AUTHENTICATION,
      activity_metadata: {
        description: "Unexpected error in getCurrentUser",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      correlation_id: correlationId,
      success: false,
    });

    return null;
  }
}

/**
 * Get the current session from server context
 * Returns null if no session exists
 *
 * @returns Promise with current session or null
 *
 * @example
 * // In API Route
 * export async function GET() {
 *   const session = await getSession()
 *   if (!session) {
 *     return new Response('Unauthorized', { status: 401 })
 *   }
 *   // ... handle authenticated request
 * }
 */
export async function getSession(): Promise<Session | null> {
  const correlationId = createCorrelationId();

  try {
    const supabase = await createServerComponentClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Error getting session:", error);

      // Log session error
      await logUserActivity({
        user_id: "unknown",
        activity_type: UserActivityType.AUTH_LOGIN,
        activity_category: ActivityCategory.AUTHENTICATION,
        activity_metadata: {
          description: "Failed to get session",
          error_message: error.message,
          error_code: error.status,
        },
        correlation_id: correlationId,
        success: false,
      });

      return null;
    }

    return session;
  } catch (err) {
    console.error("Error in getSession:", err);

    // Log unexpected error
    await logUserActivity({
      user_id: "unknown",
      activity_type: UserActivityType.AUTH_LOGIN,
      activity_category: ActivityCategory.AUTHENTICATION,
      activity_metadata: {
        description: "Unexpected error in getSession",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      correlation_id: correlationId,
      success: false,
    });

    return null;
  }
}

/**
 * Require authentication - throws error if user is not authenticated
 * Use this in API routes and server actions that require authentication
 *
 * @returns Promise with authenticated user and session
 * @throws ServerAuthError if user is not authenticated
 *
 * @example
 * // In API Route
 * export async function POST() {
 *   try {
 *     const { user, session } = await requireAuth()
 *     // ... handle authenticated request
 *   } catch (error) {
 *     return new Response(error.message, { status: error.statusCode })
 *   }
 * }
 */
export async function requireAuth(): Promise<ServerAuthResult> {
  const correlationId = createCorrelationId();

  const user = await getCurrentUser();
  const session = await getSession();

  if (!user || !session) {
    // Log authentication failure
    await logUserActivity({
      user_id: "unknown",
      activity_type: UserActivityType.AUTH_LOGIN,
      activity_category: ActivityCategory.AUTHENTICATION,
      activity_metadata: {
        description: "Authentication required but not provided",
        has_user: !!user,
        has_session: !!session,
      },
      correlation_id: correlationId,
      success: false,
    });

    const error = new Error("Authentication required") as ServerAuthError;
    error.code = "UNAUTHORIZED";
    error.statusCode = 401;
    throw error;
  }

  // Log successful authentication
  await logUserActivity({
    user_id: user.id,
    activity_type: UserActivityType.AUTH_LOGIN,
    activity_category: ActivityCategory.AUTHENTICATION,
    activity_metadata: {
      description: "Authentication verified successfully",
      email: user.email,
      session_expires_at: session.expires_at,
    },
    correlation_id: correlationId,
    success: true,
  });

  return { user, session };
}

/**
 * Require admin authentication - throws error if user is not admin
 * Use this in API routes and server actions that require admin privileges
 *
 * @returns Promise with authenticated admin user and session
 * @throws ServerAuthError if user is not authenticated or not admin
 *
 * @example
 * // In API Route
 * export async function DELETE() {
 *   try {
 *     const { user, session } = await requireAdmin()
 *     // ... handle admin request
 *   } catch (error) {
 *     return new Response(error.message, { status: error.statusCode })
 *   }
 * }
 */
export async function requireAdmin(): Promise<ServerAuthResult> {
  const correlationId = createCorrelationId();

  const { user, session } = await requireAuth();

  const userRole = await getUserRole(user);

  if (userRole !== "admin") {
    // Log unauthorized admin access attempt
    await logUserActivity({
      user_id: user.id,
      activity_type: UserActivityType.AUTH_LOGIN,
      activity_category: ActivityCategory.AUTHENTICATION,
      activity_metadata: {
        description: "Admin privileges required but user is not admin",
        user_role: userRole,
        email: user.email,
      },
      correlation_id: correlationId,
      success: false,
    });

    const error = new Error("Admin privileges required") as ServerAuthError;
    error.code = "FORBIDDEN";
    error.statusCode = 403;
    throw error;
  }

  // Log successful admin authentication
  await logUserActivity({
    user_id: user.id,
    activity_type: UserActivityType.AUTH_LOGIN,
    activity_category: ActivityCategory.AUTHENTICATION,
    activity_metadata: {
      description: "Admin authentication verified successfully",
      user_role: userRole,
      email: user.email,
    },
    correlation_id: correlationId,
    success: true,
  });

  return { user, session };
}

/**
 * Get the user's role from metadata
 *
 * @param user - Optional user object, if not provided will fetch current user
 * @returns Promise with user role ('admin' or 'user')
 *
 * @example
 * // In Server Component
 * export default async function AdminPanel() {
 *   const role = await getUserRole()
 *   if (role !== 'admin') {
 *     return <div>Access denied</div>
 *   }
 *   return <AdminDashboard />
 * }
 */
export async function getUserRole(
  user?: User | null
): Promise<"admin" | "user"> {
  try {
    const currentUser = user || (await getCurrentUser());

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
 * Check if the user has admin privileges
 *
 * @param user - Optional user object, if not provided will fetch current user
 * @returns Promise with boolean indicating admin status
 *
 * @example
 * // In Server Component
 * export default async function MyPage() {
 *   const userIsAdmin = await isAdmin()
 *   return (
 *     <div>
 *       {userIsAdmin && <AdminControls />}
 *       <RegularContent />
 *     </div>
 *   )
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
 * Validate session from request (for API routes)
 * Extracts and validates session from request headers/cookies
 *
 * @param request - The incoming request object
 * @returns Promise with session or null
 *
 * @example
 * // In API Route
 * export async function GET(request: Request) {
 *   const session = await validateSession(request)
 *   if (!session) {
 *     return new Response('Unauthorized', { status: 401 })
 *   }
 *   // ... handle authenticated request
 * }
 */
export async function validateSession(
  _request: Request
): Promise<Session | null> {
  const correlationId = createCorrelationId();

  try {
    // For API routes, we need to create a server client with the request cookies
    const supabase = await createServerComponentClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Error validating session:", error);

      // Log session validation error
      await logUserActivity({
        user_id: "unknown",
        activity_type: UserActivityType.AUTH_LOGIN,
        activity_category: ActivityCategory.AUTHENTICATION,
        activity_metadata: {
          description: "Session validation failed",
          error_message: error.message,
          error_code: error.status,
        },
        correlation_id: correlationId,
        success: false,
      });

      return null;
    }

    return session;
  } catch (err) {
    console.error("Error in validateSession:", err);

    // Log unexpected error
    await logUserActivity({
      user_id: "unknown",
      activity_type: UserActivityType.AUTH_LOGIN,
      activity_category: ActivityCategory.AUTHENTICATION,
      activity_metadata: {
        description: "Unexpected error in validateSession",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      correlation_id: correlationId,
      success: false,
    });

    return null;
  }
}

/**
 * Require authentication with redirect (for Server Components)
 * Redirects to login page if user is not authenticated
 *
 * @param redirectTo - Optional URL to redirect to after login
 * @returns Promise with authenticated user and session
 *
 * @example
 * // In Server Component
 * export default async function ProtectedPage() {
 *   const { user, session } = await requireAuthWithRedirect()
 *   // This will redirect to login if not authenticated
 *   return <div>Welcome {user.email}</div>
 * }
 */
export async function requireAuthWithRedirect(
  redirectTo?: string
): Promise<ServerAuthResult> {
  const correlationId = createCorrelationId();

  const user = await getCurrentUser();
  const session = await getSession();

  if (!user || !session) {
    // Log redirect due to missing authentication
    await logUserActivity({
      user_id: "unknown",
      activity_type: UserActivityType.AUTH_LOGIN,
      activity_category: ActivityCategory.AUTHENTICATION,
      activity_metadata: {
        description: "Redirecting to login - authentication required",
        redirect_to: redirectTo,
        has_user: !!user,
        has_session: !!session,
      },
      correlation_id: correlationId,
      success: false,
    });

    const loginUrl = redirectTo
      ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/login";
    redirect(loginUrl);
  }

  return { user, session };
}

/**
 * Require admin with redirect (for Server Components)
 * Redirects to login or home page if user is not admin
 *
 * @param redirectTo - Optional URL to redirect to after login (for non-authenticated users)
 * @returns Promise with authenticated admin user and session
 *
 * @example
 * // In Server Component
 * export default async function AdminPage() {
 *   const { user, session } = await requireAdminWithRedirect()
 *   // This will redirect if not authenticated or not admin
 *   return <AdminDashboard />
 * }
 */
export async function requireAdminWithRedirect(
  redirectTo?: string
): Promise<ServerAuthResult> {
  const correlationId = createCorrelationId();

  const user = await getCurrentUser();
  const session = await getSession();

  if (!user || !session) {
    // Log redirect due to missing authentication
    await logUserActivity({
      user_id: "unknown",
      activity_type: UserActivityType.AUTH_LOGIN,
      activity_category: ActivityCategory.AUTHENTICATION,
      activity_metadata: {
        description: "Redirecting to login - admin authentication required",
        redirect_to: redirectTo,
        has_user: !!user,
        has_session: !!session,
      },
      correlation_id: correlationId,
      success: false,
    });

    const loginUrl = redirectTo
      ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/login";
    redirect(loginUrl);
  }

  const userRole = await getUserRole(user);

  if (userRole !== "admin") {
    // Log unauthorized admin access attempt with redirect
    await logUserActivity({
      user_id: user.id,
      activity_type: UserActivityType.AUTH_LOGIN,
      activity_category: ActivityCategory.AUTHENTICATION,
      activity_metadata: {
        description: "Redirecting to home - user is not admin",
        user_role: userRole,
        email: user.email,
      },
      correlation_id: correlationId,
      success: false,
    });

    redirect("/"); // Redirect to home page for non-admin users
  }

  return { user, session };
}

/**
 * Create error response for API routes
 * Helper function to create consistent error responses
 *
 * @param error - The ServerAuthError or regular Error
 * @returns Response object with appropriate status and message
 *
 * @example
 * // In API Route
 * export async function POST() {
 *   try {
 *     await requireAdmin()
 *     // ... handle request
 *   } catch (error) {
 *     return createAuthErrorResponse(error)
 *   }
 * }
 */
export function createAuthErrorResponse(
  error: ServerAuthError | Error
): Response {
  if ("statusCode" in error && "code" in error) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
      }),
      {
        status: error.statusCode,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Generic error response
  return new Response(
    JSON.stringify({
      error: "Internal server error",
      code: "UNKNOWN_ERROR",
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Check if user has specific role
 * More flexible role checking for future role expansion
 *
 * @param requiredRole - The role to check for
 * @param user - Optional user object, if not provided will fetch current user
 * @returns Promise with boolean indicating if user has the required role
 *
 * @example
 * // In Server Component
 * export default async function ModeratorPanel() {
 *   const canModerate = await hasRole('admin') // Could be extended to 'moderator'
 *   if (!canModerate) {
 *     return <div>Access denied</div>
 *   }
 *   return <ModeratorDashboard />
 * }
 */
export async function hasRole(
  requiredRole: "admin" | "user",
  user?: User | null
): Promise<boolean> {
  try {
    const userRole = await getUserRole(user);
    return userRole === requiredRole;
  } catch (err) {
    console.error("Error checking user role:", err);
    return false;
  }
}

/**
 * Get user metadata safely
 * Returns user metadata with type safety and defaults
 *
 * @param user - Optional user object, if not provided will fetch current user
 * @returns Promise with user metadata
 *
 * @example
 * // In Server Component
 * export default async function UserProfile() {
 *   const metadata = await getUserMetadata()
 *   return (
 *     <div>
 *       <p>Role: {metadata.role}</p>
 *       <p>Theme: {metadata.settings?.theme}</p>
 *     </div>
 *   )
 * }
 */
export async function getUserMetadata(user?: User | null): Promise<{
  role: "admin" | "user";
  isActive: boolean;
  settings?: {
    theme?: string;
    defaultModel?: string;
    notifications?: boolean;
  };
}> {
  try {
    const currentUser = user || (await getCurrentUser());

    if (!currentUser) {
      return {
        role: "user",
        isActive: false,
      };
    }

    const metadata = currentUser.user_metadata || {};

    return {
      role: metadata.role === "admin" ? "admin" : "user",
      isActive: metadata.isActive ?? true,
      settings: metadata.settings || {},
    };
  } catch (err) {
    console.error("Error getting user metadata:", err);
    return {
      role: "user",
      isActive: false,
    };
  }
}
