import "server-only";

import { getAdminConfig } from "@/lib/db/queries/admin";
import {
  AgentOperationCategory,
  AgentOperationType,
  AgentType,
  createCorrelationId,
  PerformanceTracker,
} from "@/lib/logging/activity-logger";
import { GoogleDocumentAgentStreaming } from "./document-agent-streaming";
import { GoogleGitMcpAgent } from "./git-mcp-agent";
import { GoogleMermaidAgentStreaming } from "./mermaid-agent-streaming";
import { GoogleProviderToolsAgent } from "./provider-tools-agent";
import { GooglePythonAgentStreaming } from "./python-agent-streaming";

/**
 * Agent configuration loader
 * Handles loading and initialization of specialized agents
 */
export class AgentConfigLoader {
  private apiKey?: string;
  private githubPAT?: string;
  private providerToolsAgent?: GoogleProviderToolsAgent;
  private providerToolsConfig?: any;
  private documentAgentStreaming?: GoogleDocumentAgentStreaming;
  private documentAgentConfig?: any;
  private mermaidAgentStreaming?: GoogleMermaidAgentStreaming;
  private mermaidAgentConfig?: any;
  private pythonAgentStreaming?: GooglePythonAgentStreaming;
  private pythonAgentConfig?: any;
  private gitMcpAgent?: GoogleGitMcpAgent;
  private gitMcpAgentConfig?: any;

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setGitHubPAT(pat: string): void {
    this.githubPAT = pat;
    // Propagate to git MCP agent if already loaded
    if (this.gitMcpAgent) {
      this.gitMcpAgent.setApiKey(pat);
      // Also set Google API key if available
      if (this.apiKey) {
        this.gitMcpAgent.setGoogleApiKey(this.apiKey);
      }
    }
  }

  /**
   * Load provider tools agent configuration
   */
  async loadProviderToolsConfig() {
    const correlationId = createCorrelationId();
    const tracker = new PerformanceTracker({
      correlation_id: correlationId,
      agent_type: AgentType.PROVIDER_TOOLS_AGENT,
      operation_type: AgentOperationType.INITIALIZATION,
      operation_category: AgentOperationCategory.CONFIGURATION,
    });

    try {
      const config = await getAdminConfig({
        configKey: "provider_tools_agent_google",
      });

      if (config?.configData && (config.configData as any).enabled) {
        console.log("✅ [AGENT-INIT] Provider Tools Agent loaded and enabled");

        this.providerToolsConfig = config.configData;
        this.providerToolsAgent = new GoogleProviderToolsAgent(
          config.configData as any
        );

        if (this.apiKey) {
          this.providerToolsAgent.setApiKey(this.apiKey);
        } else {
          console.log(
            "⚠️  [AGENT-INIT] Provider Tools Agent: No API key available"
          );
        }

        await tracker.end({
          success: true,
          operation_metadata: {
            agent_name: "provider_tools_agent_google",
            config_loaded: true,
            model_id: (config.configData as any).modelId,
          },
        });
      } else {
        console.log(
          "❌ [AGENT-INIT] Provider Tools Agent: disabled or not found"
        );

        await tracker.end({
          success: false,
          operation_metadata: {
            agent_name: "provider_tools_agent_google",
            config_loaded: false,
            reason: "disabled or not found",
          },
        });
      }
    } catch (error) {
      console.error(
        "❌ [AGENT-INIT] Failed to load Provider Tools Agent:",
        error
      );

      await tracker.end({
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        operation_metadata: {
          agent_name: "provider_tools_agent_google",
          config_loaded: false,
        },
      });

      // Specialized agents are best-effort — when the admin_config DB is
      // unreachable we let the base chat agent stream without them rather
      // than failing the entire request.
    }
  }

