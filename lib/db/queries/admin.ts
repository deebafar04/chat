import "server-only";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { ChatSDKError } from "../../errors";
import { type AdminConfig, adminConfig } from "../drizzle-schema";
import { getDb } from "./base";

export async function getAdminConfig({
  configKey,
}: {
  configKey: string;
}): Promise<AdminConfig | null> {
  try {
    const [config] = await db
      .select()
      .from(adminConfig)
      .where(eq(adminConfig.configKey, configKey));
    return (config as AdminConfig) || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get admin config"
    );
  }
}

export async function getAllAdminConfigs(): Promise<AdminConfig[]> {
  try {
    const result = await db
      .select()
      .from(adminConfig)
      .orderBy(asc(adminConfig.configKey));
    return result as AdminConfig[];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get all admin configs"
    );
  }
}

export async function updateAdminConfig({
  configKey,
  configData,
  updatedBy,
}: {
  configKey: string;
  configData: Record<string, any>;
  updatedBy: string;
}) {
  // Validate config key format before updating
  if (!isValidAgentConfigKey(configKey)) {
    throw new ChatSDKError(
      "bad_request:api",
      `Invalid config key format: ${configKey}. Must be one of the supported agent types with valid provider.`
    );
  }

  // Validate config data structure
  const validationResult = validateAgentConfigData(configKey, configData);
  if (!validationResult.isValid) {
    throw new ChatSDKError(
      "bad_request:api",
      `Configuration validation failed: ${validationResult.errors.join(", ")}`
    );
  }

  try {
    const [updated] = await db
      .update(adminConfig)
      .set({
        configData,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(adminConfig.configKey, configKey))
      .returning();
    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update admin config"
    );
  }
}

