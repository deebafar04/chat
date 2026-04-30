import type { UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: any;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  "rag-status": {
    skippedReason?:
      | "disabled"
      | "empty_query"
      | "missing_credentials"
      | "no_matches"
      | "error";
    sourceCount?: number;
  } | null;
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
  storagePath?: string; // Path in Supabase Storage for deletion
};

// Enhanced admin configuration interfaces for chat input enhancements
export type ModelCapabilities = {
  supportsThinkingMode: boolean;
  fileInputEnabled: boolean;
  allowedFileTypes: string[];
};

export type EnhancedModelConfig = {
  id: string;
  name: string;
  description: string;
  pricingPerMillionTokens: {
    input: number;
    output: number;
  };
  enabled: boolean;
  isDefault: boolean;
  thinkingEnabled?: boolean;
  // New capabilities
  supportsThinkingMode: boolean;
  fileInputEnabled: boolean;
  allowedFileTypes: string[];
};

export type ProviderCapabilities = {
  enabled: boolean;
  models: Record<string, EnhancedModelConfig>;
  // Provider-level file input settings
  fileInputEnabled: boolean;
  allowedFileTypes: string[];
};

export type AdminConfigSummary = {
  providers: Record<string, ProviderCapabilities>;
};

// GitHub integration types
export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  description: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
};

export type GitHubSearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
};

export type GitHubContextState = {
  searchQuery: string;
  searchResults: GitHubRepo[];
  selectedRepos: GitHubRepo[];
  isLoading: boolean;
  error: string | null;
};

// GitHub MCP Agent Types
export type RateLimit = {
  perMinute: number;
  perHour: number;
  perDay: number;
};

export type GitMcpAgentConfig = {
  enabled: boolean;
  systemPrompt: string;
  rateLimit: RateLimit;
  tools: Record<
    string,
    {
      description: string;
      enabled: boolean;
    }
  >;
};

export type AgentResult = {
  output: string;
  success: boolean;
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, any>;
    result: any;
  }>;
  reasoning?: string;
  error?: string;
};

export type GitHubFile = {
  path: string;
  name: string;
  type: "file";
  size?: number;
  sha?: string;
  content?: string;
  url?: string;
};

export type GitHubFolder = {
  path: string;
  name: string;
  type: "dir";
  contents?: Array<GitHubFile | GitHubFolder>;
  url?: string;
};

export type GitHubBranch = {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
};

export type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author?: {
    login: string;
    avatar_url: string;
  };
  url: string;
};

export type GitHubIssue = {
  number: number;
  title: string;
  state: "open" | "closed";
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  labels: Array<{
    name: string;
    color: string;
  }>;
  body?: string;
};

export type GitHubPullRequest = {
  number: number;
  title: string;
  state: "open" | "closed";
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  draft: boolean;
  merged: boolean;
};

export type GitHubContext = {
  repos: GitHubRepo[];
  files: GitHubFile[];
  folders: GitHubFolder[];
  branches?: GitHubBranch[];
};
