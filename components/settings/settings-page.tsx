"use client";

import { ArrowLeft, Database, ExternalLink, GitBranch, Key, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNetworkRetry, useNetworkStatus } from "@/hooks/use-network-status";
import { useToastNotifications } from "@/hooks/use-toast-notifications";
import { storage } from "@/lib/storage/helpers";
import { cn } from "@/lib/utils";
import { SettingsErrorBoundary, useErrorHandler } from "./error-boundary";
import {
  ComponentLoading,
  ConnectedState,
  NetworkState,
  SettingsErrorState,
  SettingsLoadingState,
} from "./fallback-states";
import { GitHubIntegrationSection } from "./github-integration-section";
import { SettingsEnhancements } from "./settings-enhancements";
import { StorageManagementSection } from "./storage-management-section";
import { ToastNotifications } from "./toast-notifications";

type SettingsPageProps = {
  className?: string;
};

export function SettingsPage({ className }: SettingsPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("api-keys");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConnectedState, setShowConnectedState] = useState(false);
  const [serverKeyCount, setServerKeyCount] = useState<number | null>(null);

  const { isOnline, isSlowConnection } = useNetworkStatus();
  const handleError = useErrorHandler();
  const toast = useToastNotifications();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case "1": event.preventDefault(); setActiveTab("api-keys"); break;
        case "2": event.preventDefault(); setActiveTab("integrations"); break;
        case "3": event.preventDefault(); setActiveTab("storage"); break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const initializeSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await storage.general.initCrypto();
      const healthCheck = storage.general.checkHealth();
      if (!healthCheck.healthy) {
        console.warn("Storage health issues detected:", healthCheck.errors);
      }
      try {
        const res = await fetch("/api/server-keys");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.env_keys_present || []);
          setServerKeyCount(list.length);
        }
      } catch {
        // Server keys endpoint unavailable — ignore
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load settings";
      setError(errorMessage);
      handleError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  useNetworkRetry(
    useCallback(() => {
      if (error) {
        setShowConnectedState(true);
        toast.success("Connection restored", "Reloading settings...");
        initializeSettings();
        setTimeout(() => setShowConnectedState(false), 3000);
      }
    }, [error, initializeSettings, toast])
  );

  const storageSummary = storage.general.getSummary();
  const browserKeyCount = storageSummary.apiKeys.count;

  if (isLoading) {
    return <SettingsLoadingState className={className} />;
  }

  if (error) {
    return (
      <SettingsErrorState
        className={className}
        error={error}
        onReload={() => window.location.reload()}
        onRetry={initializeSettings}
      />
    );
  }

  return (
    <SettingsErrorBoundary>
      <NetworkState isOnline={isOnline} onRetry={initializeSettings} />
      {showConnectedState && <ConnectedState />}

      {isOnline && isSlowConnection && (
        <div className="fixed top-4 left-4 z-50">
          <Card className="w-80 border-yellow-200 bg-yellow-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm text-yellow-800">
                <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                Slow connection detected. Some features may be slower.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className={cn("container mx-auto px-4 py-4 sm:py-8", className)}>
        <div className="mx-auto max-w-4xl">
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <Button
                  aria-label="Back to chat"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  onClick={() => router.push("/chat")}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Chat</span>
                </Button>
                <Settings
                  aria-hidden="true"
                  className="h-6 w-6 text-blue-600 sm:h-8 sm:w-8"
                />
              </div>
              <div>
                <h1 className="font-bold text-2xl text-gray-900 sm:text-3xl dark:text-white">
                  Settings
                </h1>
                <p className="mt-1 text-gray-600 text-sm sm:text-base dark:text-gray-400">
                  Manage your API keys and integrations. All data is stored
                  locally in your browser.
                </p>
              </div>
            </div>

            {storageSummary.totalItems > 0 ? (
              <SettingsEnhancements />
            ) : (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-400" />
                      <div className="min-w-0">
                        <div className="font-medium text-blue-900 text-sm dark:text-blue-100">
                          No Configuration
                        </div>
                        <div className="text-blue-700 text-xs dark:text-blue-300">
                          Add your API keys and integrations to get started
                        </div>
                      </div>
                    </div>
                    <Badge
                      className="self-start border-blue-300 bg-blue-100 text-blue-800 text-xs sm:self-center dark:border-blue-600 dark:bg-blue-800 dark:text-blue-100"
                      variant="outline"
                    >
                      Local Storage
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <Tabs
            className="space-y-6"
            onValueChange={setActiveTab}
            value={activeTab}
          >
            {/* Tab Navigation */}
            <Card>
              <CardContent className="p-3 sm:p-6">
                <TabsList
                  aria-label="Settings navigation"
                  className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:gap-2"
                  role="tablist"
                >
                  <TabsTrigger
                    aria-controls="api-keys-panel"
                    aria-selected={activeTab === "api-keys"}
                    className="flex h-auto flex-col items-center gap-1 p-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 sm:gap-2 sm:p-4 dark:data-[state=active]:bg-blue-900/20 dark:data-[state=active]:text-blue-300"
                    role="tab"
                    title="API Keys (Ctrl+1 or Cmd+1)"
                    value="api-keys"
                  >
                    <Key aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
                    <div className="text-center">
                      <div className="font-medium text-xs sm:text-sm">API Keys</div>
                      <div className="mt-1 hidden text-gray-500 text-xs sm:block dark:text-gray-400">
                        Configure AI provider credentials
                      </div>
                      {browserKeyCount > 0 && (
                        <Badge className="mt-1 text-xs" variant="secondary">
                          {browserKeyCount}
                        </Badge>
                      )}
                    </div>
                  </TabsTrigger>

                  <TabsTrigger
                    aria-controls="integrations-panel"
                    aria-selected={activeTab === "integrations"}
                    className="flex h-auto flex-col items-center gap-1 p-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 sm:gap-2 sm:p-4 dark:data-[state=active]:bg-blue-900/20 dark:data-[state=active]:text-blue-300"
                    role="tab"
                    title="Integrations (Ctrl+2 or Cmd+2)"
                    value="integrations"
                  >
                    <GitBranch
                      aria-hidden="true"
                      className="h-4 w-4 sm:h-5 sm:w-5"
                    />
                    <div className="text-center">
                      <div className="font-medium text-xs sm:text-sm">Integrations</div>
                      <div className="mt-1 hidden text-gray-500 text-xs sm:block dark:text-gray-400">
                        Connect external services
                      </div>
                      {storageSummary.integrations.github && (
                        <Badge className="mt-1 text-xs" variant="secondary">
                          GitHub
                        </Badge>
                      )}
                    </div>
                  </TabsTrigger>

                  <TabsTrigger
                    aria-controls="storage-panel"
                    aria-selected={activeTab === "storage"}
                    className="flex h-auto flex-col items-center gap-1 p-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 sm:gap-2 sm:p-4 dark:data-[state=active]:bg-blue-900/20 dark:data-[state=active]:text-blue-300"
                    role="tab"
                    title="Storage (Ctrl+3 or Cmd+3)"
                    value="storage"
                  >
                    <Database
                      aria-hidden="true"
                      className="h-4 w-4 sm:h-5 sm:w-5"
                    />
                    <div className="text-center">
                      <div className="font-medium text-xs sm:text-sm">Storage</div>
                      <div className="mt-1 hidden text-gray-500 text-xs sm:block dark:text-gray-400">
                        Manage storage settings
                      </div>
                    </div>
                  </TabsTrigger>
                </TabsList>

                <div className="mt-4 hidden text-center text-gray-500 text-xs sm:block dark:text-gray-400">
                  Use{" "}
                  <kbd className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">Ctrl+1</kbd>,
                  <kbd className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">Ctrl+2</kbd>,
                  <kbd className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">Ctrl+3</kbd>{" "}
                  to navigate tabs
                </div>
              </CardContent>
            </Card>

            {/* API Keys Tab — summary + link to /keys */}
            <TabsContent
              aria-labelledby="api-keys-tab"
              className="space-y-6"
              id="api-keys-panel"
              role="tabpanel"
              value="api-keys"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key aria-hidden="true" className="h-5 w-5" />
                    API Keys
                  </CardTitle>
                  <CardDescription>
                    Keys are stored encrypted in your browser. Use the Keys page
                    to add, remove, or paste multiple keys at once.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-4 sm:p-6">
                  {/* Key count summary */}
                  <div className="flex flex-wrap gap-8">
                    <div className="flex flex-col">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {browserKeyCount}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        keys saved in browser
                      </span>
                    </div>
                    {serverKeyCount !== null && (
                      <div className="flex flex-col">
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                          {serverKeyCount}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          keys from server .env
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Add or manage keys, paste from a{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        .env
                      </code>{" "}
                      file, and control copy visibility on the Keys page.
                    </p>
                    <Button asChild className="w-full sm:w-auto" variant="default">
                      <a className="flex items-center gap-2" href="/keys">
                        <ExternalLink className="h-4 w-4" />
                        Manage API Keys
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent
              aria-labelledby="integrations-tab"
              className="space-y-6"
              id="integrations-panel"
              role="tabpanel"
              value="integrations"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch aria-hidden="true" className="h-5 w-5" />
                    Integrations
                  </CardTitle>
                  <CardDescription>
                    Connect external services to enhance your workflow.
                    Integration data is stored locally for security.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4 dark:border-blue-800 dark:bg-blue-900/20">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 sm:h-5 sm:w-5 dark:text-blue-400">
                        🔗
                      </div>
                      <div className="min-w-0 text-xs sm:text-sm">
                        <div className="mb-1 font-medium text-blue-900 dark:text-blue-100">
                          Local Integration Storage
                        </div>
                        <div className="text-blue-700 dark:text-blue-300">
                          Integration tokens and data are stored locally in your
                          browser for security. You maintain full control over
                          your credentials.
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <GitHubIntegrationSection />
                    </SettingsErrorBoundary>
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Storage Management Tab */}
            <TabsContent
              aria-labelledby="storage-tab"
              className="space-y-6"
              id="storage-panel"
              role="tabpanel"
              value="storage"
            >
              <Suspense fallback={<ComponentLoading />}>
                <SettingsErrorBoundary>
                  <StorageManagementSection />
                </SettingsErrorBoundary>
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ToastNotifications
        notifications={toast.notifications}
        onRemove={toast.removeNotification}
      />
    </SettingsErrorBoundary>
  );
}
