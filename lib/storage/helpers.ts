/**
 * Storage helper functions for API keys and integrations
 */

import { localStorageManager } from "./local-storage-manager";
import type { APIProvider, StorageEvent } from "./types";

/**
 * API Key helpers
 */
export const apiKeyHelpers = {
  /**
   * Get API key for provider
   */
  get: (provider: APIProvider): string | null => {
    const apiKey = localStorageManager.getAPIKey(provider);
    console.log(`🔑 [DEBUG] Getting API key for ${provider}:`, {
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey?.substring(0, 10) || "none",
    });
    return apiKey;
  },

  /**
   * Set API key for provider
   */
  set: (provider: APIProvider, key: string): void => {
    if (!key.trim()) {
      throw new Error("API key cannot be empty");
    }
    localStorageManager.setAPIKey(provider, key.trim());
  },

  /**
   * Remove API key for provider
   */
  remove: (provider: APIProvider): void => {
    localStorageManager.removeAPIKey(provider);
  },

  /**
   * Check if API key exists for provider
   */
  exists: (provider: APIProvider): boolean => {
    return !!localStorageManager.getAPIKey(provider);
  },

  /**
   * Get all configured API keys (without values)
   */
  getConfiguredProviders: (): APIProvider[] => {
    const apiKeys = localStorageManager.getAllAPIKeys();
    return Object.keys(apiKeys).filter(
      (key) => !!apiKeys[key as APIProvider]
    ) as APIProvider[];
  },

  /**
   * Returns the raw "rsa:<base64>" blob for the provider if one exists in
   * localStorage, otherwise null.  Use when getAPIKey() returns null but you
   * need to send the key to the server for decryption.
   */
  getEncryptedBlob: (provider: APIProvider): string | null => {
    return localStorageManager.getEncryptedBlob(provider);
  },

  /**
   * Returns true if the provider has an RSA-encrypted key in localStorage.
   */
  hasServerEncryptedKey: (provider: APIProvider): boolean => {
    return localStorageManager.hasServerEncryptedKey(provider);
  },

  /**
   * Validate API key format (basic validation)
   */
  validateFormat: (
    provider: APIProvider,
    key: string
  ): { valid: boolean; error?: string } => {
    if (!key || !key.trim()) {
      return { valid: false, error: "API key is required" };
    }

    const trimmedKey = key.trim();

    switch (provider) {
      case "google":
        if (!trimmedKey.startsWith("AIza") || trimmedKey.length < 20) {
          return {
            valid: false,
            error:
              'Google API key should start with "AIza" and be at least 20 characters',
          };
        }
        break;
      case "anthropic":
        if (!trimmedKey.startsWith("sk-ant-") || trimmedKey.length < 20) {
          return {
            valid: false,
            error:
              'Anthropic API key should start with "sk-ant-" and be at least 20 characters',
          };
        }
        break;
      case "openai":
        if (!trimmedKey.startsWith("sk-") || trimmedKey.length < 20) {
          return {
            valid: false,
            error:
              'OpenAI API key should start with "sk-" and be at least 20 characters',
          };
        }
        break;
      case "pinecone":
      case "voyage":
        // No format prefix to enforce — accept any non-empty trimmed key.
        break;
      default:
        return { valid: false, error: "Unknown provider" };
    }

    return { valid: true };
  },
};

/**
 * GitHub integration helpers
 */
