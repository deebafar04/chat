"use client";

import { useState } from "react";
import {
  CheckedSquare,
  CrossIcon,
  EyeIcon,
  LoaderIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { APIProvider } from "@/lib/storage/types";
import type { VerificationResult } from "@/lib/verification/types";

type APIKeySectionProps = {
  provider: APIProvider;
  title: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onVerify?: (key: string) => Promise<VerificationResult>;
  className?: string;
};

export function APIKeySection({
  provider,
  title,
  description,
  placeholder,
  value,
  onChange,
  onVerify,
  className,
}: APIKeySectionProps) {
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!value.trim() || !onVerify) {
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const result = await onVerify(value.trim());
      setVerificationResult(result);
    } catch (error) {
      console.error(`${provider} API key verification error:`, error);

      let errorMessage = "Verification failed";
      if (error instanceof Error) {
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }

      setVerificationResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRetry = () => {
    setVerificationResult(null);
    handleVerify();
  };

  const getStatusIcon = () => {
    if (isVerifying) {
      return (
        <span className="animate-spin text-muted-foreground">
          <LoaderIcon size={16} />
        </span>
      );
    }

    if (verificationResult?.success) {
      return (
        <span className="text-green-600">
          <CheckedSquare size={16} />
        </span>
      );
    }

    if (verificationResult && !verificationResult.success) {
      return (
        <span className="text-red-600">
          <CrossIcon size={16} />
        </span>
      );
    }

    return null;
  };

  const getStatusMessage = () => {
    if (isVerifying) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span className="animate-spin">
            <LoaderIcon size={14} />
          </span>
          Verifying API key...
        </div>
      );
    }

    if (verificationResult?.success) {
      return (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckedSquare size={14} />
          <span>API key verified successfully</span>
          {verificationResult.details && (
            <span className="text-muted-foreground text-xs">
              ({verificationResult.details.model || "Connected"})
            </span>
          )}
        </div>
      );
    }

    if (verificationResult && !verificationResult.success) {
      return (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-red-600 text-sm">
            <span className="mt-0.5 flex-shrink-0">
              <CrossIcon size={14} />
            </span>
            <div className="space-y-1">
              <div>{verificationResult.error || "Verification failed"}</div>
              {verificationResult.error?.includes("rate limit") && (
                <div className="text-muted-foreground text-xs">
                  Please wait a moment before trying again.
                </div>
              )}
              {verificationResult.error?.includes("network") && (
                <div className="text-muted-foreground text-xs">
                  Check your internet connection and try again.
                </div>
              )}
            </div>
          </div>
          <Button
            className="h-8 text-xs"
            disabled={isVerifying}
            onClick={handleRetry}
            size="sm"
            variant="outline"
          >
            Retry Verification
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor={`${provider}-api-key`}>API Key</Label>
          <div className="relative">
            <Input
              aria-describedby={`${provider}-api-key-description ${provider}-api-key-status`}
              aria-invalid={
                verificationResult && !verificationResult.success
                  ? "true"
                  : "false"
              }
              className={cn(
                "pr-16 text-sm transition-colors sm:pr-24",
                verificationResult?.success &&
                  "border-green-200 focus-visible:ring-green-500",
                verificationResult &&
                  !verificationResult.success &&
                  "border-red-200 focus-visible:ring-red-500"
              )}
              disabled={isVerifying}
              id={`${provider}-api-key`}
              onChange={(e) => {
                onChange(e.target.value);
                // Clear verification result when user changes the key
                if (verificationResult) {
                  setVerificationResult(null);
                }
              }}
              placeholder={placeholder}
              type={showKey ? "text" : "password"}
              value={value}
            />
            <div className="-translate-y-1/2 absolute top-1/2 right-1 flex items-center gap-0.5 sm:right-2 sm:gap-1">
              {getStatusIcon()}
              {value && (
                <Button
                  aria-label={`Clear ${title} API key`}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground sm:h-6 sm:w-6"
                  disabled={isVerifying}
                  onClick={() => {
                    onChange("");
                    setVerificationResult(null);
                  }}
                  size="icon"
                  tabIndex={0}
                  type="button"
                  variant="ghost"
                >
                  <CrossIcon size={10} />
                </Button>
              )}
              <Button
                aria-label={
                  showKey ? `Hide ${title} API key` : `Show ${title} API key`
                }
                aria-pressed={showKey}
                className="h-5 w-5 text-muted-foreground hover:text-foreground sm:h-6 sm:w-6"
                disabled={isVerifying}
                onClick={() => setShowKey(!showKey)}
                size="icon"
                tabIndex={0}
                type="button"
                variant="ghost"
              >
                <span
                  className={cn(
                    "transition-opacity",
                    showKey ? "opacity-100" : "opacity-50"
                  )}
                >
                  <EyeIcon size={12} />
                </span>
              </Button>
            </div>
          </div>
          <div className="sr-only" id={`${provider}-api-key-description`}>
            {description}
          </div>
        </div>

        {onVerify && <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <Button
            aria-describedby={`${provider}-verify-help`}
            className={cn(
              "w-full transition-all duration-200 sm:w-auto",
              isVerifying && "cursor-not-allowed",
              verificationResult?.success &&
                "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
              verificationResult &&
                !verificationResult.success &&
                "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            )}
            disabled={!value.trim() || isVerifying}
            onClick={handleVerify}
            size="sm"
            variant="outline"
          >
            {isVerifying ? (
              <>
                <span aria-hidden="true" className="mr-2 animate-spin">
                  <LoaderIcon size={14} />
                </span>
                Verifying...
              </>
            ) : verificationResult?.success ? (
              <>
                <span aria-hidden="true" className="mr-2">
                  <CheckedSquare size={14} />
                </span>
                Verified
              </>
            ) : (
              <>
                <span className="sm:hidden">Verify</span>
                <span className="hidden sm:inline">Verify {title} API Key</span>
              </>
            )}
          </Button>

          {value.trim() && !isVerifying && !verificationResult && (
            <div
              className="text-center text-muted-foreground text-xs sm:text-left"
              id={`${provider}-verify-help`}
            >
              Click verify to test your API key
            </div>
          )}
        </div>}

        <div aria-live="polite" id={`${provider}-api-key-status`} role="status">
          {getStatusMessage()}
        </div>
      </CardContent>
    </Card>
  );
}
