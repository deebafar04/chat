/**
 * Unit tests for admin configuration database queries
 * Tests all CRUD operations and validation logic for admin configurations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as adminQueries from "@/lib/db/queries/admin";
import { ChatSDKError } from "@/lib/errors";

// Mock the database module
vi.mock("@/lib/db/queries/base", () => {
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };
  return { db: mockDb, getDb: () => mockDb, isDbConfigured: true };
});

// Import the mocked db
import { db as _db } from "@/lib/db/queries/base";
const db = _db!;

describe("Admin Config Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Config Retrieval Tests
  // ============================================================================

  describe("getAdminConfig", () => {
    it("should retrieve a config by key successfully", async () => {
      const mockConfig = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        configKey: "chat_model_agent_google",
        configData: {
          enabled: true,
          systemPrompt: "You are a helpful assistant",
          rateLimit: {
            perMinute: 10,
            perHour: 100,
            perDay: 1000,
          },
        },
        updatedBy: "admin@test.com",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockConfig]),
        }),
      });

      (db.select as any) = selectMock;

      const result = await adminQueries.getAdminConfig({
        configKey: "chat_model_agent_google",
      });

      expect(result).toEqual(mockConfig);
      expect(selectMock).toHaveBeenCalled();
    });

    it("should return null when config not found", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      (db.select as any) = selectMock;

      const result = await adminQueries.getAdminConfig({
        configKey: "nonexistent_key",
      });

      expect(result).toBeNull();
    });

    it("should throw ChatSDKError on database error", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      (db.select as any) = selectMock;

      await expect(
        adminQueries.getAdminConfig({ configKey: "test_key" })
      ).rejects.toThrow(ChatSDKError);

      // Database errors return generic message
      await expect(
        adminQueries.getAdminConfig({ configKey: "test_key" })
      ).rejects.toThrow("An error occurred while executing a database query");
    });
  });

  describe("getAllAdminConfigs", () => {
    it("should retrieve all configs ordered by configKey", async () => {
      const mockConfigs = [
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          configKey: "chat_model_agent_google",
          configData: { enabled: true },
          updatedBy: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174002",
          configKey: "provider_tools_agent_google",
          configData: { enabled: true },
          updatedBy: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockConfigs),
        }),
      });

      (db.select as any) = selectMock;

      const result = await adminQueries.getAllAdminConfigs();

      expect(result).toEqual(mockConfigs);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no configs exist", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      (db.select as any) = selectMock;

      const result = await adminQueries.getAllAdminConfigs();

      expect(result).toEqual([]);
    });

    it("should throw ChatSDKError on database error", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      (db.select as any) = selectMock;

      await expect(adminQueries.getAllAdminConfigs()).rejects.toThrow(
        ChatSDKError
      );
    });
  });

  // ============================================================================
  // Config Creation Tests
  // ============================================================================

  describe("createAdminConfig", () => {
    it("should create a new config successfully", async () => {
      const newConfig = {
        configKey: "chat_model_agent_google",
        configData: {
          enabled: true,
          systemPrompt: "You are a helpful assistant",
          rateLimit: {
            perMinute: 10,
            perHour: 100,
            perDay: 1000,
          },
        },
        updatedBy: "admin@test.com",
      };

      const createdConfig = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        ...newConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdConfig]),
        }),
      });

      (db.insert as any) = insertMock;

      const result = await adminQueries.createAdminConfig(newConfig);

      expect(result).toEqual(createdConfig);
      expect(insertMock).toHaveBeenCalled();
    });

    it("should throw error for invalid config key format", async () => {
      const invalidConfig = {
        configKey: "invalid_key",
        configData: { enabled: true },
        updatedBy: "admin",
      };

      const error = await adminQueries
        .createAdminConfig(invalidConfig)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ChatSDKError);
      expect(error.type).toBe("bad_request");
      expect(error.surface).toBe("api");
    });

    it("should throw error for invalid config data structure", async () => {
      const invalidConfig = {
        configKey: "chat_model_agent_google",
        configData: {
          // Missing required fields
          enabled: "not a boolean", // Wrong type
        },
        updatedBy: "admin",
      };

      const error = await adminQueries
        .createAdminConfig(invalidConfig)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ChatSDKError);
      expect(error.type).toBe("bad_request");
      expect(error.surface).toBe("api");
    });

    it("should create config for provider_tools_agent", async () => {
      const providerToolsConfig = {
        configKey: "provider_tools_agent_google",
        configData: {
          enabled: true,
          systemPrompt: "You are a tool-using assistant",
          rateLimit: {
            perMinute: 5,
            perHour: 50,
            perDay: 500,
          },
          tools: {
            googleSearch: {
              description: "Search the web",
              enabled: true,
            },
          },
        },
        updatedBy: "admin",
      };

      const createdConfig = {
        id: "123e4567-e89b-12d3-a456-426614174001",
        ...providerToolsConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdConfig]),
        }),
      });

      (db.insert as any) = insertMock;

      const result = await adminQueries.createAdminConfig(providerToolsConfig);

      expect(result).toEqual(createdConfig);
    });

    it("should throw ChatSDKError on database error", async () => {
      const validConfig = {
        configKey: "chat_model_agent_google",
        configData: {
          enabled: true,
          systemPrompt: "Test prompt",
          rateLimit: {
            perMinute: 10,
            perHour: 100,
            perDay: 1000,
          },
        },
        updatedBy: "admin",
      };

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      (db.insert as any) = insertMock;

      await expect(adminQueries.createAdminConfig(validConfig)).rejects.toThrow(
        ChatSDKError
      );
    });
  });

  // ============================================================================
  // Config Update Tests
  // ============================================================================

  describe("updateAdminConfig", () => {
    it("should update an existing config successfully", async () => {
      const updateData = {
        configKey: "chat_model_agent_google",
        configData: {
          enabled: false,
          systemPrompt: "Updated prompt",
          rateLimit: {
            perMinute: 20,
            perHour: 200,
            perDay: 2000,
          },
        },
        updatedBy: "admin@test.com",
      };

      const updatedConfig = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        ...updateData,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date(),
      };

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedConfig]),
          }),
        }),
      });

      (db.update as any) = updateMock;

      const result = await adminQueries.updateAdminConfig(updateData);

      expect(result).toEqual(updatedConfig);
      expect(updateMock).toHaveBeenCalled();
    });

    it("should throw error for invalid config key format", async () => {
      const invalidUpdate = {
        configKey: "invalid_format",
        configData: { enabled: true },
        updatedBy: "admin",
      };

      const error = await adminQueries
        .updateAdminConfig(invalidUpdate)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ChatSDKError);
      expect(error.type).toBe("bad_request");
      expect(error.surface).toBe("api");
    });

    it("should throw error for invalid config data structure", async () => {
      const invalidUpdate = {
        configKey: "chat_model_agent_google",
        configData: {
          enabled: true,
          systemPrompt: "", // Empty string not allowed
          rateLimit: {
            perMinute: 0, // Must be at least 1
            perHour: 100,
            perDay: 1000,
          },
        },
        updatedBy: "admin",
      };

      await expect(
        adminQueries.updateAdminConfig(invalidUpdate)
      ).rejects.toThrow(ChatSDKError);
    });

    it("should update rate limits correctly", async () => {
      const updateData = {
        configKey: "chat_model_agent_google",
        configData: {
          enabled: true,
          systemPrompt: "Test prompt",
          rateLimit: {
            perMinute: 100,
            perHour: 5000,
            perDay: 100_000,
          },
        },
        updatedBy: "admin",
      };

      const updatedConfig = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        ...updateData,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date(),
      };

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedConfig]),
          }),
        }),
      });

      (db.update as any) = updateMock;

      const result = await adminQueries.updateAdminConfig(updateData);

      expect((result.configData as any).rateLimit.perMinute).toBe(100);
      expect((result.configData as any).rateLimit.perHour).toBe(5000);
    });

    it("should throw ChatSDKError on database error", async () => {
      const validUpdate = {
        configKey: "chat_model_agent_google",
        configData: {
          enabled: true,
          systemPrompt: "Test prompt",
          rateLimit: {
            perMinute: 10,
            perHour: 100,
            perDay: 1000,
          },
        },
        updatedBy: "admin",
      };

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error("Database error")),
          }),
        }),
      });

      (db.update as any) = updateMock;

      await expect(adminQueries.updateAdminConfig(validUpdate)).rejects.toThrow(
        ChatSDKError
      );
    });
  });

  // ============================================================================
  // Config Deletion Tests
  // ============================================================================

  describe("deleteAdminConfig", () => {
    it("should delete a config successfully", async () => {
      const deletedConfig = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        configKey: "chat_model_agent_google",
        configData: { enabled: true },
        updatedBy: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([deletedConfig]),
        }),
      });

      (db.delete as any) = deleteMock;

      const result = await adminQueries.deleteAdminConfig({
        configKey: "chat_model_agent_google",
      });

      expect(result).toEqual(deletedConfig);
      expect(deleteMock).toHaveBeenCalled();
    });

    it("should throw error for invalid config key format", async () => {
      const error = await adminQueries
        .deleteAdminConfig({ configKey: "invalid_format" })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ChatSDKError);
      expect(error.type).toBe("bad_request");
      expect(error.surface).toBe("api");
    });

    it("should throw error when config not found", async () => {
      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      (db.delete as any) = deleteMock;

      const error = await adminQueries
        .deleteAdminConfig({ configKey: "chat_model_agent_google" })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ChatSDKError);
      expect(error.type).toBe("not_found");
      expect(error.surface).toBe("api");
    });

    it("should throw ChatSDKError on database error", async () => {
      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      (db.delete as any) = deleteMock;

      await expect(
        adminQueries.deleteAdminConfig({ configKey: "chat_model_agent_google" })
      ).rejects.toThrow(ChatSDKError);
    });
  });

  // ============================================================================
  // Config Summary Generation Tests
  // ============================================================================

  describe("getAdminConfigSummary", () => {
    it("should generate config summary with models successfully", async () => {
      const mockConfigs = [
        {
          id: "123",
          configKey: "chat_model_agent_google",
          configData: {
            enabled: true,
            systemPrompt: "Test prompt",
            capabilities: {
              fileInput: true,
              thinkingReasoning: true,
            },
            fileInputTypes: {
              images: { enabled: true },
              pdf: { enabled: true },
            },
            rateLimit: {
              perMinute: 10,
              perHour: 100,
              perDay: 1000,
            },
          },
          updatedBy: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockModels = [
        {
          id: "model-1",
          modelId: "gemini-2.0-flash-exp",
          name: "Gemini 2.0 Flash",
          description: "Fast model",
          provider: "google",
          isActive: true,
          isDefault: true,
          thinkingEnabled: true,
          inputPricingPerMillionTokens: "0.075",
          outputPricingPerMillionTokens: "0.30",
        },
      ];

      // Mock getAllAgentConfigs
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockConfigs),
          where: vi.fn().mockResolvedValue(mockModels),
        }),
      });

      (db.select as any) = selectMock;

      const result = await adminQueries.getAdminConfigSummary();

      expect(result).toHaveProperty("providers");
      expect(result.providers).toHaveProperty("google");
      expect(result.providers.google.enabled).toBe(true);
      expect(result.providers.google.models).toBeDefined();
    });

    it("should handle empty configs gracefully", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      (db.select as any) = selectMock;

      const result = await adminQueries.getAdminConfigSummary();

      expect(result).toHaveProperty("providers");
      expect(Object.keys(result.providers)).toHaveLength(0);
    });

    it("should include model pricing information", async () => {
      const mockConfigs = [
        {
          id: "123",
          configKey: "chat_model_agent_google",
          configData: {
            enabled: true,
            systemPrompt: "Test",
            capabilities: { fileInput: false },
            rateLimit: { perMinute: 10, perHour: 100, perDay: 1000 },
          },
          updatedBy: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockModels = [
        {
          id: "model-1",
          modelId: "gemini-2.0-flash-exp",
          name: "Gemini 2.0 Flash",
          provider: "google",
          isActive: true,
          isDefault: true,
          thinkingEnabled: false,
          inputPricingPerMillionTokens: "0.075",
          outputPricingPerMillionTokens: "0.30",
        },
      ];

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockConfigs),
          where: vi.fn().mockResolvedValue(mockModels),
        }),
      });

      (db.select as any) = selectMock;

      const result = await adminQueries.getAdminConfigSummary();

      const model = result.providers.google.models["gemini-2.0-flash-exp"];
      expect(model.pricingPerMillionTokens.input).toBe(0.075);
      expect(model.pricingPerMillionTokens.output).toBe(0.3);
    });

    it("should throw ChatSDKError on database error", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      (db.select as any) = selectMock;

      await expect(adminQueries.getAdminConfigSummary()).rejects.toThrow(
        ChatSDKError
      );
    });
  });

  // ============================================================================
  // Validation Helper Tests
  // ============================================================================

  describe("isValidAgentConfigKey", () => {
    it("should validate correct agent config keys", () => {
      expect(
        adminQueries.isValidAgentConfigKey("chat_model_agent_google")
      ).toBe(true);
      expect(
        adminQueries.isValidAgentConfigKey("provider_tools_agent_google")
      ).toBe(true);
      expect(adminQueries.isValidAgentConfigKey("document_agent_google")).toBe(
        true
      );
      expect(adminQueries.isValidAgentConfigKey("python_agent_google")).toBe(
        true
      );
      expect(adminQueries.isValidAgentConfigKey("mermaid_agent_google")).toBe(
        true
      );
      expect(adminQueries.isValidAgentConfigKey("git_mcp_agent_google")).toBe(
        true
      );
    });

    it("should validate special config keys", () => {
      expect(adminQueries.isValidAgentConfigKey("app_settings")).toBe(true);
      expect(adminQueries.isValidAgentConfigKey("logging_settings")).toBe(true);
    });

    it("should reject invalid config keys", () => {
      expect(adminQueries.isValidAgentConfigKey("invalid_key")).toBe(false);
      expect(adminQueries.isValidAgentConfigKey("chat_agent")).toBe(false);
      expect(adminQueries.isValidAgentConfigKey("agent_invalid_provider")).toBe(
        false
      );
      expect(adminQueries.isValidAgentConfigKey("")).toBe(false);
    });

    it("should validate different providers", () => {
      expect(
        adminQueries.isValidAgentConfigKey("chat_model_agent_google")
      ).toBe(true);
      expect(
        adminQueries.isValidAgentConfigKey("chat_model_agent_openai")
      ).toBe(true);
      expect(
        adminQueries.isValidAgentConfigKey("chat_model_agent_anthropic")
      ).toBe(true);
      expect(
        adminQueries.isValidAgentConfigKey("chat_model_agent_invalid_provider")
      ).toBe(false);
    });
  });

  describe("validateAgentConfigData", () => {
    it("should validate correct chat model agent config", () => {
      const validConfig = {
        enabled: true,
        systemPrompt: "You are a helpful assistant",
        rateLimit: {
          perMinute: 10,
          perHour: 100,
          perDay: 1000,
        },
      };

      const result = adminQueries.validateAgentConfigData(
        "chat_model_agent_google",
        validConfig
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject config with missing required fields", () => {
      const invalidConfig = {
        enabled: true,
        // Missing systemPrompt
        rateLimit: {
          perMinute: 10,
          perHour: 100,
          perDay: 1000,
        },
      };

      const result = adminQueries.validateAgentConfigData(
        "chat_model_agent_google",
        invalidConfig
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject config with invalid rate limits", () => {
      const invalidConfig = {
        enabled: true,
        systemPrompt: "Test",
        rateLimit: {
          perMinute: 0, // Must be at least 1
          perHour: 100,
          perDay: 1000,
        },
      };

      const result = adminQueries.validateAgentConfigData(
        "chat_model_agent_google",
        invalidConfig
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should warn about inconsistent rate limits", () => {
      const configWithWarnings = {
        enabled: true,
        systemPrompt: "Test",
        rateLimit: {
          perMinute: 100, // 100 * 60 = 6000 > 1000
          perHour: 1000,
          perDay: 10_000,
        },
      };

      const result = adminQueries.validateAgentConfigData(
        "chat_model_agent_google",
        configWithWarnings
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should validate provider_tools_agent config", () => {
      const validConfig = {
        enabled: true,
        systemPrompt: "You are a tool-using assistant",
        rateLimit: {
          perMinute: 5,
          perHour: 50,
          perDay: 500,
        },
        tools: {
          googleSearch: {
            description: "Search the web",
            enabled: true,
          },
        },
      };

      const result = adminQueries.validateAgentConfigData(
        "provider_tools_agent_google",
        validConfig
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate app_settings config", () => {
      const validConfig = {
        appName: "CodeChat",
        maintenanceMode: false,
        allowRegistration: true,
        maxUsersPerDay: 100,
      };

      const result = adminQueries.validateAgentConfigData(
        "app_settings",
        validConfig
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
