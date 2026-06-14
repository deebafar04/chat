/**
 * Canonical provider + model registry — types and re-exports.
 *
 * Data lives in chat/keys/providers.js (single source of truth).
 * This file adds TypeScript types and re-exports for Next.js app code.
 *
 * When adding or changing providers/models, edit chat/keys/providers.js.
 * Also keep in sync with lib/db/migrations/0007_seed_data_model_config.sql
 * and lib/storage/types.ts APIProvider type.
 */

import type { APIProvider } from "@/lib/storage/types";

export type ProviderModel = {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  active: boolean;
  outputs?: string[];
  supportsThinkingMode?: boolean;
  /** Exact model/version identifier sent to the provider API (e.g. Tripo's
   *  date-stamped "v3.0-20250812"). Falls back to `id` when omitted. */
  apiModel?: string;
  /** Which `task3d.modes` entry this model uses. Falls back to the model id. */
  apiMode?: string;
  /** User-facing message shown when the provider reports the account has no
   *  API credits (e.g. Tripo code 2010 / free trial not activated). */
  noCreditsHint?: string;
};

/** One submit variant within a Task3dSpec (e.g. text-to-3d vs image-to-3d). */
export type Task3dMode = {
  /** Path appended to `Task3dSpec.base` to form the submit URL. */
  submitPath: string;
  /** Request body template; string values may contain {prompt}/{model}/{image_url}. */
  body: Record<string, unknown>;
};

/** Declarative spec for a task-based 3D generation API, consumed by the generic
 *  Rust 3D runner. See providers.js header for full docs. */
export type Task3dSpec = {
  base: string;
  taskIdPath: string;
  statusValuePath: string;
  statusSuccess: string[];
  statusFailure: string[];
  errorMessagePath?: string;
  outputPath: string;
  outputKeys: string[];
  errorCodePath?: string;
  noCreditsCode?: number;
  modes: Record<string, Task3dMode>;
};

export type ProviderInfo = {
  id: APIProvider;
  name: string;
  keyPlaceholder: string;
  keyHint: string;
  getKeyUrl: string;
  tokenOnly?: boolean;
  cliOnly?: boolean;
  /** Declarative task-based 3D generation API spec (Meshy, Tripo, …). Drives the
   *  generic backend 3D runner so no provider endpoints/parsing are hardcoded. */
  task3d?: Task3dSpec;
  models: ProviderModel[];
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const PROVIDERS: ProviderInfo[] = require("../keys/providers.js") as ProviderInfo[];

export const PROVIDER_MAP: Record<string, ProviderInfo> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p])
);
