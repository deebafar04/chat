/**
 * Activity Logging System
 *
 * Centralized logging for user activities and agent operations
 * with toggle control, batching, and privacy compliance
 */

import { v4 as uuidv4 } from "uuid";

// Activity Types
export enum UserActivityType {
  AUTH_LOGIN = "auth_login",
  AUTH_LOGOUT = "auth_logout",
  AUTH_REGISTER = "auth_register",
  CHAT_CREATE = "chat_create",
  CHAT_VIEW = "chat_view",
  CHAT_DELETE = "chat_delete",
  CHAT_MESSAGE_SEND = "chat_message_send",
  DOCUMENT_CREATE = "document_create",
  DOCUMENT_VIEW = "document_view",
  DOCUMENT_UPDATE = "document_update",
  DOCUMENT_DELETE = "document_delete",
  ADMIN_CONFIG_UPDATE = "admin_config_update",
  ADMIN_DASHBOARD_VIEW = "admin_dashboard_view",
  ADMIN_PROVIDER_VIEW = "admin_provider_view",
  VOTE_MESSAGE = "vote_message",
  SUGGESTION_VIEW = "suggestion_view",
  FILE_UPLOAD = "file_upload",
  FILE_DOWNLOAD = "file_download",
  FILE_DELETE = "file_delete",
  ARTIFACT_CREATE = "artifact_create",
  ARTIFACT_EXECUTE = "artifact_execute",
  MODEL_SELECTION = "model_selection",
  HISTORY_ACCESS = "history_access",
  HISTORY_DELETE = "history_delete",
}

export enum ActivityCategory {
  AUTHENTICATION = "authentication",
  CHAT = "chat",
  DOCUMENT = "document",
  ADMIN = "admin",
  VOTE = "vote",
  FILE = "file",
  ARTIFACT = "artifact",
  HISTORY = "history",
}

export enum AgentType {
  CHAT_MODEL_AGENT = "chat_model_agent",
  PROVIDER_TOOLS_AGENT = "provider_tools_agent",
  DOCUMENT_AGENT = "document_agent",
  PYTHON_AGENT = "python_agent",
  MERMAID_AGENT = "mermaid_agent",
  GIT_MCP_AGENT = "git_mcp_agent",
}

export enum AgentOperationType {
  INITIALIZATION = "initialization",
  TOOL_INVOCATION = "tool_invocation",
  CODE_GENERATION = "code_generation",
  DOCUMENT_GENERATION = "document_generation",
  DIAGRAM_GENERATION = "diagram_generation",
  CODE_EXECUTION = "code_execution",
  SEARCH = "search",
  URL_FETCH = "url_fetch",
  MCP_OPERATION = "mcp_operation",
  STREAMING = "streaming",
}

export enum AgentOperationCategory {
  GENERATION = "generation",
  EXECUTION = "execution",
  TOOL_USE = "tool_use",
  STREAMING = "streaming",
  CONFIGURATION = "configuration",
}

// Interfaces
export type UserActivityLog = {
  user_id: string;
  correlation_id?: string;
  activity_type: UserActivityType;
  activity_category: ActivityCategory;
  activity_metadata?: Record<string, any>;
  resource_id?: string;
  resource_type?: string;
  ip_address?: string;
  user_agent?: string;
  request_path?: string;
  request_method?: string;
  session_id?: string;
  success?: boolean;
  error_message?: string;
};

export type AgentActivityLog = {
  user_id?: string;
  correlation_id: string;
  agent_type: AgentType;
  operation_type: AgentOperationType;
  operation_category: AgentOperationCategory;
  operation_metadata?: Record<string, any>;
  resource_id?: string;
  resource_type?: string;

  // Performance
  duration_ms?: number;
  start_time?: Date;
  end_time?: Date;

  // AI Model metrics
  model_id?: string;
  provider?: string;
  thinking_mode?: boolean;
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  input_cost?: number;
  output_cost?: number;
  total_cost?: number;

  // Execution
  success?: boolean;
  error_type?: string;
  error_message?: string;
  retry_count?: number;
};

// Logging configuration cache
let loggingConfig: any = null;
let configLastFetched = 0;
const CONFIG_CACHE_TTL = 60_000; // 1 minute

// Batch queue for async logging
let userActivityBatch: UserActivityLog[] = [];
let agentActivityBatch: AgentActivityLog[] = [];
let batchTimer: NodeJS.Timeout | null = null;

/**
 * Get logging configuration with caching
 */
async function getLoggingConfig(): Promise<any> {
  const now = Date.now();

  // Return cached config if fresh
  if (loggingConfig && now - configLastFetched < CONFIG_CACHE_TTL) {
    return loggingConfig;
  }

  try {
    // Skip DB fetch when the service role key is absent (local dev without admin credentials).
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { user_activity_logging_enabled: false, agent_activity_logging_enabled: false };
    }

    // Fetch from database using admin client
    const { createAdminClient } = await import("@/lib/db/supabase-client");
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("admin_config")
      .select("config_data")
      .eq("config_key", "logging_settings")
      .single();

    if (!error && data) {
      loggingConfig = data.config_data;
      configLastFetched = now;
      return loggingConfig;
    }
  } catch (err) {
    console.error("Failed to fetch logging config:", err);
  }

  // Fallback config
  return {
    user_activity_logging_enabled: false,
    agent_activity_logging_enabled: false,
  };
}

