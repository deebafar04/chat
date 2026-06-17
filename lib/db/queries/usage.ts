import "server-only";

import { and, asc, count, desc, eq, gte, lt } from "drizzle-orm";
import { ChatSDKError } from "../../errors";
import { rateLimitTracking, usageLogs } from "../drizzle-schema";
import { getDb } from "./base";

// =====================================================
// USAGE LOGS QUERIES
// =====================================================

export async function createUsageLog({
  userId,
  chatId,
  agentType,
  modelUsed,
  provider,
  inputTokens,
  outputTokens,
  totalTokens,
  inputCost,
  outputCost,
  totalCost,
  responseTimestamp,
  durationMs,
  metadata,
}: {
  userId: string;
  chatId?: string;
  agentType: string;
  modelUsed?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCost?: string;
  outputCost?: string;
  totalCost?: string;
  responseTimestamp?: Date;
  durationMs?: number;
  metadata?: Record<string, any>;
}) {
  try {
    const [created] = await db
      .insert(usageLogs)
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        chat_id: chatId,
        agentType,
        modelUsed,
        provider,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        requestTimestamp: new Date(),
        responseTimestamp,
        durationMs,
        metadata,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create usage log"
    );
  }
}

export async function getUsageLogsByUserId({
  userId,
  limit = 100,
  offset = 0,
}: {
  userId: string;
  limit?: number;
  offset?: number;
}) {
  try {
    return await db
      .select()
      .from(usageLogs)
      .where(eq(usageLogs.user_id, userId))
      .orderBy(desc(usageLogs.requestTimestamp))
      .limit(limit)
      .offset(offset);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get usage logs by user id"
    );
  }
}

export async function getUsageLogsByChatId({ chatId }: { chatId: string }) {
  try {
    return await db
      .select()
      .from(usageLogs)
      .where(eq(usageLogs.chat_id, chatId))
      .orderBy(asc(usageLogs.requestTimestamp));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get usage logs by chat id"
    );
  }
}

export async function getUsageLogsByDateRange({
  userId,
  startDate,
  endDate,
}: {
  userId?: string;
  startDate: Date;
  endDate: Date;
}) {
  try {
    const conditions = [
      gte(usageLogs.requestTimestamp, startDate),
      lt(usageLogs.requestTimestamp, endDate),
    ];

    if (userId) {
      conditions.push(eq(usageLogs.user_id, userId));
    }

    return await db
      .select()
      .from(usageLogs)
      .where(and(...conditions))
      .orderBy(desc(usageLogs.requestTimestamp));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get usage logs by date range"
    );
  }
}

export async function getUsageSummary({
  userId,
  startDate,
  endDate,
}: {
  userId?: string;
  startDate: Date;
  endDate: Date;
}) {
  try {
    const conditions = [
      gte(usageLogs.requestTimestamp, startDate),
      lt(usageLogs.requestTimestamp, endDate),
    ];

    if (userId) {
      conditions.push(eq(usageLogs.user_id, userId));
    }

    const [summary] = await db
      .select({
        totalCalls: count(usageLogs.id),
        totalInputTokens: usageLogs.inputTokens,
        totalOutputTokens: usageLogs.outputTokens,
        totalTokens: usageLogs.totalTokens,
        totalCost: usageLogs.totalCost,
      })
      .from(usageLogs)
      .where(and(...conditions));

    return summary;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get usage summary"
    );
  }
}

// =====================================================
// RATE LIMIT TRACKING QUERIES
// =====================================================

export async function checkRateLimit({
  userId,
  agentType,
  limitType,
  limitValue,
}: {
  userId: string;
  agentType: string;
  limitType: "hourly" | "daily";
  limitValue: number;
}) {
  try {
    const now = new Date();
    const periodStart = new Date(
      limitType === "hourly"
        ? now.getTime() - 60 * 60 * 1000
        : now.getTime() - 24 * 60 * 60 * 1000
    );

    const [record] = await db
      .select()
      .from(rateLimitTracking)
      .where(
        and(
          eq(rateLimitTracking.user_id, userId),
          eq(rateLimitTracking.agentType, agentType),
          gte(rateLimitTracking.periodStart, periodStart)
        )
      )
      .orderBy(desc(rateLimitTracking.periodStart))
      .limit(1);

    if (!record) {
      return { allowed: true, remaining: limitValue, resetAt: null };
    }

    const currentCount = record.requestCount || 0;
    const allowed = currentCount < limitValue;
    const remaining = Math.max(0, limitValue - currentCount);

    return {
      allowed,
      remaining,
      resetAt: record.periodEnd,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to check rate limit"
    );
  }
}

export async function incrementRateLimit({
  userId,
  agentType,
  limitType,
  limitValue,
}: {
  userId: string;
  agentType: string;
  limitType: "hourly" | "daily";
  limitValue: number;
}) {
  try {
    const now = new Date();
    const periodStart = new Date(
      limitType === "hourly"
        ? now.getTime() - 60 * 60 * 1000
        : now.getTime() - 24 * 60 * 60 * 1000
    );
    const periodEnd = new Date(
      limitType === "hourly"
        ? now.getTime() + 60 * 60 * 1000
        : now.getTime() + 24 * 60 * 60 * 1000
    );

    // Check if a record exists for this period
    const [existing] = await db
      .select()
      .from(rateLimitTracking)
      .where(
        and(
          eq(rateLimitTracking.user_id, userId),
          eq(rateLimitTracking.agentType, agentType),
          gte(rateLimitTracking.periodStart, periodStart)
        )
      )
      .orderBy(desc(rateLimitTracking.periodStart))
      .limit(1);

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(rateLimitTracking)
        .set({
          requestCount: (existing.requestCount || 0) + 1,
        })
        .where(eq(rateLimitTracking.id, existing.id))
        .returning();
      return updated;
    }

    // Create new record
    const [created] = await db
      .insert(rateLimitTracking)
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        agentType,
        periodStart: now,
        periodEnd,
        requestCount: 1,
        limitType,
        limitValue,
        createdAt: now,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to increment rate limit"
    );
  }
}

export async function resetRateLimitForUser({
  userId,
  agentType,
}: {
  userId: string;
  agentType?: string;
}) {
  try {
    const conditions = [eq(rateLimitTracking.user_id, userId)];

    if (agentType) {
      conditions.push(eq(rateLimitTracking.agentType, agentType));
    }

    return await db
      .delete(rateLimitTracking)
      .where(and(...conditions))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to reset rate limit"
    );
  }
}
