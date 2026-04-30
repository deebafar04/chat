import type { User } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/auth/server";
import { getAdminConfigSummary } from "@/lib/db/queries/admin";
import {
  FALLBACK_ADMIN_CONFIG_SUMMARY,
  FALLBACK_DB_OFFLINE_STATUS,
  FALLBACK_DB_OFFLINE_STATUS_LOCALHOST,
} from "@/lib/ai/fallback-config";
import { ErrorCategory, ErrorSeverity, logApiError } from "@/lib/errors/logger";

// GET /api/models/capabilities - Public model capabilities for authenticated users
export async function GET(request: Request) {
  let user: User | undefined;

  try {
    const authResult = await requireAuth();
    user = authResult.user;
  } catch (error) {
    // Auth uses Supabase too — if it's unreachable we still want the dropdown
    // populated with fallback models so the user can chat without persistence.
    await logApiError(
      ErrorCategory.UNAUTHORIZED_ACCESS,
      `Model capabilities auth failed (continuing with fallback): ${error instanceof Error ? error.message : "Unknown auth error"}`,
      { request: { method: "GET", url: request.url } },
      ErrorSeverity.WARNING
    );
  }

  try {
    const capabilities = await getAdminConfigSummary();

    return Response.json(
      { capabilities, dbStatus: { ok: true } },
      {
        status: 200,
        headers: {
          "X-API-Version": "1.0",
        },
      }
    );
  } catch (error) {
    await logApiError(
      ErrorCategory.DATABASE_ERROR,
      `Failed to retrieve model capabilities: ${error instanceof Error ? error.message : "Unknown database error"}`,
      {
        request: {
          method: "GET",
          url: request.url,
        },
        user,
      },
      ErrorSeverity.ERROR
    );

    const hostname = new URL(request.url).hostname;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    return Response.json(
      {
        capabilities: FALLBACK_ADMIN_CONFIG_SUMMARY,
        dbStatus: isLocalhost
          ? FALLBACK_DB_OFFLINE_STATUS_LOCALHOST
          : FALLBACK_DB_OFFLINE_STATUS,
      },
      { status: 200 }
    );
  }
}
