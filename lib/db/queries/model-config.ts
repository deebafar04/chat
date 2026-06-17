import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { ChatSDKError } from "../../errors";
import type { ModelConfig as DBModelConfig } from "../drizzle-schema";
import { modelConfig } from "../drizzle-schema";
import { getDb } from "./base";

// Type for model configuration (matches database schema)
export type ModelConfig = {
  id: string;
  modelId: string;
  name: string;
  description?: string;
  provider: "google" | "openai" | "anthropic";
  isActive?: boolean;
  isDefault?: boolean;
  thinkingEnabled?: boolean;
  inputPricingPerMillionTokens: string;
  outputPricingPerMillionTokens: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
};

// Get all models
export async function getAllModels(): Promise<DBModelConfig[]> {
  try {
    const result = await db
      .select()
      .from(modelConfig)
      .orderBy(
        desc(modelConfig.isDefault),
        modelConfig.provider,
        modelConfig.modelId
      );

    return result as DBModelConfig[];
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get all models");
  }
}

// Get models by provider
export async function getModelsByProvider(
  provider: string
): Promise<DBModelConfig[]> {
  try {
    const result = await db
      .select()
      .from(modelConfig)
      .where(eq(modelConfig.provider, provider))
      .orderBy(desc(modelConfig.isDefault), modelConfig.modelId);

    return result as DBModelConfig[];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to get models for provider: ${provider}`
    );
  }
}

// Get active models by provider
export async function getActiveModelsByProvider(
  provider: string
): Promise<DBModelConfig[]> {
  try {
    const result = await db
      .select()
      .from(modelConfig)
      .where(
        and(eq(modelConfig.provider, provider), eq(modelConfig.isActive, true))
      )
      .orderBy(desc(modelConfig.isDefault), modelConfig.modelId);

    return result as DBModelConfig[];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to get active models for provider: ${provider}`
    );
  }
}

// Get a specific model by modelId
export async function getModelByModelId(
  modelId: string
): Promise<DBModelConfig | null> {
  try {
    const [result] = await db
      .select()
      .from(modelConfig)
      .where(eq(modelConfig.modelId, modelId))
      .limit(1);

    return (result as DBModelConfig) || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to get model: ${modelId}`
    );
  }
}

// Get default model for a provider
export async function getDefaultModelForProvider(
  provider: string
): Promise<DBModelConfig | null> {
  try {
    const [result] = await db
      .select()
      .from(modelConfig)
      .where(
        and(eq(modelConfig.provider, provider), eq(modelConfig.isDefault, true))
      )
      .limit(1);

    return (result as DBModelConfig) || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to get default model for provider: ${provider}`
    );
  }
}

// Create a new model
export async function createModel(
  data: Omit<ModelConfig, "id" | "createdAt" | "updatedAt">
): Promise<DBModelConfig> {
  try {
    // If this model is being set as default, unset other defaults for the same provider
    if (data.isDefault) {
      await db
        .update(modelConfig)
        .set({ isDefault: false })
        .where(
          and(
            eq(modelConfig.provider, data.provider),
            eq(modelConfig.isDefault, true)
          )
        );
    }

    const [created] = await db
      .insert(modelConfig)
      .values({
        modelId: data.modelId,
        name: data.name,
        description: data.description,
        provider: data.provider,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        thinkingEnabled: data.thinkingEnabled ?? true,
        inputPricingPerMillionTokens: data.inputPricingPerMillionTokens,
        outputPricingPerMillionTokens: data.outputPricingPerMillionTokens,
        metadata: data.metadata || {},
      })
      .returning();

    return created as DBModelConfig;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create model");
  }
}

// Update a model
export async function updateModel(
  modelId: string,
  data: Partial<Omit<ModelConfig, "id" | "modelId" | "createdAt" | "updatedAt">>
): Promise<DBModelConfig> {
  try {
    // Get the current model to check its provider
    const currentModel = await getModelByModelId(modelId);
    if (!currentModel) {
      throw new ChatSDKError("not_found:api", `Model ${modelId} not found`);
    }

    // If setting this model as default, unset other defaults for the same provider
    if (data.isDefault === true) {
      await db
        .update(modelConfig)
        .set({ isDefault: false })
        .where(
          and(
            eq(modelConfig.provider, currentModel.provider),
            eq(modelConfig.isDefault, true)
          )
        );
    }

    const [updated] = await db
      .update(modelConfig)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(modelConfig.modelId, modelId))
      .returning();

    if (!updated) {
      throw new ChatSDKError("not_found:api", `Model ${modelId} not found`);
    }

    return updated as DBModelConfig;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to update model: ${modelId}`
    );
  }
}

// Delete a model
export async function deleteModel(modelId: string): Promise<DBModelConfig> {
  try {
    const [deleted] = await db
      .delete(modelConfig)
      .where(eq(modelConfig.modelId, modelId))
      .returning();

    if (!deleted) {
      throw new ChatSDKError("not_found:api", `Model ${modelId} not found`);
    }

    return deleted as DBModelConfig;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to delete model: ${modelId}`
    );
  }
}

// Toggle model active status
export async function toggleModelStatus(
  modelId: string,
  isActive: boolean
): Promise<DBModelConfig> {
  return await updateModel(modelId, { isActive });
}

// Set model as default for its provider
export async function setModelAsDefault(
  modelId: string
): Promise<DBModelConfig> {
  return await updateModel(modelId, { isDefault: true });
}

// Legacy function name for backward compatibility
export async function setModelAsPrimary(
  modelId: string
): Promise<DBModelConfig> {
  return await setModelAsDefault(modelId);
}

// Get model statistics by provider
export async function getModelStatsByProvider(): Promise<
  Record<string, { total: number; active: number; default: string | null }>