/**
 * Check if user activity logging is enabled
 */
export async function isUserActivityLoggingEnabled(): Promise<boolean> {
  const config = await getLoggingConfig();
  return config.user_activity_logging_enabled === true;
}

/**
 * Check if agent activity logging is enabled
 */
export async function isAgentActivityLoggingEnabled(): Promise<boolean> {
  const config = await getLoggingConfig();
  return config.agent_activity_logging_enabled === true;
}

/**
 * Flush batch to database
 */
async function flushBatch() {
  if (userActivityBatch.length === 0 && agentActivityBatch.length === 0) {
    return;
  }

  try {
    const { createAdminClient } = await import("@/lib/db/supabase-client");
    const supabase = createAdminClient();

    // Insert user activity logs
    if (userActivityBatch.length > 0) {
      const { error } = await supabase
        .from("user_activity_logs")
        .insert(userActivityBatch);

      if (error) {
        console.error("Failed to insert user activity logs:", error);
      } else {
        userActivityBatch = [];
      }
    }

    // Insert agent activity logs
    if (agentActivityBatch.length > 0) {
      const { error } = await supabase
        .from("agent_activity_logs")
        .insert(agentActivityBatch);

      if (error) {
        console.error("Failed to insert agent activity logs:", error);
      } else {
        agentActivityBatch = [];
      }
    }
  } catch (err) {
    console.error("Failed to flush activity log batch:", err);
  }
}

/**
 * Schedule batch flush
 */
function scheduleBatchFlush() {
  if (batchTimer) {
    return; // Already scheduled
  }

  batchTimer = setTimeout(async () => {
    await flushBatch();
    batchTimer = null;
  }, 5000); // Flush every 5 seconds
}

/**
 * Log user activity
 */
export async function logUserActivity(log: UserActivityLog): Promise<void> {
  try {
    // Check if logging is enabled
    if (!(await isUserActivityLoggingEnabled())) {
      return;
    }

    // Generate correlation ID if not provided
    if (!log.correlation_id) {
      log.correlation_id = uuidv4();
    }

    // Get config for batch settings
    const config = await getLoggingConfig();
    const batchEnabled = config.performance_settings?.batch_writes !== false;

    if (batchEnabled) {
      // Add to batch
      userActivityBatch.push(log);

      // Flush if batch is full
      if (
        userActivityBatch.length >=
        (config.performance_settings?.batch_size || 100)
      ) {
        await flushBatch();
      } else {
        scheduleBatchFlush();
      }
    } else {
      // Write immediately
      const { createAdminClient } = await import("@/lib/db/supabase-client");
      const supabase = createAdminClient();
      await supabase.from("user_activity_logs").insert(log);
    }
  } catch (err) {
    console.error("Failed to log user activity:", err);
  }
}

/**
 * Log agent activity
 */
export async function logAgentActivity(log: AgentActivityLog): Promise<void> {
  try {
    // Check if logging is enabled
    if (!(await isAgentActivityLoggingEnabled())) {
      return;
    }

    // Get config for batch settings
    const config = await getLoggingConfig();
    const batchEnabled = config.performance_settings?.batch_writes !== false;

    if (batchEnabled) {
      // Add to batch
      agentActivityBatch.push(log);

      // Flush if batch is full
      if (
        agentActivityBatch.length >=
        (config.performance_settings?.batch_size || 100)
      ) {
        await flushBatch();
      } else {
        scheduleBatchFlush();
      }
    } else {
      // Write immediately
      const { createAdminClient } = await import("@/lib/db/supabase-client");
      const supabase = createAdminClient();
      await supabase.from("agent_activity_logs").insert(log);
    }
  } catch (err) {
    console.error("Failed to log agent activity:", err);
  }
}

/**
 * Performance tracking helper
 */
export class PerformanceTracker {
  private readonly startTime: number;
  private readonly log: Partial<AgentActivityLog>;

  constructor(log: Partial<AgentActivityLog>) {
    this.startTime = Date.now();
    this.log = {
      ...log,
      start_time: new Date(),
      correlation_id: log.correlation_id || uuidv4(),
    };
  }

  async end(additionalData?: Partial<AgentActivityLog>): Promise<void> {
    const endTime = Date.now();
    const duration_ms = endTime - this.startTime;

    await logAgentActivity({
      ...this.log,
      ...additionalData,
      duration_ms,
      end_time: new Date(),
    } as AgentActivityLog);
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  getCorrelationId(): string {
    return this.log.correlation_id!;
  }
}

/**
 * Export utility to create correlation ID
 */
export function createCorrelationId(): string {
  return uuidv4();
}
