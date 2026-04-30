/**
 * Storage types and interfaces for API keys and integrations
 */

// Storage schema for localStorage
export type LocalStorageSchema = {
  "api-keys": {
    google?: string;
    anthropic?: string;
    openai?: string;
    xai?: string;
    groq?: string;
    together?: string;
    fireworks?: string;
    mistral?: string;
    perplexity?: string;
    deepseek?: string;
    discord?: string;
    github?: string;
    pinecone?: string;
    voyage?: string;
  };
  integrations: {
    github?: {
      token: string;
      lastVerified?: string;
      user?: {
        login: string;
        name: string;
        avatar_url?: string;
      };
      repositories?: Array<{
        name: string;
        full_name: string;
        private: boolean;
        permissions?: {
          admin: boolean;
          push: boolean;
          pull: boolean;
        };
      }>;
      scopes?: string[];
      expiresAt?: string;
    };
  };
};

// Component state interfaces
export type APIKeyState = {
  value: string;
  isVerifying: boolean;
  verificationResult?: VerificationResult;
  showKey: boolean;
};

export type GitHubState = {
  token: string;
  isVerifying: boolean;
  verificationResult?: GitHubVerificationResult;
  showToken: boolean;
};

// Verification result types
export type VerificationResult = {
  success: boolean;
  error?: string;
  details?: {
    model?: string;
    usage?: object;
  };
};

export type GitHubVerificationResult = {
  success: boolean;
  error?: string;
  user?: {
    login: string;
    name: string;
  };
  repositories?: Array<{
    name: string;
    full_name: string;
    private: boolean;
  }>;
  scopes?: string[];
  expiresAt?: string;
};

// API provider types
export type APIProvider =
  | "google"
  | "anthropic"
  | "openai"
  | "xai"
  | "groq"
  | "together"
  | "fireworks"
  | "mistral"
  | "perplexity"
  | "deepseek"
  | "discord"
  | "github"
  | "pinecone"
  | "voyage";

// Storage manager interface
export type StorageManager = {
  getAPIKey(provider: APIProvider): string | null;
  setAPIKey(provider: APIProvider, key: string): void;
  removeAPIKey(provider: APIProvider): void;
  getGitHubPAT(): string | null;
  setGitHubPAT(token: string): void;
  removeGitHubPAT(): void;
  clearAll(): void;
  migrateFromLegacy(): void;

  // Session management
  setupAutoCleanup(): void;
  cleanupOnLogout(): void;

  // Storage management
  getStorageQuota(): StorageQuotaInfo | null;
  checkStorageHealth(): { healthy: boolean; errors: StorageError[] };

  // Configuration
  configure(config: Partial<StorageConfig>): void;
  getConfig(): StorageConfig;
};

// Storage events
export type StorageEvent = {
  type:
    | "api-key-updated"
    | "api-key-removed"
    | "github-pat-updated"
    | "github-pat-removed"
    | "storage-cleared"
    | "storage-error";
  provider?: APIProvider;
  timestamp: number;
  error?: string;
};

// Storage configuration
export type StorageConfig = {
  useSessionStorage?: boolean;
  autoCleanupOnLogout?: boolean;
  maxStorageSize?: number; // in bytes
  enableEncryption?: boolean;
};

// Storage quota information
export type StorageQuotaInfo = {
  used: number;
  available: number;
  total: number;
  percentage: number;
};

// Storage error types
export enum StorageErrorType {
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  STORAGE_UNAVAILABLE = "STORAGE_UNAVAILABLE",
  DATA_CORRUPTION = "DATA_CORRUPTION",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export type StorageError = {
  type: StorageErrorType;
  message: string;
  details?: any;
};