  /**
   * Load document agent configuration
   */
  async loadDocumentAgentConfig() {
    const correlationId = createCorrelationId();
    const tracker = new PerformanceTracker({
      correlation_id: correlationId,
      agent_type: AgentType.DOCUMENT_AGENT,
      operation_type: AgentOperationType.INITIALIZATION,
      operation_category: AgentOperationCategory.CONFIGURATION,
    });

    try {
      const config = await getAdminConfig({
        configKey: "document_agent_google",
      });

      if (config?.configData && (config.configData as any).enabled) {
        console.log(
          "✅ [AGENT-INIT] Document Agent loaded and enabled (STREAMING VERSION)"
        );

        this.documentAgentConfig = config.configData;
        this.documentAgentStreaming = new GoogleDocumentAgentStreaming(
          config.configData as any
        );

        if (this.apiKey) {
          this.documentAgentStreaming.setApiKey(this.apiKey);
        } else {
          console.log("⚠️  [AGENT-INIT] Document Agent: No API key available");
        }

        await tracker.end({
          success: true,
          operation_metadata: {
            agent_name: "document_agent_google",
            config_loaded: true,
            model_id: (config.configData as any).modelId,
          },
        });
      } else {
        console.log("❌ [AGENT-INIT] Document Agent: disabled or not found");

        await tracker.end({
          success: false,
          operation_metadata: {
            agent_name: "document_agent_google",
            config_loaded: false,
            reason: "disabled or not found",
          },
        });
      }
    } catch (error) {
      console.error("❌ [AGENT-INIT] Failed to load Document Agent:", error);

      await tracker.end({
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        operation_metadata: {
          agent_name: "document_agent_google",
          config_loaded: false,
        },
      });

      // Specialized agents are best-effort — when the admin_config DB is
      // unreachable we let the base chat agent stream without them rather
      // than failing the entire request.
    }
  }

  /**
   * Load mermaid agent configuration
   */
  async loadMermaidAgentConfig() {
    const correlationId = createCorrelationId();
    const tracker = new PerformanceTracker({
      correlation_id: correlationId,
      agent_type: AgentType.MERMAID_AGENT,
      operation_type: AgentOperationType.INITIALIZATION,
      operation_category: AgentOperationCategory.CONFIGURATION,
    });

    try {
      const config = await getAdminConfig({
        configKey: "mermaid_agent_google",
      });

      if (config?.configData && (config.configData as any).enabled) {
        console.log(
          "✅ [AGENT-INIT] Mermaid Agent loaded and enabled (STREAMING VERSION)"
        );

        this.mermaidAgentConfig = config.configData;
        this.mermaidAgentStreaming = new GoogleMermaidAgentStreaming(
          config.configData as any
        );

        if (this.apiKey) {
          this.mermaidAgentStreaming.setApiKey(this.apiKey);
        } else {
          console.log("⚠️  [AGENT-INIT] Mermaid Agent: No API key available");
        }

        await tracker.end({
          success: true,
          operation_metadata: {
            agent_name: "mermaid_agent_google",
            config_loaded: true,
            model_id: (config.configData as any).modelId,
          },
        });
      } else {
        console.log("❌ [AGENT-INIT] Mermaid Agent: disabled or not found");

        await tracker.end({
          success: false,
          operation_metadata: {
            agent_name: "mermaid_agent_google",
            config_loaded: false,
            reason: "disabled or not found",
          },
        });
      }
    } catch (error) {
      console.error("❌ [AGENT-INIT] Failed to load Mermaid Agent:", error);

      await tracker.end({
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        operation_metadata: {
          agent_name: "mermaid_agent_google",
          config_loaded: false,
        },
      });

      // Specialized agents are best-effort — when the admin_config DB is
      // unreachable we let the base chat agent stream without them rather
      // than failing the entire request.
    }
  }

  /**
   * Load python agent configuration
   */
  async loadPythonAgentConfig() {
    const correlationId = createCorrelationId();
    const tracker = new PerformanceTracker({
      correlation_id: correlationId,
      agent_type: AgentType.PYTHON_AGENT,
      operation_type: AgentOperationType.INITIALIZATION,
      operation_category: AgentOperationCategory.CONFIGURATION,
    });

    try {
      const config = await getAdminConfig({
        configKey: "python_agent_google",
      });

      if (config?.configData && (config.configData as any).enabled) {
        console.log(
          "✅ [AGENT-INIT] Python Agent loaded and enabled (STREAMING VERSION)"
        );

        this.pythonAgentConfig = config.configData;
        this.pythonAgentStreaming = new GooglePythonAgentStreaming(
          config.configData as any
        );

        if (this.apiKey) {
          this.pythonAgentStreaming.setApiKey(this.apiKey);
        } else {
          console.log("⚠️  [AGENT-INIT] Python Agent: No API key available");
        }

        await tracker.end({
          success: true,
          operation_metadata: {
            agent_name: "python_agent_google",
            config_loaded: true,
            model_id: (config.configData as any).modelId,
          },
        });
      } else {
        console.log("❌ [AGENT-INIT] Python Agent: disabled or not found");

        await tracker.end({
          success: false,
          operation_metadata: {
            agent_name: "python_agent_google",
            config_loaded: false,
            reason: "disabled or not found",
          },
        });
      }
    } catch (error) {
      console.error("❌ [AGENT-INIT] Failed to load Python Agent:", error);

      await tracker.end({
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        operation_metadata: {
          agent_name: "python_agent_google",
          config_loaded: false,
        },
      });

      // Specialized agents are best-effort — when the admin_config DB is
      // unreachable we let the base chat agent stream without them rather
      // than failing the entire request.
    }
  }

