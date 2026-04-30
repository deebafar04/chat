"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { useAuth } from "@/lib/auth/hooks";
import {
  ErrorCategory,
  ErrorSeverity,
  logAuthError,
} from "@/lib/errors/logger";
import { isSupabaseConfigured } from "@/lib/db/supabase-client";

const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_URL;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, loading, error, clearError, user } = useAuth();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dbUnavailable = !isSupabaseConfigured;

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      const returnTo = searchParams.get("returnTo") || "/chat";
      router.push(returnTo);
    }
  }, [user, loading, router, searchParams]);

  const getErrorMessage = useCallback((authError: string): string => {
    if (authError.includes("Invalid login credentials")) {
      return "Invalid email or password. Please try again.";
    }
    if (authError.includes("Email not confirmed")) {
      return "Please check your email and click the confirmation link.";
    }
    if (authError.includes("Too many requests")) {
      return "Too many login attempts. Please wait a moment and try again.";
    }
    if (authError.includes("Network")) {
      return "Network error. Please check your connection and try again.";
    }
    return "Login failed. Please try again.";
  }, []);

  // Handle auth errors
  useEffect(() => {
    if (error) {
      const userMessage = getErrorMessage(error);
      let errorCategory = ErrorCategory.LOGIN_FAILED;
      let severity = ErrorSeverity.ERROR;

      if (error.includes("Invalid login credentials")) {
        errorCategory = ErrorCategory.LOGIN_FAILED;
        severity = ErrorSeverity.WARNING;
      } else if (error.includes("Email not confirmed")) {
        errorCategory = ErrorCategory.LOGIN_FAILED;
        severity = ErrorSeverity.WARNING;
      } else if (error.includes("Too many requests")) {
        errorCategory = ErrorCategory.API_RATE_LIMIT;
        severity = ErrorSeverity.WARNING;
      } else if (error.includes("Network")) {
        errorCategory = ErrorCategory.NETWORK_ERROR;
        severity = ErrorSeverity.ERROR;
      }

      logAuthError(
        errorCategory,
        `Login failed: ${error}`,
        {
          email,
          userMessage,
          originalError: error,
          timestamp: new Date().toISOString(),
        },
        undefined,
        severity
      );

      toast({
        type: "error",
        description: userMessage,
      });
      setIsSubmitting(false);
    }
  }, [error, email, getErrorMessage]);

  // Clear error when component unmounts or user starts typing
  useEffect(() => {
    return () => {
      if (error) {
        clearError();
      }
    };
  }, [error, clearError]);

  const handleSubmit = async (formData: FormData) => {
    const emailValue = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!emailValue || !password) {
      toast({
        type: "error",
        description: "Please enter both email and password.",
      });
      return;
    }

    setEmail(emailValue);
    setIsSubmitting(true);
    clearError();

    try {
      await signIn(emailValue, password);
      setIsSuccessful(true);

      toast({
        type: "success",
        description: "Successfully signed in!",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown login error";

      logAuthError(
        ErrorCategory.LOGIN_FAILED,
        `Unexpected login error: ${errorMessage}`,
        {
          email: emailValue,
          error: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString(),
        },
        undefined,
        ErrorSeverity.ERROR
      );

      console.error("Login error:", err);
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2 dark:border-gray-100" />
          <p className="mt-2 text-gray-600 text-sm dark:text-gray-400">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Keep showing spinner while redirect to /chat is in flight
  if (user) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2 dark:border-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col bg-background">
      <div className="flex flex-1 items-start justify-center pt-12 md:items-center md:pt-0">
        <div className="flex w-full max-w-md flex-col gap-8 overflow-hidden rounded-2xl">
          {dbUnavailable && (
            <div className="mx-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Database connection unavailable.{" "}
              {isVercel
                ? "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables."
                : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in docker/.env."}
            </div>
          )}
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
            <h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
            <p className="text-gray-500 text-sm dark:text-zinc-400">
              Use your email and password to sign in
            </p>
          </div>
          <div className={dbUnavailable ? "pointer-events-none select-none opacity-40" : ""}>
            <AuthForm action={handleSubmit} defaultEmail={email}>
              <SubmitButton
                disabled={isSubmitting || loading || dbUnavailable}
                isSuccessful={isSuccessful}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </SubmitButton>
              <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
                {"Don't have an account? "}
                <Link
                  className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
                  href="/register"
                >
                  Sign up
                </Link>
                {" for free."}
              </p>
            </AuthForm>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-screen items-center justify-center bg-background">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2 dark:border-gray-100" />
            <p className="mt-2 text-gray-600 text-sm dark:text-gray-400">
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
