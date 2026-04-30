"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { useAuth } from "@/lib/auth/hooks";
import { resendSignupEmail, type SignUpEmailStatus } from "@/lib/auth/client";
import {
  ErrorCategory,
  ErrorSeverity,
  logAuthError,
} from "@/lib/errors/logger";
import { isSupabaseConfigured } from "@/lib/db/supabase-client";

const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_URL;

export default function Page() {
  const _router = useRouter();
  const { signUp, loading, error, clearError } = useAuth();
  const dbUnavailable = !isSupabaseConfigured;

  const [email, setEmail] = useState("");
  const [isSuccessful, _setIsSuccessful] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailStatus, setEmailStatus] = useState<SignUpEmailStatus>("sent");
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Tick down the resend cooldown so the button re-enables itself.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!email || isResending || resendCooldown > 0) return;
    setIsResending(true);
    try {
      const result = await resendSignupEmail(email);
      setEmailStatus(result.emailStatus);
      if (result.error) {
        toast({
          type: "error",
          description:
            result.emailStatus === "rate_limited"
              ? "Email service is rate-limited. Wait a minute and try again."
              : `Couldn't resend: ${result.error.message}`,
        });
      } else {
        toast({
          type: "success",
          description: "Verification email re-sent. Check your inbox and spam folder.",
        });
        setResendCooldown(30);
      }
    } finally {
      setIsResending(false);
    }
  };

  // Handle auth errors
  useEffect(() => {
    if (error) {
      // Map Supabase errors to user-friendly messages
      let errorMessage = "Failed to create account!";
      let errorCategory = ErrorCategory.REGISTRATION_FAILED;
      let severity = ErrorSeverity.ERROR;

      if (
        error.includes("already registered") ||
        error.includes("already exists")
      ) {
        errorMessage = "Account already exists!";
        errorCategory = ErrorCategory.REGISTRATION_FAILED;
        severity = ErrorSeverity.WARNING;
      } else if (error.includes("password")) {
        errorMessage = "Password must be at least 6 characters long!";
        errorCategory = ErrorCategory.VALIDATION_ERROR;
        severity = ErrorSeverity.WARNING;
      } else if (error.includes("email")) {
        errorMessage = "Please enter a valid email address!";
        errorCategory = ErrorCategory.VALIDATION_ERROR;
        severity = ErrorSeverity.WARNING;
      } else if (error.includes("weak password")) {
        errorMessage =
          "Password is too weak. Please choose a stronger password!";
        errorCategory = ErrorCategory.VALIDATION_ERROR;
        severity = ErrorSeverity.WARNING;
      } else if (error.includes("rate limit")) {
        errorMessage = "Too many attempts. Please try again later!";
        errorCategory = ErrorCategory.API_RATE_LIMIT;
        severity = ErrorSeverity.WARNING;
      }

      // Log the error
      logAuthError(
        errorCategory,
        `Registration failed: ${error}`,
        {
          email,
          userMessage: errorMessage,
          originalError: error,
          timestamp: new Date().toISOString(),
        },
        undefined, // No user_id yet since registration failed
        severity
      );

      toast({ type: "error", description: errorMessage });
      setIsSubmitting(false);
    }
  }, [error, email]);

  const handleSubmit = async (formData: FormData) => {
    const emailValue = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Basic validation
    if (!emailValue || !password) {
      toast({
        type: "error",
        description: "Please fill in all fields!",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        type: "error",
        description: "Password must be at least 6 characters long!",
      });
      return;
    }

    setEmail(emailValue);
    setIsSubmitting(true);
    clearError();

    try {
      // Sign up with Supabase Auth with default user role
      const status = await signUp(emailValue, password, {
        role: "user",
        isActive: true,
        settings: {
          theme: "system",
          notifications: true,
        },
      });

      setEmailStatus(status);
      setShowEmailVerification(true);
      setIsSubmitting(false);

      if (status === "sent") {
        toast({
          type: "success",
          description:
            "Verification email sent. Check your inbox to complete registration.",
        });
      } else if (status === "already_registered") {
        toast({
          type: "error",
          description: "This email is already registered. Try signing in instead.",
        });
      } else if (status === "rate_limited") {
        toast({
          type: "error",
          description:
            "Email service is rate-limited. Your account exists — see remediation steps below.",
        });
      } else if (status === "smtp_failed") {
        toast({
          type: "error",
          description:
            "Verification email could not be sent due to a server email-config issue.",
        });
      }

      // The auth state change will be handled by the context
    } catch (err) {
      // Log unexpected errors
      const errorMessage =
        err instanceof Error ? err.message : "Unknown registration error";

      logAuthError(
        ErrorCategory.REGISTRATION_FAILED,
        `Unexpected registration error: ${errorMessage}`,
        {
          email: emailValue,
          error: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString(),
        },
        undefined,
        ErrorSeverity.ERROR
      );

      console.error("Registration error:", err);

      // Route email-delivery failures to the verification screen so the user
      // sees remediation steps instead of just a generic toast. The auth-error
      // useEffect will still show its toast, which is fine.
      const lower = errorMessage.toLowerCase();
      if (
        lower.includes("rate limit") ||
        lower.includes("too many") ||
        lower.includes("over_email_send_rate_limit")
      ) {
        setEmailStatus("rate_limited");
        setShowEmailVerification(true);
        setIsSubmitting(false);
      } else if (
        lower.includes("smtp") ||
        lower.includes("send email") ||
        lower.includes("email send") ||
        lower.includes("sending confirmation") ||
        lower.includes("email_send_failed")
      ) {
        setEmailStatus("smtp_failed");
        setShowEmailVerification(true);
        setIsSubmitting(false);
      }
    }
  };

  // Show email verification message if needed
  if (showEmailVerification) {
    const isSent = emailStatus === "sent";
    const isAlreadyRegistered = emailStatus === "already_registered";
    const isRateLimited = emailStatus === "rate_limited";
    const isSmtpFailed = emailStatus === "smtp_failed";
    const isProblem = !isSent;
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    const localOrigin =
      typeof window !== "undefined" ? window.location.origin : "";

    const iconWrapClass = isProblem
      ? "flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40"
      : "flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900";
    const iconClass = isProblem
      ? "h-8 w-8 text-amber-600 dark:text-amber-400"
      : "h-8 w-8 text-green-600 dark:text-green-400";

    let heading = "Check Your Email";
    let body: React.ReactNode = (
      <>
        We've sent a verification link to <strong>{email}</strong>. Please
        check your email and click the link to complete your registration.
      </>
    );
    if (isAlreadyRegistered) {
      heading = "Email Already Registered";
      body = (
        <>
          <strong>{email}</strong> is already linked to an account, so no
          verification email was sent. Sign in instead, or use password
          recovery if you've forgotten your password.
        </>
      );
    } else if (isRateLimited) {
      heading = "Email Service Rate-Limited";
      body = (
        <>
          Your account for <strong>{email}</strong> was created, but the
          verification email couldn't be sent right now because the email
          service is rate-limited. Wait a minute and click <em>Resend</em>, or
          see the fix below.
        </>
      );
    } else if (isSmtpFailed) {
      heading = "Verification Email Failed";
      body = (
        <>
          Your account for <strong>{email}</strong> was created, but the
          verification email couldn't be sent due to a server email-config
          issue. Try <em>Resend</em>, or see the admin fix below.
        </>
      );
    }

    return (
      <div className="flex min-h-full w-full items-start justify-center bg-background pt-12 md:items-center md:pt-0">
        <div className="flex w-full max-w-md flex-col gap-6 overflow-hidden rounded-2xl">
          <div className="flex flex-col items-center justify-center gap-4 px-4 text-center sm:px-16">
            <div className={iconWrapClass}>
              <svg
                className={iconClass}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isProblem ? (
                  <path
                    d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                ) : (
                  <path
                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                )}
              </svg>
            </div>
            <h3 className="font-semibold text-xl dark:text-zinc-50">{heading}</h3>
            <p className="text-gray-500 text-sm dark:text-zinc-400">{body}</p>
            {isSent && (
              <p className="text-gray-400 text-xs dark:text-zinc-500">
                Didn't get it? Check your spam folder, or click Resend below.
              </p>
            )}
          </div>

          {(isRateLimited || isSmtpFailed) && (
            <div className="mx-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:mx-16">
              <p className="mb-1 font-semibold">How to fix this</p>
              {isRateLimited ? (
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    Wait 60 seconds and click <em>Resend verification email</em>.
                  </li>
                  <li>
                    Admin: Supabase's default SMTP allows only a few emails per
                    hour. Configure a custom SMTP provider at{" "}
                    <strong>Supabase Dashboard → Project Settings → Auth → SMTP Settings</strong>.
                  </li>
                </ul>
              ) : (
                <ul className="list-disc space-y-1 pl-4">
                  <li>Click <em>Resend verification email</em> to retry.</li>
                  <li>
                    Admin: verify SMTP credentials in{" "}
                    <strong>Supabase Dashboard → Project Settings → Auth → SMTP Settings</strong>{" "}
                    and confirm the sender domain is verified.
                  </li>
                  <li>
                    Vercel deployments: ensure SMTP env vars are set in{" "}
                    <strong>Vercel → Project → Settings → Environment Variables</strong>{" "}
                    and redeploy.
                  </li>
                </ul>
              )}
            </div>
          )}

          {isAlreadyRegistered && (
            <div className="mx-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:mx-16">
              <p className="mb-1 font-semibold">What to do next</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <Link className="underline font-medium" href="/login">
                    Sign in
                  </Link>{" "}
                  with your existing password.
                </li>
                <li>
                  Forgot your password? Use the password reset link on the
                  sign-in page.
                </li>
              </ul>
            </div>
          )}

          {isLocalhost && !isAlreadyRegistered && (
            <div className="mx-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 text-xs dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 sm:mx-16">
              <p className="mb-1 font-semibold">
                Local development ({localOrigin})
              </p>
              <p className="mb-2">
                The verification link will redirect to{" "}
                <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900/60">
                  {localOrigin}
                </code>
                . If clicking the link sends you to production instead, add{" "}
                <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900/60">
                  {localOrigin}/**
                </code>{" "}
                to <strong>Supabase → Authentication → URL Configuration → Redirect URLs</strong>.
              </p>
              <p className="mb-1 font-semibold">Faster paths for development</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Manually confirm the user: <strong>Supabase → Authentication → Users</strong>,
                  find <strong>{email}</strong>, click the row menu →{" "}
                  <em>Confirm email</em>. Then sign in normally.
                </li>
                <li>
                  Or skip email verification entirely for dev:{" "}
                  <strong>Supabase → Authentication → Providers → Email</strong>{" "}
                  and toggle off <em>Confirm email</em>.
                </li>
                {(isRateLimited || isSmtpFailed) && (
                  <li>
                    Self-hosted Supabase usually ships with Inbucket at{" "}
                    <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900/60">
                      http://localhost:54324
                    </code>{" "}
                    — check there for the captured email.
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 px-4 sm:px-16">
            {!isAlreadyRegistered && (
              <button
                type="button"
                disabled={isResending || resendCooldown > 0}
                onClick={handleResend}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {isResending
                  ? "Resending..."
                  : resendCooldown > 0
                    ? `Resend verification email (${resendCooldown}s)`
                    : "Resend verification email"}
              </button>
            )}
            <button
              type="button"
              className="w-full rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 text-sm hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              onClick={() => {
                setShowEmailVerification(false);
                setEmail("");
                setEmailStatus("sent");
                setResendCooldown(0);
                clearError();
              }}
            >
              {isAlreadyRegistered ? "Use a different email" : "Try Again"}
            </button>
            <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
              {"Already have an account? "}
              <Link
                className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
                href="/login"
              >
                Sign in
              </Link>
              {" instead."}
            </p>
          </div>
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
            <h3 className="font-semibold text-xl dark:text-zinc-50">Sign Up</h3>
            <p className="text-gray-500 text-sm dark:text-zinc-400">
              Create an account with your email and password
            </p>
          </div>
          <div className={dbUnavailable ? "pointer-events-none select-none opacity-40" : ""}>
            <AuthForm action={handleSubmit} defaultEmail={email}>
              <SubmitButton
                disabled={isSubmitting || loading || dbUnavailable}
                isSuccessful={isSuccessful}
              >
                {isSubmitting || loading ? "Creating Account..." : "Sign Up"}
              </SubmitButton>
              <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
                {"Already have an account? "}
                <Link
                  className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
                  href="/login"
                >
                  Sign in
                </Link>
                {" instead."}
              </p>
            </AuthForm>
          </div>
        </div>
      </div>
    </div>
  );
}
