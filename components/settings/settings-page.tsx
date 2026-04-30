"use client";

import { ArrowLeft, Database, GitBranch, Key, Settings } from "lucide-react";
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
import { AnthropicVerificationService } from "@/lib/verification/anthropic-verification-service";
import { GoogleVerificationService } from "@/lib/verification/google-verification-service";
import { OpenAIVerificationService } from "@/lib/verification/openai-verification-service";
import { APIKeySection } from "./api-key-section";
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

  // API Key states
  const [googleKey, setGoogleKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [xaiKey, setXaiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [mistralKey, setMistralKey] = useState("");
  const [perplexityKey, setPerplexityKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [togetherKey, setTogetherKey] = useState("");
  const [fireworksKey, setFireworksKey] = useState("");

  // Export window state (1-hour window after last key edit)
  const [exportWindowOpen, setExportWindowOpen] = useState(false);
  const [exportEnvText, setExportEnvText] = useState<string | null>(null);

  // Verification services
  const googleService = new GoogleVerificationService();
  const anthropicService = new AnthropicVerificationService();
  const openaiService = new OpenAIVerificationService();

  // Network status and error handling
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const handleError = useErrorHandler();
  const toast = useToastNotifications();

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Handle keyboard shortcuts for tab navigation
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case "1":
          event.preventDefault();
          setActiveTab("api-keys");
          break;
        case "2":
          event.preventDefault();
          setActiveTab("integrations");
          break;
        case "3":
          event.preventDefault();
          setActiveTab("storage");
          break;
      }
    }
  }, []);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Initialize settings data
  const initializeSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Simulate a small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Decrypt all stored keys into the in-memory cache before reading them.
      await storage.general.initCrypto();

      // Check whether the 1-hour export window is still open.
      setExportWindowOpen(storage.general.isExportWindowOpen());

      // Load existing API keys
      const existingGoogleKey = storage.apiKeys.get("google");
      const existingAnthropicKey = storage.apiKeys.get("anthropic");
      const existingOpenaiKey = storage.apiKeys.get("openai");
      const existingXaiKey = storage.apiKeys.get("xai");
      const existingGroqKey = storage.apiKeys.get("groq");
      const existingMistralKey = storage.apiKeys.get("mistral");
      const existingPerplexityKey = storage.apiKeys.get("perplexity");
      const existingDeepseekKey = storage.apiKeys.get("deepseek");
      const existingTogetherKey = storage.apiKeys.get("together");
      const existingFireworksKey = storage.apiKeys.get("fireworks");

      if (existingGoogleKey) setGoogleKey(existingGoogleKey);
      if (existingAnthropicKey) setAnthropicKey(existingAnthropicKey);
      if (existingOpenaiKey) setOpenaiKey(existingOpenaiKey);
      if (existingXaiKey) setXaiKey(existingXaiKey);
      if (existingGroqKey) setGroqKey(existingGroqKey);
      if (existingMistralKey) setMistralKey(existingMistralKey);
      if (existingPerplexityKey) setPerplexityKey(existingPerplexityKey);
      if (existingDeepseekKey) setDeepseekKey(existingDeepseekKey);
      if (existingTogetherKey) setTogetherKey(existingTogetherKey);
      if (existingFireworksKey) setFireworksKey(existingFireworksKey);

      // Check storage health
      const healthCheck = storage.general.checkHealth();
      if (!healthCheck.healthy) {
        console.warn("Storage health issues detected:", healthCheck.errors);
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

  // Load existing API keys on mount
  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  // Export window: generate .env text from decrypted keys in memory
  const handleExportEnv = useCallback(() => {
    const ENV_NAMES: Record<string, string> = {
      google: "GOOGLE_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      xai: "XAI_API_KEY",
      groq: "GROQ_API_KEY",
      together: "TOGETHER_API_KEY",
      fireworks: "FIREWORKS_API_KEY",
      mistral: "MISTRAL_API_KEY",
      perplexity: "PERPLEXITY_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      discord: "DISCORD_BOT_TOKEN",
    };
    const keys = storage.general.getDecryptedKeysForExport();
    const lines = Object.entries(keys)
      .filter(([, v]) => !!v)
      .map(([provider, value]) => `${ENV_NAMES[provider] || provider.toUpperCase() + "_API_KEY"}=${value}`);
    setExportEnvText(lines.length > 0 ? lines.join("\n") : "(no keys saved)");
  }, []);

  const handleEncryptNow = useCallback(() => {
    storage.general.closeExportWindow();
    setExportWindowOpen(false);
    setExportEnvText(null);
    toast.success("Keys locked", "Export window closed. Keys are encrypted.");
  }, [toast]);

  // Handle network reconnection
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

  // API Key handlers with error handling
  const handleGoogleKeyChange = useCallback(
    (value: string) => {
      try {
        setGoogleKey(value);
        if (value.trim()) {
          storage.apiKeys.set("google", value);
          toast.success(
            "Google API key saved",
            "Your API key has been stored locally."
          );
        } else {
          storage.apiKeys.remove("google");
          toast.info(
            "Google API key removed",
            "Your API key has been cleared."
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save Google API key";
        toast.error("Failed to save API key", errorMessage);
        handleError(err instanceof Error ? err : new Error(errorMessage));
      }
    },
    [handleError, toast]
  );

  const handleAnthropicKeyChange = useCallback(
    (value: string) => {
      try {
        setAnthropicKey(value);
        if (value.trim()) {
          storage.apiKeys.set("anthropic", value);
          toast.success(
            "Anthropic API key saved",
            "Your API key has been stored locally."
          );
        } else {
          storage.apiKeys.remove("anthropic");
          toast.info(
            "Anthropic API key removed",
            "Your API key has been cleared."
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to save Anthropic API key";
        toast.error("Failed to save API key", errorMessage);
        handleError(err instanceof Error ? err : new Error(errorMessage));
      }
    },
    [handleError, toast]
  );

  const handleOpenaiKeyChange = useCallback(
    (value: string) => {
      try {
        setOpenaiKey(value);
        if (value.trim()) {
          storage.apiKeys.set("openai", value);
          toast.success(
            "OpenAI API key saved",
            "Your API key has been stored locally."
          );
        } else {
          storage.apiKeys.remove("openai");
          toast.info(
            "OpenAI API key removed",
            "Your API key has been cleared."
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save OpenAI API key";
        toast.error("Failed to save API key", errorMessage);
        handleError(err instanceof Error ? err : new Error(errorMessage));
      }
    },
    [handleError, toast]
  );

  const handleXaiKeyChange = useCallback((value: string) => {
    try { setXaiKey(value); value.trim() ? storage.apiKeys.set("xai", value) : storage.apiKeys.remove("xai"); }
    catch (err) { handleError(err instanceof Error ? err : new Error(String(err))); }
  }, [handleError]);

  const handleGroqKeyChange = useCallback((value: string) => {
    try { setGroqKey(value); value.trim() ? storage.apiKeys.set("groq", value) : storage.apiKeys.remove("groq"); }
    catch (err) { handleError(err instanceof Error ? err : new Error(String(err))); }
  }, [handleError]);

  const handleMistralKeyChange = useCallback((value: string) => {
    try { setMistralKey(value); value.trim() ? storage.apiKeys.set("mistral", value) : storage.apiKeys.remove("mistral"); }
    catch (err) { handleError(err instanceof Error ? err : new Error(String(err))); }
  }, [handleError]);

  const handlePerplexityKeyChange = useCallback((value: string) => {
    try { setPerplexityKey(value); value.trim() ? storage.apiKeys.set("perplexity", value) : storage.apiKeys.remove("perplexity"); }
    catch (err) { handleError(err instanceof Error ? err : new Error(String(err))); }
  }, [handleError]);

  const handleDeepseekKeyChange = useCallback((value: string) => {
    try { setDeepseekKey(value); value.trim() ? storage.apiKeys.set("deepseek", value) : storage.apiKeys.remove("deepseek"); }
    catch (err) { handleError(err instanceof Error ? err : new Error(String(err))); }
  }, [handleError]);

  const handleTogetherKeyChange = useCallback((value: string) => {
    try { setTogetherKey(value); value.trim() ? storage.apiKeys.set("together", value) : storage.apiKeys.remove("together"); }
    catch (err) { handleError(err instanceof Error ? err : new Error(String(err))); }
  }, [handleError]);

  const handleFireworksKeyChange = useCallback((value: string) => {
    try { setFireworksKey(value); value.trim() ? storage.apiKeys.set("fireworks", value) : storage.apiKeys.remove("fireworks"); }
    catch (err) { handleError(err instanceof Error ? err : new Error(String(err))); }
  }, [handleError]);

  // Get storage summary for display
  const storageSummary = storage.general.getSummary();

  // Show loading state
  if (isLoading) {
    return <SettingsLoadingState className={className} />;
  }

  // Show error state
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
      {/* Network Status Indicators */}
      <NetworkState isOnline={isOnline} onRetry={initializeSettings} />
      {showConnectedState && <ConnectedState />}

      {/* Slow Connection Warning */}
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

      {/* Main Content */}
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

            {/* Storage Summary and Enhancements */}
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
                      <div className="font-medium text-xs sm:text-sm">
                        API Keys
                      </div>
                      <div className="mt-1 hidden text-gray-500 text-xs sm:block dark:text-gray-400">
                        Configure AI provider credentials
                      </div>
                      {storageSummary.apiKeys.count > 0 && (
                        <Badge className="mt-1 text-xs" variant="secondary">
                          {storageSummary.apiKeys.count}
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
                      <div className="font-medium text-xs sm:text-sm">
                        Integrations
                      </div>
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
                      <div className="font-medium text-xs sm:text-sm">
                        Storage
                      </div>
                      <div className="mt-1 hidden text-gray-500 text-xs sm:block dark:text-gray-400">
                        Manage storage settings
                      </div>
                    </div>
                  </TabsTrigger>
                </TabsList>

                {/* Keyboard shortcuts help - hidden on mobile */}
                <div className="mt-4 hidden text-center text-gray-500 text-xs sm:block dark:text-gray-400">
                  <span className="sr-only">Keyboard shortcuts: </span>
                  Use{" "}
                  <kbd className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">
                    Ctrl+1
                  </kbd>
                  ,
                  <kbd className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">
                    Ctrl+2
                  </kbd>
                  ,
                  <kbd className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">
                    Ctrl+3
                  </kbd>{" "}
                  to navigate tabs
                </div>
              </CardContent>
            </Card>

            {/* API Keys Tab */}
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
                    Configure API keys for AI providers. Keys are stored locally
                    in your browser and never sent to our servers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
                  {/* Security Notice */}
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 sm:p-4 dark:border-green-800 dark:bg-green-900/20">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 sm:h-5 sm:w-5 dark:text-green-400">
                        🔒
                      </div>
                      <div className="min-w-0 text-xs sm:text-sm">
                        <div className="mb-1 font-medium text-green-900 dark:text-green-100">
                          Encrypted at Rest
                        </div>
                        <div className="text-green-700 dark:text-green-300 space-y-1">
                          <p>
                            Keys are encrypted with an AES-GCM key stored in
                            your browser&apos;s IndexedDB. That key is{" "}
                            <strong>non-extractable</strong> — JavaScript cannot
                            read its raw bytes, so the ciphertext in localStorage
                            is useless to any script or extension that can only
                            read storage.
                          </p>
                          <p>
                            When you send a message, the key is briefly decrypted
                            in memory and forwarded over HTTPS to the server,
                            which passes it directly to the AI provider. HTTPS
                            prevents network interception, but code already
                            running on this page could in theory read the key from
                            memory at that moment.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Export window — only shown within 1 hour of last key edit */}
                  {exportWindowOpen && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4 dark:border-amber-800 dark:bg-amber-900/20">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 sm:h-5 sm:w-5 dark:text-amber-400">
                            ℹ
                          </div>
                          <div className="min-w-0 text-xs sm:text-sm">
                            <div className="mb-1 font-medium text-amber-900 dark:text-amber-100">
                              Export Window Open (1 hour)
                            </div>
                            <div className="text-amber-700 dark:text-amber-300">
                              Your keys can be exported as a <code>.env</code> file
                              within one hour of the last edit. After that, only
                              re-entering a key reopens the window. Click{" "}
                              <strong>Encrypt Now</strong> to close it immediately.
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={handleExportEnv}
                            size="sm"
                            variant="outline"
                          >
                            Export as .env
                          </Button>
                          <Button
                            onClick={handleEncryptNow}
                            size="sm"
                            variant="default"
                          >
                            Encrypt Now
                          </Button>
                        </div>
                        {exportEnvText !== null && (
                          <textarea
                            className="w-full rounded border border-amber-300 bg-white p-2 font-mono text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                            readOnly
                            rows={Math.min(10, exportEnvText.split("\n").length + 1)}
                            style={{ filter: "blur(4px)" }}
                            title="Click to reveal"
                            value={exportEnvText}
                            onFocus={(e) => { (e.target as HTMLTextAreaElement).style.filter = "none"; }}
                            onBlur={(e) => { (e.target as HTMLTextAreaElement).style.filter = "blur(4px)"; }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Google AI API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your Google AI API key to use Gemini models"
                        onChange={handleGoogleKeyChange}
                        onVerify={googleService.verify.bind(googleService)}
                        placeholder="AIza..."
                        provider="google"
                        title="Google AI"
                        value={googleKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* Anthropic API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your Anthropic API key to use Claude models"
                        onChange={handleAnthropicKeyChange}
                        onVerify={anthropicService.verify.bind(
                          anthropicService
                        )}
                        placeholder="sk-ant-..."
                        provider="anthropic"
                        title="Anthropic"
                        value={anthropicKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* OpenAI API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your OpenAI API key to use GPT models"
                        onChange={handleOpenaiKeyChange}
                        onVerify={openaiService.verify.bind(openaiService)}
                        placeholder="sk-..."
                        provider="openai"
                        title="OpenAI"
                        value={openaiKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* xAI API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your xAI API key to use Grok models"
                        onChange={handleXaiKeyChange}
                        placeholder="xai-..."
                        provider="xai"
                        title="xAI"
                        value={xaiKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* Groq API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your Groq API key for fast open-source models"
                        onChange={handleGroqKeyChange}
                        placeholder="gsk_..."
                        provider="groq"
                        title="Groq"
                        value={groqKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* Mistral API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your Mistral API key to use Mistral models"
                        onChange={handleMistralKeyChange}
                        placeholder=""
                        provider="mistral"
                        title="Mistral"
                        value={mistralKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* Perplexity API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your Perplexity API key for online search models"
                        onChange={handlePerplexityKeyChange}
                        placeholder="pplx-..."
                        provider="perplexity"
                        title="Perplexity"
                        value={perplexityKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* DeepSeek API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your DeepSeek API key to use DeepSeek models"
                        onChange={handleDeepseekKeyChange}
                        placeholder=""
                        provider="deepseek"
                        title="DeepSeek"
                        value={deepseekKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* Together AI API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your Together AI API key for open-source models"
                        onChange={handleTogetherKeyChange}
                        placeholder=""
                        provider="together"
                        title="Together AI"
                        value={togetherKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>

                  {/* Fireworks API Key */}
                  <Suspense fallback={<ComponentLoading />}>
                    <SettingsErrorBoundary>
                      <APIKeySection
                        description="Configure your Fireworks AI API key for fast model inference"
                        onChange={handleFireworksKeyChange}
                        placeholder=""
                        provider="fireworks"
                        title="Fireworks AI"
                        value={fireworksKey}
                      />
                    </SettingsErrorBoundary>
                  </Suspense>
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
                  {/* Security Notice */}
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

                  {/* GitHub Integration */}
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

      {/* Toast Notifications */}
      <ToastNotifications
        notifications={toast.notifications}
        onRemove={toast.removeNotification}
      />
    </SettingsErrorBoundary>
  );
}