> {
  try {
    const allModels = await getAllModels();
    const stats: Record<
      string,
      { total: number; active: number; default: string | null }
    > = {};

    for (const model of allModels) {
      if (!stats[model.provider]) {
        stats[model.provider] = {
          total: 0,
          active: 0,
          default: null,
        };
      }

      stats[model.provider].total++;
      if (model.isActive) {
        stats[model.provider].active++;
      }
      if (model.isDefault) {
        stats[model.provider].default = model.modelId;
      }
    }

    return stats;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get model statistics"
    );
  }
}

// LEGACY COMPATIBILITY FUNCTIONS
// These functions maintain backward compatibility with the old admin_config-based system

export type AgentModelConfig = {
  configKey: string;
  modelConfig: Array<{
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
    pricingPerMillionTokens: {
      input: number;
      output: number;
    };
    enabled: boolean;
  }>;
};

// Get model config for a specific agent (legacy function)
export async function getAgentModelConfig(
  configKey: string
): Promise<AgentModelConfig | null> {
  try {
    // Extract provider from configKey (e.g., "chat_model_agent_google" -> "google")
    const parts = configKey.split("_");
    const provider = parts.at(-1);

    if (!provider || !["google", "openai", "anthropic"].includes(provider)) {
      throw new Error(`Invalid provider extracted from configKey: ${provider}`);
    }

    // Get models from model_config table
    const models = await getModelsByProvider(provider);

    // Transform to legacy format
    const modelConfig = models.map((model) => ({
      id: model.modelId,
      name: model.name,
      description: model.description || "",
      isDefault: model.isDefault || false,
      pricingPerMillionTokens: {
        input: Number.parseFloat(model.inputPricingPerMillionTokens),
        output: Number.parseFloat(model.outputPricingPerMillionTokens),
      },
      enabled: model.isActive || false,
    }));

    return {
      configKey,
      modelConfig,
    };
  } catch (error) {
    console.error("Error fetching agent model config:", error);
    throw error;
  }
}

// Update model config for a specific agent (legacy function)
export async function updateAgentModelConfig(
  configKey: string,
  models: Array<{
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
    pricingPerMillionTokens: {
      input: number;
      output: number;
    };
    enabled: boolean;
  }>
): Promise<AgentModelConfig> {
  try {
    // Extract provider from configKey
    const parts = configKey.split("_");
    const _provider = parts.at(-1) as "google" | "openai" | "anthropic";

    // Update each model in the model_config table
    for (const model of models) {
      await updateModel(model.id, {
        name: model.name,
        description: model.description,
        isDefault: model.isDefault,
        isActive: model.enabled,
        inputPricingPerMillionTokens:
          model.pricingPerMillionTokens.input.toString(),
        outputPricingPerMillionTokens:
          model.pricingPerMillionTokens.output.toString(),
      });
    }

    return {
      configKey,
      modelConfig: models,
    };
  } catch (error) {
    console.error("Error updating agent model config:", error);
    throw error;
  }
}

// Add a new model to an agent's config (legacy function)
export async function addModelToAgent(
  configKey: string,
  newModel: {
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
    pricingPerMillionTokens: {
      input: number;
      output: number;
    };
    enabled: boolean;
  }
): Promise<AgentModelConfig> {
  try {
    // Extract provider from configKey
    const parts = configKey.split("_");
    const provider = parts.at(-1) as "google" | "openai" | "anthropic";

    // Create the model in model_config table
    await createModel({
      modelId: newModel.id,
      name: newModel.name,
      description: newModel.description,
      provider,
      isActive: newModel.enabled,
      isDefault: newModel.isDefault,
      inputPricingPerMillionTokens:
        newModel.pricingPerMillionTokens.input.toString(),
      outputPricingPerMillionTokens:
        newModel.pricingPerMillionTokens.output.toString(),
    });

    return (await getAgentModelConfig(configKey)) as AgentModelConfig;
  } catch (error) {
    console.error("Error adding model to agent:", error);
    throw error;
  }
}

// Update a specific model in an agent's config (legacy function)
export async function updateModelInAgent(
  configKey: string,
  modelId: string,
  updatedModel: Partial<{
    name: string;
    description: string;
    isDefault: boolean;
    pricingPerMillionTokens: {
      input: number;
      output: number;
    };
    enabled: boolean;
  }>
): Promise<AgentModelConfig> {
  try {
    const updateData: Partial<
      Omit<ModelConfig, "id" | "modelId" | "createdAt" | "updatedAt">
    > = {};

    if (updatedModel.name !== undefined) {
      updateData.name = updatedModel.name;
    }
    if (updatedModel.description !== undefined) {
      updateData.description = updatedModel.description;
    }
    if (updatedModel.isDefault !== undefined) {
      updateData.isDefault = updatedModel.isDefault;
    }
    if (updatedModel.enabled !== undefined) {
      updateData.isActive = updatedModel.enabled;
    }
    if (updatedModel.pricingPerMillionTokens) {
      updateData.inputPricingPerMillionTokens =
        updatedModel.pricingPerMillionTokens.input.toString();
      updateData.outputPricingPerMillionTokens =
        updatedModel.pricingPerMillionTokens.output.toString();
    }

    await updateModel(modelId, updateData);

    return (await getAgentModelConfig(configKey)) as AgentModelConfig;
  } catch (error) {
    console.error("Error updating model in agent:", error);
    throw error;
  }
}

// Delete a model from an agent's config (legacy function)
export async function deleteModelFromAgent(
  configKey: string,
  modelId: string
): Promise<AgentModelConfig> {
  try {
    await deleteModel(modelId);

    return (await getAgentModelConfig(configKey)) as AgentModelConfig;
  } catch (error) {
    console.error("Error deleting model from agent:", error);
    throw error;
  }
}
