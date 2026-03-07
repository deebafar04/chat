import "server-only";

import {
  AgentOperationCategory,
  AgentOperationType,
  AgentType,
  createCorrelationId,
  PerformanceTracker,
} from "@/lib/logging/activity-logger";
import { getAdminConfig } from "../db/queries/admin";
import { getActiveModelsByProvider } from "../db/queries/model-config";
import { GoogleChatAgent } from "./providers/google/chat-agent";

// Simple agent config interface
type AgentConfig = {
  systemPrompt: string;
  enabled: boolean;
  tools?: Record<
    string,
    {
      description: string;
      enabled: boolean;
    }
  >;
  rateLimit?: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
};

export type Provider = "google" | "openai" | "anthropic";

/**
 * Simple resolver to get the right chat agent based on provider
 * No complex factory pattern - just direct instantiation
 */
export class ChatAgentResolver {
  /**
   * Get the active provider from app settings
   */
  static async getActiveProvider(): Promise<Provider> {
    try {
      const settings = await getAdminConfig({ configKey: "app_settings" });
      return (settings?.configData as any)?.activeProvider || "google";
    } catch (error) {
      console.warn(
        "Failed to get active provider, defaulting to google:",
        error
      );
      return "google";
    }
  }

  /**
   * Create a chat agent for the specified provider
   */
  static async createChatAgent(provider?: Provider): Promise<GoogleChatAgent> {
    const correlationId = createCorrelationId();
    const tracker = new PerformanceTracker({
      correlation_id: correlationId,
      agent_type: AgentType.CHAT_MODEL_AGENT,
      operation_type: AgentOperationType.INITIALIZATION,
      operation_category: AgentOperationCategory.CONFIGURATION,
    });

    try {
      const activeProvider =
        provider || (await ChatAgentResolver.getActiveProvider());

      let agent: GoogleChatAgent;

      switch (activeProvider) {
        case "google":
          agent = await ChatAgentResolver.createGoogleChatAgent(correlationId);
          break;

        case "openai":
          // TODO: Implement when needed
          throw new Error("OpenAI chat agent not implemented yet");

        case "anthropic":
          // TODO: Implement when needed
          throw new Error("Anthropic chat agent not implemented yet");

        default:
          throw new Error(`Unknown provider: ${activeProvider}`);
      }

      // Log successful agent initialization
      await tracker.end({
        success: true,
        operation_metadata: {
          provider: activeProvider,
          initialization_result: "success",
        },
      });

      return agent;
    } catch (error) {
      // Log failed agent initialization
      await tracker.end({
        success: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
        operation_metadata: {
          provider: provider || "unknown",
          initialization_result: "error",
        },
      });

      throw error;
    }
  }

  /**
   * Create Google chat agent with configuration
   */
  private static async createGoogleChatAgent(
    correlationId: string
  ): Promise<GoogleChatAgent> {
    const tracker = new PerformanceTracker({
      correlation_id: correlationId,
      agent_type: AgentType.CHAT_MODEL_AGENT,
      operation_type: AgentOperationType.INITIALIZATION,
      operation_category: AgentOperationCategory.CONFIGURATION,
    });

    try {
      // Load Google chat agent config from database
      const adminConfig = await getAdminConfig({
        configKey: "chat_model_agent_google",
      });

      if (!adminConfig?.configData) {
        throw new Error("Google chat agent configuration not found");
      }

      const configData = adminConfig.configData as any;

      // Load model configurations from model_config table
      const models = await getActiveModelsByProvider("google");

      // Convert database models to availableModels array
      const availableModels = models.map((model) => ({
        id: model.modelId,
        name: model.name,
        description: model.description || "",
        enabled: model.isActive !== false,
        isDefault: model.isDefault || false,
        thinkingEnabled: model.thinkingEnabled !== false,
        supportsThinkingMode: model.thinkingEnabled !== false,
        fileInputEnabled: false, // TODO: Add to model_config table
        allowedFileTypes: [],
      }));

      // Find default model
      const defaultModel = availableModels.find((m) => m.isDefault);

      // Default system prompt with structured response guidelines
      const defaultSystemPrompt = [
        "You are a helpful AI assistant powered by Google Gemini.",
        "",
        "Response Guidelines:",
        "- Respond concisely.",
        "- Limit responses to 3\u20135 short paragraphs or bullet points.",
        "- Prioritize key facts over long explanations.",
        "- If the answer is long, summarize the key points first.",
        "- Prefer bullet points for clarity when listing information.",
      ].join("\n");

      // Parse configuration
      const config: any = {
        systemPrompt: configData.systemPrompt || defaultSystemPrompt,
        enabled: configData.enabled !== false,
        availableModels,
        tools: configData.tools || {},
        rateLimit: configData.rateLimit || {
          perMinute: 60,
          perHour: 1000,
          perDay: 10_000,
        },
      };

      // Validate configuration
      if (!config.enabled) {
        throw new Error("Google chat agent is disabled");
      }

      const agent = new GoogleChatAgent(config);

      // Log detailed Google agent creation
      await tracker.end({
        success: true,
        operation_metadata: {
          provider: "google",
          model_count: availableModels.length,
          default_model: defaultModel?.id || "none",
          enabled_models: availableModels.filter((m) => m.enabled).length,
          config_loaded: true,
        },
      });

      return agent;
    } catch (error) {
      // Log detailed Google agent creation failure
      await tracker.end({
        success: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
        operation_metadata: {
          provider: "google",
          config_loaded: false,
        },
      });

      console.error("Failed to create Google chat agent:", error);
      throw error;
    }
  }

  /**
   * Get available providers
   */
  static async getAvailableProviders(): Promise<Provider[]> {
    const providers: Provider[] = [];

    // Check Google
    try {
      const googleConfig = await getAdminConfig({
        configKey: "chat_model_agent_google",
      });
      if ((googleConfig?.configData as any)?.enabled) {
        providers.push("google");
      }
    } catch (error) {
      console.warn("Failed to check Google provider:", error);
    }

    // TODO: Check OpenAI and Anthropic when implemented

    return providers;
  }
}