export const githubHelpers = {
  /**
   * Get GitHub PAT
   */
  getToken: (): string | null => {
    return localStorageManager.getGitHubPAT();
  },

  /**
   * Set GitHub PAT
   */
  setToken: (token: string): void => {
    if (!token.trim()) {
      throw new Error("GitHub token cannot be empty");
    }
    localStorageManager.setGitHubPAT(token.trim());
  },

  /**
   * Remove GitHub PAT
   */
  removeToken: (): void => {
    localStorageManager.removeGitHubPAT();
  },

  /**
   * Check if GitHub PAT exists
   */
  hasToken: (): boolean => {
    return !!localStorageManager.getGitHubPAT();
  },

  /**
   * Get full GitHub integration data
   */
  getIntegration: () => {
    return localStorageManager.getGitHubIntegration();
  },

  /**
   * Update GitHub integration data
   */
  updateIntegration: (
    data: Parameters<typeof localStorageManager.updateGitHubIntegration>[0]
  ) => {
    localStorageManager.updateGitHubIntegration(data);
  },

  /**
   * Validate GitHub PAT format
   */
  validateTokenFormat: (token: string): { valid: boolean; error?: string } => {
    if (!token || !token.trim()) {
      return { valid: false, error: "GitHub token is required" };
    }

    const trimmedToken = token.trim();

    // GitHub PATs can be classic (ghp_) or fine-grained (github_pat_)
    if (
      !trimmedToken.startsWith("ghp_") &&
      !trimmedToken.startsWith("github_pat_")
    ) {
      return {
        valid: false,
        error:
          'GitHub token should start with "ghp_" (classic) or "github_pat_" (fine-grained)',
      };
    }

    if (trimmedToken.length < 20) {
      return {
        valid: false,
        error: "GitHub token should be at least 20 characters",
      };
    }

    return { valid: true };
  },
};

/**
 * General storage helpers
 */
export const storageHelpers = {
  /**
   * Clear all stored data
   */
  clearAll: (): void => {
    localStorageManager.clearAll();
  },

  /**
   * Check if any data is stored
   */
  hasData: (): boolean => {
    return localStorageManager.hasData();
  },

  /**
   * Add storage event listener
   */
  addEventListener: (listener: (event: StorageEvent) => void): void => {
    localStorageManager.addEventListener(listener);
  },

  /**
   * Remove storage event listener
   */
  removeEventListener: (listener: (event: StorageEvent) => void): void => {
    localStorageManager.removeEventListener(listener);
  },

  /**
   * Get storage summary
   */
  getSummary: () => {
    const configuredProviders = apiKeyHelpers.getConfiguredProviders();
    const hasGitHub = githubHelpers.hasToken();

    return {
      apiKeys: {
        count: configuredProviders.length,
        providers: configuredProviders,
      },
      integrations: {
        github: hasGitHub,
      },
      totalItems: configuredProviders.length + (hasGitHub ? 1 : 0),
    };
  },

  /**
   * Configure storage settings
   */
  configure: (config: Partial<import("./types").StorageConfig>): void => {
    localStorageManager.configure(config);
  },

  /**
   * Get current storage configuration
   */
  getConfig: (): import("./types").StorageConfig => {
    return localStorageManager.getConfig();
  },

  /**
   * Get storage quota information
   */
  getQuota: (): import("./types").StorageQuotaInfo | null => {
    return localStorageManager.getStorageQuota();
  },

  /**
   * Check storage health
   */
  checkHealth: (): {
    healthy: boolean;
    errors: import("./types").StorageError[];
  } => {
    return localStorageManager.checkStorageHealth();
  },

  /**
   * Setup automatic cleanup on logout
   */
  setupAutoCleanup: (): void => {
    localStorageManager.setupAutoCleanup();
  },

  /**
   * Manually trigger cleanup (for logout)
   */
  cleanup: (): void => {
    localStorageManager.cleanupOnLogout();
  },

  /**
   * Migrate keys from legacy formats (aPro, ${aiType}_api_key) into settings_api-keys.
   * Safe to call multiple times.
   */
  migrateFromLegacy: (): void => {
    localStorageManager.migrateFromLegacy();
  },

  /**
   * Decrypt all stored API keys into the in-memory cache.
   * Call once at app startup before reading any keys.
   */
  initCrypto: (): Promise<void> => localStorageManager.initCrypto(),

  /**
   * Returns true if the 1-hour export window is open (within 1 hour of last key edit).
   */
  isExportWindowOpen: (): boolean => localStorageManager.isExportWindowOpen(),

  /**
   * Closes the export window immediately (sets last-edit to 0).
   */
  closeExportWindow: (): void => localStorageManager.closeExportWindow(),

  /**
   * Returns all currently decrypted API keys as plaintext for .env export.
   * Only call when isExportWindowOpen() is true.
   */
  getDecryptedKeysForExport: (): Record<string, string> =>
    localStorageManager.getDecryptedKeysForExport(),
};

/**
 * Export all helpers as a single object
 */
export const storage = {
  apiKeys: apiKeyHelpers,
  github: githubHelpers,
  general: storageHelpers,
};