  /**
   * Load GitHub MCP agent configuration
   */
  async loadGitMcpAgentConfig() {
    const correlationId = createCorrelationId();
    const tracker = new PerformanceTracker({
      correlation_id: correlationId,
      agent_type: AgentType.GIT_MCP_AGENT,
      operation_type: AgentOperationType.INITIALIZATION,
      operation_category: AgentOperationCategory.CONFIGURATION,
    });

    try {
      const config = await getAdminConfig({
        configKey: "git_mcp_agent_google",
      });

      if (config?.configData && (config.configData as any).enabled) {
        console.log("✅ [AGENT-INIT] GitHub MCP Agent loaded and enabled");

        this.gitMcpAgentConfig = config.configData;
        this.gitMcpAgent = new GoogleGitMcpAgent(config.configData as any);

        // Set GitHub PAT if available
        if (this.githubPAT) {
          this.gitMcpAgent.setApiKey(this.githubPAT);
        }

        // Set Google API key if available
        if (this.apiKey) {
          this.gitMcpAgent.setGoogleApiKey(this.apiKey);
        }

        await tracker.end({
          success: true,
          operation_metadata: {
            agent_name: "git_mcp_agent_google",
            config_loaded: true,
            model_id: (config.configData as any).modelId,
          },
        });

        // Model will be set later via setGitMcpAgentModel() from chat agent
      } else {
        await tracker.end({
          success: false,
          operation_metadata: {
            agent_name: "git_mcp_agent_google",
            config_loaded: false,
            reason: "disabled or not found",
          },
        });
      }
    } catch (error) {
      console.error("❌ [AGENT-INIT] Failed to load GitHub MCP Agent:", error);

      await tracker.end({
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        operation_metadata: {
          agent_name: "git_mcp_agent_google",
          config_loaded: false,
        },
      });

      // Specialized agents are best-effort — when the admin_config DB is
      // unreachable we let the base chat agent stream without them rather
      // than failing the entire request.
    }
  }

  /**
   * Set the model for provider tools agent
   */
  setProviderToolsModel(modelId: string) {
    if (this.providerToolsAgent) {
      this.providerToolsAgent.setModel(modelId);
    }
  }

  /**
   * Set the model for document agent
   */
  setDocumentAgentModel(modelId: string) {
    if (this.documentAgentStreaming) {
      this.documentAgentStreaming.setModel(modelId);
    }
  }

  /**
   * Set the model for mermaid agent
   */
  setMermaidAgentModel(modelId: string) {
    if (this.mermaidAgentStreaming) {
      this.mermaidAgentStreaming.setModel(modelId);
    }
  }

  /**
   * Set the model for python agent
   */
  setPythonAgentModel(modelId: string) {
    if (this.pythonAgentStreaming) {
      this.pythonAgentStreaming.setModel(modelId);
    }
  }

  /**
   * Set the model for GitHub MCP agent
   */
  setGitMcpAgentModel(modelId: string) {
    if (this.gitMcpAgent) {
      this.gitMcpAgent.setModel(modelId);
    }
  }

  // Getters for agents and configs
  getProviderToolsAgent() {
    return this.providerToolsAgent;
  }

  getProviderToolsConfig() {
    return this.providerToolsConfig;
  }

  getDocumentAgentStreaming() {
    return this.documentAgentStreaming;
  }

  getDocumentAgentConfig() {
    return this.documentAgentConfig;
  }

  getMermaidAgentStreaming() {
    return this.mermaidAgentStreaming;
  }

  getMermaidAgentConfig() {
    return this.mermaidAgentConfig;
  }

  getPythonAgentStreaming() {
    return this.pythonAgentStreaming;
  }

  getPythonAgentConfig() {
    return this.pythonAgentConfig;
  }

  getGitMcpAgent() {
    return this.gitMcpAgent;
  }

  getGitMcpAgentConfig() {
    return this.gitMcpAgentConfig;
  }
}
