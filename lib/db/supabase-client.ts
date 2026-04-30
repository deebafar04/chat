/**
 * Supabase Client Utilities
 *
 * This file provides Supabase client instances for different contexts:
 * - Server-side (with service role key for admin operations)
 * - Client-side (with anon key for regular operations)
 * - Server Components (with cookies for SSR)
 */

import { createBrowserClient, createServerClient } from "@supabase/ssr";

// Get environment variables (will be validated when functions are called)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Helper to validate environment variables at runtime
function validateEnvVars() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
}

/**
 * Browser Client
 * Use this in Client Components
 *
 * @example
 * 'use client'
 * import { createClient } from '@/lib/db/supabase-client'
 *
 * export function MyComponent() {
 *   const supabase = createClient()
 *   // ... use supabase
 * }
 */
export function createClient() {
  validateEnvVars();
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}

/**
 * Server Client (with cookies)
 * Use this in Server Components, Server Actions, and Route Handlers
 *
 * @example
 * import { createServerClient } from '@/lib/db/supabase-client'
 *
 * export async function MyServerComponent() {
 *   const supabase = await createServerClient()
 *   const { data, error } = await supabase.from('chat').select()
 *   // ...
 * }
 */
export async function createServerComponentClient() {
  validateEnvVars();
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: any }>
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Server Admin Client (with service role key)
 * Use this for admin operations that bypass RLS
 * ⚠️ WARNING: This client has full database access. Use with caution!
 *
 * @example
 * import { createAdminClient } from '@/lib/db/supabase-client'
 *
 * export async function deleteUser(userId: string) {
 *   const supabase = createAdminClient()
 *   // This bypasses RLS
 *   await supabase.from('chat').delete().eq('user_id', userId)
 * }
 */
export function createAdminClient() {
  validateEnvVars();
  if (!supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. This is required for admin operations."
    );
  }

  return createBrowserClient(supabaseUrl!, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Get current user from server
 * Use this in Server Components to get the authenticated user
 *
 * @example
 * import { getCurrentUser } from '@/lib/db/supabase-client'
 *
 * export async function MyServerComponent() {
 *   const user = await getCurrentUser()
 *   if (!user) return <LoginPrompt />
 *   // ...
 * }
 */
export async function getCurrentUser() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get current user's role from metadata
 * Returns 'admin' or 'user'
 *
 * @example
 * import { getUserRole } from '@/lib/db/supabase-client'
 *
 * export async function MyServerComponent() {
 *   const role = await getUserRole()
 *   if (role !== 'admin') return <AccessDenied />
 *   // ...
 * }
 */
export async function getUserRole(): Promise<"admin" | "user"> {
  const user = await getCurrentUser();
  return user?.user_metadata?.role === "admin" ? "admin" : "user";
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === "admin";
}