export async function createAdminConfig({
  configKey,
  configData,
  updatedBy,
}: {
  configKey: string;
  configData: Record<string, any>;
  updatedBy?: string;
}) {
  // Validate config key format before creating
  if (!isValidAgentConfigKey(configKey)) {
    throw new ChatSDKError(
      "bad_request:api",
      `Invalid config key format: ${configKey}. Must be one of the supported agent types with valid provider.`
    );
  }

  // Validate config data structure
  const validationResult = validateAgentConfigData(configKey, configData);
  if (!validationResult.isValid) {
    throw new ChatSDKError(
      "bad_request:api",
      `Configuration validation failed: ${validationResult.errors.join(", ")}`
    );
  }

  try {
    const [created] = await db
      .insert(adminConfig)
      .values({
        id: crypto.randomUUID(),
        configKey,
        configData,
        updatedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create admin config"
    );
  }
}

// New agent configuration validation and helper functions

// Valid agent types
const VALID_AGENT_TYPES = [
  "chat_model_agent",
  "provider_tools_agent",
  "document_agent",
  "python_agent",
  "mermaid_agent",
  "git_mcp_agent",
];

const VALID_PROVIDERS = ["google", "openai", "anthropic"];
const SPECIAL_CONFIG_KEYS = ["app_settings", "logging_settings"];

// Validation schemas for different agent types
const BaseAgentConfigSchema = z.object({
  enabled: z.boolean(),
  systemPrompt: z.string().min(1, "System prompt is required"),
  rateLimit: z.object({
    perMinute: z.number().min(1).max(1000),
    perHour: z.number().min(1).max(10_000),
    perDay: z.number().min(1).max(100_000),
  }),
});

// NOTE: ModelConfigSchema removed - models are now stored in model_config table
// Models are no longer part of admin_config JSONB data

// Base tool config for simple tools (no prompts)
const BaseToolConfigSchema = z.object({
  description: z.string(),
  enabled: z.boolean(),
});

// Tool config with system prompt and user prompt template (for document/python/mermaid agents)
const ToolWithPromptsConfigSchema = z.object({
  description: z.string(),
  enabled: z.boolean(),
  systemPrompt: z.string().optional(),
  userPromptTemplate: z.string().optional(),
});

// Chat model agent tool config (has tool_input structure)
const ChatModelToolConfigSchema = z.object({
  description: z.string(),
  enabled: z.boolean(),
  tool_input: z.any().optional(), // Flexible structure for different tool inputs
});

const FileTypeConfigSchema = z.object({
  enabled: z.boolean(),
});

const FileTypeCategorySchema = z.record(z.string(), FileTypeConfigSchema);

const FileInputTypesSchema = z.object({
  codeFiles: FileTypeCategorySchema,
  textFiles: FileTypeCategorySchema,
  pdf: FileTypeConfigSchema,
  ppt: FileTypeConfigSchema,
  excel: FileTypeConfigSchema,
  images: FileTypeConfigSchema,
});

const ChatModelAgentConfigSchema = BaseAgentConfigSchema.extend({
  // NOTE: availableModels removed - models are now stored in model_config table
  capabilities: z
    .object({
      thinkingReasoning: z.boolean().optional(),
      fileInput: z.boolean().optional(),
    })
    .optional(),
  fileInputTypes: FileInputTypesSchema.optional(),
  // Provider-level file input capabilities (optional for backward compatibility)
  fileInputEnabled: z.boolean().optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  tools: z
    .object({
      providerToolsAgent: ChatModelToolConfigSchema.optional(),
      documentAgent: ChatModelToolConfigSchema.optional(),
      pythonAgent: ChatModelToolConfigSchema.optional(),
      mermaidAgent: ChatModelToolConfigSchema.optional(),
      gitMcpAgent: ChatModelToolConfigSchema.optional(),
    })
    .optional(),
});

const ProviderToolsAgentConfigSchema = z.object({
  enabled: z.boolean(),
  systemPrompt: z.string().min(1, "System prompt is required"),
  rateLimit: z.object({
    perMinute: z.number().min(1).max(1000),
    perHour: z.number().min(1).max(10_000),
    perDay: z.number().min(1).max(100_000),
  }),
  tools: z.object({
    googleSearch: BaseToolConfigSchema.optional(),
    urlContext: BaseToolConfigSchema.optional(),
    codeExecution: BaseToolConfigSchema.optional(),
  }),
});

const DocumentAgentConfigSchema = z.object({
  enabled: z.boolean(),
  rateLimit: z.object({
    perMinute: z.number().min(1).max(1000),
    perHour: z.number().min(1).max(10_000),
    perDay: z.number().min(1).max(100_000),
  }),
  tools: z.object({
    create: ToolWithPromptsConfigSchema.optional(),
    update: ToolWithPromptsConfigSchema.optional(),
    suggestion: ToolWithPromptsConfigSchema.optional(),
    revert: BaseToolConfigSchema.optional(),
  }),
});

const PythonAgentConfigSchema = z.object({
  enabled: z.boolean(),
  rateLimit: z.object({
    perMinute: z.number().min(1).max(1000),
    perHour: z.number().min(1).max(10_000),
    perDay: z.number().min(1).max(100_000),
  }),
  tools: z.object({
    create: ToolWithPromptsConfigSchema.optional(),
    update: ToolWithPromptsConfigSchema.optional(),
    fix: ToolWithPromptsConfigSchema.optional(),
    explain: ToolWithPromptsConfigSchema.optional(),
    generate: ToolWithPromptsConfigSchema.optional(),
    revert: BaseToolConfigSchema.optional(),
  }),
});

const MermaidAgentConfigSchema = z.object({
  enabled: z.boolean(),
  rateLimit: z.object({
    perMinute: z.number().min(1).max(1000),
    perHour: z.number().min(1).max(10_000),
    perDay: z.number().min(1).max(100_000),
  }),
  tools: z.object({
    create: ToolWithPromptsConfigSchema.optional(),
    update: ToolWithPromptsConfigSchema.optional(),
    fix: ToolWithPromptsConfigSchema.optional(),
    generate: ToolWithPromptsConfigSchema.optional(),
    revert: BaseToolConfigSchema.optional(),
  }),
});

const GitMCPAgentConfigSchema = z.object({
  enabled: z.boolean(),
  systemPrompt: z.string().min(1, "System prompt is required"),
  rateLimit: z.object({
    perMinute: z.number().min(1).max(1000),
    perHour: z.number().min(1).max(10_000),
    perDay: z.number().min(1).max(100_000),
  }),
  tools: z.object({
    repos: BaseToolConfigSchema.optional(),
    issues: BaseToolConfigSchema.optional(),
    pull_requests: BaseToolConfigSchema.optional(),
    users: BaseToolConfigSchema.optional(),
    code_search: BaseToolConfigSchema.optional(),
    branches: BaseToolConfigSchema.optional(),
  }),
});

const AppSettingsSchema = z
  .object({
    appName: z.string().optional(),
    maintenanceMode: z.boolean().optional(),
    allowRegistration: z.boolean().optional(),
    maxUsersPerDay: z.number().optional(),
  })
  .passthrough(); // Allow additional fields

// Function to validate config key format
export function isValidAgentConfigKey(configKey: string): boolean {
  // Handle special config keys
  if (SPECIAL_CONFIG_KEYS.includes(configKey)) {
    return true;
  }

  const parts = configKey.split("_");
  if (parts.length < 3) {
    return false;
  }

  const provider = parts.at(-1);
  const agentType = parts.slice(0, -1).join("_");

  return (
    VALID_AGENT_TYPES.includes(agentType) &&
    provider !== undefined &&
    VALID_PROVIDERS.includes(provider)
  );
}

// Function to get the appropriate schema for an agent type
function getSchemaForAgentType(configKey: string): z.ZodSchema {
  if (configKey === "app_settings") {
    return AppSettingsSchema;
  }

  const parts = configKey.split("_");
  const agentType = parts.slice(0, -1).join("_");

  switch (agentType) {
    case "chat_model_agent":
      return ChatModelAgentConfigSchema;
    case "provider_tools_agent":
      return ProviderToolsAgentConfigSchema;
    case "document_agent":
      return DocumentAgentConfigSchema;
    case "python_agent":
      return PythonAgentConfigSchema;
    case "mermaid_agent":
      return MermaidAgentConfigSchema;
    case "git_mcp_agent":
      return GitMCPAgentConfigSchema;
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

// Validation result interface
type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

// Function to validate agent configuration data
export function validateAgentConfigData(
  configKey: string,
  configData: any
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  try {
    const schema = getSchemaForAgentType(configKey);
    const validationResult = schema.safeParse(configData);

    if (!validationResult.success) {
      result.isValid = false;
      result.errors = validationResult.error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      );
    }

    // Additional business logic validations
    if (result.isValid && configKey !== "app_settings") {
      // NOTE: Model validation removed - models are now stored in model_config table

      // Validate rate limits are reasonable
      if (configData.rateLimit) {
        const { perMinute, perHour, perDay } = configData.rateLimit;
        if (perMinute * 60 > perHour) {
          result.warnings.push("Per-minute rate limit may exceed hourly limit");
        }
        if (perHour * 24 > perDay) {
          result.warnings.push("Per-hour rate limit may exceed daily limit");
        }
      }
    }
  } catch (error) {
    result.isValid = false;
    result.errors.push(
      `Schema validation error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return result;
}

// Function to get all agent configurations
export async function getAllAgentConfigs(): Promise<AdminConfig[]> {
  try {
    const result = await db
      .select()
      .from(adminConfig)
      .orderBy(asc(adminConfig.configKey));

    // Filter to only valid agent configurations
    return result.filter((config) =>
      isValidAgentConfigKey(config.configKey)
    ) as AdminConfig[];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get agent configs"
    );
  }
}

// Function to get configurations by agent type
export async function getConfigsByAgentType(
  agentType: string
): Promise<AdminConfig[]> {
  if (!VALID_AGENT_TYPES.includes(agentType)) {
    throw new ChatSDKError(
      "bad_request:api",
      `Invalid agent type: ${agentType}`
    );
  }

  try {
    const allConfigs = await getAllAgentConfigs();
    return allConfigs.filter((config) =>
      config.configKey.startsWith(`${agentType}_`)
    );
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get configs by agent type"
    );
  }
}

// Function to get configurations by provider
export async function getConfigsByProvider(
  provider: string
): Promise<AdminConfig[]> {
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new ChatSDKError("bad_request:api", `Invalid provider: ${provider}`);
  }

  try {
    const allConfigs = await getAllAgentConfigs();
    return allConfigs.filter((config) =>
      config.configKey.endsWith(`_${provider}`)
    );
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get configs by provider"
    );
  }
}

// Function to delete a specific admin configuration
export async function deleteAdminConfig({ configKey }: { configKey: string }) {
  // Validate config key format before deleting
  if (!isValidAgentConfigKey(configKey)) {
    throw new ChatSDKError(
      "bad_request:api",
      `Invalid config key format: ${configKey}. Cannot delete invalid configuration.`
    );
  }

  try {
    const [deleted] = await db
      .delete(adminConfig)
      .where(eq(adminConfig.configKey, configKey))
      .returning();

    if (!deleted) {
      throw new ChatSDKError(
        "not_found:api",
        `Configuration for ${configKey} not found`
      );
    }

    return deleted;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete admin config"
    );
  }
}

// Function to perform partial updates on admin configuration
export async function patchAdminConfig({
  configKey,
  partialConfigData,
  updatedBy,
}: {
  configKey: string;
  partialConfigData: Record<string, any>;
  updatedBy: string;
}) {
  // Validate config key format before updating
  if (!isValidAgentConfigKey(configKey)) {
    throw new ChatSDKError(
      "bad_request:api",
      `Invalid config key format: ${configKey}. Must be one of the supported agent types with valid provider.`
    );
  }

  try {
    // Get existing configuration
    const existingConfig = await getAdminConfig({ configKey });
    if (!existingConfig) {
      throw new ChatSDKError(
        "not_found:api",
        `Configuration for ${configKey} not found`
      );
    }

    // Merge partial data with existing configuration using deep merge
    const mergedConfigData = deepMerge(
      existingConfig.configData,
      partialConfigData
    );

    // For PATCH operations, skip full validation and only validate the partial data
    // This allows for more flexible updates without requiring all fields to be present
    const partialValidationResult = validatePartialAgentConfigData(
      configKey,
      partialConfigData
    );
    if (!partialValidationResult.isValid) {
      throw new ChatSDKError(
        "bad_request:api",
        `Partial configuration validation failed: ${partialValidationResult.errors.join(", ")}`
      );
    }

    // Update with merged data
    const [updated] = await db
      .update(adminConfig)
      .set({
        configData: mergedConfigData,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(adminConfig.configKey, configKey))
      .returning();

    return updated;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to patch admin config"
    );
  }
}

// Helper function for deep merging objects
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      if (
        target[key] &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// Function to get admin configuration summary with model capabilities
export async function getAdminConfigSummary(): Promise<any> {
  try {
    const allConfigs = await getAllAgentConfigs();
    const summary: any = {
      providers: {},
    };

    // Import model_config table to get models
    const { modelConfig } = await import("../drizzle-schema");
    const { eq, and } = await import("drizzle-orm");

    // Process each configuration to build the summary
    for (const config of allConfigs) {
      const parts = config.configKey.split("_");
      if (parts.length < 3) {
        continue;
      }

      const provider = parts.at(-1);
      const agentType = parts.slice(0, -1).join("_");

      // Only process chat_model_agent configurations for the summary
      if (agentType === "chat_model_agent" && provider !== undefined) {
        if (!summary.providers[provider]) {
          const configData = config.configData as any;
          summary.providers[provider] = {
            enabled: configData.enabled || false,
            models: {},
            // Map from the actual database structure
            fileInputEnabled: configData.capabilities?.fileInput || false,
            allowedFileTypes: [],
          };

          // Extract allowed file types from fileInputTypes structure
          if (configData.fileInputTypes) {
            const allowedTypes: string[] = [];

            // Process different file type categories
            Object.entries(configData.fileInputTypes).forEach(
              ([category, types]: [string, any]) => {
                if (category === "images" && types.enabled) {
                  allowedTypes.push("image/*");
                } else if (category === "pdf" && types.enabled) {
                  allowedTypes.push("application/pdf");
                } else if (typeof types === "object" && types !== null) {
                  Object.entries(types).forEach(
                    ([ext, config]: [string, any]) => {
                      if (config.enabled) {
                        allowedTypes.push(ext);
                      }
                    }
                  );
                }
              }
            );

            summary.providers[provider].allowedFileTypes = allowedTypes;
          }
        }

        // Fetch models from model_config table instead of admin_config JSONB
        const models = await db
          .select()
          .from(modelConfig)
          .where(eq(modelConfig.provider, provider));

        // Add models with their capabilities
        for (const model of models) {
          summary.providers[provider].models[model.modelId] = {
            id: model.modelId,
            name: model.name,
            description: model.description || "",
            enabled: model.isActive || false,
            isDefault: model.isDefault || false,
            // Map thinkingEnabled to supportsThinkingMode
            supportsThinkingMode: model.thinkingEnabled || false,
            // For now, inherit file input settings from provider
            fileInputEnabled: summary.providers[provider].fileInputEnabled,
            allowedFileTypes: summary.providers[provider].allowedFileTypes,
            // Add pricing information
            pricingPerMillionTokens: {
              input: Number.parseFloat(
                model.inputPricingPerMillionTokens || "0"
              ),
              output: Number.parseFloat(
                model.outputPricingPerMillionTokens || "0"
              ),
            },
          };
        }
      }
    }

    return summary;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get admin config summary"
    );
  }
}

// Function to validate partial agent configuration data
export function validatePartialAgentConfigData(
  configKey: string,
  partialConfigData: any
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  try {
    // For partial validation, we're very lenient - only validate basic types and structure
    // Skip complex schema validation for PATCH operations to allow flexible updates

    // Basic type checks for common fields
    if (
      partialConfigData.enabled !== undefined &&
      typeof partialConfigData.enabled !== "boolean"
    ) {
      result.errors.push("enabled must be a boolean");
      result.isValid = false;
    }

    if (
      partialConfigData.systemPrompt !== undefined &&
      typeof partialConfigData.systemPrompt !== "string"
    ) {
      result.errors.push("systemPrompt must be a string");
      result.isValid = false;
    }

    // Additional business logic validations for partial data
    if (result.isValid && configKey !== "app_settings") {
      // NOTE: Model validation removed - models are now stored in model_config table

      // Validate rate limits if provided
      if (partialConfigData.rateLimit) {
        const { perMinute, perHour, perDay } = partialConfigData.rateLimit;
        if (perMinute && perHour && perMinute * 60 > perHour) {
          result.warnings.push("Per-minute rate limit may exceed hourly limit");
        }
        if (perHour && perDay && perHour * 24 > perDay) {
          result.warnings.push("Per-hour rate limit may exceed daily limit");
        }
      }
    }
  } catch (error) {
    result.isValid = false;
    result.errors.push(
      `Partial validation error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return result;
}

// Function to get partial schema for agent type (allows partial objects)
function _getPartialSchemaForAgentType(configKey: string): z.ZodSchema {
  if (configKey === "app_settings") {
    return AppSettingsSchema.partial();
  }

  const parts = configKey.split("_");
  const agentType = parts.slice(0, -1).join("_");

  switch (agentType) {
    case "chat_model_agent":
      return ChatModelAgentConfigSchema.partial().deepPartial();
    case "provider_tools_agent":
      return ProviderToolsAgentConfigSchema.partial().deepPartial();
    case "document_agent":
      return DocumentAgentConfigSchema.partial().deepPartial();
    case "python_agent":
      return PythonAgentConfigSchema.partial().deepPartial();
    case "mermaid_agent":
      return MermaidAgentConfigSchema.partial().deepPartial();
    case "git_mcp_agent":
      return GitMCPAgentConfigSchema.partial().deepPartial();
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

// Function to purge old activity logs
export async function purgeOldActivityLogs(): Promise<{
  user_logs_deleted: number;
  agent_logs_deleted: number;
  error_logs_deleted: number;
}> {
  try {
    const { createAdminClient } = await import("../supabase-client");
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("purge_old_activity_logs");

    if (error) {
      throw new ChatSDKError(
        "bad_request:database",
        `Failed to purge old activity logs: ${error.message}`
      );
    }

    // The function returns a single row with the counts
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

    return (
      result || {
        user_logs_deleted: 0,
        agent_logs_deleted: 0,
        error_logs_deleted: 0,
      }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to purge old activity logs"
    );
  }
}
